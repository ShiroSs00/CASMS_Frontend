import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = path.resolve('src')
const jsx = (type, props) => ({ type, props })
function harness(permissions = []) {
  let slot = 0
  const states = [], cache = new Map(), calls = []
  const access = { userId: 'staff', status: 'ready', has: permission => permissions.includes(permission) }
  const react = {
    useState(initial) { const index = slot++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }] },
    useRef: value => ({ current: value }), useCallback: fn => fn, useEffect() {},
  }
  const ui = new Proxy({}, { get: (_, key) => key })
  const query = { data: [], loading: false, error: null, retry() {} }
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-router': { useNavigate: () => () => {}, useParams: () => ({}), useLocation: () => ({}), Link: 'Link' },
    '@/shared/auth': { useSessionAccess: () => access }, '@/shared/ui': ui,
    '@/shared/api': { useReadQuery: () => query },
    '../api/shore-excursion-api': { shoreExcursionApi: {} },
    '../hooks/useShoreRequest': { useShoreMutation: () => ({ busy: false, clearError() {}, run: fn => { calls.push(fn) } }) },
    './ShoreUI': { ShoreError: 'ShoreError' },
    '../api/activity-api': { activityApi: {} },
    '../api/service-package-api': { servicePackageApi: {} },
    './CatalogUI': { CatalogState: 'CatalogState' },
  }
  function load(file) {
    const absolute = path.resolve(root, file)
    if (cache.has(absolute)) return cache.get(absolute)
    const module = { exports: {} }; cache.set(absolute, module.exports)
    vm.runInNewContext(ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText, {
      module, exports: module.exports, Intl, Date, Error, require(id) {
        if (Object.hasOwn(imports, id)) return imports[id]
        if (id.endsWith('.module.css')) return { default: {} }
        if (id.startsWith('.')) {
          const target = path.resolve(path.dirname(absolute), id)
          return load(path.relative(root, existsSync(target + '.ts') ? target + '.ts' : target + '.tsx'))
        }
        throw Error('Unmocked dependency: ' + id)
      },
    })
    return module.exports
  }
  return { load, calls, permissions, render(component, props) { slot = 0; return component(props) } }
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.footer), ...nodes(tree.props?.actions)]
}
const text = tree => JSON.stringify(tree)
const buttons = tree => nodes(tree).filter(node => ['Button', 'button', 'ButtonLink'].includes(node.type))
const excursion = { shoreExcursionId: 'tour', excursionName: 'Tham quan cảng', status: 'PLANNED' }
const activity = { id: 'activity', name: 'Yoga', status: 'PLANNED' }
const item = { id: 'service', name: 'Spa', code: 'SPA', status: 'ACTIVE' }

test('read-only excursion retains availability lookup but omits lifecycle, capacity and delete controls', () => {
  const h = harness(['EXCURSION_READ']), { ExcursionActions } = h.load('features/shore-excursions/components/ExcursionActions.tsx')
  const tree = h.render(ExcursionActions, { excursion: { ...excursion, status: 'OPEN' }, onRefresh() {} })
  assert.deepEqual(buttons(tree).map(button => button.props.children), ['Kiểm tra chỗ trống'])
  assert.equal(h.calls.length, 0)
})

test('each BE role only sees excursion actions granted to that role', () => {
  const { backendRolePermissions } = harness().load('shared/ui/admin-v3/admin-navigation.ts')
  for (const [role, permissions] of Object.entries(backendRolePermissions)) {
    const h = harness([...permissions]), { ExcursionActions } = h.load('features/shore-excursions/components/ExcursionActions.tsx')
    const tree = h.render(ExcursionActions, { excursion, onRefresh() {} })
    const rendered = text(tree)
    assert.equal(rendered.includes('Làm mới sức chứa'), permissions.includes('EXCURSION_STATUS_CHANGE'), role)
    assert.equal(rendered.includes('Xóa chuyến tham quan'), permissions.includes('EXCURSION_DELETE_DRAFT'), role)
  }
})

