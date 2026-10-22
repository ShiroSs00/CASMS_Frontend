import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const root = new URL('../../src/features/', import.meta.url)
const jsx = (type, props) => ({ type, props })
function load(file, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText, { module, exports: module.exports, AbortController, Date, Intl, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    assert.ok(Object.hasOwn(imports, id), id); return imports[id]
  } }); return module.exports
}
test('OIM edit serializes only mutable severity/description, never relocates issue or changes reporter', async () => {
  let request
  const { operationalIssuesApi } = load('operational-issues/api/operational-issues-api.ts', { '@/shared/api': { apiRequest: async (url, options) => { request = { url, options }; return { issueId: 'i', shipId: 's', issueCode: 'ISS', description: 'Saved' } } } })
  await operationalIssuesApi.update('i/1', { shipId: 'forged', cruiseId: 'other', cabinId: 'other', issueType: 'SAFETY', reportedById: 'forged', severity: 'HIGH', description: ' Saved ' })
  assert.equal(request.url, '/operational-issues/i%2F1'); assert.equal(request.options.method, 'PUT')
  assert.deepEqual(JSON.parse(JSON.stringify(request.options.body)), { severity: 'HIGH', description: 'Saved' })
})
test('OIM location selectors paginate and block unavailable/mismatched Ship, Cruise and Cabin context', async () => {
  const calls = []
  const { issueLocationApi, validateIssueLocation } = load('operational-issues/api/location-lookup-api.ts', { '@/shared/api': { apiRequest: async (url, options) => { calls.push([url, options.query.page]); return { totalPages: 2, content: [{ shipId: 's' + options.query.page, shipCode: 'QA', shipName: 'Tàu QA' }] } } } })
  const ships = await issueLocationApi.ships(); assert.equal(ships.length, 2); assert.equal(calls.length, 2)
  const context = { ships, cruises: [{ cruiseId: 'c', shipId: 's0' }], cabins: [{ cabinId: 'room', shipId: 's0' }] }
  assert.equal(validateIssueLocation('s0', 'c', 'room', context), '')
  assert.ok(validateIssueLocation('s0', '', '', null))
  assert.ok(validateIssueLocation('typed-id', '', '', context))
  assert.ok(validateIssueLocation('s1', 'c', '', context)); assert.ok(validateIssueLocation('s1', '', 'room', context))
  const broken = load('operational-issues/api/location-lookup-api.ts', { '@/shared/api': { apiRequest: async () => ({ content: null, totalPages: 1 }) } })
  await assert.rejects(broken.issueLocationApi.ships(), /không đầy đủ/)
})
test('OIM lifecycle preserves resolution/verification distinction and exact controller permissions', () => {
  const { getIssueActionAvailability, issueActionPermissions } = load('operational-issues/model/issue-actions.ts')
  const open = getIssueActionAvailability({ status: 'OPEN', assignedTo: null })
  assert.equal(open.START_HANDLING.enabled, false)
  const inProgress = getIssueActionAvailability({ status: 'IN_PROGRESS', resolution: null })
  assert.equal(inProgress.RECORD_RESOLUTION.enabled, true); assert.equal(inProgress.VERIFY_RESOLUTION.enabled, false)
  const resolved = getIssueActionAvailability({ status: 'RESOLVED', resolution: 'Fixed', resolvedBy: {}, resolvedAt: 'today', verifiedAt: null })
  assert.equal(resolved.CLOSE.enabled, false)
  assert.equal(issueActionPermissions.START_HANDLING, 'OPERATIONAL_ISSUE_UPDATE')
  assert.equal(issueActionPermissions.VERIFY_RESOLUTION, 'OPERATIONAL_ISSUE_RESOLVE')
})
test('OIM action hook cannot issue any mutation without the exact granted permission', async () => {
  let writes = 0
  const rules = load('operational-issues/model/issue-actions.ts')
  const { useIssueActions } = load('operational-issues/hooks/useIssueActions.ts', {
    react: { useState: value => [value, () => {}], useRef: current => ({ current }) }, '@/shared/auth': { useSessionAccess: () => ({ has: () => false }) },
    '../api/operational-issues-api': { operationalIssuesApi: new Proxy({}, { get: () => () => { writes++; return Promise.resolve() } }) }, '../model/issue-actions': rules,
  })
  const actions = useIssueActions('i', () => {})
  for (const [method, value] of [['assign', 'u'], ['start'], ['recordResolution', 'Fix'], ['verifyResolution'], ['close'], ['reopen']]) assert.equal(await actions[method](value), false)
  assert.equal(writes, 0)
})
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.footer)] : [] }
const flush = () => new Promise(setImmediate)
test('Regulation candidate selection is read-only; explicit precheck and positive result are required before assignment', async () => {
  let index = 0, prechecks = 0, assignments = 0
  const state = [], refs = []
  const snapshot = { host: { id: 'ship1', name: 'Tàu QA' }, direct: [], inherited: [] }
  const candidate = { regulation: { id: 'r1', code: 'R1', name: 'Safety', type: 'CAPACITY', scope: 'SHIP', status: 'ACTIVE', value: 10 }, capabilities: { canAssign: { allowed: true } } }
  const hooks = { useEffect() {}, useCallback: fn => fn, useMemo: fn => fn(), useState(initial) { const i = index++; if (!(i in state)) state[i] = i === 0 ? snapshot : initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] }, useRef(current) { const i = index++; return refs[i] ??= { current } } }
  const exports = load('regulations/pages/AssignmentPage.tsx', {
    react: hooks, 'react-router': { useParams: () => ({ shipId: 'ship1' }) }, '@/shared/auth': { useSessionAccess: () => ({ has: () => true }) },
    '../api/regulations-api': { regulationsApi: { getCandidates: async () => [candidate], getAssignments: async () => snapshot, checkConflict: async () => { prechecks++; return { canProceed: false, severity: 'blocking', comparedWith: [] } }, assign: async () => { assignments++; return {} } } },
    '../model/regulation': { formatDateTime: x => x, scopeLabels: {}, typeLabels: {} },
    '../components/RegulationUI': Object.fromEntries(['AdminFrame', 'Button', 'ConflictCard', 'Field', 'LoadingPanel', 'Modal', 'Notice', 'PageHeader', 'Panel', 'StatusBadge', 'TableScroll'].map(key => [key, key])),
  })
  const element = exports.ShipRegulationsPage()
  const render = () => { index = 0; return nodes(element.type(element.props)) }
  render().find(node => node.type === 'PageHeader').props.actions.props.onClick(); await flush()
  render().find(node => node.type === 'input' && node.props.type === 'radio').props.onChange()
  assert.equal(prechecks, 0); assert.equal(assignments, 0)
  const check = render().find(node => node.type === 'Button' && node.props.children === 'Kiểm tra trước khi gán')
  check.props.onClick(); await flush(); assert.equal(prechecks, 1)
  assert.equal(render().find(node => node.type === 'Button' && node.props.children === 'Gán quy định')?.props.disabled, true)
  assert.equal(assignments, 0)
})
