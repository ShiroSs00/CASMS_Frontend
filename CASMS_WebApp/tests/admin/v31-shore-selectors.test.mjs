import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const root = new URL('../../src/features/', import.meta.url)
const jsx = (type, props) => ({ type, props })
function load(file, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText, { module, exports: module.exports, Intl, Date, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    assert.ok(Object.hasOwn(imports, id), id); return imports[id]
  } }); return module.exports
}
test('excursion window respects planned call, all-aboard deadline and available Tender transfer duration', () => {
  const { validateExcursionWindow } = load('shore-excursions/api/excursion-context-api.ts', { '@/shared/api': {} })
  const stop = { plannedArrival: '2026-10-21T01:00:00Z', plannedDeparture: '2026-10-21T09:00:00Z', allAboardTime: '2026-10-21T08:00:00Z', arrivalMethod: 'TENDER', tenderTransferMinutes: 20 }
  assert.ok(validateExcursionWindow('2026-10-21T01:10:00Z', '2026-10-21T07:00:00Z', stop))
  assert.ok(validateExcursionWindow('2026-10-21T02:00:00Z', '2026-10-21T08:30:00Z', stop))
  assert.equal(validateExcursionWindow('2026-10-21T02:00:00Z', '2026-10-21T07:00:00Z', stop), '')
  assert.ok(validateExcursionWindow('bad', 'bad', stop)); assert.ok(validateExcursionWindow('2026-10-21T02:00:00Z', '2026-10-21T07:00:00Z'))
})
test('context uses real paged itineraries and stop/port names; missing context never becomes successful empty data', async () => {
  const { excursionContextApi } = load('shore-excursions/api/excursion-context-api.ts', { '@/shared/api': { apiRequest: async url => {
    if (url === '/itineraries') return { content: [{ itineraryId: 'i1', itineraryName: 'Hạ Long' }], totalPages: 1 }
    if (url === '/ports/active') return [{ portId: 'p1', portName: 'Cảng QA' }]
    return [{ cruiseStopId: 's1', portId: 'p1', stopOrder: 1, plannedArrival: '2026-10-21T01:00:00Z', plannedDeparture: '2026-10-21T09:00:00Z' }]
  } } })
  assert.equal((await excursionContextApi.stops())[0].label, 'Hạ Long · Điểm 1 · Cảng QA')
  const broken = load('shore-excursions/api/excursion-context-api.ts', { '@/shared/api': { apiRequest: async () => { throw Error('HTTP 403') } } })
  await assert.rejects(broken.excursionContextApi.stops(), /403/)
})
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.footer)] : [] }
const primitives = Object.fromEntries(['Button', 'Field', 'Loading', 'Notice'].map(key => [key, key]))
test('Create forms render real entity selects, no UUID entry, and omit saving without permission', () => {
  const react = { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] }
  const shared = { react, 'react-router': { Link: 'Link' }, '@/shared/ui': primitives, '@/shared/auth': { useSessionAccess: () => ({ has: () => false }) }, '@/shared/api': { useReadQuery: () => ({ data: null, loading: false, error: Error('403'), retry() {} }) } }
  const model = load('shore-excursions/model/shore-excursion.ts')
  const { ExcursionForm } = load('shore-excursions/components/ExcursionForm.tsx', { ...shared, '../model/shore-excursion': model, '../api/excursion-context-api': { excursionContextApi: {} } })
  const excursion = nodes(ExcursionForm({ busy: false, onSave() {} }))
  for (const field of ['cruiseStopId', 'supplierId']) { assert.ok(excursion.some(node => node.type === 'select' && node.props.name === field)); assert.ok(!excursion.some(node => node.type === 'input' && node.props.name === field)) }
  assert.equal(excursion.some(node => node.type === 'Button' && node.props.type === 'submit'), false)
  const groupModel = load('tour-groups/model/tour-group.ts')
  const { GroupForm } = load('tour-groups/components/GroupForm.tsx', { ...shared, '../model/tour-group': groupModel, '../api/group-context-api': {} })
  const group = nodes(GroupForm({ busy: false, onSave() {} }))
  assert.ok(group.some(node => node.type === 'select' && node.props.name === 'shoreExcursionId'))
  assert.ok(!group.some(node => node.type === 'input' && ['shoreExcursionId', 'guideId', 'vehicleId'].includes(node.props.name)))
  assert.equal(group.some(node => node.type === 'Button' && node.props.type === 'submit'), false)
})
test('eligible-passenger adapter retains only actual passenger ID/name and rejects missing names', async () => {
  const id = '3b71a7dc-8eda-495d-8fbf-1f5afea6cd8e'
  let response = [{ passengerId: id, fullName: 'Khách QA', email: 'private', phoneNumber: 'private' }], path
  const model = load('tour-groups/model/tour-group.ts')
  const passengers = load('tour-groups/model/group-passenger.ts', { './tour-group': model, './tour-group.ts': model })
  const { groupPassengerApi } = load('tour-groups/api/group-passenger-api.ts', { '@/shared/api': { ApiError: Error, apiRequestRaw: async (url, decode) => { path = url; return decode(response, 200) } }, '../model/tour-group': model, '../model/group-passenger': passengers, './tour-group-api': {} })
  assert.deepEqual(JSON.parse(JSON.stringify(await groupPassengerApi.eligible(id))), [{ passengerId: id, fullName: 'Khách QA' }])
  assert.equal(path, `/tour-group-passengers/groups/${id}/eligible-passengers`)
  response = [{ passengerId: id }]; await assert.rejects(groupPassengerApi.eligible(id), /không đầy đủ/)
})
test('Supplier verification failure keeps the dialog and entered notes; permissions are independent', async () => {
  let index = 0, calls = 0
  const state = []
  const model = load('suppliers/model/supplier-list.ts')
  const { SupplierDetail } = load('suppliers/components/SupplierDetail.tsx', {
    react: { useState(initial) { const i = index++; if (!(i in state)) state[i] = initial; return [state[i], next => { state[i] = next }] } },
    'react-router': { Link: 'Link' }, '@/shared/ui': { Modal: 'Modal' }, '@/shared/auth': { useSessionAccess: () => ({ has: permission => permission === 'SUPPLIER_VERIFY' }) }, '../model/supplier-list': model,
  })
  const render = () => { index = 0; return nodes(SupplierDetail({ supplier: { id: 's', supplierName: 'Supplier QA', status: 'ACTIVE', verificationStatus: 'PENDING' }, onVerify: async () => { calls++; throw Error('HTTP 500') } })) }
  render().find(node => node.type === 'button' && node.props.children === 'Xác minh nhà cung cấp').props.onClick()
  render().find(node => node.props?.id === 'verificationNotesInput').props.onChange({ target: { value: 'Ghi chú cần giữ' } })
  assert.equal(render().find(node => node.type === 'button' && node.props.onClick?.name === 'handleConfirmVerify').props.disabled, false)
  await render().find(node => node.type === 'button' && node.props.onClick?.name === 'handleConfirmVerify').props.onClick()
  assert.equal(calls, 1); assert.equal(render().find(node => node.props?.id === 'verificationNotesInput').props.value, 'Ghi chú cần giữ')
  assert.equal(render().find(node => node.type === 'button' && node.props.title === 'Xóa nhà cung cấp nếu chưa được sử dụng'), undefined)
})
