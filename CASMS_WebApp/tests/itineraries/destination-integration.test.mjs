import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as model from '../../src/features/itineraries/model/itinerary.ts'
const root = new URL('../../src/features/itineraries/', import.meta.url)
const destination = { destinationId: 'destination-1', destinationName: 'ABC', countryCode: 'VN', description: 'Original description', status: 'ACTIVE' }
const summary = { portId: 'port-1', portCode: 'VN-HPH', portName: 'Hải Phòng' }
class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code } }
const jsx = (type, props) => ({ type, props })
const plain = value => JSON.parse(JSON.stringify(value))
const flush = () => new Promise(setImmediate)
function load(file, imports, globals = {}) {
  const module = { exports: {} }, code = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, Error, ...globals, require(id) { if(id === '@/shared/auth') return imports[id] ?? {useSessionAccess:()=>({status:'ready',userId:'test-user',has:()=>true})}; if(id === '../model/permissions') return {entityPermission:(kind,action)=>({ships:'SHIP',decks:'DECK',cabins:'CABIN'})[kind]+'_'+action,operationPermission:()=> 'TEST_PERMISSION'};
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    assert.ok(Object.hasOwn(imports, id), 'Unexpected import ' + id); return imports[id]
  } }); return module.exports
}
test('Destination validation mirrors create required fields and documented size/enum limits', () => {
  const valid = { destinationName: 'A'.repeat(200), countryCode: 'VN', description: 'A'.repeat(1000), status: 'ACTIVE' }
  assert.deepEqual(model.validateDestinationDraft(valid), {})
  for (const [key, value] of [['destinationName', ''], ['destinationName', '   '], ['destinationName', 'A'.repeat(201)], ['countryCode', 'V'], ['countryCode', 'VNN'], ['description', 'A'.repeat(1001)], ['status', 'UNKNOWN']]) assert.ok(model.validateDestinationDraft({ ...valid, [key]: value })[key])
  assert.deepEqual(model.validateDestinationDraft({ ...valid, status: 'INACTIVE', description: null }), {})
})
test('Destination Edit clears description, preserves existing required-name policy and ignores immutable fields', () => {
  assert.deepEqual(model.validateDestinationDraft({ destinationName: 'Destination', countryCode: '', description: '', status: 'unknown' }, true), {})
  assert.ok(model.validateDestinationDraft({ ...destination, destinationName: '' }, true).destinationName)
  assert.ok(model.validateDestinationDraft({ ...destination, destinationName: 'A'.repeat(201) }, true).destinationName)
})
test('Destination serializers send only contract fields; PATCH preserves explicit empty description', async () => {
  const calls = [], api = load('api/itinerary-api.ts', { '@/shared/api': { ApiError, apiRequest: async (endpoint, options) => { calls.push({ endpoint, options }); return destination } } }).itineraryApi
  await api.createDestination({ ...destination, ports: [summary], createdAt: 'not-a-request-field' })
  await api.updateDestination(destination.destinationId, { ...destination, description: '' })
  assert.deepEqual(plain(calls), [
    { endpoint: '/destinations', options: { method: 'POST', body: { destinationName: 'ABC', countryCode: 'VN', description: 'Original description', status: 'ACTIVE' } } },
    { endpoint: '/destinations/destination-1', options: { method: 'PATCH', body: { destinationName: 'ABC', description: '' } } },
  ])
})
test('Destination read adapter preserves real summary shape, pagination, signal and encoded path', async () => {
  const calls = [], signal = new AbortController().signal
  const api = load('api/itinerary-api.ts', { '@/shared/api': { ApiError, apiRequest: async (endpoint, options) => { calls.push({ endpoint, options }); return endpoint.endsWith('/ports') ? [summary] : { content: [destination], number: 1, size: 20, totalPages: 3, totalElements: 41 } } } }).itineraryApi
  const list = await api.listDestinations(2, signal); assert.equal(list.page, 2); assert.equal(list.total, 41)
  assert.deepEqual(plain(await api.destinationPorts('a/b', signal)), [summary]); assert.equal(calls[0].options.query.page, 1); assert.equal(calls[0].options.query.sort, 'destinationName,asc'); assert.equal(calls[0].options.signal, signal); assert.equal(calls[1].endpoint, '/destinations/a%2Fb/ports')
})

