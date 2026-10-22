import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root=new URL('../../src/',import.meta.url)
const jsx=(type,props)=>({type,props})
function load(file,imports={}) {
  const module={exports:{}}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    module,exports:module.exports,Date,URL,URLSearchParams,
    require(id){if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};if(id.endsWith('.module.css'))return {default:{}};assert.ok(Object.hasOwn(imports,id),id);return imports[id]},
  })
  return module.exports
}
const context=load('domain/booking-context/booking-context-api.ts',{'@/shared/api':{}})
const api=load('features/booking/api/real-booking-api.ts',{'@/shared/api':{},'@/domain/booking-context':context})
const live=load('features/booking/model/live-booking-context.ts',{react:{createContext:()=>null}})
const {availableBookingStep}=load('features/booking/model/booking-progress.ts',{'../api/real-booking-api':api})
const cruise={cruiseId:'cruise',cruiseName:'Trip',status:'PUBLISHED',shipId:'ship',departureDatetime:'2099-01-01T00:00:00Z'}
const cabin={cabinId:'cabin',cabinNumber:'100',remainingCapacity:2}

test('booking advances only after earlier choices are valid and retains staged payment on serialization',()=>{
  const draft=live.initialLiveBooking()
  assert.equal(draft.paymentPlan,'STAGES')
  assert.equal(availableBookingStep(draft,cruise,[cabin],[]),1)
  draft.cruiseId='cruise';draft.passengers[0].cabinId='cabin'
  assert.equal(availableBookingStep(draft,cruise,[cabin],[]),2)
  draft.passengers[0].fullName='Guest';draft.passengers[0].email='guest@example.test'
  assert.equal(availableBookingStep(draft,cruise,[cabin],[]),3)
  assert.equal(api.serializeBooking(draft).paymentPlan,'STAGES')
  assert.equal(availableBookingStep(draft,cruise,[{...cabin,remainingCapacity:0}],[]),1)
  draft.passengers[0].tourPackageId='removed'
  assert.equal(availableBookingStep(draft,cruise,[cabin],[]),1)
})

test('former customer account routes use guest reference lookup',()=>{
  const {CustomerGuard}=load('features/auth/guards.tsx',{
    react:{},'@/shared/auth':{},'@/shared/ui/admin-v3':{},'@/shared/ui':{},
    'react-router':{Navigate:'Navigate',useLocation:()=>({pathname:'/my-bookings',search:'?preview=1'})},
    './useAuth':{useAuth:()=>({user:null})},'./model/auth-types':{},
  })
  const result=CustomerGuard()
  assert.equal(result.type,'Navigate')
  assert.equal(result.props.to,'/booking/lookup')
})

test('installment view uses persisted sequence, amounts and due dates without inventing paid states',()=>{
  const {BookingInstallments}=load('features/booking/components/BookingInstallments.tsx',{
    '../model/booking-presentation':{bookingMoney:(amount,currency)=>`${amount} ${currency}`},
    '../model/real-booking-view':{bookingWhen:value=>value},
  })
  const tree=BookingInstallments({booking:{paymentPlan:'STAGES',installments:[
    {sequenceNo:3,requiredAmount:30,currency:'USD',dueAt:'final',status:'Scheduled'},
    {sequenceNo:1,requiredAmount:30,currency:'USD',dueAt:'first',status:'Scheduled'},
    {sequenceNo:2,requiredAmount:40,currency:'USD',dueAt:'middle',status:'Cancelled'},
  ]}})
  const output=JSON.stringify(tree)
  assert.ok(output.indexOf('first')<output.indexOf('middle')&&output.indexOf('middle')<output.indexOf('final'))
  assert.match(output,/40 USD/);assert.match(output,/Đã hủy/)
  assert.doesNotMatch(output,/Đã thanh toán|Paid|Settled/)
})

