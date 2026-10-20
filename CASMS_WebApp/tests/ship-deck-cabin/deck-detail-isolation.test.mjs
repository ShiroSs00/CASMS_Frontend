import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const root = new URL('../../src/features/ship-deck-cabin/', import.meta.url)
const jsx = (type, props) => ({ type, props })
const ship = { id: 'ship-1', code: 'S1', name: 'Parent Ship', capacity: 24, totalDecks: 2, status: 'ACTIVE' }
const deck = { id: 'deck-1', shipId: ship.id, number: 2, name: 'Test Deck' }
const cabin = { id: 'cabin-1', shipId: ship.id, deckId: deck.id, number: '201', type: 'INTERIOR', capacity: 2, status: 'AVAILABLE' }
const counts = { totalCabins: 1, availableCabins: 1, totalPassengerCapacity: 2 }
const loaded = data => ({ data, loading: false, error: '', retry() {} })
function load(file, imports) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, Error, require(id) { if(id === '@/shared/auth') return {useSessionAccess:()=>({status:'ready',userId:'test-user',has:()=>true})}; if(id === '../model/permissions') return {entityPermission:(kind,action)=>({ships:'SHIP',decks:'DECK',cabins:'CABIN'})[kind]+'_'+action,operationPermission:()=> 'TEST_PERMISSION'};
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    assert.ok(Object.hasOwn(imports, id), 'Unexpected import ' + id); return imports[id]
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
const nodes = tree => tree.flatMap(node => typeof node === 'object' ? [node, ...nodes(node.children)] : [])
const text = tree => tree.map(node => typeof node === 'object' ? `${node.props?.title ?? ''} ${text(node.children)}` : String(node)).join(' ')
const shared = Object.fromEntries(['Button', 'Modal', 'Notice', 'PageHeader', 'Panel', 'DataTable', 'Empty'].map(name => [name, name]))
const common = {
  DataState: props => props.loading || props.error ? jsx('DataState', props) : null,
  Definition: ({ rows }) => jsx('Definition', { children: rows }), StatusBadge: ({ status }) => jsx('StatusBadge', { children: status }),
  NotFound: () => jsx('NotFound', {}), InputField: 'InputField', SelectField: 'SelectField',
}
function setup({ entity = loaded(deck), queries = {}, operation = null } = {}) {
  const calls = { snapshot: 0, entity: [], queries: [], retries: [], ownershipList: 0 }
  const values = { [`deck-parent:${ship.id}`]: loaded(ship), [`deck-capacity:${deck.id}`]: loaded(counts), [`deck-cabins:${deck.id}`]: loaded([cabin]), 'deck-ownership-ships': loaded([ship, { ...ship, id: 'ship-2', code: 'S2' }]), ...queries }
  const hooks = {
    useAdminData() { calls.snapshot++; throw new Error('Deck must not call snapshot') },
    useEntity(kind, id) { calls.entity.push([kind, id]); return entity }, useMutation: () => ({ busy: false, clear() {} }),
    useApiQuery(key, loader) {
      calls.queries.push({ key, loader })
      assert.ok(Object.hasOwn(values, key), 'Unexpected query ' + key)
      return { ...values[key], retry() { calls.retries.push(key) } }
    },
  }
  const react = { useState: initial => [initial === null ? operation : initial, () => {}], useCallback: fn => fn }
  const model = { formatDate: () => 'date', entityName: () => 'Boong 2 · Test Deck', kindLabels: {}, sectionLabels: {}, cabinTypes: { INTERIOR: 'Interior' } }
  const api = { listShips: async () => { calls.ownershipList++; return [ship] } }
  const details = load('components/EntityDetails.tsx', { react, 'react-router': { Link: 'Link' }, '@/shared/ui': shared, '../hooks/useAdminData': hooks, '../api/ship-deck-cabin-api': { shipDeckCabinApi: api }, '../model/types': model, './Common': common })
  const page = load('pages/DetailPage.tsx', { react, 'react-router': { Link: 'Link', useParams: () => ({ id: deck.id }), useLocation: () => ({}), useNavigate: () => () => {} }, '@/shared/ui': shared, '@/shared/ui/admin-v3': { AdminShell: 'AdminShell' }, '../hooks/useAdminData': hooks, '../api/ship-deck-cabin-api': { shipDeckCabinApi: api }, '../model/types': model, '../components/Common': common, '../components/EntityDetails': details, '../components/OperationDialog': { OperationDialog: 'OperationDialog' } })
  return { calls, view: () => render(jsx(page.DeckDetailPage, {})) }
}

test('Deck core loads independently and preserves parent, capacity, Cabin columns and navigation', () => {
  const app = setup(), tree = app.view(), all = nodes(tree)
  assert.equal(app.calls.snapshot, 0); assert.deepEqual(app.calls.entity, [['decks', deck.id]])
  assert.ok(all.some(node => node.type === 'PageHeader'))
  assert.match(text(tree), /Số boong 2/); assert.match(text(tree), /Tên boong Test Deck/); assert.match(text(tree), /S1 · Parent Ship/)
  assert.ok(all.some(node => node.type === 'Link' && node.props.to === '/admin/ships/' + ship.id))
  assert.match(text(tree), /Tổng số cabin 1/); assert.match(text(tree), /Cabin sẵn sàng 1/); assert.match(text(tree), /2 khách/)
  const table = all.find(node => node.type === 'DataTable'); assert.equal(table.props.label, 'Cabin trên boong')
  assert.deepEqual(Array.from(table.props.headers), ['SỐ CABIN', 'LOẠI', 'SỨC CHỨA', 'TRẠNG THÁI', 'THAO TÁC'])
  assert.match(text(tree), /201/); assert.match(text(tree), /Interior/)
  assert.ok(all.some(node => node.type === 'Link' && node.props.to === '/admin/cabins/' + cabin.id))
  assert.equal(app.calls.queries.some(query => query.key === 'deck-ownership-ships'), false)
})

for (const key of [`deck-parent:${ship.id}`, `deck-capacity:${deck.id}`, `deck-cabins:${deck.id}`]) {
  for (const error of ['Không kết nối được backend.', 'Bạn không có quyền thực hiện thao tác này.']) test(`${key}: independent network/403 error keeps core and retries only that resource (${error})`, () => {
    const app = setup({ queries: { [key]: { data: null, error, loading: false } } }), tree = app.view(), all = nodes(tree)
    assert.ok(all.some(node => node.type === 'PageHeader')); assert.match(text(tree), /Tên boong Test Deck/)
    const failure = all.find(node => node.type === 'DataState' && node.props.error === error); assert.ok(failure); failure.props.retry(); assert.deepEqual(app.calls.retries, [key])
    assert.ok(!all.some(node => node.type === 'Empty'))
    if (!key.startsWith('deck-capacity:')) assert.match(text(tree), /Tổng số cabin 1/)
    else assert.doesNotMatch(text(tree), /Tổng số cabin/)
    if (!key.startsWith('deck-cabins:')) assert.ok(all.some(node => node.type === 'DataTable'))
    else assert.ok(!all.some(node => node.type === 'DataTable'))
    if (key.startsWith('deck-parent:')) assert.ok(all.some(node => node.type === 'Link' && node.props.to === '/admin/ships/' + ship.id && text(node.children).includes(ship.id)))
  })
}

test('Loading supplementary states preserve core without fabricated values; loaded zero Cabins remains a valid empty state', () => {
  const pending = { data: null, loading: true, error: '' }
  const app = setup({ queries: { [`deck-parent:${ship.id}`]: pending, [`deck-capacity:${deck.id}`]: pending, [`deck-cabins:${deck.id}`]: pending } })
  const tree = app.view(); assert.ok(nodes(tree).some(node => node.type === 'PageHeader')); assert.equal(nodes(tree).filter(node => node.type === 'DataState' && node.props.loading).length, 3)
  assert.doesNotMatch(text(tree), /Tổng số cabin/); assert.ok(!nodes(tree).some(node => node.type === 'Empty'))
  const empty = setup({ queries: { [`deck-capacity:${deck.id}`]: loaded({ totalCabins: 0, availableCabins: 0, totalPassengerCapacity: 0 }), [`deck-cabins:${deck.id}`]: loaded([]) } }).view()
  assert.match(text(empty), /Tổng số cabin 0/); assert.ok(nodes(empty).some(node => node.type === 'Empty' && node.props.title === 'Boong chưa có cabin'))
  assert.ok(nodes(empty).some(node => node.type === 'Link' && node.props.to === `/admin/cabins/new?ship=${ship.id}&deck=${deck.id}`))
})

test('Authoritative Deck loading/error/not-found states remain intact and do not start supplementary queries', () => {
  for (const entity of [{ data: null, loading: true, error: '' }, { data: null, loading: false, error: 'Deck GET forbidden' }, loaded(null)]) {
    const app = setup({ entity }), tree = app.view()
    assert.ok(!nodes(tree).some(node => node.type === 'PageHeader')); assert.equal(app.calls.queries.length, 0); assert.equal(app.calls.snapshot, 0)
    assert.ok(nodes(tree).some(node => node.type === (entity.loading || entity.error ? 'DataState' : 'NotFound')))
  }
})

test('Ownership choices load only when requested and retain all Ship choices plus retry state', async () => {
  const app = setup({ operation: 'ownership' }), tree = app.view()
  const dialog = nodes(tree).find(node => node.type === 'OperationDialog'); assert.ok(dialog)
  assert.equal(dialog.props.ships.length, 2); assert.equal(dialog.props.operation, 'ownership')
  const query = app.calls.queries.find(query => query.key === 'deck-ownership-ships'); assert.ok(query); await query.loader(); assert.equal(app.calls.ownershipList, 1)
  const failed = setup({ operation: 'ownership', queries: { 'deck-ownership-ships': { data: null, loading: false, error: 'Ship choices denied' } } })
  const errorDialog = nodes(failed.view()).find(node => node.type === 'OperationDialog'); assert.equal(errorDialog.props.shipChoicesState.error, 'Ship choices denied'); errorDialog.props.shipChoicesState.retry(); assert.deepEqual(failed.calls.retries, ['deck-ownership-ships'])
})

test('Ownership dialog cannot execute checks while choices are loading/denied and keeps its retry and options', async () => {
  let executed = 0, retried = 0
  const dialog = load('components/OperationDialog.tsx', {
    react: { useState: initial => [initial, () => {}] }, '@/shared/ui': shared,
    '../api/ship-deck-cabin-api': { shipDeckCabinApi: {} }, '../hooks/useAdminData': { useMutation: () => ({ busy: false, clear() {}, run() { executed++ } }) },
    '../model/types': { shipStatuses: {}, cabinStatuses: {} }, './Common': common, './CruiseTable': { CruiseTable: 'CruiseTable' },
  })
  for (const query of [{ loading: true, error: '' }, { loading: false, error: 'Bạn không có quyền thực hiện thao tác này.' }]) {
    const tree = render(jsx(dialog.OperationDialog, { item: deck, kind: 'decks', operation: 'ownership', ships: [ship], shipChoicesState: { ...query, retry() { retried++ } }, onClose() {} }))
    const all = nodes(tree), select = all.find(node => node.type === 'SelectField'); assert.equal(select.props.disabled, true)
    const check = all.find(node => node.type === 'Button' && text(node.children).includes('Kiểm tra')); assert.equal(check.props.disabled, true); await check.props.onClick(); assert.equal(executed, 0)
    const state = all.find(node => node.type === 'DataState'); assert.ok(state); state.props.retry()
    assert.match(text(tree), /S1\s+·\s+Parent Ship/)
  }
  assert.equal(retried, 2)
})

test('Ownership Ship choices adapter requests only paginated Ships and preserves selector fields', async () => {
  const requests = []
  const api = load('api/ship-deck-cabin-api.ts', { '@/shared/api': { ApiError: Error, apiRequest: async endpoint => { requests.push(endpoint); return { content: [{ shipId: ship.id, shipCode: ship.code, shipName: ship.name }], totalPages: 1, totalElements: 1 } } } }).shipDeckCabinApi
  const choices = await api.listShips(new AbortController().signal); assert.deepEqual(requests, ['/ships']); assert.equal(choices[0].id, ship.id); assert.equal(choices[0].code, ship.code); assert.equal(choices[0].name, ship.name)
})

test('Existing query hook ignores cancelled/stale completions and exposes retry without turning 403 into empty success', async () => {
  const slots = []; let index = 0; const effects = []
  const react = {
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value }] },
    useSyncExternalStore: () => 0,
    useEffect(fn, deps) { const slot = index++, previous = slots[slot]; if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) effects.push(() => { previous?.cleanup?.(); slots[slot] = { deps, cleanup: fn() } }) },
  }
  const query = load('hooks/useAdminData.ts', { react, '@/shared/api': { ApiError: Error }, '../api/ship-deck-cabin-api': { shipDeckCabinApi: {} } }).useApiQuery
  const requests = []
  const loader = signal => new Promise((resolve, reject) => { requests.push({ signal, resolve, reject }) })
  const view = key => { index = 0; const output = query(key, loader); while (effects.length) effects.shift()(); return output }
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
  view('deck-old'); view('deck-new'); assert.equal(requests[0].signal.aborted, true)
  requests[0].resolve('stale'); await flush(); assert.equal(view('deck-new').loading, true)
  requests[1].reject(new Error('Bạn không có quyền thực hiện thao tác này.')); await flush()
  let current = view('deck-new'); assert.match(current.error, /không có quyền/); assert.equal(current.data, null); assert.equal(current.loading, false)
  current.retry(); view('deck-new'); requests[2].resolve('fresh'); await flush(); current = view('deck-new'); assert.equal(current.data, 'fresh'); assert.equal(current.error, '')
})
