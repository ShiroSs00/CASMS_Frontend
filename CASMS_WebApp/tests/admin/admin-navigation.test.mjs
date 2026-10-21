import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('../../src/', import.meta.url)
const jsx = (type, props) => ({ type, props })
function load(file, imports) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    assert.ok(Object.hasOwn(imports, id), 'Unexpected import: ' + id)
    return imports[id]
  } })
  return module.exports
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...nodes(tree.props?.children)]
}
const modules = ['destinations', 'ports', 'ships', 'decks', 'cabins', 'cruises', 'itineraries', 'regulations', 'issues', 'suppliers', 'shore-excursions', 'tour-groups', 'activities', 'services', 'products', 'service-packages', 'service-requests', 'package-assignments', 'bookings']
function shell(pathname, topbar, account = null) {
  const { AdminShell } = load('shared/ui/admin-v3/AdminShell.tsx', { react: { useContext: () => account, useEffect() {}, useRef: () => ({ current: null }) }, './admin-account-context': { AdminAccountContext: {} }, 'react-router': { Link: 'Link', useLocation: () => ({ pathname }) } })
  return nodes(AdminShell({ children: 'Content', topbar }))
}

test('injected account action remains visible with a custom Admin topbar', () => {
  const account = jsx('AccountAction', {})
  const tree = shell('/admin/bookings', jsx('CustomTopbar', {}), account)
  assert.ok(tree.some(node => node.type === 'CustomTopbar'))
  assert.ok(tree.includes(account))
})

test('all functions remain visible in business groups, with unique links to existing screens', () => {
  const tree = shell('/admin/workflow')
  const links = tree.filter(node => node.type === 'Link')
  assert.deepEqual(links.map(node => node.props.to).sort(), [...modules, 'workflow'].map(name => '/admin/' + name).sort())
  const functionsWithoutRoutes = tree.filter(node => node.props?.['aria-disabled'] === 'true')
  assert.deepEqual(functionsWithoutRoutes.map(node => node.props.children).sort(), [
    'Tổng quan', 'Làm thủ tục', 'Thanh toán', 'Hoàn tiền', 'Báo cáo', 'Người dùng & quyền',
  ].sort())
  for (const node of functionsWithoutRoutes) {
    assert.equal(node.type, 'span')
    assert.equal(node.props.to, undefined)
    assert.equal(node.props.title, undefined)
  }
  assert.deepEqual(tree.filter(node => node.type === 'p' && typeof node.props.children === 'string').map(node => node.props.children), [
    'ĐIỀU PHỐI & VẬN HÀNH', 'TỔNG QUAN', 'ĐẶT CHỖ', 'DỮ LIỆU NỀN TẢNG', 'LẬP KẾ HOẠCH CHUYẾN',
    'VẬN HÀNH & TUÂN THỦ', 'DỊCH VỤ BỜ', 'DỊCH VỤ TÀU', 'TÀI CHÍNH', 'HỆ THỐNG', 'Khu vực quản trị',
  ])
  assert.equal(tree.filter(node => node.type === 'main').length, 1)
})

test('each list, detail, create and edit highlights only its own module', () => {
  for (const name of [...modules, 'workflow']) for (const suffix of ['', '/new', '/fixture', '/fixture/edit']) {
    const active = shell('/admin/' + name + suffix).filter(node => node.props?.['aria-current'] === 'page')
    assert.equal(active.length, 1, name + suffix)
    assert.equal(active[0].props.to, '/admin/' + name)
  }
  assert.equal(shell('/admin/ships-unknown').filter(node => node.props?.['aria-current']).length, 0)
})

test('ship and cruise regulation assignments keep Regulations active', () => {
  for (const path of ['/admin/ships/id/regulations', '/admin/cruises/id/regulations', '/admin/ships/id/regulations/edit']) {
    const active = shell(path).filter(node => node.props?.['aria-current'] === 'page')
    assert.equal(active.length, 1)
    assert.equal(active[0].props.to, '/admin/regulations')
  }
})

const featureNames = ['auth', 'booking', 'home', 'suppliers', 'shore-excursions', 'tour-groups', 'cruises', 'operational-issues', 'itineraries', 'regulations', 'ship-deck-cabin', 'activities', 'service-packages']
const imports = Object.fromEntries(featureNames.map(name => ['@/features/' + name, new Proxy({}, { get: (_, key) => String(key) })]))
const { router } = load('app/router.tsx', {
  ...imports,
  'react-router': { createBrowserRouter: routes => routes, Navigate: 'Navigate' },
  './layouts/PublicLayout': { PublicLayout: 'PublicLayout' },
  './layouts/AdminAccountLayout': { AdminAccountLayout: 'AdminAccountLayout' },
  './layouts/BookingSessionLayout': { BookingSessionLayout: 'BookingSessionLayout' },
  './pages/AdminBookingPages': { AdminBookingListPage: 'AdminBookingListPage', AdminBookingDetailPage: 'AdminBookingDetailPage', AdminBookingCreatePage: 'AdminBookingCreatePage', AdminBookingLookupPage:'AdminBookingLookupPage' },
  './pages/AdminWorkflowPage': { AdminWorkflowPage: 'AdminWorkflowPage' },
})
function routes(tree) { return tree.flatMap(route => [route, ...routes(route.children ?? [])]) }
const allRoutes = routes(router)
const adminGuard = allRoutes.find(route => route.Component === 'AdminGuard')

test('every sidebar target is a registered protected route, not the wildcard fallback', () => {
  for (const name of [...modules, 'workflow']) assert.ok(adminGuard.children.some(route => route.path === '/admin/' + name && route.Component), name)
  assert.equal(adminGuard.children.find(route => route.path === '/admin/workflow').Component, 'AdminWorkflowPage')
  assert.equal(adminGuard.children.find(route => route.path === '/admin/ships/:shipId/regulations').Component, 'ShipRegulationsPage')
  assert.equal(adminGuard.children.find(route => route.path === '/admin/cruises/:cruiseId/regulations').Component, 'CruiseRegulationsPage')
})

test('workflow preserves nine ordered stages and links only to real screens in one shell', () => {
  const { AdminWorkflowPage } = load('app/pages/AdminWorkflowPage.tsx', { 'react-router': { Link: 'Link' }, '@/shared/ui/admin-v3': { AdminShell: 'AdminShell' } })
  const tree = nodes(AdminWorkflowPage())
  assert.equal(tree.filter(node => node.type === 'AdminShell').length, 1)
  assert.equal(tree.filter(node => node.type === 'ol').length, 1)
  assert.deepEqual(tree.filter(node => node.type === 'h2').map(node => node.props.children), [
    'Điểm đến & cảng', 'Tàu, boong & cabin', 'Bản nháp chuyến du lịch', 'Hải trình', 'Ngày hành trình & điểm dừng',
    'Kiểm tra điều kiện & mức độ sẵn sàng', 'Công bố chuyến du lịch', 'Sự cố vận hành', 'Nhà cung cấp, tham quan bờ & nhóm tour',
  ])
  for (const link of tree.filter(node => node.type === 'Link')) assert.ok(adminGuard.children.some(route => route.path === link.props.to && route.Component), link.props.to)
  for (const step of tree.filter(node => node.type === 'li')) {
    assert.equal(nodes(step).filter(node => node.type === 'dd').length, 2)
    assert.ok(nodes(step).some(node => node.type === 'Link'))
  }
})
