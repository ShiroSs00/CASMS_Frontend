import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const jsx = (type, props) => ({ type, props })
function load(file, imports) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL('../../src/' + file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText.replaceAll('import.meta.env.DEV','false')
  vm.runInNewContext(source, { URL, URLSearchParams, module, exports: module.exports, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    assert.ok(Object.hasOwn(imports, id), id)
    return imports[id]
  } })
  return module.exports
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
}

test('passenger picker never starts booking queries while access is missing, loading or failed', () => {
  for (const status of ['ready', 'loading', 'error', 'anonymous']) {
    const access = { status, error: 'Offline', has: () => false }
    const { BookingPassengerPicker } = load('domain/booking-context/BookingPassengerPicker.tsx', {
      react: {}, '@/shared/api': { useReadQuery() { assert.fail('Must not request inaccessible bookings') } },
      '@/shared/auth': { useSessionAccess: () => access }, '@/shared/ui': { Loading: 'Loading', Notice: 'Notice' }, './booking-context-api': {},
    })
    const result = BookingPassengerPicker({ value: '', onChange() {} })
    assert.equal(result.type, status === 'loading' ? 'Loading' : 'Notice')
    if (status === 'ready') assert.equal(result.props.title, 'Cần quyền xem đặt chỗ')
    if (status === 'error') assert.equal(result.props.title, 'Chưa tải được quyền xem đặt chỗ')
  }
})

test('authorized passenger picker delegates unchanged booking context to its query component', () => {
  const { BookingPassengerPicker } = load('domain/booking-context/BookingPassengerPicker.tsx', {
    react: {}, '@/shared/api': {}, '@/shared/auth': { useSessionAccess: () => ({ status: 'ready', has: permission => permission === 'BOOKING_READ' }) }, '@/shared/ui': {}, './booking-context-api': {},
  })
  const props = { fixedBookingId: 'fixture', value: 'passenger', onChange() {} }
  const result = BookingPassengerPicker(props)
  assert.equal(typeof result.type, 'function')
  assert.equal(result.props.fixedBookingId, 'fixture')
  assert.equal(result.props.value, 'passenger')
  assert.equal(result.props.onChange, props.onChange)
})

test('ship list only offers creation when the session explicitly grants SHIP_CREATE', () => {
  for (const granted of [false, true]) {
    const { ShipListPage } = load('features/ship-deck-cabin/pages/ShipListPage.tsx', {
      react: { useState: value => [value, () => {}] }, 'react-router': { Link: 'Link' },
      '@/shared/auth': { useSessionAccess: () => ({ has: permission => granted && permission === 'SHIP_CREATE' }) },
      '@/shared/ui': { Button: 'Button' }, '@/shared/ui/admin-v3': { AdminShell: 'AdminShell' },
      '../components/ShipListMetrics': { ShipListMetrics: 'Metrics' }, '../components/ShipListFilters': { ShipListFilters: 'Filters' }, '../components/ShipListTable': { ShipListTable: 'Table' },
      '../api/ship-deck-cabin-api': { shipDeckCabinApi: {} }, '../model/ship-list-types': { emptyShipFilters: { search:'', status:'ALL', readiness:'ALL' } },
      '../model/useShipList': { useShipList: () => ({ state: { status: 'error', message: 'Denied' } }) },
    })
    const links = nodes(ShipListPage()).filter(node => node.type === 'Link' && node.props.to === '/admin/ships/new')
    assert.equal(links.length, granted ? 1 : 0)
  }
})


const workspaceModel = load('shared/ui/admin-v3/admin-navigation.ts', {})
function guard(pathname, permissions, status = 'ready', signedIn = true, staff = true, roles = ['ACTIVITY_SERVICE_MANAGER']) {
  const access = { status, userId:'fixture', permissions, error:'Offline', has:permission=>permissions.includes(permission) }
  const { AdminGuard } = load('features/auth/guards.tsx', {
    '@/shared/auth':{useSessionAccess:()=>access}, '@/shared/ui':{Loading:'Loading',Notice:'Notice'},
    '@/shared/ui/admin-v3':{...workspaceModel,AdminShell:'AdminShell'},
    'react-router':{Link:'Link',Outlet:'Outlet',Navigate:'Navigate',useLocation:()=>({pathname,search:'',hash:''})},
    react:{useState:value=>[value,()=>{}]},
    './useAuth':{useAuth:()=>({user:signedIn?{id:'fixture',roles}:null,isStaff:staff})}, './model/auth-types':{},
  })
  return AdminGuard()
}

