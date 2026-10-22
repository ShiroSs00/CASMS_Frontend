import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = new URL('../../src/', import.meta.url)
const jsx = (type, props) => ({ type, props })
function load(file, imports, globals = {}) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, Date, Error, ...globals, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    assert.ok(Object.hasOwn(imports, id), 'Unexpected import: ' + id)
    return imports[id]
  } })
  return module.exports
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...nodes(tree.props?.children)]
}
function hooks() {
  const values = []; let cursor = 0
  return {
    reset() { cursor = 0 },
    useCallback: fn => fn,
    useState(initial) {
      const index = cursor++
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial
      return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value }]
    },
    useRef(initial) { const index = cursor++; return values[index] ??= { current: initial } },
  }
}
class ApiError extends Error { constructor(status) { super('HTTP ' + status); this.status = status } }
const mutation = load('features/booking/model/booking-mutation.ts', { '@/shared/api': { ApiError } })
const context = load('domain/booking-context/booking-context-api.ts', { '@/shared/api': {} })
const model = load('features/booking/api/real-booking-api.ts', { '@/shared/api': {}, '@/domain/booking-context': context })

test('Booking validation rejects invalid dates and grouped overcapacity and keeps step one independent of passenger details', () => {
  const draft = { cruiseId: 'cr', currency: 'USD', paymentPlan: 'DEPOSIT', notes: '', passengers: [{ fullName: '', dateOfBirth: '', nationality: '', documentType: '', documentNumber: '', email: '', phoneNumber: '', cabinId: 'c', tourPackageId: '' }] }
  const cruise = { cruiseId: 'cr', status: 'PUBLISHED', shipId: 's', departureDatetime: '2099-01-01T00:00:00Z' }
  const cabins = [{ cabinId: 'c', cabinNumber: '101', capacity: 2, remainingCapacity: 1 }]
  assert.equal(Object.keys(model.bookingFieldErrors(draft, cruise, cabins, Date.now(), 1)).length, 0)
  assert.ok(model.bookingFieldErrors(draft, cruise, cabins)['person-0-fullName'])
  assert.ok(model.bookingFieldErrors({ ...draft, passengers: [...draft.passengers, draft.passengers[0]] }, cruise, cabins)['person-1-cabinId'])
  for (const dateOfBirth of ['2020-02-31', '2099-01-01', 'invalid']) assert.ok(model.bookingFieldErrors({ ...draft, passengers: [{ ...draft.passengers[0], dateOfBirth }] }, cruise, cabins)['person-0-dateOfBirth'])
  assert.ok(model.bookingFieldErrors(draft, { ...cruise, departureDatetime: 'invalid' }, cabins)['real-booking-cruise'])
  for (const error of [new Error('Malformed response'), new ApiError(200), new ApiError(0), new ApiError(408), new ApiError(500), new ApiError(503)]) assert.equal(mutation.bookingMutationFailure(error).uncertain, true)
  for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(mutation.bookingMutationFailure(new ApiError(status)).uncertain, false)
})
const flush = () => new Promise(resolve => setImmediate(resolve))

test('Booking decoder rejects malformed financial responses instead of rendering success', () => {
  const value = { bookingId: 'b', bookingReference: 'BK-QA', bookingStatus: 'Draft', cruiseId: 'cr', cruiseName: 'QA', passengers: [], agreedFareAmount: 100, requiredDepositAmount: 30, currency: 'USD', paymentPlan: 'DEPOSIT', installments: [] }
  assert.equal(model.decodeBookingDetail(value).bookingReference, 'BK-QA')
  for (const change of [{ installments: [null] }, { installments: [{ sequenceNo: 1, requiredAmount: 'invalid' }] }, { paymentPlan: 'PAID' }, { contractSigningInstructions: {} }, { currency: 'invalid' }, { agreedFareAmount: -1 }, { departureDatetime: 'invalid' }]) assert.throws(() => model.decodeBookingDetail({ ...value, ...change }))
})

test('catalog return accepts only local cruise-list paths', () => {
  const { catalogReturn } = load('features/booking/model/live-booking-navigation.ts', {})
  assert.equal(catalogReturn('/cruises?cruiseType=MULTI_DAYS&page=2'), '/cruises?cruiseType=MULTI_DAYS&page=2')
  for (const path of ['https://example.test', '//example.test', '/admin', '/cruises/booking', '/cruises?x=\\evil']) assert.equal(catalogReturn(path), '/cruises')
})

test('Admin logout calls existing auth action once and replaces navigation after completion', async () => {
  const react = hooks(), navigations = []; let resolve, calls = 0
  const { AdminAccountActions } = load('features/auth/components/AdminAccountActions.tsx', {
    react,
    'react-router': { useNavigate: () => (to, options) => navigations.push({ to, options }) },
    '../useAuth': { useAuth: () => ({ user: { username: 'Operator QA' }, logout: () => { calls++; return new Promise(yes => { resolve = yes }) } }) },
  })
  const render = () => { react.reset(); return nodes(AdminAccountActions()) }
  const button = render().find(node => node.type === 'button')
  button.props.onClick(); button.props.onClick()
  assert.equal(calls, 1); assert.equal(render().find(node => node.type === 'button').props.disabled, true)
  assert.equal(navigations.length, 0)
  resolve(); await flush()
  assert.equal(navigations[0].to, '/login'); assert.equal(navigations[0].options.replace, true)
})

test('existing logout clears token and persisted session even when the server request fails', async () => {
  let token = null, logoutCalls = 0; const store = new Map()
  const session = { accessToken: 'test-token', expiresAt: Date.now() + 60000, refreshAt: Date.now() + 30000, user: { id: 'u', username: 'QA', roles: ['ADMIN'] } }
  const { authSession } = load('features/auth/model/auth-session.ts', {
    '@/shared/api': { setApiAccessToken: value => { token = value }, subscribeApiUnauthorized: () => () => {} },
    '../api/auth-api': { authApi: { login: async () => session, logout: async () => { logoutCalls++; throw new Error('Offline') } } },
    './auth-types': { AUTH_ROLES: ['ADMIN'], canSignIn: user => user.roles.includes('ADMIN') },
  }, { sessionStorage: { setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }, setTimeout: () => 1, clearTimeout() {} })
  await authSession.login('QA', 'test-only'); assert.equal(token, 'test-token')
  const first = authSession.logout(), second = authSession.logout()
  assert.equal(first, second); await first
  assert.equal(logoutCalls, 1); assert.equal(token, null); assert.equal(store.size, 0)
  assert.equal(authSession.getSnapshot().status, 'anonymous')
})
