import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as validators from '../../src/features/ship-deck-cabin/model/validation.ts'
const { validateDeck } = validators

const qaId = 'cdf74526-9a8f-408c-9ee8-b06df2cab8e7'
const deck2Id = '6fd94829-d5f0-460e-9be5-a04fbd9ed427'
const draft = { shipId: qaId, number: 1, name: 'Test Deck' }
const snapshot = {
  ships: [{ id: qaId, code: 'OCV-QA-261020-C690C4', name: 'QA Ship', totalDecks: 2 }, { id: 'other-ship', totalDecks: 3 }],
  decks: [{ id: deck2Id, shipId: qaId, number: 2, name: 'AAAAAA' }, { id: 'other-deck', shipId: 'other-ship', number: 1, name: '' }],
  cabins: [],
}
const invalid = result => assert.ok(Object.keys(result).length > 0)

test('unused Deck 1 is valid for totalDecks=2; same number on another Ship is not a duplicate', () => {
  assert.deepEqual(validateDeck(draft, snapshot), {})
})
test('Create rejects existing Deck 2 and numbers beyond the selected Ship limit', () => {
  assert.ok(validateDeck({ ...draft, number: 2 }, snapshot).number)
  assert.ok(validateDeck({ ...draft, number: 3 }, snapshot).number)
})
test('number must be finite, safe, positive and integral', () => {
  for (const number of [0, -1, 1.5, NaN, Infinity, -Infinity, undefined, null, '', '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.ok(validateDeck({ ...draft, number }, snapshot).number, `Must reject ${String(number)}`)
  }
  const missing = { ...draft }; delete missing.number
  assert.ok(validateDeck(missing, snapshot).number)
})
test('Edit retains its own Deck 2, but cannot take another record number', () => {
  assert.deepEqual(validateDeck({ ...draft, number: 2 }, snapshot, deck2Id), {})
  const withDeck1 = { ...snapshot, decks: [...snapshot.decks, { id: 'deck-1', shipId: qaId, number: 1, name: '' }] }
  assert.ok(validateDeck({ ...draft, number: 2 }, withDeck1, 'deck-1').number)
})
test('excluding the current ID never excludes another Deck with the same number', () => {
  const conflict = { ...snapshot, decks: [...snapshot.decks, { id: 'conflicting-deck', shipId: qaId, number: 2, name: '' }] }
  assert.ok(validateDeck({ ...draft, number: 2 }, conflict, deck2Id).number)
})
test('Deck name permits blank and 50 characters; rejects 51 characters', () => {
  for (const name of ['', 'A'.repeat(50)]) assert.deepEqual(validateDeck({ ...draft, name }, snapshot), {})
  assert.ok(validateDeck({ ...draft, name: 'A'.repeat(51) }, snapshot).name)
})
test('missing Ship, invalid Ship limit and incomplete context are blocked without throwing', () => {
  invalid(validateDeck({ ...draft, shipId: '' }, snapshot))
  invalid(validateDeck({ ...draft, shipId: 'missing-ship' }, snapshot))
  for (const context of [null, undefined, {}, { ships: snapshot.ships }, { decks: snapshot.decks }, { ...snapshot, ships: null }, { ...snapshot, decks: null }, { ...snapshot, ships: [null] }, { ...snapshot, decks: [null] }, { ...snapshot, decks: [{ id: 'partial', shipId: qaId }] }]) {
    invalid(validateDeck(draft, context))
  }
  for (const totalDecks of [undefined, null, 0, -1, NaN, Infinity, 1.5, '2']) {
    invalid(validateDeck(draft, { ...snapshot, ships: [{ id: qaId, totalDecks }] }))
  }
})
test('missing or mismatched current Edit record blocks validation rather than treating it as Create', () => {
  for (const currentId of ['missing-deck', '', 'other-deck']) invalid(validateDeck(draft, snapshot, currentId))
})
test('a complete, successfully loaded empty Deck list is valid Create context', () => {
  assert.deepEqual(validateDeck(draft, { ...snapshot, decks: [] }), {})
})
test('validation does not mutate the draft, snapshot or existing Deck values', () => {
  const before = JSON.stringify({ draft, snapshot })
  validateDeck(draft, snapshot); validateDeck({ ...draft, number: 2 }, snapshot, deck2Id)
  assert.equal(JSON.stringify({ draft, snapshot }), before)
})

// This executes only a virtual component's handler against in-memory stubs.
// No browser form is submitted and no API action is executed, even for valid data.
function formHarness({ data = snapshot, editing, loading = false, error = '' } = {}) {
  const jsx = (type, props) => ({ type, props })
  const slots = []; let index = 0
  const calls = { actionQueued: 0, api: 0, retry: 0, validatorIds: [] }
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value }] },
      useRef: () => ({ current: null }),
    },
    'react-router': { Link: 'Link', useNavigate: () => () => {}, useParams: () => ({ id: editing?.id }), useSearchParams: () => [new URLSearchParams({ ship: qaId })] },
    '@/shared/ui': Object.fromEntries(['Button', 'Notice', 'PageHeader', 'Panel'].map(name => [name, name])),
    '@/shared/ui/admin-v3': { AdminShell: 'AdminShell' },
    '../hooks/useAdminData': {
      useAdminData: () => ({ data, loading, error, retry() { calls.retry++ } }), useEntity: () => ({ data: editing ?? null, loading: false, error: '' }),
      useMutation: () => ({ busy: false, run() { calls.actionQueued++; return Promise.resolve(false) } }),
    },
    '../api/ship-deck-cabin-api': { shipDeckCabinApi: { saveDeck() { calls.api++; throw new Error('API must never execute in this unit test') } } },
    '../model/validation': { ...validators, validateDeck(...args) { calls.validatorIds.push(args[2]); return validateDeck(...args) } },
    '../model/types': { kindLabels: { decks: 'boong' }, sectionLabels: { decks: 'Deck' }, shipStatuses: {}, cabinStatuses: {}, cabinTypes: {} },
    '../components/Common': Object.fromEntries(['DataState', 'InputField', 'SelectField', 'NotFound'].map(name => [name, name])),
    '../components/Management.module.css': { default: {} },
  }
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL('../../src/features/ship-deck-cabin/pages/FormPage.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, requestAnimationFrame: callback => callback(), require(id) { if(id === '@/shared/auth') return {useSessionAccess:()=>({status:'ready',userId:'test-user',has:()=>true})}; if(id === '../model/permissions') return {entityPermission:(kind,action)=>({ships:'SHIP',decks:'DECK',cabins:'CABIN'})[kind]+'_'+action,operationPermission:()=> 'TEST_PERMISSION'}; assert.ok(Object.hasOwn(imports, id), 'Unexpected import ' + id); return imports[id] } })
  function flatten(tree) {
    if (Array.isArray(tree)) return tree.flatMap(flatten)
    if (tree == null || typeof tree !== 'object') return []
    if (typeof tree.type === 'function') return flatten(tree.type(tree.props))
    return [tree, ...flatten(tree.props?.children)]
  }
  const view = () => { index = 0; return flatten(jsx(module.exports.DeckFormPage, {})) }
  const change = (label, value) => { const field = view().find(node => node.type === 'InputField' && node.props.label === label); assert.ok(field); field.props.onChange({ target: { value } }) }
  const simulateHandler = () => { const form = view().find(node => node.type === 'form'); assert.ok(form); form.props.onSubmit({ preventDefault() {} }); return view() }
  return { calls, view, change, simulateHandler }
}

