import { reviewedSourceModule, explicitTestAccess } from '../helpers/reviewed-source-modules.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/features/cruises/pages/CruiseFormPage.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
}).outputText
const pendingRenders = new Set()
const flush = async () => { await new Promise(setImmediate); for(const render of pendingRenders) render(); await new Promise(setImmediate) }
const port = (name) => [{ portId: name, portName: name, status:'ACTIVE',countryCode:'' }]
const detail = (id) => ({ cruise: { cruiseId: id, cruiseCode: id, cruiseName: id, status: 'DRAFT', cruiseType: 'ONE_DAY', departureDatetime: '2026-10-18T01:00:00Z', returnDatetime: '2026-10-18T03:00:00Z', departurePortId: 'port', returnPortId: 'port' }, ship: null })
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [] }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '') }

// Execute the real component's effects with controlled promises; browser checks cover React Strict Mode.
function mount(cruiseId) {
  let params = { cruiseId }, stateIndex = 0, effectIndex = 0
  const state = [], effects = [], writes = [], requests = [], pending = new Set(), module = { exports: {} }
  const request = (method, args) => {
    let resolve, reject
    const promise = new Promise((yes, no) => { resolve = yes; reject = no })
    requests.push({ method, args, signal: args.at(-1), resolve, reject })
    return promise
  }
  const hooks = {
    useState(initial) { const index = stateIndex++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial; return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; writes.push(state[index]) }] },
    useCallback:fn=>fn, useRef: (current) => ({ current }),
    useEffect(setup, deps) { const index = effectIndex++, previous = effects[index]; if (!previous || deps.some((value, i) => value !== previous.deps[i])) pending.add(index); effects[index] = { setup, deps, cleanup: previous?.cleanup } },
  }
  const jsx = (type, props) => ({ type, props })
  vm.runInNewContext(source, { module, exports: module.exports, AbortController, Error, Date, URLSearchParams, structuredClone, require(id) {
    if (id === 'react') return hooks
    if (id === 'react-router') return { useLocation:()=>({search:''}), useSearchParams:()=>[new URLSearchParams()], useParams: () => params, useNavigate: () => () => {} }
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === '@/shared/api') return {ApiError:Error,useReadQuery:()=>({data:null,loading:false,error:null})};
    if (id.includes('/components/')&&!id.endsWith('/CruiseUI')) return Object.fromEntries(['InheritedSourcePlan','DepartureMilestones','DepartureSourcePicker','DepartureSchedulePreview','CruiseSourceDetails'].map(name=>[name,name]));
    if (id === '@/shared/ui') return Object.fromEntries(['EditorLayout','FormErrorSummary','FormSection','ButtonLink','PermissionLink','Button', 'Field', 'Loading', 'Notice', 'PageHeader', 'Panel'].map((name) => [name, name]))
    if (id.endsWith('/CruiseUI')) return { CruiseFrame: 'CruiseFrame' }
    if (id.endsWith('/cruise-api')) return { cruiseApi: { getDetail: (...args) => request('getDetail', args), listPorts: (...args) => request('listPorts', args) } }
    if (id.endsWith('.module.css')) return { default: {} }
    if (id.endsWith('/cruise-validation')) return { localCruiseInput:value=>value.slice(0,16) }
      if (id === '@/shared/auth') return { useSessionAccess: () => explicitTestAccess(['CRUISE_MANAGER'], ['CRUISE_READ','CRUISE_UPDATE_DRAFT','ITINERARY_READ','ITINERARY_UPDATE_DRAFT']) }
      const reviewed = reviewedSourceModule(id); if(reviewed) return reviewed; throw new Error('Unexpected import: ' + id)
  } })
  const render = () => { stateIndex = 0; effectIndex = 0; return module.exports.CruiseFormPage() }
  const run = () => { for (const index of pending) { effects[index].cleanup?.(); effects[index].cleanup = effects[index].setup() } pending.clear() }
  render(); run()
  const settle = () => { render(); run() }; pendingRenders.add(settle)
  return {
    requests, writes, view: render,
    navigate(id) { params = { cruiseId: id }; render(); run() },
    replay() { for (const effect of effects) effect.cleanup?.(); for (const effect of effects) effect.cleanup = effect.setup() },
    unmount() { pendingRenders.delete(settle); for (const effect of effects) effect.cleanup?.() },
    errors() { return nodes(render()).filter((node) => node.type === 'Notice' && node.props.tone === 'error').map(text) },
    options() { return nodes(render()).filter((node) => node.type === 'option').map(text) },
    name() { return nodes(render()).find((node) => node.props?.id === 'cruise-name')?.props.value },
    loading() { return nodes(render()).some((node) => node.type === 'Loading') },
  }
}