// Virtual component handlers only. No HTTP transport or live form submission exists here.
function mount(component, params = { destinationId: destination.destinationId }, granted = true) {
  const slots = [], effects = [], pending = new Set(), requests = [], calls = [], writes = []
  let index = 0, effectIndex = 0, focused = 0
  const react = {
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], next => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; writes.push(slot) }] },
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial === null ? { querySelector: () => ({ focus() { focused++ } }) } : initial } },
    useCallback(fn, deps) { const slot = index++, old = slots[slot]; if (!old || deps.some((value, i) => value !== old.deps[i])) slots[slot] = { fn, deps }; return slots[slot].fn },
    useEffect(setup, deps) { const slot = effectIndex++, old = effects[slot]; if (!old || deps.some((value, i) => value !== old.deps[i])) pending.add(slot); effects[slot] = { setup, deps, cleanup: old?.cleanup } },
  }
  const api = new Proxy({}, { get: (_, name) => (...args) => {
    calls.push({ name, args }); let resolve, reject
    const promise = new Promise((yes, no) => { resolve = yes; reject = no }); requests.push({ name, args, resolve, reject }); return promise
  } })
  const pages = load('pages/MasterDataPages.tsx', { '@/shared/auth': {useSessionAccess:()=>({status:'ready',userId:'test-user',has:()=>granted})}, react, 'react-router': { useSearchParams:()=>[{get:()=>null}], Link: 'Link', useParams: () => params, useNavigate: () => route => calls.push({ name: 'navigate', args: [route] }) }, '@/shared/ui': Object.fromEntries(['Badge','Button','ButtonLink','DataTable','Empty','Field','Loading','Modal','Notice','PageHeader','Panel'].map(key => [key,key])), '@/shared/api': { ApiError }, '../api/itinerary-api': { itineraryApi: api }, '../model/itinerary': model, '../components/ItineraryUI': { ItineraryFrame: 'ItineraryFrame' } }, { requestAnimationFrame: callback => callback() })
  function flatten(tree) { if (Array.isArray(tree)) return tree.flatMap(flatten); if (!tree || typeof tree !== 'object') return []; if (typeof tree.type === 'function') return flatten(tree.type(tree.props)); return [tree, ...flatten(tree.props?.children)] }
  const view = () => { index = 0; effectIndex = 0; const tree = flatten(jsx(pages[component], {})); for (const i of pending) { effects[i].cleanup?.(); effects[i].cleanup = effects[i].setup() } pending.clear(); return tree }
  const find = (type, predicate = () => true) => view().find(node => node.type === type && predicate(node.props))
  const change = (id, value) => { find(id === 'master-description' ? 'textarea' : id === 'master-status' ? 'select' : 'input', props => props.id === id).props.onChange({ target: { value } }) }
  const submit = () => find('form').props.onSubmit({ preventDefault() {} })
  view()
  return { view, find, change, submit, requests, calls, writes, focused: () => focused, unmount() { for (const effect of effects) effect.cleanup?.() } }
}
test('Destination core stays visible on Ports failure/403 and retries only related Ports', async () => {
  for (const status of [403, 500]) {
    const app = mount('DestinationDetailPage'); app.requests.find(r => r.name === 'getDestination').resolve(destination); app.requests.find(r => r.name === 'destinationPorts').reject(new ApiError('Unavailable', status)); await flush()
    assert.equal(app.find('PageHeader').props.title, 'ABC'); assert.ok(app.find('DataTable', props => props.label === 'Thông tin điểm đến')); assert.ok(app.find('Notice', props => props.title === 'Không tải được cảng liên kết')); assert.ok(!app.find('Empty'))
    app.find('Button', props => props.children === 'Thử lại').props.onClick(); app.view(); assert.equal(app.requests.filter(r => r.name === 'getDestination').length, 1); assert.equal(app.requests.filter(r => r.name === 'destinationPorts').length, 2)
    app.requests.at(-1).resolve([summary]); await flush(); const table = app.find('DataTable', props => props.label === 'Cảng thuộc điểm đến'); assert.deepEqual(Array.from(table.props.headers), ['Mã','Tên cảng','']); assert.ok(app.find('Link', props => props.to === '/admin/ports/port-1'))
  }
})
test('Related Ports loading/empty/malformed states are distinct and do not fabricate a timezone', async () => {
  const app = mount('DestinationDetailPage'); app.requests[0].resolve(destination); await flush(); assert.ok(app.find('Loading', p => p.label === 'Đang tải cảng liên kết…')); assert.ok(!app.find('Empty'))
  app.requests[1].resolve([]); await flush(); assert.ok(app.find('Empty', props => props.title === 'Chưa có cảng liên kết'))
  const malformed = mount('DestinationDetailPage'); malformed.requests[0].resolve(destination); malformed.requests[1].resolve(null); await flush(); assert.ok(malformed.find('Notice', p => p.title === 'Không tải được cảng liên kết')); assert.ok(!malformed.find('Empty'))
})
test('Destination core failures are errors with a working retry and never a fake empty record', async () => {
  const app = mount('DestinationDetailPage'); app.requests[0].reject(new ApiError('Record missing', 404)); app.requests[1].resolve([]); await flush(); assert.ok(!app.find('DataTable')); assert.ok(!app.find('Empty')); app.find('Button', p => p.children === 'Thử lại').props.onClick(); app.view(); app.requests.at(-1).resolve(destination); await flush(); assert.equal(app.find('PageHeader').props.title, 'ABC')
})
test('Destination cleanup aborts requests and ignores late core/Ports completion', async () => {
  const app = mount('DestinationDetailPage'); const before = app.writes.length; app.unmount(); for (const r of app.requests) { assert.equal(r.args[1].aborted, true); r.resolve(r.name === 'getDestination' ? destination : [summary]) } await flush(); assert.equal(app.writes.length, before)
})
test('Destination List failure is not empty success; retry replaces it with real rows', async () => {
  const app = mount('DestinationListPage', {}); app.requests[0].reject(new ApiError('Denied', 403)); await flush(); assert.ok(app.find('Notice')); assert.ok(!app.find('Empty')); assert.ok(!app.find('DataTable')); app.find('Button', p => p.children === 'Thử lại').props.onClick(); app.view(); app.requests.at(-1).resolve({ items: [destination], page: 1, pageCount: 1, total: 1 }); await flush(); assert.ok(app.find('DataTable')); assert.ok(!app.find('Notice')); assert.equal(app.find('Badge').props.label, 'Đang hoạt động')
})
test('Destination Create inline validation focuses first invalid field and blocks any save', async () => {
  const app = mount('DestinationFormPage', {}); await app.submit(); assert.equal(app.focused(), 1); assert.equal(app.find('input', p => p.id === 'master-name').props['aria-invalid'], true); assert.equal(app.calls.length, 0)
})
test('Destination Edit locks immutable fields and sends empty description to clear it', async () => {
  const app = mount('DestinationFormPage'); app.requests[0].resolve(destination); await flush(); assert.equal(app.find('input', p => p.id === 'master-country').props.disabled, true); assert.equal(app.find('select', p => p.id === 'master-status').props.disabled, true)
  app.change('master-description', ''); const save = app.submit(); const call = app.requests.find(r => r.name === 'updateDestination'); assert.equal(call.args[1].description, ''); call.resolve(destination); await save
})
test('Destination API errors keep the draft, release Save, reject duplicates and allow retry', async () => {
  const app = mount('DestinationFormPage', {}); app.change('master-name','New Destination'); app.change('master-country','vn'); const first = app.submit(), second = app.submit(); await second
  assert.equal(app.requests.filter(r => r.name === 'createDestination').length, 1); assert.equal(app.requests[0].args[0].countryCode,'VN'); assert.equal(app.find('Button', p => p.type === 'submit').props.disabled,true)
  app.requests[0].reject(new Error('Temporary failure')); await first; assert.equal(app.find('input', p => p.id === 'master-name').props.value,'New Destination'); assert.equal(app.find('Button', p => p.type === 'submit').props.disabled,false)
  const retry = app.submit(); app.requests.at(-1).reject(new ApiError('Name exists',409,'DESTINATION_NAME_EXISTS')); await retry; assert.ok(app.find('Field', p => p.htmlFor === 'master-name').props.error); assert.equal(app.focused(),1)
})
test('Destination Edit load errors offer retry; cleanup cancellation cannot alter form state', async () => {
  const app = mount('DestinationFormPage'); app.requests[0].reject(new Error('Network failure')); await flush(); assert.ok(!app.find('form')); app.find('Button', p => p.children === 'Thử lại').props.onClick(); app.view(); app.requests.at(-1).resolve(destination); await flush(); assert.ok(app.find('form'))
  const pending = mount('DestinationFormPage'); const before = pending.writes.length; pending.unmount(); pending.requests[0].reject(new DOMException('aborted','AbortError')); await flush(); assert.equal(pending.writes.length,before)
})
test('Port Create/Edit controls, payload, detail fetch and native validation remain unchanged', async () => {
  const app = mount('PortFormPage', {}); assert.equal(app.find('form').props.noValidate,false); assert.equal(app.find('input', p => p.id === 'master-country').props.disabled,false); assert.equal(app.find('select', p => p.id === 'master-status').props.disabled,false)
  for (const [id,value] of [['master-code','VN-X'],['master-name','Port Name'],['master-country','VN'],['master-timezone','Asia/Ho_Chi_Minh']]) app.change(id,value)
  const saving=app.submit(); assert.equal(app.requests[0].name,'createPort'); assert.equal(app.requests[0].args[0].portCode,'VN-X'); app.requests[0].resolve({portId:'port-1'}); await saving
  const detail=mount('PortDetailPage',{portId:'port-1'}); assert.equal(detail.requests.length,1); assert.equal(detail.requests[0].name,'getPort'); detail.requests[0].resolve({portId:'port-1',portCode:'X',portName:'Port',countryCode:'VN',status:'ACTIVE'}); await flush(); assert.equal(detail.find('PageHeader').props.title,'Port'); assert.ok(!detail.requests.some(r=>r.name==='destinationPorts'))
})

