import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('../../src/features/ship-deck-cabin/', import.meta.url)
const jsx = (type, props) => ({ type, props })
const ship = { id: 'ship-1', code: 'QA-SHIP', name: 'Test Ship', status: 'ACTIVE', capacity: 24, totalDecks: 2, commissionDate: '' }
const capacity = { configuredTotalCapacity: 24, configuredTotalDecks: 2, actualCabinCount: 3, availableCabinCount: 1, actualDeckCount: 2 }

function load(relative, imports) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL(relative, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, require(id) { if(id === '@/shared/auth') return {useSessionAccess:()=>({status:'ready',userId:'test-user',has:()=>true})}; if(id === '../model/permissions') return {entityPermission:(kind,action)=>({ships:'SHIP',decks:'DECK',cabins:'CABIN'})[kind]+'_'+action,operationPermission:()=> 'TEST_PERMISSION'};
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    assert.ok(Object.hasOwn(imports, id), 'Unexpected import: ' + id)
    return imports[id]
  } })
  return module.exports
}

function render(tree) {
  if (Array.isArray(tree)) return tree.flatMap(render)
  if (tree == null || typeof tree === 'boolean') return []
  if (typeof tree !== 'object') return [tree]
  if (typeof tree.type === 'function') return render(tree.type(tree.props))
  return [{ ...tree, children: render(tree.props?.children) }]
}
function nodes(tree) { return tree.flatMap(node => typeof node === 'object' ? [node, ...nodes(node.children)] : []) }
function text(tree) { return tree.map(node => typeof node === 'object' ? `${node.props?.title ?? ''} ${text(node.children)}` : String(node)).join(' ') }

function setup({ entity = { data: ship, loading: false, error: '' }, snapshotError = '', capacityError = '', currentError = '' } = {}) {
  const calls = { snapshot: 0, entity: [], capacityRetry: 0, entityRetry: 0 }
  const hooks = {
    useAdminData() { calls.snapshot++; return { data: { ships: [ship], decks: [], cabins: [] }, loading: false, error: snapshotError, retry() {} } },
    useEntity(kind, id) { calls.entity.push({ kind, id }); return { ...entity, retry() { calls.entityRetry++ } } },
    useMutation: () => ({ clear() {}, busy: false }),
    useApiQuery(key) {
      if (key.startsWith('ship-capacity:')) return { data: capacityError ? null : capacity, loading: false, error: capacityError, retry() { calls.capacityRetry++ } }
      if (key.startsWith('current-cruise:')) return { data: null, loading: false, error: currentError, retry() {} }
      throw new Error('Unexpected supplementary query: ' + key)
    },
  }
  const shared = Object.fromEntries(['Button', 'Modal', 'Notice', 'PageHeader', 'Panel', 'DataTable', 'Empty'].map(name => [name, name]))
  const common = {
    DataState: props => props.loading || props.error ? jsx('DataState', props) : null,
    NotFound: () => jsx('NotFound', {}),
    Definition: ({ rows }) => jsx('Definition', { children: rows }),
    StatusBadge: ({ status }) => jsx('StatusBadge', { children: status }),
  }
  const react = { useState: value => [value, () => {}], useCallback: fn => fn }
  const model = { entityName: item => `${item.code} · ${item.name}`, kindLabels: {}, sectionLabels: {}, formatDate: () => 'date', cabinTypes: {} }
  const details = load('components/EntityDetails.tsx', {
    react, 'react-router': { Link: 'Link' }, '@/shared/ui': shared,
    '../api/ship-deck-cabin-api': { shipDeckCabinApi: {} }, '../hooks/useAdminData': hooks, '../model/types': model, './Common': common,
  })
  const page = load('pages/DetailPage.tsx', {
    react, 'react-router': { Link: 'Link', useParams: () => ({ id: ship.id }), useLocation: () => ({}), useNavigate: () => () => {} },
    '@/shared/ui': shared, '@/shared/ui/admin-v3': { AdminShell: 'AdminShell' },
    '../hooks/useAdminData': hooks, '../api/ship-deck-cabin-api': { shipDeckCabinApi: {} }, '../model/types': model,
    '../components/Common': common, '../components/EntityDetails': details, '../components/OperationDialog': { OperationDialog: 'OperationDialog' },
  })
  return { calls, page, view: () => render(jsx(page.ShipDetailPage, {})) }
}

