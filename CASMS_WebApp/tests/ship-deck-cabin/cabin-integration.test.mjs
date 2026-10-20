import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as validators from '../../src/features/ship-deck-cabin/model/validation.ts'
import * as model from '../../src/features/ship-deck-cabin/model/types.ts'

const root = new URL('../../src/features/ship-deck-cabin/', import.meta.url)
const ship = { id: 'ship-1', code: 'S1', name: 'Parent Ship', totalDecks: 2 }
const deck = { id: 'deck-1', shipId: ship.id, number: 1, name: 'Parent Deck' }
const cabin = { id: 'cabin-1', shipId: ship.id, deckId: deck.id, number: '101', type: 'SUITE', status: 'AVAILABLE', capacity: 2, accessible: false }
const { id: ignoredId, ...draft } = cabin
void ignoredId
const snapshot = { ships: [ship, { ...ship, id: 'ship-2' }], decks: [deck, { ...deck, id: 'deck-2', shipId: 'ship-2' }], cabins: [cabin] }
const { validateCabin } = validators
const jsx = (type, props) => ({ type, props })
class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code } }
function load(file, imports) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, Error, requestAnimationFrame: callback => callback(), require(id) { if(id === '@/shared/auth') return {useSessionAccess:()=>({status:'ready',userId:'test-user',has:()=>true})}; if(id === '../model/permissions') return {entityPermission:(kind,action)=>({ships:'SHIP',decks:'DECK',cabins:'CABIN'})[kind]+'_'+action,operationPermission:()=> 'TEST_PERMISSION'};
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    assert.ok(Object.hasOwn(imports, id), 'Unexpected import ' + id); return imports[id]
  } })
  return module.exports
}
const plain = value => JSON.parse(JSON.stringify(value))

test('Cabin validation accepts supported enums, positive int32 capacity and unused number', () => {
  for (const type of Object.keys(model.cabinTypes)) for (const status of Object.keys(model.cabinStatuses)) {
    assert.deepEqual(validateCabin({ ...draft, number: '102', type, status }, snapshot), {})
  }
  assert.deepEqual(validateCabin({ ...draft, number: '102', capacity: 2147483647 }, snapshot), {})
})
test('Cabin validates Ship and matching Deck, number presence/length and capacity boundaries', () => {
  assert.ok(validateCabin({ ...draft, shipId: 'missing' }, snapshot).shipId)
  assert.ok(validateCabin({ ...draft, deckId: 'deck-2' }, snapshot).deckId)
  for (const number of ['', '   ', undefined, '1'.repeat(11)]) assert.ok(validateCabin({ ...draft, number }, snapshot).number)
  for (const capacity of [0, -1, 1.5, NaN, Infinity, undefined, 2147483648]) assert.ok(validateCabin({ ...draft, capacity }, snapshot).capacity)
  for (const type of ['', 'UNKNOWN', 'toString', undefined]) assert.ok(validateCabin({ ...draft, type }, snapshot).type)
  for (const status of ['', 'ACTIVE', 'toString', undefined]) assert.ok(validateCabin({ ...draft, status }, snapshot).status)
  assert.ok(validateCabin({ ...draft, accessible: undefined }, snapshot).accessible)
})
test('Duplicate numbers use the serialized trimmed value and only the selected Ship', () => {
  assert.ok(validateCabin({ ...draft, number: ' 101 ' }, snapshot).number)
  assert.deepEqual(validateCabin({ ...draft, shipId: 'ship-2', deckId: 'deck-2' }, snapshot), {})
  assert.deepEqual(validateCabin({ ...draft, number: 'abcdefghij' }, snapshot), {})
  assert.deepEqual(validateCabin({ ...draft, number: 'qa201' }, { ...snapshot, cabins: [{ ...cabin, number: 'QA201' }] }), {})
})
test('Edit excludes exactly itself, rejects another duplicate and preserves immutable identity', () => {
  assert.deepEqual(validateCabin(draft, snapshot, cabin.id), {})
  assert.ok(validateCabin(draft, { ...snapshot, cabins: [cabin, { ...cabin, id: 'other-cabin' }] }, cabin.id).number)
  for (const id of ['missing', '']) assert.ok(validateCabin(draft, snapshot, id).shipId)
  for (const fields of [{ number: '102' }, { shipId: 'ship-2', deckId: 'deck-2' }]) assert.ok(validateCabin({ ...draft, ...fields }, snapshot, cabin.id).shipId)
})
test('Incomplete Cabin validation context blocks; complete zero-Cabin snapshot is valid', () => {
  for (const data of [null, undefined, {}, { ships: [] }, { ...snapshot, cabins: null }, { ...snapshot, cabins: [null] }, { ...snapshot, decks: [null] }, { ...snapshot, ships: [null] }, { ...snapshot, cabins: [{ id: 'partial' }] }, { ...snapshot, cabins: [cabin, cabin] }]) assert.ok(validateCabin(draft, data).shipId)
  assert.deepEqual(validateCabin(draft, { ...snapshot, cabins: [] }), {})
  const before = JSON.stringify(snapshot); validateCabin(draft, snapshot, cabin.id); assert.equal(JSON.stringify(snapshot), before)
})