test('limited grant exposes its own action and revoked grant removes an open dialog', () => {
  const h = harness(['EXCURSION_DELETE_DRAFT']), { ExcursionActions } = h.load('features/shore-excursions/components/ExcursionActions.tsx')
  const props = { excursion, onRefresh() {} }
  let tree = h.render(ExcursionActions, props)
  assert.deepEqual(buttons(tree).map(button => button.props.children), ['Xóa chuyến tham quan'])
  buttons(tree)[0].props.onClick()
  tree = h.render(ExcursionActions, props)
  assert.ok(nodes(tree).some(node => node.type === 'Modal'))
  h.permissions.length = 0
  tree = h.render(ExcursionActions, props)
  assert.equal(buttons(tree).length, 0)
  assert.ok(!nodes(tree).some(node => node.type === 'Modal'))
})

test('activity, catalog and request readers have no management panels or mutation controls', () => {
  const cases = [
    ['features/activities/components/ActivityOperations.tsx', 'ActivityOperations', { activity, onChanged() {} }, ['ACTIVITY_READ']],
    ['features/service-packages/components/CatalogActions.tsx', 'CatalogActions', { kind: 'services', item, onChanged() {} }, ['SERVICE_READ']],
    ['features/service-packages/components/ServiceRequestActions.tsx', 'ServiceRequestActions', { request: { id: 'request', status: 'REQUESTED' }, onChanged() {} }, ['SERVICE_REQUEST_READ']],
  ]
  for (const [file, component, props, permissions] of cases) {
    const h = harness(permissions)
    assert.equal(h.render(h.load(file)[component], props), null, component)
  }
})

test('request creator can cancel and edit but cannot take execution or assignment actions', () => {
  const h = harness(['SERVICE_REQUEST_CREATE']), { ServiceRequestActions } = h.load('features/service-packages/components/ServiceRequestActions.tsx')
  const tree = h.render(ServiceRequestActions, { request: { id: 'request', status: 'REQUESTED' }, onChanged() {} })
  assert.deepEqual(buttons(tree).map(button => button.props.children), ['Sửa số lượng và ghi chú', 'Hủy yêu cầu'])
})

test('package readers see benefits without editing fields; managers retain draft-state restrictions', () => {
  for (const manage of [false, true]) {
    const h = harness(manage ? ['PACKAGE_COMPONENT_MANAGE'] : ['TOUR_PACKAGE_MANAGE'])
    const { PackageBenefitsEditor } = h.load('features/service-packages/components/PackageBenefitsEditor.tsx')
    const tree = h.render(PackageBenefitsEditor, { packageId: 'package', status: 'ACTIVE', onChanged() {} })
    assert.equal(buttons(tree).length, manage ? 1 : 0)
    if (manage) assert.equal(buttons(tree)[0].props.disabled, true)
    assert.equal(nodes(tree).some(node => node.type === 'select'), true)
  }
})

test('day timezone-only permission selects the permitted editor rather than exposing type configuration', () => {
  const h = harness(['ITINERARY_DAY_READ', 'ITINERARY_DAY_TIMEZONE_SET'])
  const { DayOperations } = h.load('features/itineraries/components/DayOperations.tsx')
  const tree = h.render(DayOperations, { day: { itineraryDayId: 'day', dayNumber: 1 }, editable: true, onChanged() {} })
  assert.ok(!text(tree).includes('value":"type"'))
  assert.ok(text(tree).includes('value":"timezone"'))
})

test('supplier readers retain details and have no verification, status, edit or delete controls', () => {
  const h = harness(['SUPPLIER_READ'])
  const { SupplierDetail } = h.load('features/suppliers/components/SupplierDetail.tsx')
  const tree = h.render(SupplierDetail, { supplier: { id: 'supplier', supplierName: 'Đối tác cảng', status: 'ACTIVE', verificationStatus: 'VERIFIED' } })
  assert.equal(buttons(tree).length, 0)
  assert.equal(nodes(tree).some(node => node.type === 'Link' && node.props.to.endsWith('/edit')), false)
  assert.ok(text(tree).includes('Đối tác cảng'))
})
