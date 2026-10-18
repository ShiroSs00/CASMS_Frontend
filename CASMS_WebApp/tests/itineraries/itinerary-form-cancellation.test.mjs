import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/features/itineraries/pages/ItineraryPages.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
}).outputText
const flush = () => new Promise(setImmediate)
const item = (id) => ({ itineraryId: id, cruiseId: 'cruise-' + id, itineraryName: id, startDate: '2026-10-18', endDate: '2026-10-19', itineraryType: 'ROUND_TRIP', status: 'DRAFT' })
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [] }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '') }

// Exercise the actual form effect with deterministic cleanup, replay and out-of-order API completion.
function mount(itineraryId) {
  let params = { itineraryId }, stateIndex = 0, effectIndex = 0
  const state = [], effects = [], writes = [], requests = [], pending = new Set(), module = { exports: {} }
  const hooks = {
    useState(initial) { const index = stateIndex++; if (!(index in state)) state[index] = initial; return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; writes.push(state[index]) }] },
    useRef: (current) => ({ current }), useCallback: (fn) => fn,
    useEffect(setup, deps) { const index = effectIndex++, previous = effects[index]; if (!previous || deps.some((value, i) => value !== previous.deps[i])) pending.add(index); effects[index] = { setup, deps, cleanup: previous?.cleanup } },
  }
  const jsx = (type, props) => ({ type, props })
  vm.runInNewContext(source, { module, exports: module.exports, AbortController, Error, Date, require(id) {
    if (id === 'react') return hooks
    if (id === 'react-router') return { useParams: () => params, useNavigate: () => () => {} }
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === '@/shared/ui') return Object.fromEntries(['Button', 'ButtonLink', 'DataTable', 'Empty', 'Field', 'Loading', 'Notice', 'PageHeader', 'Panel'].map((name) => [name, name]))
    if (id.endsWith('/ItineraryUI')) return { ItineraryFrame: 'ItineraryFrame' }
    if (id.endsWith('/itinerary-api')) return { itineraryApi: { get(id, signal) { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); requests.push({ id, signal, resolve, reject }); return promise } } }
    if (id.endsWith('.module.css')) return { default: {} }
    if (id === './ItineraryDetailPage') return {}
    throw new Error('Unexpected import: ' + id)
  } })
  const render = () => { stateIndex = 0; effectIndex = 0; return module.exports.ItineraryFormPage() }
  const run = () => { for (const index of pending) { effects[index].cleanup?.(); effects[index].cleanup = effects[index].setup() } pending.clear() }
  render(); run()
  return {
    requests, writes, view: render,
    navigate(id) { params = { itineraryId: id }; render(); run() },
    replay() { for (const effect of effects) effect.cleanup?.(); for (const effect of effects) effect.cleanup = effect.setup() },
    unmount() { for (const effect of effects) effect.cleanup?.() },
    errors() { return nodes(render()).filter((node) => node.type === 'Notice' && node.props.tone === 'error').map(text) },
    name() { return nodes(render()).find((node) => node.props?.id === 'itinerary-name')?.props.value },
    loading() { return nodes(render()).some((node) => node.type === 'Loading') },
    saveDisabled() { return nodes(render()).find((node) => node.type === 'Button' && node.props.type === 'submit')?.props.disabled },
  }
}

test('Itinerary cleanup cancellation never changes error, draft, editability or loading state', async () => {
  for (const outcome of ['reject', 'resolve']) {
    const page = mount('old'), request = page.requests[0]
    page.unmount(); assert.equal(request.signal.aborted, true)
    if (outcome === 'reject') request.reject(new DOMException('signal is aborted without reason', 'AbortError'))
    else request.resolve(item('stale'))
    await flush()
    assert.deepEqual(page.writes, [])
  }
})

test('Itinerary Strict Mode replay ignores the cancelled failure and does not duplicate loads on rerender', async () => {
  const page = mount('current')
  page.replay()
  assert.equal(page.requests.length, 2)
  page.requests[0].reject(new DOMException('signal is aborted without reason', 'AbortError'))
  page.requests[1].resolve(item('current'))
  await flush()
  assert.equal(page.name(), 'current')
  assert.equal(page.saveDisabled(), false)
  assert.deepEqual(page.errors(), [])
  page.view(); assert.equal(page.requests.length, 2)
  page.unmount()
})

test('Itinerary replaced requests cannot dismiss current loading or overwrite a newer draft/editability', async () => {
  for (const outcome of ['reject', 'resolve']) {
    const page = mount('old'), old = page.requests[0]
    page.navigate('current')
    assert.equal(old.signal.aborted, true)
    if (outcome === 'reject') old.reject(new Error('stale HTTP 403'))
    else old.resolve({ ...item('stale'), status: 'APPROVED' })
    await flush()
    assert.equal(page.loading(), true)
    page.requests[1].resolve(item('current')); await flush()
    assert.equal(page.name(), 'current')
    assert.equal(page.saveDisabled(), false)
    assert.deepEqual(page.errors(), [])
    page.unmount()
  }
  const page = mount('old'), old = page.requests[0]
  page.navigate('current'); page.requests[1].resolve(item('current')); await flush()
  old.resolve(item('stale')); await flush()
  assert.equal(page.name(), 'current')
  assert.equal(page.saveDisabled(), false)
  assert.deepEqual(page.errors(), [])
  page.unmount()
})

test('Itinerary genuine HTTP, authorization, network and timeout failures stay visible', async (context) => {
  for (const message of ['HTTP 401: phiên đăng nhập hết hạn', 'HTTP 403: không có quyền', 'HTTP 500: lỗi máy chủ', 'Không kết nối được backend.', 'Yêu cầu quá thời gian.', 'AbortError from an active request']) await context.test(message, async () => {
    const page = mount('current')
    page.requests[0].reject(message.startsWith('AbortError') ? new DOMException(message, 'AbortError') : new Error(message))
    await flush()
    assert.equal(page.loading(), false)
    assert.equal(page.saveDisabled(), true)
    assert.ok(page.errors().some((error) => error.includes(message)))
    page.unmount()
  })
})

test('Itinerary remount retries with a fresh signal and preserves non-DRAFT editing restrictions', async () => {
  const failed = mount('current'), old = failed.requests[0]
  old.reject(new Error('Không kết nối được backend.')); await flush()
  assert.equal(failed.errors().length, 1); failed.unmount()
  const retry = mount('current'), request = retry.requests[0]
  assert.notEqual(request.signal, old.signal)
  request.resolve({ ...item('current'), status: 'APPROVED' }); await flush()
  assert.equal(retry.name(), 'current')
  assert.equal(retry.saveDisabled(), true)
  assert.deepEqual(retry.errors(), ['Chỉ lịch trình ở trạng thái DRAFT mới được chỉnh sửa thông tin.'])
  retry.unmount()
})