function apiHarness(handler) {
  const calls = []
  const api = load('api/ship-deck-cabin-api.ts', { '@/shared/api': { ApiError, apiRequest: async (endpoint, options) => { calls.push({ endpoint, options }); return handler(endpoint, options) } } }).shipDeckCabinApi
  return { api, calls }
}
test('Availability 500 is unavailable, never a GET fallback or a fabricated empty list', async () => {
  const app = apiHarness(async () => { throw new ApiError('SQL details must not be shown', 500, 'INTERNAL_ERROR') })
  await assert.rejects(app.api.searchAvailable({ shipId: ship.id }), error => error.status === 500 && /Chưa thể xác nhận/.test(error.message) && !/SQL|Backend/.test(error.message))
  assert.deepEqual(app.calls.map(call => [call.endpoint, call.options.method]), [['/cabins/search', 'POST']])
})
test('Availability preserves denied/network failures and maps genuine successful search results', async () => {
  for (const status of [403, 404, 0]) {
    const failure = new ApiError('Unavailable', status), app = apiHarness(async () => { throw failure })
    await assert.rejects(app.api.searchAvailable({}), error => error === failure); assert.equal(app.calls.length, 1)
  }
  const dto = { cabinId: cabin.id, shipId: ship.id, deckId: deck.id, cabinNumber: '101', cabinType: 'SUITE', capacity: 2, status: 'AVAILABLE', isAccessible: false }
  const app = apiHarness(async () => [dto]); assert.deepEqual(plain(await app.api.searchAvailable({})), [cabin])
})
test('Cabin Create/Edit serialization stays aligned; Edit excludes identity and status fields', async () => {
  const dto = { cabinId: cabin.id, shipId: ship.id, deckId: deck.id, cabinNumber: '101', cabinType: 'SUITE', capacity: 2, status: 'AVAILABLE', isAccessible: false }
  const app = apiHarness(async () => dto)
  await app.api.saveCabin({ ...draft, number: ' 101 ' }); await app.api.saveCabin(draft, cabin.id)
  assert.deepEqual(plain(app.calls.map(call => [call.endpoint, call.options])), [
    ['/cabins', { method: 'POST', body: { cabinType: 'SUITE', capacity: 2, isAccessible: false, shipId: ship.id, deckId: deck.id, cabinNumber: '101', status: 'AVAILABLE' } }],
    ['/cabins/' + cabin.id, { method: 'PATCH', body: { cabinType: 'SUITE', capacity: 2, isAccessible: false } }],
  ])
})
test('Cabin GET inspection messages describe current status without promising Booking availability', async () => {
  const app = apiHarness(async () => true), results = await app.api.inspectCabin(cabin.id, 2, false)
  assert.equal(app.calls.length, 3); assert.ok(app.calls.every(call => !call.options?.method))
  assert.ok(results.every(result => !result.message.includes('Backend'))); assert.match(results[0].message, /không xác nhận chỗ/)
})

