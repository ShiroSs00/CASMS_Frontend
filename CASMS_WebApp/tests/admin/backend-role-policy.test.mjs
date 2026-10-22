import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const module={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/shared/ui/admin-v3/admin-navigation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module,exports:module.exports,URL,URLSearchParams})
const nav=module.exports
const ready=permissions=>({status:'ready',permissions})

test('unified activity/service manager owns both onboard and shore management entry points',()=>{
  const roles=['ACTIVITY_SERVICE_MANAGER']
  for(const path of ['/admin/activities/new','/admin/services/new','/admin/shore-excursions/new','/admin/tour-groups/new','/admin/products/new','/admin/service-packages/new']) assert.equal(nav.canRoleOpenAdminPath(roles,path),true,path)
  for(const legacy of ['SHORE_MANAGER','ACTIVITY_MANAGER']) assert.equal(nav.canRoleOpenAdminPath([legacy],'/admin/services'),false)
})

test('system admin has no implicit business permissions and revoked session grants override role snapshot',()=>{
  for(const path of ['/admin/bookings','/admin/cruises/new','/admin/services/new','/admin/staff/finance']) assert.equal(nav.canRoleOpenAdminPath(['ADMIN'],path),false,path)
  const role=['ACTIVITY_SERVICE_MANAGER']
  assert.equal(nav.canRoleOpenAdminPath(role,'/admin/services/new','',ready(['SERVICE_READ'])),false)
  assert.equal(nav.canRoleOpenAdminPath(role,'/admin/services/new','',ready(['SERVICE_CREATE'])),true)
  for(const status of ['loading','anonymous','error']) assert.equal(nav.canRoleOpenAdminPath(role,'/admin/services','',{status,permissions:['SERVICE_READ']}),false)
})

test('reference reads do not grant creation and combined roles retain both functions',()=>{
  assert.equal(nav.canRoleOpenAdminPath(['CRUISE_MANAGER'],'/admin/ships'),true)
  assert.equal(nav.canRoleOpenAdminPath(['CRUISE_MANAGER'],'/admin/ships/new'),false)
  assert.equal(nav.canRoleOpenAdminPath(['OPERATIONS_MANAGER'],'/admin/itineraries/fixture'),true)
  assert.equal(nav.canRoleOpenAdminPath(['OPERATIONS_MANAGER'],'/admin/itineraries/new'),false)
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'],'/admin/issues/new'),false)
  const roles=['CRUISE_MANAGER','ACTIVITY_SERVICE_MANAGER']
  for(const path of ['/admin/cruises/new','/admin/services/new','/admin/workspaces/schedule','/admin/workspaces/services']) assert.equal(nav.canRoleOpenAdminPath(roles,path),true,path)
  assert.equal(nav.canRoleOpenAdminPath(['PASSENGER'],'/admin/cruises'),false)
})

test('return-to rejects external URLs, control characters and obsolete department homes',()=>{
  for(const target of ['https://other.example/admin/services','//other.example/admin/services','/admin/\\other','/admin/services\n','/admin/workspaces/shore','/admin/workspaces/onboard']) assert.equal(nav.roleSafeAdminReturnTo(['ACTIVITY_SERVICE_MANAGER'],target),'/admin/workspaces/services')
})

test('role menus honor current effective grants and never show unregistered role homes',()=>{
  const roles=['ACTIVITY_SERVICE_MANAGER']
  const links=nav.roleNavigationItems(roles,ready(['SERVICE_READ','EXCURSION_READ'])).map(item=>item.to)
  assert.deepEqual(Array.from(links),['/admin/services','/admin/shore-excursions'])
  assert.equal(nav.roleNavigationItems(roles,{status:'error',permissions:['SERVICE_READ']}).length,0)
})

const roleCases=[
  ['ADMIN','/admin/system','system','Quản trị hệ thống'],
  ['CRUISE_MANAGER','/admin/workspaces/schedule','schedule','Quản lý lịch trình'],
  ['SHIP_MANAGER','/admin/workspaces/operations','fleet','Quản lý đội tàu'],
  ['OPERATIONS_MANAGER','/admin/workspaces/operations','operations','Quản lý vận hành'],
  ['ACTIVITY_SERVICE_MANAGER','/admin/workspaces/services','experiences','Quản lý hoạt động và dịch vụ'],
  ['ONBOARD_STAFF','/admin/service-requests','services','Phục vụ trên tàu'],
  ['BOOKING_AGENT','/admin/bookings','bookings','Điều phối đặt chỗ'],
  ['CUSTOMER_SERVICE','/admin/bookings','bookings','Chăm sóc khách hàng'],
  ['CHECKIN_STAFF','/admin/staff/checkin','bookings','Làm thủ tục'],
  ['FINANCE_OFFICER','/admin/staff/finance','staff/finance','Tài chính'],
]
for(const [role,home,firstGroup,label] of roleCases) test(`${role}: grouped menu keeps its landing, job priority and exact effective grants`,()=>{
  const permissions=nav.backendRolePermissions[role], access=ready(permissions)
  assert.equal(nav.staffRoleHome([role]),home)
  assert.equal(nav.staffRoleLabel([role]),label)
  assert.equal(nav.canRoleOpenAdminPath([role],home,'',access),true)
  const groups=nav.roleNavigationGroups([role],access)
  assert.equal(groups[0].id,firstGroup)
  const items=groups.flatMap(group=>Array.from(group.items))
  assert.ok(groups.every(group=>group.items.length>0))
  assert.equal(new Set(items.map(item=>item.to)).size,items.length)
  const expected=nav.adminNavigation.flatMap(group=>Array.from(group.items)).filter(item=>nav.canOpenAdminItem(item,access)&&nav.canRoleOpenAdminPath([role],item.to,'',access))
  assert.deepEqual(items.map(item=>item.to).sort(),expected.map(item=>item.to).sort())
  for(const item of items) assert.ok(item.permissions.some(p=>permissions.includes(p)),`${role}: ${item.to}`)
  assert.equal(nav.roleNavigationGroups([role],ready([])).length,0)
  for(const status of ['anonymous','loading','error']) assert.equal(nav.roleNavigationGroups([role],{status,permissions}).length,0)
})

test('PASSENGER never receives a staff menu; combined roles retain both departments without duplicate links',()=>{
  assert.equal(nav.roleNavigationGroups(['PASSENGER'],ready(nav.backendRolePermissions.PASSENGER)).length,0)
  const roles=['SHIP_MANAGER','ACTIVITY_SERVICE_MANAGER'], permissions=roles.flatMap(role=>nav.backendRolePermissions[role])
  const links=nav.roleNavigationGroups(roles,ready(permissions)).flatMap(group=>Array.from(group.items,item=>item.to))
  assert.equal(new Set(links).size,links.length)
  for(const path of ['/admin/ships','/admin/decks','/admin/activities','/admin/services','/admin/shore-excursions']) assert.ok(links.includes(path))
})