test('direct department links block unrelated staff before mounting business pages',()=>{
  const result=guard('/admin/ships',['SERVICE_READ'])
  assert.equal(result.type,'AdminShell')
  assert.ok(nodes(result).some(node=>node.props?.title==='Bạn chưa được cấp quyền vào chức năng này'))
  assert.ok(!nodes(result).some(node=>node.type==='Outlet'))
  assert.equal(guard('/admin/services',['SERVICE_READ']).type,'Outlet')
  assert.equal(guard('/admin/workspaces/shore',['EXCURSION_READ']).type,'AdminShell')
  assert.equal(guard('/admin/workspaces/schedule',['ITINERARY_READ'],'ready',true,true,['CRUISE_MANAGER']).type,'Outlet')
  assert.equal(guard('/admin',['SERVICE_READ']).type,'Outlet')
})

test('unknown, loading and failed access never mount a protected department',()=>{
  for(const status of ['anonymous','loading','error']) {
    const result=guard('/admin/workspaces/services',['SERVICE_READ'],status)
    assert.equal(result.type,'AdminShell')
    assert.ok(!nodes(result).some(node=>node.type==='Outlet'))
  }
})

test('department boundary preserves anonymous login and passenger denial',()=>{
  assert.equal(guard('/admin/services',[],'ready',false).props.to.startsWith('/login?'),true)
  assert.equal(guard('/admin/services',['SERVICE_READ'],'ready',true,false).props.to,'/403')
})


test('only assigned roles enter workspace homes, while operations can read and approve itineraries',()=>{
  const all=['ITINERARY_READ','SHIP_READ','EXCURSION_READ','SERVICE_READ']
  const personas={CRUISE_MANAGER:'schedule',SHIP_MANAGER:'operations',OPERATIONS_MANAGER:'operations',ACTIVITY_SERVICE_MANAGER:'services',ADMIN:'system'}
  for(const [role,own] of Object.entries(personas)) for(const id of ['schedule','operations','services']) {
    assert.equal(guard('/admin/workspaces/'+id,all,'ready',true,true,[role]).type,own===id?'Outlet':'AdminShell',role+' -> '+id)
  }
  assert.equal(guard('/admin/system',['USER_READ'],'ready',true,true,['ADMIN']).type,'Outlet')
  assert.equal(guard('/admin/itineraries/fixture',['ITINERARY_READ'],'ready',true,true,['OPERATIONS_MANAGER']).type,'Outlet')
  assert.equal(guard('/admin/services/new',['SERVICE_READ'],'ready',true,true,['ACTIVITY_SERVICE_MANAGER']).type,'AdminShell')
  assert.equal(guard('/admin/services/new',['SERVICE_CREATE'],'ready',true,true,['ACTIVITY_SERVICE_MANAGER']).type,'Outlet')
})

test('same-account permission refresh preserves admitted forms but never admits another department or revoked access',()=>{
  let admitted='',status='ready',permissions=['SERVICE_READ'],pathname='/admin/services',userId='staff-a'
  const { AdminGuard }=load('features/auth/guards.tsx',{
    react:{useState:()=>[admitted,value=>{admitted=value}]},
    '@/shared/auth':{useSessionAccess:()=>({status,userId,permissions,error:'',has:permission=>status==='ready'&&permissions.includes(permission)})},
    '@/shared/ui':{Loading:'Loading',Notice:'Notice'}, '@/shared/ui/admin-v3':{...workspaceModel,AdminShell:'AdminShell'},
    'react-router':{Link:'Link',Outlet:'Outlet',Navigate:'Navigate',useLocation:()=>({pathname,search:'',hash:''})},
    './useAuth':{useAuth:()=>({user:{id:userId,roles:['ACTIVITY_SERVICE_MANAGER']},isStaff:true})}, './model/auth-types':{},
  })
  assert.equal(AdminGuard().type,'Outlet')
  status='loading'
  assert.equal(AdminGuard().type,'Outlet','refresh must keep the admitted form mounted')
  pathname='/admin/ships'
  assert.equal(AdminGuard().type,'AdminShell','another department is not admitted during refresh')
  pathname='/admin/services'
  assert.equal(AdminGuard().type,'AdminShell','leaving a department retires its prior admission')
  status='ready';permissions=['SERVICE_READ'];AdminGuard();status='loading';userId='staff-b'
  assert.equal(AdminGuard().type,'AdminShell','another account cannot reuse admission')
  userId='staff-a'
  assert.equal(AdminGuard().type,'AdminShell','returning to an account requires fresh admission')
  status='ready';permissions=[]
  assert.equal(AdminGuard().type,'AdminShell','fresh revocation takes effect')
  status='loading'
  assert.equal(AdminGuard().type,'AdminShell','revoked admission is retired')
})