test('Cruise cleanup aborts both loads and cancelled rejections perform no state writes', async () => {
  const page = mount('old')
  page.unmount()
  for (const request of page.requests) {
    assert.equal(request.signal?.aborted, true, request.method)
    request.reject(new DOMException('signal is aborted without reason', 'AbortError'))
  }
  await flush()
  assert.deepEqual(page.writes, [])
})

test('Cruise Strict Mode replay keeps only fresh ports/detail, with no extra requests on rerender', async () => {
  const page = mount('current')
  page.replay()
  assert.equal(page.requests.length, 2)
  const [oldDetail, currentDetail] = page.requests
  assert.equal(oldDetail.signal.aborted, true)
  currentDetail.resolve(detail('current')); await flush(); const currentPorts=page.requests.at(-1); currentPorts.resolve(port('Fresh port'))
  await flush()
  oldDetail.resolve(detail('stale'))
  await flush()
  assert.equal(page.name(), 'current')
  assert.ok(page.options().includes('Fresh port'))
  assert.ok(!page.options().includes('Stale port'))
  assert.deepEqual(page.errors(), [])
  page.view()
  assert.equal(page.requests.length, 3)
  page.unmount()
})

test('Cruise replacement ignores stale error/finally while the newer detail is pending', async () => {
  const page = mount('old'), old = page.requests[0]
  page.navigate('new')
  assert.equal(old.signal?.aborted, true)
  old.reject(new Error('stale HTTP 500'))
  await flush()
  assert.equal(page.loading(), true)
  page.requests.find((request) => request.method === 'getDetail' && request.args[0] === 'new').resolve(detail('new')); await flush()
  page.requests.find((request) => request.method === 'listPorts').resolve(port('Port'))
  await flush()
  assert.equal(page.name(), 'new')
  assert.deepEqual(page.errors(), [])
  page.unmount()
})

test('Cruise genuine failures remain visible, including AbortError when this effect was not cancelled', async (context) => {
  for (const method of ['listPorts', 'getDetail']) for (const message of ['HTTP 401: phiên đăng nhập hết hạn', 'HTTP 403: không có quyền', 'HTTP 500: lỗi máy chủ', 'Không kết nối được backend.', 'Yêu cầu quá thời gian.', 'AbortError from an active request']) await context.test(`${method}: ${message}`, async () => {
    const page = mount('current')
    const handled=new Set()
    for(let round=0;round<2;round++){ for (const request of page.requests) {
      if(handled.has(request))continue; handled.add(request)
      if (request.method === method) request.reject(message.startsWith('AbortError') ? new DOMException(message, 'AbortError') : new Error(message))
      else request.resolve(request.method === 'getDetail' ? detail('current') : port('Port'))
    }
    await flush() }
    assert.ok(page.errors().some((error) => error.includes(message)))
    page.unmount()
  })
})

test('Cruise remount retries a failed lookup using a fresh signal', async () => {
  const failed = mount('current'), oldRequest = failed.requests[0]
  oldRequest.reject(new Error('Không kết nối được backend.')); await flush()
  assert.equal(failed.errors().length, 1)
  failed.unmount()
  const retry = mount('current'), request = retry.requests[0]
  assert.notEqual(request.signal, oldRequest.signal)
  request.resolve(detail('current')); await flush(); retry.requests.at(-1).resolve(port('Recovered port')); await flush()
  assert.ok(retry.options().includes('Recovered port'))
  assert.deepEqual(retry.errors(), [])
  retry.unmount()
})
