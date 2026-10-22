import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
function load(url, imports) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, { module, exports: module.exports, Error, require: id => { assert.ok(Object.hasOwn(imports, id), id); return imports[id] } })
  return module.exports
}
const cruise = { cruiseId: 'cruise-1', shipId: null, departurePortId: 'port-1', returnPortId: 'port-2', status: 'DRAFT' }
const plan = { itineraryId: 'itinerary-1', cruiseId: cruise.cruiseId, itineraryName: 'Hải trình thật', status: 'DRAFT', startDate: '2026-10-21', endDate: '2026-10-24' }
function api(overrides = {}) {
  const calls = []
  const { cruiseApi } = load(new URL('../../src/features/cruises/api/cruise-api.ts', import.meta.url), { '../model/cruise-validation': load(new URL('../../src/features/cruises/model/cruise-validation.ts', import.meta.url), {}), '@/shared/api': { apiRequest: async (path, options) => {
    calls.push([path, options])
    if (Object.hasOwn(overrides, path)) return overrides[path](options)
    if (path === '/cruise/cruise-1') return cruise
    if (path.startsWith('/ports/')) return { portId: path.split('/').at(-1), portName: 'Cảng thật' }
    if (path.endsWith('/readiness')) return { ready: false, issues: ['Chưa phân công tàu'] }
    if (path === '/operational-issues') return []
    if (path.endsWith('/regulations/effective')) return { direct: [], inherited: [] }
    if (path === '/itineraries') return { content: options.query.page === 0 ? [] : [plan], totalPages: 2 }
    throw Error('Unexpected: ' + path)
  } } })
  return { cruiseApi, calls }
}
test('Cruise detail links its actual itinerary across pages and publishes core before supplements', async () => {
  const { cruiseApi, calls } = api(); let core
  const detail = await cruiseApi.getDetail('cruise-1', undefined, value => { core = value; assert.equal(calls.length, 1) })
  assert.equal(core.cruise.cruiseId, cruise.cruiseId); assert.equal(core.readiness.state, 'UNKNOWN')
  assert.equal(detail.itinerary.itineraryId, plan.itineraryId)
  assert.equal(detail.itinerary.dayCount, null)
  assert.ok(calls.some(([path, options]) => path === '/itineraries' && options.query.page === 1))
})
test('readiness, itinerary, port, issue and regulation failures keep authoritative Cruise core with explicit errors', async () => {
  const fail = async () => { throw Error('403 no permission') }
  const { cruiseApi } = api({ '/itineraries': fail, '/cruise/cruise-1/readiness': fail, '/ports/port-1': fail, '/operational-issues': fail, '/cruises/cruise-1/regulations/effective': fail })
  const detail = await cruiseApi.getDetail('cruise-1')
  assert.equal(detail.cruise.cruiseId, cruise.cruiseId); assert.equal(detail.readiness.state, 'UNKNOWN')
  for (const key of ['itinerary', 'readiness', 'departurePort', 'issues', 'regulations']) assert.match(detail.supplementaryErrors[key], /403/)
  assert.equal(detail.capacity.activePassengerCount, null)
  assert.equal(detail.departurePort.status, 'UNKNOWN')
})
test('authoritative Cruise error is preserved, never converted to a supplementary error', async () => {
  await assert.rejects(api({ '/cruise/cruise-1': async () => { throw Error('500 core failed') } }).cruiseApi.getDetail('cruise-1'), /500 core failed/)
})
test('Itinerary core remains available when Days/Stops/Ports fail; errors are distinguished from empty', async () => {
  const fail = async () => { throw Error('403 supplement') }
  const { fetchEditor } = load(new URL('../../src/features/itineraries/hooks/useItineraryEditor.ts', import.meta.url), { react: {}, '../api/itinerary-api': { itineraryApi: { get: async () => plan, listDays: fail, listStops: fail, activePorts: fail, activeDestinations: async () => [] } } })
  let core
  const detail = await fetchEditor('itinerary-1', undefined, value => { core = value })
  assert.equal(core.itinerary.itineraryId, plan.itineraryId)
  assert.equal(core.supplementaryLoading, true)
  assert.deepEqual(Object.keys(detail.supplementaryErrors).sort(), ['days', 'ports', 'stops'])
  assert.equal(detail.supplementaryLoading, false)
})
