import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const root = new URL('../../src/features/itineraries/', import.meta.url)
const jsx = (type, props) => ({ type, props })
function load(file, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText, {
    module, exports: module.exports, URLSearchParams, AbortController, require(id) {
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (id.endsWith('.module.css')) return { default: {} }
      assert.ok(Object.hasOwn(imports, id), id); return imports[id]
    },
  }); return module.exports
}
const model = load('model/itinerary.ts')
const cruise = { cruiseId: 'cruise-1', cruiseCode: 'QA', cruiseName: 'Chuyến thật', departureDatetime: '2026-10-21T00:00:00Z', returnDatetime: '2026-10-24T00:00:00Z', status: 'DRAFT' }
const draft = { cruiseId: cruise.cruiseId, itineraryName: 'Hải trình', startDate: '2026-10-21', endDate: '2026-10-24', itineraryType: 'ROUND_TRIP' }
test('Day sequence is contiguous, dates valid/ordered/in itinerary, timezone and day kind are checked', () => {
  const itinerary = { ...draft, itineraryId: 'itinerary-1' }
  const day = { itineraryId: itinerary.itineraryId, dayNumber: 1, date: draft.startDate, dayType: 'SEA_DAY', shipTimeZoneId: 'Asia/Ho_Chi_Minh' }
  assert.equal(model.validateItineraryDay(day, itinerary, []), '')
  for (const patch of [{ dayNumber: 0 }, { dayNumber: 2 }, { dayNumber: 1.5 }, { date: '2026-10-25' }, { date: '2026-02-30' }, { shipTimeZoneId: 'INVALID' }, { dayType: 'OTHER' }]) assert.ok(model.validateItineraryDay({ ...day, ...patch }, itinerary, []))
  const existing = { ...day, itineraryDayId: 'day-1' }
  assert.equal(model.validateItineraryDay(day, itinerary, [existing], existing.itineraryDayId), '')
  assert.ok(model.validateItineraryDay({ ...day, dayNumber: 2 }, itinerary, [existing]))
  assert.equal(model.validateItineraryDay({ ...day, dayNumber: 2, date: '2026-10-22' }, itinerary, [existing]), '')
})
test('selected real cruise, date window, one-to-one and missing context are enforced; edit excludes itself', () => {
  const context = { cruises: [cruise], itineraries: [] }
  assert.equal(Object.keys(model.validateItineraryDraft(draft, context)).length, 0)
  assert.ok(model.validateItineraryDraft(draft, null).cruiseId)
  assert.ok(model.validateItineraryDraft({ ...draft, cruiseId: 'typed-uuid' }, context).cruiseId)
  for (const patch of [{ startDate: '2026-10-20' }, { endDate: '2026-10-25' }, { endDate: draft.startDate }, { startDate: '2026-02-30' }, { itineraryName: '' }, { itineraryType: 'INVALID' }]) assert.ok(Object.keys(model.validateItineraryDraft({ ...draft, ...patch }, context)).length)
  const existing = { ...draft, itineraryId: 'itinerary-1' }
  assert.ok(model.validateItineraryDraft(draft, { ...context, itineraries: [existing] }).cruiseId)
  assert.equal(Object.keys(model.validateItineraryDraft(draft, { ...context, itineraries: [existing], editingId: existing.itineraryId })).length, 0)
})
test('Create serializes exactly five DTO fields and never forwards creator identity', async () => {
  let call
  const { itineraryApi } = load('api/itinerary-api.ts', { '@/shared/api': { apiRequest: async (...args) => { call = args; return { itineraryId: 'saved' } }, apiRequestRaw() {}, ApiError: Error } })
  await itineraryApi.create({ ...draft, itineraryName: ' Hải trình ', createdByUserId: 'forged-user', unrelated: 'ignored' })
  assert.equal(call[0], '/itineraries'); assert.equal(call[1].method, 'POST')
  assert.deepEqual(JSON.parse(JSON.stringify(call[1].body)), draft)
})
test('cruise context reads every page and propagates permission errors instead of empty success', async () => {
  const calls = []
  const { itineraryApi } = load('api/itinerary-api.ts', { '@/shared/api': { apiRequest: async (path, options) => {
    calls.push([path, options.query.page]); return { content: path === '/cruise' ? [{ ...cruise, cruiseId: 'cruise-' + options.query.page }] : [], totalPages: path === '/cruise' ? 2 : 1 }
  }, apiRequestRaw() {}, ApiError: Error } })
  assert.equal((await itineraryApi.formContext()).cruises.length, 2)
  assert.ok(calls.some(([path, page]) => path === '/cruise' && page === 1))
  const broken = load('api/itinerary-api.ts', { '@/shared/api': { apiRequest: async () => { throw Error('403') }, apiRequestRaw() {}, ApiError: Error } })
  await assert.rejects(broken.itineraryApi.formContext(), /403/)
})
test('cruise lookup rejects malformed pages and incomplete dates instead of crashing the form or assuming empty data', async () => {
  for (const payload of [{ content: null, totalPages: 1 }, { content: [], totalPages: undefined }, { content: [{ ...cruise, departureDatetime: null }], totalPages: 1 }, { content: [{ ...cruise, returnDatetime: 'invalid' }], totalPages: 1 }]) {
    const { itineraryApi } = load('api/itinerary-api.ts', { '@/shared/api': { apiRequest: async () => payload, apiRequestRaw() {}, ApiError: Error } })
    await assert.rejects(itineraryApi.listCruises(), /không đúng định dạng|không đầy đủ/)
  }
})
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [] }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '') }
test('Itinerary List keeps core rows and detail links when cruise names fail; successful lookup uses readable name/code', () => {
  const item = { ...draft, itineraryId: 'itinerary-1', status: 'DRAFT' }
  for (const names of [{ data: [cruise], error: null, loading: false }, { data: null, error: new Error('HTTP 403'), loading: false }, { data: null, error: null, loading: true }]) {
    const { ItineraryListPage } = load('pages/ItineraryPages.tsx', {
      react: { useState: value => [value, () => {}], useCallback: fn => fn },
      'react-router': { Link: 'Link' },
      '@/shared/api': { useReadQuery: key => key.startsWith('itineraries:') ? { data: { items: [item], total: 1, pageCount: 1 }, loading: false, error: null, retry() {} } : { ...names, retry() {} } },
      '@/shared/ui': Object.fromEntries(['Button', 'ButtonLink', 'DataTable', 'Empty', 'Loading', 'Notice', 'PageHeader', 'Panel'].map(key => [key, key])),
      '../api/itinerary-api': { itineraryApi: { listCruises() {} } },
      '../components/ItineraryUI': { ItineraryFrame: 'ItineraryFrame', ItineraryStatusBadge: 'ItineraryStatusBadge' },
      './ItineraryFormPage': {}, './ItineraryDetailPage': {},
    })
    const tree = ItineraryListPage(), all = nodes(tree)
    assert.ok(text(tree).includes(item.itineraryName))
    assert.ok(all.some(node => node.type === 'Link' && node.props.to === '/admin/itineraries/itinerary-1'))
    const link = all.find(node => node.type === 'Link' && node.props.to === '/admin/cruises/cruise-1')
    assert.ok(link); assert.ok(!text(link).includes(cruise.cruiseId))
    if (names.data) assert.equal(text(link), 'Chuyến thật · QA')
    if (names.error) assert.ok(text(tree).includes('HTTP 403'))
    assert.ok(!all.some(node => node.type === 'Empty'))
  }
})
test('Create form has natural cruise select, no manual creator input, and a synchronous duplicate-submit lock', async () => {
  let calls = 0, complete, navigations = 0
  const response = new Promise(resolve => { complete = resolve })
  const { ItineraryFormPage } = load('pages/ItineraryFormPage.tsx', {
    '@/shared/api': { ApiError: Error },
    '@/shared/auth': { useSessionAccess: () => ({ has: () => true }) },
    react: { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value === null ? { cruises: [cruise], itineraries: [] } : value?.cruiseId !== undefined ? draft : value, () => {}] },
    'react-router': { useParams: () => ({}), useSearchParams: () => [new URLSearchParams()], useNavigate: () => () => navigations++ },
    '@/shared/ui': Object.fromEntries(['Button', 'ButtonLink', 'Field', 'Loading', 'Notice', 'PageHeader', 'Panel'].map(key => [key, key])),
    '../api/itinerary-api': { itineraryApi: { create: () => { calls++; return response } } },
    '../components/ItineraryUI': { ItineraryFrame: 'ItineraryFrame' }, '../model/itinerary': model,
  })
  const tree = nodes(ItineraryFormPage())
  assert.ok(tree.some(node => node.type === 'select' && node.props.name === 'cruiseId'))
  assert.ok(!tree.some(node => /author|creator|createdBy/i.test(node.props?.id ?? '')))
  const submit = tree.find(node => node.type === 'form').props.onSubmit
  const first = submit({ preventDefault() {} }), second = submit({ preventDefault() {} })
  assert.equal(calls, 1); complete({ itineraryId: 'saved' }); await Promise.all([first, second]); assert.equal(navigations, 1)
})
