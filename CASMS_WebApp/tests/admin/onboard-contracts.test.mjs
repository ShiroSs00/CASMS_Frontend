import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const root = new URL('../../src/', import.meta.url), jsx = (type, props) => ({ type, props })
class ApiError extends Error { constructor(message, status) { super(message); this.status = status } }
function load(file, imports) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText, {
    module, exports: module.exports, Error, AbortController, require(id) {
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (id.endsWith('.module.css')) return { default: {} }
      assert.ok(Object.hasOwn(imports, id), id); return imports[id]
    },
  }); return module.exports
}
const cruise = { cruiseId: 'cruise-1', cruiseName: 'QA', cruiseCode: 'QA', departureDatetime: '2026-10-21T00:00:00Z', returnDatetime: '2026-10-22T00:00:00Z' }
const draft = { cruiseId: cruise.cruiseId, activityCode: 'YOGA', activityName: 'Yoga', description: '', startTime: '2026-10-21T08:00:00Z', endTime: '2026-10-21T09:00:00Z', location: 'Boong chính', capacity: 20, price: 0, currencyCode: 'VND' }
const activity = { id: 'activity-1', cruiseId: cruise.cruiseId, code: 'YOGA', name: 'Yoga', startTime: draft.startTime, endTime: draft.endTime, status: 'PLANNED', capacity: 20 }
const service = { id: 'service-1', code: 'SPA', name: 'Spa', type: 'SPA', price: 100, currency: 'VND', status: 'ACTIVE' }
test('Activity validates actual Cruise, schedule, finite capacity/pricing, required fields and limits', () => {
  const { validateActivity } = load('features/activities/model/activity.ts', {})
  assert.equal(Object.keys(validateActivity(draft, [cruise])).length, 0)
  assert.equal(Object.keys(validateActivity({ ...draft, price: null, currencyCode: '' }, [cruise])).length, 0)
  for (const patch of [{ capacity: NaN }, { capacity: 0 }, { capacity: 1.5 }, { price: -1 }, { price: Infinity }, { currencyCode: 'VN' }, { startTime: '' }, { endTime: draft.startTime }, { endTime: '2026-10-23T00:00:00Z' }, { activityName: '' }, { activityCode: 'X'.repeat(51) }, { cruiseId: 'unselected' }]) assert.ok(Object.keys(validateActivity({ ...draft, ...patch }, [cruise])).length)
  assert.ok(validateActivity(draft, null).cruiseId)
})
test('Activity adapter uses measured contract shapes and does not default malformed availability to zero', async () => {
  const calls = [], transport = { ApiError, apiRequestRaw: async (path, decode, options) => {
    calls.push({ path, options }); return decode({ success: true, data: path.endsWith('availability') ? {} : path.endsWith('schedule-check') ? {} : options?.method ? activity : [activity] }, 200)
  } }
  const { activityApi } = load('features/activities/api/activity-api.ts', { '@/shared/api': transport })
  assert.equal((await activityApi.list()).length, 1)
  await assert.rejects(activityApi.availability(activity.id), /số chỗ/)
  await assert.rejects(activityApi.schedule(activity.id), /kiểm tra lịch/)
  await activityApi.save({ ...draft, unexpected: 'ignored' })
  assert.equal(calls.at(-1).options.method, 'POST')
  assert.equal(calls.at(-1).options.body.cruiseId, cruise.cruiseId)
  assert.equal(calls.at(-1).options.body.unexpected, undefined)
  assert.equal(calls.at(-1).options.body.startTime, new Date(draft.startTime).toISOString())
  await activityApi.save({ ...draft, price: null, currencyCode: '' }, activity.id)
  assert.equal(calls.at(-1).options.method, 'PUT')
  assert.equal(calls.at(-1).options.body.price, null)
  assert.equal(calls.at(-1).options.body.currencyCode, undefined)
})
test('new adapters propagate real 403/500 without converting failure to an empty list', async () => {
  for (const status of [403, 500]) {
    const transport = { ApiError, apiRequestRaw: async () => { throw new ApiError('actual HTTP failure', status) } }
    await assert.rejects(load('features/activities/api/activity-api.ts', { '@/shared/api': transport }).activityApi.list(), error => error.status === status)
    await assert.rejects(load('features/service-packages/api/service-package-api.ts', { '@/shared/api': transport, '../model/catalog-editor': load('features/service-packages/model/catalog-editor.ts', {}) }).servicePackageApi.list('services'), error => error.status === status)
  }
})
test('Catalog adapters distinguish empty, malformed DTO and wrong package benefits; all exposed calls are reads', async () => {
  const calls = []
  let payload = { success: true, data: [] }
  const transport = { ApiError, apiRequestRaw: async (path, decode, options) => { calls.push({ path, options }); return decode(payload, 200) } }
  const { servicePackageApi: api } = load('features/service-packages/api/service-package-api.ts', { '@/shared/api': transport, '../model/catalog-editor': load('features/service-packages/model/catalog-editor.ts', {}) })
  assert.equal((await api.list('services')).length, 0)
  payload = { success: true, data: [service] }; assert.equal((await api.list('services'))[0].name, service.name)
  payload = { success: true, data: {} }; await assert.rejects(api.list('services'), /Danh sách/)
  payload = { success: true, data: { ...service, price: 'invented' } }; await assert.rejects(api.get('services', service.id), /Không đọc/)
  payload = { success: true, data: { packageInfo: service, services: [], activities: [], excursions: [] } }
  await assert.rejects(api.benefits('wrong-package'), /không thuộc/)
  assert.equal((await api.benefits(service.id)).services.length, 0)
  assert.ok(calls.every(call => !call.options?.method || call.options.method === 'GET'))
  assert.ok(calls.every(call => !/schedule-check|\/sales/.test(call.path)))
})
test('new screen error states distinguish permission denial from BE expression failure and do not show fake empty success', () => {
  const imports = { '@/shared/api': { ApiError }, '@/shared/ui': { Button: 'Button', Loading: 'Loading', Notice: 'Notice' }, '@/shared/ui/admin-v3': { AdminShell: 'AdminShell' }, 'react-router': { Link: 'Link', useLocation: () => ({ pathname: '' }) }, '../model/catalog': { catalogConfig: {} } }
  for (const [file, name] of [['features/activities/components/ActivityUI.tsx', 'ActivityState'], ['features/service-packages/components/CatalogUI.tsx', 'CatalogState']]) {
    const render = load(file, imports)[name]
    const denied = render({ loading: false, error: new ApiError('Denied', 403), retry() {} })
    assert.match(denied.props.title, /quyền/); assert.equal(denied.props.tone, 'error')
    const broken = render({ loading: false, error: new ApiError('Failed to evaluate expression', 400), retry() {} })
    assert.match(JSON.stringify(broken), /kiểm tra quyền/); assert.ok(!JSON.stringify(broken).includes('evaluate expression'))
  }
})
test('read query aborts prior navigation and ignores late results, with error and retry kept explicit', async () => {
  const states = [], effects = []; let slot = 0
  const react = { useState(initial) { const index = slot++; if (!(index in states)) states[index] = initial; return [states[index], next => states[index] = typeof next === 'function' ? next(states[index]) : next] }, useEffect(effect) { effects.push(effect) } }
  const { useReadQuery } = load('shared/api/useReadQuery.ts', { react })
  let finishOld, finishNew
  const old = new Promise(resolve => { finishOld = resolve }), fresh = new Promise(resolve => { finishNew = resolve })
  const render = (key, load) => { slot = 0; return useReadQuery(key, load) }
  render('old', () => old); const cancelOld = effects.at(-1)()
  const pending = render('new', () => fresh); cancelOld(); effects.at(-1)()
  assert.equal(pending.loading, true)
  finishOld('stale'); finishNew('current'); await new Promise(resolve => setImmediate(resolve))
  const final = render('new', () => fresh); assert.equal(final.data, 'current'); assert.equal(final.loading, false)
  final.retry(); assert.equal(render('new', () => fresh).loading, true)
})