function flatten(tree) {
  if (Array.isArray(tree)) return tree.flatMap(flatten)
  if (!tree || typeof tree !== 'object') return []
  if (typeof tree.type === 'function') return flatten(tree.type(tree.props))
  return [tree, ...flatten(tree.props?.children)]
}
const shared = Object.fromEntries(['Button', 'Notice', 'PageHeader', 'Panel', 'Modal', 'DataTable', 'Empty'].map(key => [key, key]))
const common = { ...Object.fromEntries(['InputField', 'SelectField', 'DataState', 'NotFound', 'StatusBadge'].map(key => [key, key])), Definition: ({ rows }) => jsx('Definition', { rows, children: rows.map(row => row[1]) }) }
function detailHarness({ queryErrors = {}, entity = { data: cabin, loading: false, error: '' }, loadingKey } = {}) {
  const calls = { snapshot: 0, retry: [], loads: [] }
  const values = { ['cabin-ship:' + ship.id]: ship, ['cabin-deck:' + deck.id]: deck, ['assignments:' + cabin.id]: [] }
  const hooks = {
    useAdminData() { calls.snapshot++; throw new Error('Cabin must not load global snapshot') },
    useEntity: () => entity, useMutation: () => ({ busy: false, clear() {} }),
    useApiQuery(key, loader) { calls.loads.push({ key, loader }); return { data: queryErrors[key] || loadingKey === key ? null : values[key], loading: loadingKey === key, error: queryErrors[key] ?? '', retry() { calls.retry.push(key) } } },
  }
  const react = { useState: initial => [initial, () => {}], useCallback: fn => fn }
  const api = { get: async kind => kind === 'ships' ? ship : deck }
  const info = load('components/EntityDetails.tsx', { react, 'react-router': { Link: 'Link' }, '@/shared/ui': shared, '../hooks/useAdminData': hooks, '../api/ship-deck-cabin-api': { shipDeckCabinApi: api }, '../model/types': model, './Common': common })
  const pages = load('pages/DetailPage.tsx', { react, 'react-router': { Link: 'Link', useParams: () => ({ id: cabin.id }), useLocation: () => ({}), useNavigate: () => () => {} }, '@/shared/ui': shared, '@/shared/ui/admin-v3': { AdminShell: 'AdminShell' }, '../hooks/useAdminData': hooks, '../api/ship-deck-cabin-api': { shipDeckCabinApi: api }, '../model/types': model, '../components/Common': common, '../components/EntityDetails': info, '../components/OperationDialog': { OperationDialog: 'OperationDialog' } })
  return { calls, view: () => flatten(jsx(pages.CabinDetailPage, {})) }
}
test('Cabin Detail GET is independent, preserving readable parent links and history empty state', () => {
  const app = detailHarness(), tree = app.view(); assert.equal(app.calls.snapshot, 0)
  assert.ok(tree.some(node => node.type === 'PageHeader' && node.props.title === 'Cabin 101'))
  assert.ok(tree.some(node => node.type === 'Link' && node.props.to === '/admin/ships/' + ship.id && node.props.children === 'S1 · Parent Ship'))
  assert.ok(tree.some(node => node.type === 'Link' && node.props.to === '/admin/decks/' + deck.id && node.props.children === 'Boong 1 · Parent Deck'))
  assert.ok(tree.some(node => node.type === 'Empty' && node.props.title === 'Chưa có lịch sử gán cabin'))
})
test('Supplementary Ship/Deck/history errors and loading preserve Cabin core, truthful state and focused retry', () => {
  for (const key of ['cabin-ship:' + ship.id, 'cabin-deck:' + deck.id, 'assignments:' + cabin.id]) {
    for (const error of ['Không kết nối được.', 'Bạn không có quyền đọc dữ liệu.']) {
      const app = detailHarness({ queryErrors: { [key]: error } }), tree = app.view(); assert.ok(tree.some(node => node.type === 'PageHeader'))
      const state = tree.find(node => node.type === 'DataState' && node.props.error === error); assert.ok(state); state.props.retry(); assert.deepEqual(app.calls.retry, [key])
      if (key.startsWith('assignments:')) assert.ok(!tree.some(node => node.type === 'Empty'))
    }
    const tree = detailHarness({ loadingKey: key }).view(); assert.ok(tree.some(node => node.type === 'PageHeader')); assert.ok(tree.some(node => node.type === 'DataState' && node.props.loading))
  }
})
test('Core Cabin loading/errors/not-found remain authoritative without starting supplementary calls', () => {
  for (const entity of [{ data: null, loading: true, error: '' }, { data: null, loading: false, error: 'Forbidden' }, { data: null, loading: false, error: '' }]) {
    const app = detailHarness({ entity }), tree = app.view(); assert.equal(app.calls.loads.length, 0); assert.ok(!tree.some(node => node.type === 'PageHeader'))
  }
})