test('Destination status requires explicit confirmation; failed request retains core data and can be inspected (virtual only)', async () => {
  const app = mount('DestinationDetailPage'); app.requests.find(r=>r.name==='getDestination').resolve(destination); app.requests.find(r=>r.name==='destinationPorts').resolve([]); await flush()
  app.find('Button', p=>p.children==='Ngừng kích hoạt').props.onClick(); app.view()
  assert.equal(app.calls.filter(c=>c.name==='deactivateDestination').length,0)
  const pending=app.find('Button',p=>p.children==='Xác nhận thay đổi trạng thái').props.onClick(); await flush()
  assert.equal(app.calls.filter(c=>c.name==='deactivateDestination').length,1)
  app.requests.find(r=>r.name==='deactivateDestination').reject(new ApiError('Cannot deactivate referenced destination',409)); await pending; await flush()
  assert.equal(app.find('PageHeader').props.title,'ABC'); assert.ok(app.find('Modal')); assert.ok(app.find('Notice',p=>p.title==='Chưa đổi được trạng thái'))
})
test('Destination mutation buttons and Create handler deny absent permissions, while reads remain available', async () => {
  const app=mount('DestinationDetailPage',undefined,false); app.requests.find(r=>r.name==='getDestination').resolve(destination); app.requests.find(r=>r.name==='destinationPorts').resolve([]); await flush()
  assert.equal(app.find('Button',p=>p.children==='Ngừng kích hoạt').props.disabled,true)
  assert.equal(app.find('Button',p=>p.children==='Kiểm tra dữ liệu').props.disabled,true)
  const form=mount('DestinationFormPage',{},false); form.change('master-name','New'); form.change('master-country','VN'); await form.submit(); assert.equal(form.calls.filter(c=>c.name==='createDestination').length,0)
})
test('Destination activate/deactivate serialize PATCH paths with no forged update body (unit only)', async()=>{
 const calls=[],api=load('api/itinerary-api.ts',{'@/shared/api':{ApiError,apiRequest:async(endpoint,options)=>{calls.push({endpoint,options});return destination}}}).itineraryApi
 await api.activateDestination('a/b');await api.deactivateDestination('a/b')
 assert.deepEqual(plain(calls),[{endpoint:'/destinations/a%2Fb/activate',options:{method:'PATCH'}},{endpoint:'/destinations/a%2Fb/deactivate',options:{method:'PATCH'}}])
})
