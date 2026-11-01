import { loadSource } from '../helpers/source-loader.mjs'
import assert from 'node:assert/strict'

import test from 'node:test'



const root = new URL('../../src/', import.meta.url)
const jsx = (type, props) => ({ type, props })
function load(file, imports = {}, globals = {}) { return loadSource(new URL(file, root), { 'react/jsx-runtime': { jsx: jsx, jsxs: jsx, Fragment: 'Fragment' }, ...imports }, globals); }
const types = load('features/auth/model/auth-types.ts')

test('web login admits admins, managers and booking agents, including mixed-role accounts', () => {
  const allowed = ['ADMIN', 'CRUISE_MANAGER', 'SHIP_MANAGER', 'OPERATIONS_MANAGER', 'ACTIVITY_SERVICE_MANAGER', 'BOOKING_AGENT','CHECKIN_STAFF','ONBOARD_STAFF','FINANCE_OFFICER','CUSTOMER_SERVICE']
  for (const role of types.AUTH_ROLES) assert.equal(types.canSignIn({ roles: [role] }), allowed.includes(role), role)
  assert.equal(types.canSignIn({ roles: ['PASSENGER', 'SHIP_MANAGER'] }), true)
  assert.equal(types.canSignIn(null), false)
})

test('passenger login never publishes a token and old passenger sessions are removed on restore', async () => {
  let token = null
  const store = new Map()
  const session = { accessToken: 'fixture-only', expiresAt: Date.now() + 60000, refreshAt: Date.now() + 30000, user: { id: 'guest', username: 'guest', roles: ['PASSENGER'] } }
  const { authSession } = load('features/auth/model/auth-session.ts', {
    './auth-types': types,
    '@/shared/api': { setApiAccessToken: value => { token = value }, subscribeApiUnauthorized: () => () => {} },
    '../api/auth-api': { authApi: { login: async () => session } },
  }, {
    sessionStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    setTimeout: () => 1, clearTimeout() {}, document: { addEventListener() {}, removeEventListener() {} }, window: { addEventListener() {}, removeEventListener() {} },
  })
  await assert.rejects(authSession.login('guest', 'fixture-only'), /Hành khách có thể đặt chỗ/)
  assert.equal(token, null)
  assert.equal(store.size, 0)
  store.set('aurora.auth.session.v1', JSON.stringify(session))
  const stop = authSession.start()
  assert.equal(authSession.getSnapshot().status, 'anonymous')
  assert.equal(token, null)
  assert.equal(store.size, 0)
  stop()
})

test('booking agent sign-in persists and restores a valid session without changing its role', async () => {
  let token = null
  const store = new Map()
  const user = { id: 'agent', username: 'test_booking_agent', roles: ['BOOKING_AGENT'] }
  const session = { accessToken: 'fixture-only', expiresAt: Date.now() + 60000, refreshAt: Date.now() + 30000, user }
  const { authSession } = load('features/auth/model/auth-session.ts', {
    './auth-types': types,
    '@/shared/api': { setApiAccessToken: value => { token = value }, subscribeApiUnauthorized: () => () => {} },
    '../api/auth-api': { authApi: { login: async () => session } },
  }, {
    sessionStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    setTimeout: () => 1, clearTimeout() {}, document: { addEventListener() {}, removeEventListener() {} }, window: { addEventListener() {}, removeEventListener() {} },
  })
  assert.equal(await authSession.login(user.username, 'fixture-only'), user)
  assert.equal(authSession.getSnapshot().status, 'authenticated')
  assert.equal(token, 'fixture-only')
  assert.ok(store.has('aurora.auth.session.v1'))
  const stop = authSession.start()
  assert.equal(authSession.getSnapshot().session.user.roles.join(','), 'BOOKING_AGENT')
  assert.equal(authSession.getSnapshot().status, 'authenticated')
  stop()
})

test('expired management sessions do not interrupt public guest booking', () => {
  let pathname = '/booking/review'
  const { SessionBoundary } = load('features/auth/guards.tsx', {
    react: {}, '@/shared/auth': {}, '@/shared/ui': {}, '@/shared/ui/admin-v3': {},
    './useAuth': { useAuth: () => ({ status: 'expired' }) }, './model/auth-types': types,
    'react-router': { Navigate: 'Navigate', Outlet: 'Outlet', useLocation: () => ({ pathname, search: '', hash: '' }) },
  })
  assert.equal(SessionBoundary().type, 'Outlet')
  pathname = '/admin/bookings'
  const redirect = SessionBoundary()
  assert.equal(redirect.type, 'Navigate')
  assert.match(redirect.props.to, /^\/login\?reason=expired/)
})

test('admin, managers and booking agents return to their own area even from old passenger login links', () => {
  const navigation = load('shared/ui/admin-v3/admin-navigation.ts')
  for (const role of ['ADMIN', 'CRUISE_MANAGER', 'SHIP_MANAGER', 'OPERATIONS_MANAGER', 'ACTIVITY_SERVICE_MANAGER', 'BOOKING_AGENT']) {
    const { LoginPage } = load('features/auth/pages/LoginPage.tsx', {
      '@/shared/ui':{Button:'Button',Loading:'Loading',Notice:'Notice'},'@/shared/ui/admin-v3': navigation,
      '@/shared/auth':{useSessionAccess:()=>({status:'ready',roles:[role],permissions:navigation.backendRolePermissions[role]})},
      react: { useEffect() {}, useState: value => [value] },
      '../model/auth-session': { authSession: {} },
      'react-router': { Navigate: 'Navigate', useNavigate: () => () => {}, useSearchParams: () => [new URLSearchParams('returnTo=/my-bookings')] },
      '../components/AuthPageShell': {}, '../components/LoginForm': {}, '../model/auth-types': types,
      '../useAuth': { useAuth: () => ({ status: 'authenticated', user: { roles: [role] } }) },
    })
    const redirect = LoginPage()
    assert.equal(redirect.type, 'Navigate')
    assert.equal(redirect.props.to, navigation.staffRoleHome([role],{status:'ready',roles:[role],permissions:navigation.backendRolePermissions[role]}))
    assert.match(redirect.props.to, /^\/admin/)
  }
})