// Virtual form handler only: never submits a live browser form or calls business APIs.
function formHarness({ data = snapshot, editing, params = { ship: ship.id, deck: deck.id }, busy = false, mutationError = '' } = {}) {
  const slots = []; let index = 0; const calls = { queued: 0, focused: 0, ids: [] }
  const react = {
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value }] },
    useRef: () => ({ current: { querySelector: () => ({ focus() { calls.focused++ } }) } }),
  }
  const pages = load('pages/FormPage.tsx', { react, 'react-router': { Link: 'Link', useNavigate: () => () => {}, useParams: () => ({ id: editing?.id }), useSearchParams: () => [new URLSearchParams(params)] }, '@/shared/ui': shared, '@/shared/ui/admin-v3': { AdminShell: 'AdminShell' }, '../hooks/useAdminData': { useAdminData: () => ({ data, loading: false, error: '', retry() {} }), useEntity: () => ({ data: editing, loading: false, error: '' }), useMutation: () => ({ busy, error: mutationError, run() { calls.queued++; return Promise.resolve(false) } }) }, '../api/ship-deck-cabin-api': { shipDeckCabinApi: {} }, '../model/validation': { ...validators, validateCabin(...args) { calls.ids.push(args[2]); return validateCabin(...args) } }, '../model/types': model, '../components/Common': common })
  const view = () => { index = 0; return flatten(jsx(pages.CabinFormPage, {})) }
  const change = (label, value) => { const input = view().find(node => node.props?.label === label); input.props.onChange(input.type === 'InputField' ? { target: { value } } : value) }
  const submit = () => { const form = view().find(node => node.type === 'form'); form.props.onSubmit({ preventDefault() {} }); return view() }
  return { calls, view, change, submit }
}
test('Cabin form preselects matching parents, resets Deck on Ship change, and disables orphan selection', () => {
  const app = formHarness(); assert.equal(app.view().find(n => n.props.label === 'Boong *').props.value, deck.id)
  app.change('Tàu *', 'ship-2'); assert.equal(app.view().find(n => n.props.label === 'Boong *').props.value, '')
  const empty = formHarness({ params: {} }); assert.equal(empty.view().find(n => n.props.label === 'Boong *').props.disabled, true)
  const wrong = formHarness({ params: { ship: ship.id, deck: 'deck-2' } }); assert.equal(wrong.view().find(n => n.props.label === 'Boong *').props.value, '')
  const inferred = formHarness({ params: { deck: deck.id } }); assert.equal(inferred.view().find(n => n.props.label === 'Tàu *').props.value, ship.id)
})
test('Cabin form blocks invalid/duplicate drafts and uses existing first-error focus; Edit excludes its ID', () => {
  const app = formHarness({ editing: cabin }); app.submit(); assert.deepEqual(app.calls.ids, [cabin.id]); assert.equal(app.calls.queued, 1)
  const failed = formHarness(); failed.change('Số cabin *', '101'); failed.change('Sức chứa *', '2'); const tree = failed.submit()
  assert.equal(failed.calls.queued, 0); assert.equal(failed.calls.focused, 1); assert.ok(tree.find(n => n.props.label === 'Số cabin *').props.error)
})
test('Cabin Edit locks immutable fields, preserves draft under API errors, busy prevents a save', () => {
  const app = formHarness({ editing: cabin, mutationError: 'Không thể lưu. Vui lòng thử lại.' })
  for (const label of ['Tàu *', 'Boong *', 'Trạng thái *']) assert.equal(app.view().find(n => n.props.label === label).props.disabled, true)
  assert.equal(app.view().find(n => n.props.label === 'Số cabin *').props.readOnly, true)
  app.change('Sức chứa *', '4'); assert.equal(app.view().find(n => n.props.label === 'Sức chứa *').props.value, 4)
  assert.ok(app.view().some(n => n.type === 'Notice' && n.props.title === 'Không lưu được dữ liệu'))
  const waiting = formHarness({ editing: cabin, busy: true }); waiting.submit(); assert.equal(waiting.calls.queued, 0); assert.ok(waiting.view().some(n => n.type === 'Button' && n.props.disabled && n.props.children === 'Đang lưu…'))
  const missing = formHarness({ data: null }); assert.ok(!missing.view().some(n => n.type === 'form'))
})

test('Existing mutation hook rejects duplicate in-flight saves and exposes errors for retry', async () => {
  const slots = []; let index = 0, release, actions = 0
  const react = {
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], value => { slots[slot] = value }] },
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial } },
    useCallback: fn => fn,
  }
  const { useMutation } = load('hooks/useAdminData.ts', { react, '@/shared/api': { ApiError }, '../api/ship-deck-cabin-api': { shipDeckCabinApi: {} } })
  const view = () => { index = 0; return useMutation() }
  const mutation = view(), first = mutation.run(async () => { actions++; await new Promise(resolve => { release = resolve }) })
  assert.equal(view().busy, true); assert.equal(await mutation.run(async () => { actions++ }), false); assert.equal(actions, 1)
  release(); assert.equal(await first, true); assert.equal(view().busy, false)
  assert.equal(await view().run(async () => { throw new Error('Không lưu được. Vui lòng thử lại.') }), false)
  assert.match(view().error, /Không lưu được/); assert.equal(view().busy, false)
})
