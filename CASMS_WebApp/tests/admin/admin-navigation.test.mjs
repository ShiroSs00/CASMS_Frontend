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
  vm.runInNewContext(source, { URL, URLSearchParams, module, exports: module.exports, require(id) {
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
const navigationModel = load('shared/ui/admin-v3/admin-navigation.ts', {})
const allPermissions = [...navigationModel.adminNavigation.flatMap(group => group.items.flatMap(item => item.permissions ?? [])), ...navigationModel.adminWorkspaces.flatMap(workspace => [...workspace.permissions,workspace.action.permission])]
const modules = ['destinations','ports','ships','decks','cabins','cruises','itineraries','regulations','issues','suppliers','shore-excursions','tour-groups','activities','services','products','service-packages','service-requests','package-assignments','bookings']
function shell(pathname, topbar, account = null, access, search = '', roles) {
  const owner=navigationModel.workspaceForPath(pathname,search)
  const roleByWorkspace={schedule:'CRUISE_MANAGER',operations:'OPERATIONS_MANAGER',services:'ACTIVITY_SERVICE_MANAGER'}
  roles ??= pathname.startsWith('/admin/system')?['ADMIN']:owner?[roleByWorkspace[owner.id]].filter(Boolean):['ACTIVITY_SERVICE_MANAGER']
  access ??= {status:'ready',permissions:roles.flatMap(role=>navigationModel.backendRolePermissions[role]??[])}
  const { AdminShell } = load('shared/ui/admin-v3/AdminShell.tsx', {
    '@/shared/auth': {useSessionAccess:()=>access}, './admin-navigation':navigationModel,
    './AdminWorkspaceIcon':{AdminWorkspaceIcon:'Icon'}, '../BrandLogo':{BrandLogo:'Logo'},
    react:{useState:value=>[value,()=>{}],useContext:context=>context?.kind==='roles'?roles:account},
    './admin-account-context':{AdminAccountContext:{kind:'account'},AdminRoleContext:{kind:'roles'}}, 'react-router':{Link:'Link',useLocation:()=>({pathname,search})},
  })
  return nodes(AdminShell({children:'Content',topbar}))
}

test('custom admin topbar retains injected account and a single main region', () => {
  const account=jsx('AccountAction',{})
  const tree=shell('/admin/services',jsx('CustomTopbar',{}),account)
  assert.ok(tree.includes(account))
  assert.ok(tree.some(node=>node.type==='CustomTopbar'))
  assert.equal(tree.filter(node=>node.type==='main').length,1)
})

test('three workspaces unite shore and onboard tools without duplicate ownership',()=>{
  assert.deepEqual(Array.from(navigationModel.adminWorkspaces,w=>w.id),['schedule','operations','services'])
  const owned=navigationModel.adminWorkspaces.flatMap(w=>Array.from(w.tools))
  assert.deepEqual(Array.from(owned).sort(),[...modules].sort())
  assert.equal(new Set(owned).size,owned.length)
})

test('admin and staff no longer see a department switcher or all four business groups',()=>{
  for(const roles of [['ADMIN'],['CRUISE_MANAGER'],['ACTIVITY_SERVICE_MANAGER']]) {
    const targets=shell(navigationModel.staffRoleHome(roles),undefined,null,undefined,'',roles).filter(node=>node.type==='Link').map(node=>node.props.to)
    for(const workspace of navigationModel.adminWorkspaces) if(workspace.id!==navigationModel.roleWorkspace(roles)?.id) assert.ok(!targets.includes(navigationModel.workspaceUrl(workspace)))
    if(roles[0]==='ADMIN') for(const name of modules) assert.ok(!targets.includes('/admin/'+name))
  }
})

test('menus highlight resource routes and include only effective permission links',()=>{
  for(const workspace of navigationModel.adminWorkspaces) for(const name of workspace.tools) for(const suffix of ['','/new','/fixture','/fixture/edit']) {
    const tree=shell('/admin/'+name+suffix)
    const active=tree.filter(node=>node.props?.['aria-current']==='page')
    assert.equal(active.length,1,name+suffix)
    assert.equal(active[0].props.to,'/admin/'+name)
  }
  const access={status:'ready',permissions:['BOOKING_READ']}
  const links=shell('/admin/bookings',undefined,null,access,'',['BOOKING_AGENT']).filter(n=>n.type==='Link').map(n=>n.props.to)
  assert.ok(links.includes('/admin/bookings'))
  assert.ok(!links.includes('/admin/ships'))
})

test('related regulation/history/registration routes resolve to their correct department',()=>{
  for(const path of ['/admin/ships/id/regulations','/admin/cruises/id/regulations']) {
    assert.equal(navigationModel.workspaceForPath(path).id,'operations')
    assert.equal(shell(path).find(node=>node.props?.['aria-current']==='page').props.to,'/admin/regulations')
  }
  assert.equal(navigationModel.workspaceForPath('/admin/itinerary-history').id,'schedule')
  assert.equal(navigationModel.workspaceForPath('/admin/activity-registrations').id,'services')
  assert.equal(navigationModel.workspaceForPath('/admin/activity-registrations','?excursionId=fixture').id,'services')

  assert.equal(navigationModel.workspaceForPath('/admin/ships-unknown'),undefined)
})

test('limited accounts only switch into authorized departments; failed/loading access grants none',()=>{
  const access={status:'ready',permissions:['SERVICE_READ','SERVICE_REQUEST_CREATE']}
  const targets=shell('/admin/services',undefined,null,access).filter(node=>node.type==='Link').map(node=>node.props.to)
  assert.ok(targets.includes('/admin/workspaces/services'))
  assert.ok(!targets.includes('/admin/workspaces/shore'))
  assert.ok(targets.includes('/admin/services'))
  assert.ok(targets.includes('/admin/service-requests'))
  assert.ok(!targets.includes('/admin/products'))
  for(const status of ['loading','error','anonymous']) for(const workspace of navigationModel.adminWorkspaces) assert.equal(navigationModel.canEnterWorkspace(workspace,{status,permissions:allPermissions}),false)
})

test('public catalog readability does not by itself grant department entry',()=>{
  const access={status:'ready',permissions:[]}
  assert.equal(navigationModel.canOpenAdminItem({to:'/admin/cruises'},access),false)
  assert.equal(navigationModel.canEnterWorkspace(navigationModel.adminWorkspaces[0],access),false)
  assert.equal(navigationModel.canEnterWorkspace(navigationModel.adminWorkspaces[2],access),false)
})

const featureNames = ['auth', 'booking', 'home', 'suppliers', 'shore-excursions', 'tour-groups', 'cruises', 'operational-issues', 'itineraries', 'regulations', 'ship-deck-cabin', 'activities', 'service-packages']
const imports = Object.fromEntries(featureNames.map(name => ['@/features/' + name, new Proxy({}, { get: (_, key) => String(key) })]))
const { router } = load('app/router.tsx', {
  ...imports,
  'react-router': { createBrowserRouter: routes => routes, Navigate: 'Navigate' },
  './layouts/PublicLayout': { PublicLayout: 'PublicLayout' },
  './layouts/AdminAccountLayout': { AdminAccountLayout: 'AdminAccountLayout' },
  './layouts/BookingSessionLayout': { BookingSessionLayout: 'BookingSessionLayout' },
  './RouteLoading': { RouteLoading: 'RouteLoading' }, './RouteErrorPage': {RouteErrorPage:'RouteErrorPage'},
  './pages/AdminBookingPages': { AdminBookingListPage: 'AdminBookingListPage', AdminBookingDetailPage: 'AdminBookingDetailPage', AdminBookingCreatePage: 'AdminBookingCreatePage', AdminBookingLookupPage:'AdminBookingLookupPage' },
  './pages/AdminSystemPage': { AdminSystemPage:'AdminSystemPage' },
  './pages/AdminStaffFunctionPage': { AdminStaffFunctionPage:'AdminStaffFunctionPage' },
  './pages/AdminWorkspacePage': { AdminWorkspacePage: 'AdminWorkspacePage' },
  './pages/AdminOverviewPage': { AdminOverviewPage: 'AdminOverviewPage' },
  './pages/AdminWorkflowPage': { AdminWorkflowPage: 'AdminWorkflowPage' },
})
function routes(tree) { return tree.flatMap(route => [route, ...routes(route.children ?? [])]) }
const allRoutes = routes(router)
const adminGuard = allRoutes.find(route => route.Component === 'AdminGuard')

test('workspace home and existing module links remain protected registered routes',async()=>{
  for(const name of [...modules,'workflow']) assert.ok(adminGuard.children.some(route=>route.path==='/admin/'+name&&(route.Component||route.lazy)),name)
  const home=adminGuard.children.find(route=>route.path==='/admin')
  assert.equal((await home.lazy()).Component,'AdminOverviewPage')
  const workspace=adminGuard.children.find(route=>route.path==='/admin/workspaces/:workspaceId')
  assert.equal((await workspace.lazy()).Component,'AdminWorkspacePage')
  for(const item of navigationModel.adminWorkspaces) assert.ok(adminGuard.children.some(route=>route.path===item.action.to),item.action.to)
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
  for (const link of tree.filter(node => node.type === 'Link')) assert.ok(adminGuard.children.some(route => route.path === link.props.to && (route.Component || route.lazy)), link.props.to)
  for (const step of tree.filter(node => node.type === 'li')) {
    assert.equal(nodes(step).filter(node => node.type === 'dd').length, 2)
    assert.ok(nodes(step).some(node => node.type === 'Link'))
  }
})


test('role landing uses BE roles and safe return-to honors authorized cross-module reads',()=>{
  assert.equal(navigationModel.staffRoleHome(['ADMIN']),'/admin/system')
  assert.equal(navigationModel.staffRoleHome(['ACTIVITY_SERVICE_MANAGER']),'/admin/workspaces/services')
  assert.equal(navigationModel.staffRoleHome(['CRUISE_MANAGER']),'/admin/workspaces/schedule')
  assert.equal(navigationModel.staffRoleHome(['BOOKING_AGENT']),'/admin/bookings')
  assert.equal(navigationModel.staffRoleHome(['FINANCE_OFFICER']),'/admin/staff/finance')
  assert.equal(navigationModel.staffRoleHome(['PASSENGER']),null)
  assert.equal(navigationModel.staffRoleHome(['SHORE_MANAGER']),null)
  assert.equal(navigationModel.roleSafeAdminReturnTo(['ACTIVITY_SERVICE_MANAGER'],'/admin/cruises/new'),'/admin/workspaces/services')
  assert.equal(navigationModel.roleSafeAdminReturnTo(['ACTIVITY_SERVICE_MANAGER'],'/admin/shore-excursions/new'),'/admin/shore-excursions/new')
  assert.equal(navigationModel.roleSafeAdminReturnTo(['CRUISE_MANAGER'],'/admin/cruises/new'),'/admin/cruises/new')
  assert.equal(navigationModel.roleSafeAdminReturnTo(['ADMIN'],'/admin/services'),'/admin/system')
  assert.equal(navigationModel.roleSafeAdminReturnTo(['ACTIVITY_SERVICE_MANAGER'],'https://example.com/admin/services'),'/admin/workspaces/services')
})

test('booking coordination keeps its landing and shows BE-authorized reference reads',()=>{
  const access={status:'ready',permissions:navigationModel.backendRolePermissions.BOOKING_AGENT}
  const tree=shell('/admin/bookings',undefined,null,access,'',['BOOKING_AGENT'])
  const targets=tree.filter(node=>node.type==='Link').map(node=>node.props.to)
  assert.ok(targets.includes('/admin/bookings'))
  assert.ok(targets.includes('/admin/ships'))
  for(const forbidden of ['/admin/issues','/admin/workspaces/operations','/admin/products']) assert.ok(!targets.includes(forbidden))
})

test('related sidebar tools use disclosure parents and automatically open the active group',()=>{
  const tree=shell('/admin/services')
  const groups=tree.filter(node=>node.type==='details')
  assert.ok(groups.length>0)
  const open=groups.filter(group=>group.props.open)
  assert.equal(open.length,1)
  assert.equal(nodes(open[0]).find(node=>node.type==='summary').props.children[0].props.children,'Dịch vụ và sản phẩm')
  const targets=nodes(open[0]).filter(node=>node.type==='Link').map(node=>node.props.to)
  assert.deepEqual(Array.from(targets),['/admin/services','/admin/products','/admin/service-requests'])
  assert.equal(tree.filter(node=>node.props?.['aria-current']==='page').length,1)
})

test('collapsed groups contain only authorized children and empty groups are removed',()=>{
  const groups=navigationModel.roleNavigationGroups(['ONBOARD_STAFF'],{status:'ready',permissions:['SERVICE_READ','SERVICE_REQUEST_READ']})
  assert.equal(groups.length,1)
  assert.equal(groups[0].label,'Dịch vụ và sản phẩm')
  assert.deepEqual(Array.from(groups[0].items,item=>item.to).sort(),['/admin/service-requests','/admin/services'])
  assert.equal(navigationModel.roleNavigationGroups(['ONBOARD_STAFF'],{status:'error',permissions:['SERVICE_READ']}).length,0)
})

test('fleet manager workspace shows its own creation action and hides inaccessible operational tools',()=>{
  const roles=['SHIP_MANAGER'],permissions=navigationModel.backendRolePermissions.SHIP_MANAGER
  const {AdminWorkspacePage}=load('app/pages/AdminWorkspacePage.tsx',{
    react:{useContext:()=>roles},'react-router':{Link:'Link',useParams:()=>({workspaceId:'operations'})},
    '@/shared/auth':{useSessionAccess:()=>({status:'ready',permissions,has:p=>permissions.includes(p)})},
    '@/shared/ui':{Loading:'Loading',Notice:'Notice'},
    '@/shared/ui/admin-v3':{...navigationModel,AdminShell:'Shell',AdminWorkspaceIcon:'Icon',AdminRoleContext:{}},
  })
  const tree=nodes(AdminWorkspacePage()),links=tree.filter(n=>n.type==='Link').map(n=>n.props.to)
  assert.equal(tree.find(n=>n.type==='h1').props.children,'Quản lý đội tàu')
  assert.ok(links.includes('/admin/ships/new'))
  assert.ok(!links.includes('/admin/issues'))
  assert.ok(!links.includes('/admin/bookings'))
  assert.ok(!links.includes('/admin/issues/new'))
})

test('every staff role renders permission-filtered grouped navigation with its own identity',()=>{
  for(const role of Object.keys(navigationModel.backendRolePermissions).filter(role=>role!=='PASSENGER')){
    const permissions=navigationModel.backendRolePermissions[role]
    const tree=shell(navigationModel.staffRoleHome([role]),undefined,null,{status:'ready',permissions},'',[role])
    const links=tree.filter(n=>n.type==='Link').map(n=>n.props.to)
    for(const item of navigationModel.roleNavigationItems([role],{status:'ready',permissions})) assert.ok(links.includes(item.to),role+' '+item.to)
    assert.equal(tree.filter(n=>n.props?.['aria-current']==='page').length,1,role)
  }
})


test('onboard staff can read activities and tours but cannot create management records',()=>{
  assert.equal(navigationModel.staffRoleHome(['ONBOARD_STAFF']),'/admin/service-requests')
  assert.equal(navigationModel.canRoleOpenAdminPath(['ONBOARD_STAFF'],'/admin/service-requests/new'),false)
  assert.equal(navigationModel.canRoleOpenAdminPath(['ONBOARD_STAFF'],'/admin/service-requests/fixture/edit'),true)
  assert.equal(navigationModel.canRoleOpenAdminPath(['ONBOARD_STAFF'],'/admin/shore-excursions'),true)
  for(const path of ['/admin/activities/new','/admin/products','/admin/services/new','/admin/shore-excursions/new']) assert.equal(navigationModel.canRoleOpenAdminPath(['ONBOARD_STAFF'],path),false)
})