test('Ship Detail uses its entity GET without calling the global Deck/Cabin snapshot', () => {
  for (const snapshotError of ['Deck GET unavailable', 'Cabin GET unavailable']) {
    const app = setup({ snapshotError })
    const tree = app.view()
    assert.equal(app.calls.snapshot, 0)
    assert.deepEqual(app.calls.entity, [{ kind: 'ships', id: ship.id }])
    assert.equal(nodes(tree).find(node => node.type === 'PageHeader')?.props.title, 'QA-SHIP · Test Ship')
    assert.match(text(tree), /24 khách/)
    assert.match(text(tree), /Số cabin thực tế 3/)
  }
})

test('Capacity errors keep Ship core visible, expose retry, and do not fabricate zero counts', () => {
  const app = setup({ capacityError: 'Capacity temporarily unavailable' })
  const tree = app.view()
  assert.ok(nodes(tree).some(node => node.type === 'PageHeader'))
  const failure = nodes(tree).find(node => node.type === 'DataState' && node.props.error === 'Capacity temporarily unavailable')
  assert.ok(failure)
  failure.props.retry()
  assert.equal(app.calls.capacityRetry, 1)
  assert.doesNotMatch(text(tree), /Số cabin thực tế/)
  assert.match(text(tree), /Tàu chưa có chuyến đang vận hành/)
})

test('Current cruise errors are independent of Ship core and real capacity counts', () => {
  const tree = setup({ currentError: 'Cruise temporarily unavailable' }).view()
  assert.ok(nodes(tree).some(node => node.type === 'PageHeader'))
  assert.ok(nodes(tree).some(node => node.type === 'DataState' && node.props.error === 'Cruise temporarily unavailable'))
  assert.match(text(tree), /Số cabin thực tế 3/)
  assert.doesNotMatch(text(tree), /Tàu chưa có chuyến đang vận hành/)
})

test('Legitimate Ship loading, error/retry and missing-record states remain authoritative', () => {
  const loading = setup({ entity: { data: null, loading: true, error: '' } })
  assert.ok(nodes(loading.view()).some(node => node.type === 'DataState' && node.props.loading))
  const failed = setup({ entity: { data: null, loading: false, error: 'Ship GET forbidden' } })
  const tree = failed.view()
  const failure = nodes(tree).find(node => node.type === 'DataState' && node.props.error === 'Ship GET forbidden')
  assert.ok(failure)
  failure.props.retry()
  assert.equal(failed.calls.entityRetry, 1)
  assert.ok(!nodes(tree).some(node => node.type === 'PageHeader'))
  const missing = setup({ entity: { data: null, loading: false, error: '' } })
  assert.ok(nodes(missing.view()).some(node => node.type === 'NotFound'))
})

test('Cabin detail also uses its entity without the obsolete shared snapshot gate', () => {
  const app = setup({ snapshotError: 'Existing snapshot error' })
  const tree = render(jsx(app.page.CabinDetailPage, {}))
  assert.equal(app.calls.snapshot, 0)
  assert.equal(app.calls.entity.length, 1)
  assert.ok(!nodes(tree).some(node => node.type === 'DataState' && node.props.error === 'Existing snapshot error'))
})

test('Only the recognized no-active-cruise 404 becomes the existing empty state', async () => {
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status } }
  for (const [message, status, empty] of [
    ['No active cruise found for ship currently', 404, true],
    ['Ship not found', 404, false],
    ['No active cruise found for ship currently', 500, false],
  ]) {
    const error = new ApiError(message, status)
    const { shipDeckCabinApi } = load('api/ship-deck-cabin-api.ts', {
      '@/shared/api': { ApiError, apiRequest: async () => { throw error } },
    })
    if (empty) assert.equal(await shipDeckCabinApi.getCurrentCruise(ship.id), null)
    else await assert.rejects(shipDeckCabinApi.getCurrentCruise(ship.id), reason => reason === error)
  }
})