test('hero provides seven distinct real port assets with source and license',()=>{
  const {asianPorts}=load('features/home/model/asian-ports.ts')
  assert.equal(asianPorts.length,7)
  assert.equal(new Set(asianPorts.map(port=>port.id)).size,7)
  for(const port of asianPorts){
    assert.ok(existsSync(new URL('../../public'+port.image,import.meta.url)))
    assert.match(port.source,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
    assert.ok(port.author&&port.license&&port.licenseUrl)
  }
})

test('later booking stages expose retry for failed prerequisites rather than an empty review or unusable form',()=>{
  const failure=new Error('offline'),retry=()=>{}
  const draft=live.initialLiveBooking();draft.cruiseId='cruise';draft.passengers[0].cabinId='cabin'
  const {RealBookingCreatePage}=load('features/booking/pages/RealBookingCreatePage.tsx',{
    react:{useCallback:fn=>fn,useEffect:()=>{},useRef:value=>({current:value}),useState:value=>[typeof value==='function'?value():value,()=>{}]},
    'react-router':{Link:'Link',Navigate:'Navigate',useSearchParams:()=>[new URLSearchParams('cruiseId=cruise')],useNavigate:()=>()=>{}},
    '@/shared/auth':{useSessionAccess:()=>({userId:null})},
    '@/shared/api':{ApiError:Error,useReadQuery:key=>key==='booking-published-cruises'?{error:failure,data:null,loading:false,retry}:{data:key.startsWith('booking-available')?[cabin]:[],loading:false,error:null,retry}},
    '@/shared/ui':Object.fromEntries(['Button','ButtonLink','Empty','Field','Loading','Modal','Notice','PageHeader','Panel'].map(name=>[name,name])),
    '../api/real-booking-api':api,'../components/LiveBookingFields':{},
    '../components/RealBookingUI':{RealBookingFrame:'Frame',BookingReadState:'ReadState'},
    '../model/booking-mutation':{},'../model/live-booking-context':{useLiveBooking:()=>({draft,saved:null,uncertain:false,busy:false,errors:{},submissionLockRef:{current:false}})},
    '../model/booking-progress':{availableBookingStep},'../model/live-booking-navigation':{catalogReturn:()=>'/cruises',bookingStepPaths:['/booking/cabin-experience','/booking/travellers','/booking/review']},
    '../model/real-booking-view':{},'../model/booking-feedback':{},'./RealBookingPages':{},
  })
  const result=RealBookingCreatePage({step:2})
  assert.equal(result.type,'Frame')
  const children=result.props.children
  assert.equal(children[0].props.breadcrumb,'ĐẶT CHỖ')
  assert.equal(children[1].type,'ReadState')
  assert.equal(children[1].props.error,failure)
  assert.equal(children[1].props.retry,retry)
  assert.ok(children[3].props.to.startsWith('/booking/cabin-experience'))
})

test('production route errors never render transport messages or developer stack traces',()=>{
  const {RouteErrorPage}=load('app/RouteErrorPage.tsx',{
    'react-router':{Link:'Link',isRouteErrorResponse:()=>false,useRouteError:()=>new Error('PRIVATE_STACK_TRACE')},
    '@/shared/ui':{BrandLogo:'BrandLogo'},
  })
  const output=JSON.stringify(RouteErrorPage())
  assert.match(output,/Chưa thể mở trang này/)
  assert.doesNotMatch(output,/PRIVATE_STACK_TRACE|Hey developer|Unexpected Application Error/)
})

test('service request tabs respect staff role while management catalog tabs remain available to activity managers',()=>{
  const navigation=load('shared/ui/admin-v3/admin-navigation.ts')
  let roles=['ONBOARD_STAFF']
  const {CatalogFrame}=load('features/service-packages/components/CatalogUI.tsx',{
    react:{useContext:()=>roles},'react-router':{Link:'Link',useLocation:()=>({pathname:'/admin/service-requests'})},
    '@/shared/api':{},'@/shared/auth':{useSessionAccess:()=>({status:'ready',permissions:navigation.backendRolePermissions[roles[0]]})},'@/shared/ui':{},'@/shared/ui/admin-v3':{...navigation,AdminShell:'Shell',AdminRoleContext:{}},
    '../model/catalog':{catalogConfig:{services:{route:'/admin/services',label:'Dịch vụ'},products:{route:'/admin/products',label:'Sản phẩm'},packages:{route:'/admin/service-packages',label:'Gói'}}},
  })
  const links=()=>CatalogFrame({children:'content'}).props.children.props.children[0].props.children.map(node=>node.props.to)
  assert.deepEqual(Array.from(links()),['/admin/services','/admin/service-requests'])
  assert.equal(navigation.canRoleOpenAdminPath(roles,'/admin/services/10000000-0000-4000-8000-000000000001'),true)
  roles=['ACTIVITY_SERVICE_MANAGER']
  assert.equal(links().length,4)
})