test('virtual Create handler blocks invalid fields and exposes their Vietnamese errors without queuing any save', () => {
  for (const [number, name, field] of [[2, 'Deck', 'Số boong *'], [3, 'Deck', 'Số boong *'], [1, 'A'.repeat(51), 'Tên boong']]) {
    const app = formHarness(); app.change('Số boong *', String(number)); app.change('Tên boong', name)
    const tree = app.simulateHandler(), input = tree.find(node => node.type === 'InputField' && node.props.label === field)
    assert.ok(input.props.error); assert.match(input.props.error, /boong|ký tự/)
    assert.equal(app.calls.actionQueued, 0); assert.equal(app.calls.api, 0)
  }
})

test('virtual Edit handler passes only the current ID: unchanged self passes, taking another Deck number fails', () => {
  const edit2 = formHarness({ editing: snapshot.decks[0] }); edit2.simulateHandler()
  assert.deepEqual(edit2.calls.validatorIds, [deck2Id]); assert.equal(edit2.calls.actionQueued, 1); assert.equal(edit2.calls.api, 0)
  const deck1 = { id: 'deck-1', shipId: qaId, number: 1, name: 'First Deck' }
  const edit1 = formHarness({ data: { ...snapshot, decks: [...snapshot.decks, deck1] }, editing: deck1 }); edit1.change('Số boong *', '2')
  const tree = edit1.simulateHandler(); assert.ok(tree.find(node => node.type === 'InputField' && node.props.label === 'Số boong *').props.error)
  assert.deepEqual(edit1.calls.validatorIds, ['deck-1']); assert.equal(edit1.calls.actionQueued, 0); assert.equal(edit1.calls.api, 0)
})

test('virtual Create gate preserves the valid unused number and complete-empty-list behavior', () => {
  for (const data of [snapshot, { ...snapshot, decks: [] }]) {
    const app = formHarness({ data }); app.change('Số boong *', '1'); app.change('Tên boong', 'A'.repeat(50)); app.simulateHandler()
    assert.equal(app.calls.actionQueued, 1); assert.equal(app.calls.api, 0); assert.deepEqual(app.calls.validatorIds, [undefined])
  }
})

test('Deck form never renders a saveable form for missing/incomplete context and exposes retry instead', () => {
  for (const data of [null, {}, { ships: snapshot.ships }, { ...snapshot, ships: [null] }, { ...snapshot, decks: [{ id: deck2Id }] }]) {
    const app = formHarness({ data }), tree = app.view(); assert.ok(!tree.some(node => node.type === 'form'))
    const state = tree.find(node => node.type === 'DataState'); assert.ok(state); assert.match(state.props.error, /Chưa có đủ dữ liệu/); state.props.retry(); assert.equal(app.calls.retry, 1); assert.equal(app.calls.api, 0)
  }
  for (const options of [{ loading: true, data: null }, { error: 'Bạn không có quyền đọc dữ liệu.', data: null }]) {
    const tree = formHarness(options).view(); assert.ok(!tree.some(node => node.type === 'form')); const state = tree.find(node => node.type === 'DataState'); assert.ok(state)
    assert.equal(options.loading ? state.props.loading : state.props.error, options.loading || options.error)
  }
})
