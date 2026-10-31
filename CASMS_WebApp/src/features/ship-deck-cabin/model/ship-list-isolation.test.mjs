import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import * as model from './ship-list-types.ts'

const root = new URL('../', import.meta.url)
class ApiError extends Error { constructor(message, status) { super(message); this.status = status } }
function load(file, imports) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, Error, require(id) {
    assert.ok(Object.hasOwn(imports, id), `Unexpected import ${id}`)
    return imports[id]
  } })
  return module.exports
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const fields = ['capacity', 'readiness', 'currentCruise']
const values = { capacity: { deckCount: 2, cabinCount: 3 }, readiness: 'READY', currentCruise: null }
const base = () => model.shipListState(['one', 'two'].map(id => ({ id, name: id, code: id, status: 'READY', capacity: { status: 'loading' }, readiness: { status: 'loading' }, currentCruise: { status: 'loading' } })))

function hook(repository) {
  const slots = []; let index = 0, revision = 0; const effects = []
  const react = {
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value }] },
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial } },
    useSyncExternalStore() { return revision },
    useEffect(fn, deps) {
      const slot = index++; const previous = slots[slot]
      if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) effects.push(() => { previous?.cleanup?.(); slots[slot] = { deps, cleanup: fn() } })
    },
  }
  const { useShipList } = load('model/useShipList.ts', { react, '@/shared/api': { ApiError }, '../api/ship-deck-cabin-api': { shipDeckCabinApi: {} }, './ship-list-types': model })
  return {
    render() { index = 0; const result = useShipList(repository); while (effects.length) effects.shift()(); return result },
    revise() { revision++ },
  }
}

for (const failed of fields) test(`${failed} failure preserves base rows, independent data and focused retry`, async () => {
  const requests = []
  const app = hook({ load: async () => base(), loadField(id, field) { const result = deferred(); requests.push({ id, field, ...result }); return result.promise } })
  app.render(); await flush()
  let view = app.render()
  assert.equal(view.state.status, 'data')
  assert.equal(view.state.data.items.length, 2)
  assert.equal(view.state.data.metrics.configuredCabinCount, null)
  assert.equal(view.state.data.metrics.attentionCount, null)
  for (const request of requests) {
    if (request.id === 'one' && request.field === failed) request.reject(new ApiError('Network failed', 0))
    else request.resolve(values[request.field])
  }
  await flush(); view = app.render()
  const [one, two] = view.state.data.items
  assert.equal(one[failed].status, 'unavailable')
  for (const field of fields.filter(field => field !== failed)) assert.equal(one[field].status, 'loaded')
  for (const field of fields) assert.equal(two[field].status, 'loaded')
  assert.equal(view.state.data.metrics.configuredCabinCount, failed === 'capacity' ? null : 6)
  assert.equal(view.state.data.metrics.attentionCount, failed === 'readiness' ? null : 0)
  view.retrySupplement('one', failed)
  assert.equal(requests.length, 7)
  assert.equal(app.render().state.data.items[0][failed].status, 'loading')
  requests.at(-1).resolve(values[failed]); await flush()
  assert.equal(app.render().state.data.items[0][failed].status, 'loaded')
})

test('403 is denied, arbitrary 404/500 are unavailable; unknown readiness never matches READY or BLOCKED', async () => {
  for (const status of [403, 404, 500]) {
    const app = hook({ load: async () => base(), loadField: async () => { throw new ApiError('Not available', status) } })
    app.render(); await flush(); const data = app.render().state.data
    assert.equal(data.items[0].readiness.status, status === 403 ? 'denied' : 'unavailable')
    for (const readiness of ['READY', 'ATTENTION', 'BLOCKED']) assert.equal(model.filterShips(data.items, { ...model.emptyShipFilters, readiness }).length, 0)
    assert.equal(model.filterShips(data.items, model.emptyShipFilters).length, 2)
  }
})

test('old list and field completions cannot overwrite a newer revision or a newer retry', async () => {
  const loads = [], requests = []
  const app = hook({ load() { const result = deferred(); loads.push(result); return result.promise }, loadField(id, field) { const result = deferred(); requests.push({ id, field, ...result }); return result.promise } })
  app.render(); app.revise(); app.render()
  loads[0].resolve(base()); await flush()
  assert.equal(app.render().state.status, 'loading')
  assert.equal(requests.length, 0)
  loads[1].resolve(base()); await flush()
  app.render().retrySupplement('one', 'readiness')
  requests.at(-1).resolve('ATTENTION'); await flush()
  requests.find(request => request.id === 'one' && request.field === 'readiness').resolve('READY'); await flush()
  assert.equal(app.render().state.data.items[0].readiness.data, 'ATTENTION')
  app.revise(); app.render(); loads[2].resolve(base()); await flush()
  requests[0].resolve(values.capacity); await flush()
  assert.equal(app.render().state.data.items[0].capacity.status, 'loading')
})

test('base Ship GET failures remain list errors', async () => {
  const app = hook({ load: async () => { throw new ApiError('Ship GET failed', 500) } })
  app.render(); await flush()
  assert.equal(app.render().state.status, 'error')
  assert.equal(app.render().state.message, 'Ship GET failed')
})

test('base adapter requests only Ships; malformed capacity/readiness and unrecognized cruise errors stay errors', async () => {
  const requests = []
  let response
  const { shipDeckCabinApi: api } = load('api/ship-deck-cabin-api.ts', { '@/shared/api': { ApiError, apiRequest: async path => {
    requests.push(path)
    if (path === '/ships') return { content: [{ shipId: 'one', shipName: 'One', shipCode: 'S1', status: 'READY' }], totalPages: 1, totalElements: 1 }
    if (response instanceof Error) throw response
    return response
  } } })
  const signal = new AbortController().signal
  assert.equal((await api.loadShipList(signal)).items.length, 1)
  assert.deepEqual(requests, ['/ships'])
  response = { actualDeckCount: null, actualCabinCount: 0 }
  await assert.rejects(api.loadShipListField('one', 'capacity', signal))
  response = 'false'
  await assert.rejects(api.loadShipListField('one', 'readiness', signal))
  response = false
  assert.equal(await api.loadShipListField('one', 'readiness', signal), 'ATTENTION')
  for (const [message, status, expectedEmpty] of [['No active cruise found for ship currently', 404, true], ['Ship missing', 404, false], ['Denied', 403, false], ['Server failed', 500, false]]) {
    response = new ApiError(message, status)
    if (expectedEmpty) assert.equal(await api.loadShipListField('one', 'currentCruise', signal), null)
    else await assert.rejects(api.loadShipListField('one', 'currentCruise', signal))
  }
})
