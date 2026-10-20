import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('../../src/features/itineraries/', import.meta.url)
const jsx = (type, props) => ({ type, props })
function load(file, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText, {
    module, exports: module.exports, AbortController, Intl, Date, require(id) {
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (id.endsWith('.module.css')) return { default: {} }
      assert.ok(Object.hasOwn(imports, id), id); return imports[id]
    },
  }); return module.exports
}
const stop = { cruiseStopId: 's1', itineraryId: 'i1', stopOrder: 1, status: 'PLANNED', plannedArrival: '2026-01-01T00:00:00Z', plannedDeparture: '2026-01-02T00:00:00Z' }
const second = { ...stop, cruiseStopId: 's2', stopOrder: 2 }
const { validateStopOperation, stopOperations } = load('model/stop-operations.ts')
test('stop operations reject invalid order, cross-itinerary replacement, finished states and missing reason', () => {
  for (const value of ['', '0', '-1', '1.5', 'NaN', '2']) assert.ok(validateStopOperation('reorder', value, stop, [stop, second], 'DRAFT'))
  assert.equal(validateStopOperation('reorder', '3', stop, [stop, second], 'DRAFT'), '')
  assert.ok(validateStopOperation('reorder', '3', stop, [], 'ACTIVE'))
  assert.ok(validateStopOperation('substitute', 's1', stop, [stop, second], 'DRAFT'))
  assert.ok(validateStopOperation('substitute', 's2', stop, [{ ...second, itineraryId: 'other' }], 'DRAFT'))
  assert.equal(validateStopOperation('substitute', 's2', stop, [second], 'DRAFT'), '')
  assert.ok(validateStopOperation('omit', ' ', stop, [], 'ACTIVE'))
  assert.ok(validateStopOperation('omit', 'Weather', stop, [], 'COMPLETED'))
})
test('planned, all-aboard and actual times remain separate and cannot invent future actual events', () => {
  for (const action of ['plannedArrival', 'plannedDeparture', 'allAboard', 'actualArrival', 'actualDeparture']) assert.ok(validateStopOperation(action, 'bad', stop, [], 'ACTIVE'))
  assert.ok(validateStopOperation('plannedArrival', stop.plannedDeparture, stop, [], 'DRAFT'))
  assert.ok(validateStopOperation('allAboard', '2026-01-03T00:00:00Z', stop, [], 'ACTIVE'))
  assert.equal(validateStopOperation('allAboard', '2026-01-01T22:00:00Z', stop, [], 'ACTIVE'), '')
  assert.ok(validateStopOperation('actualArrival', '2099-01-01T00:00:00Z', stop, [], 'ACTIVE'))
  assert.ok(validateStopOperation('actualDeparture', '2026-01-01T03:00:00Z', stop, [], 'ACTIVE'))
  assert.equal(validateStopOperation('actualDeparture', '2026-01-01T03:00:00Z', { ...stop, actualArrival: '2026-01-01T02:00:00Z' }, [], 'ACTIVE'), '')
})
test('dedicated stop/day adapters use exact paths, query names, ISO times and explicit update DTO', async () => {
  const calls = []
  const { itineraryApi } = load('api/itinerary-api.ts', { '@/shared/api': { apiRequest: async (...args) => { calls.push(args); return {} }, apiRequestRaw() {}, ApiError: Error } })
  await itineraryApi.reorderStop('s/1', 3)
  await itineraryApi.substituteStop('s1', 's2')
  await itineraryApi.setAllAboardTime('s1', '2026-01-01T22:00:00Z')
  await itineraryApi.setDayType('d1', 'SEA_DAY')
  await itineraryApi.setShipTimeZone('d1', 'Asia/Ho_Chi_Minh')
  await itineraryApi.updateDay('d1', { itineraryId: 'forged', dayType: 'PORT_DAY', description: '' })
  assert.equal(calls[0][0], '/cruise-stops/s%2F1/reorder'); assert.equal(calls[0][1].query.newStopOrder, 3)
  assert.equal(calls[1][1].query.newStopId, 's2')
  assert.equal(calls[2][1].query.allAboardTime, '2026-01-01T22:00:00.000Z')
  assert.equal(calls[3][0], '/itinerary-days/d1/day-type'); assert.equal(calls[3][1].query.dayType, 'SEA_DAY')
  assert.equal(calls[4][1].query.shipTimeZoneId, 'Asia/Ho_Chi_Minh')
  assert.equal(calls[5][1].method, 'PATCH'); assert.ok(!Object.hasOwn(calls[5][1].body, 'itineraryId')); assert.equal(calls[5][1].body.description, '')
})
test('history raw response decoders preserve raw contracts and reject malformed success', async () => {
  const calls = [], entry = { changeHistoryId: 'h1', itineraryId: 'i1', changeType: 'TIME_CHANGE', reason: 'Weather', beforeData: null, afterData: null }
  let response = [entry]
  const { itineraryHistoryApi } = load('api/itinerary-api.ts', { '@/shared/api': { apiRequest() {}, apiRequestRaw: async (url, decode, options) => { calls.push({ url, options }); return decode(response, 200) }, ApiError: Error } })
  assert.equal((await itineraryHistoryApi.search({ itineraryId: 'i1' }))[0].changeHistoryId, 'h1')
  response = entry
  assert.equal((await itineraryHistoryApi.get('h/1')).changeHistoryId, 'h1'); assert.equal(calls[1].url, '/itinerary-change-history/h%2F1')
  await itineraryHistoryApi.append({ itineraryId: 'i1', changedEntityType: 'Itinerary', changedEntityId: 'i1', changeType: 'TIME_CHANGE', changeSummary: ' Time ', reason: ' Weather ', changedByUserId: 'session-user', forged: true })
  assert.equal(calls[2].options.method, 'POST'); assert.equal(calls[2].options.body.changedByUserId, 'session-user'); assert.equal(calls[2].options.body.reason, 'Weather'); assert.ok(!Object.hasOwn(calls[2].options.body, 'forged'))
  response = { success: true, data: entry }
  await assert.rejects(itineraryHistoryApi.get('h1'), /định dạng/)
})
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [] }
function mountStop(allowed) {
  let position = 0, render, calls = 0, finish
  const state = [], refs = []
  const hooks = { useCallback: f => f, useState(initial) { const i = position++; if (!(i in state)) state[i] = initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] }, useRef(initial) { const i = position++; return refs[i] ??= { current: initial } } }
  const response = new Promise(resolve => { finish = resolve })
  const query = { data: stop, loading: false, error: null, retry() {} }
  const { StopOperations } = load('components/StopOperations.tsx', {
    react: hooks, '@/shared/api': { useReadQuery: () => query }, '@/shared/auth': { useSessionAccess: () => ({ has: () => allowed, status: 'ready' }) },
    '@/shared/ui': Object.fromEntries(['Button', 'ButtonLink', 'Field', 'Loading', 'Notice', 'Panel'].map(key => [key, key])),
    '../api/itinerary-api': { itineraryApi: { reorderStop: () => { calls++; return response } } }, '../model/stop-operations': { stopOperations, validateStopOperation },
  })
  render = () => { position = 0; return nodes(StopOperations({ stop, stops: [stop, second], itineraryStatus: 'DRAFT', onChanged() {} })) }
  return { render, finish, calls: () => calls }
}
test('actual stop form asks confirmation, blocks permission denial and locks double submission (unit; no live write)', async () => {
  for (const allowed of [false, true]) {
    const page = mountStop(allowed)
    page.render().find(n => n.props?.id === 'stop-operation-value').props.onChange({ target: { value: '3' } })
    await page.render().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(page.calls(), 0)
    const submit = page.render().find(n => n.type === 'form').props.onSubmit
    const pending = submit({ preventDefault() {} }); const duplicate = submit({ preventDefault() {} })
    assert.equal(page.calls(), allowed ? 1 : 0)
    page.finish({}); await Promise.all([pending, duplicate])
  }
})
test('permission state comes from auth/me values; missing permissions never become ADMIN bypass', () => {
  const { decodeSessionAccess, setSessionAccess, useSessionAccess } = load(new URL('../../src/shared/auth/session-access.ts', import.meta.url), { react: { useSyncExternalStore: (_, read) => read() } })
  assert.throws(() => decodeSessionAccess({ userId: 'u', roles: ['ADMIN'] }), /không đầy đủ/)
  setSessionAccess(decodeSessionAccess({ userId: 'u', effectivePermissions: ['CRUISE_STOP_REORDER'] }))
  assert.equal(useSessionAccess().has('CRUISE_STOP_REORDER'), true); assert.equal(useSessionAccess().has('CRUISE_STOP_OMIT'), false)
  setSessionAccess({ status: 'error', userId: null, permissions: [], error: '403' }); assert.equal(useSessionAccess().has('CRUISE_STOP_REORDER'), false)
})
