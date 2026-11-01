import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceLoader } from '../helpers/source-loader.mjs'

const service = { id:'service', name:'Massage', type:'SPA', price:12.3456, currency:'USD', status:'ACTIVE', requiresSchedule:true, unitCode:'SESSION', applicabilityScope:'PASSENGER' }
const window = { id:'window', serviceId:'service', cruiseId:'cruise', startsAt:'2030-01-02T01:00:00Z', endsAt:'2030-01-02T02:00:00Z', location:'Spa', capacity:3, remainingCapacity:2, status:'OPEN' }
const request = { id:'request', passengerId:'passenger', bookingId:'booking', bookingPassengerId:'person', serviceId:'service', scheduleId:'window', quantity:2, unitPriceSnapshot:12.3456, currencySnapshot:'USD', status:'REQUESTED', requestTime:'2030-01-01T00:00:00Z' }
function client(transport) { return sourceLoader({'@/shared/api':{apiRequest:transport,apiRequestRaw:transport}})('features/booking/api/customer-extras-api.ts') }

test('service client preserves nullable catalogue units and immutable request price snapshot',()=>{
  const c=client(()=>{throw Error('No network expected')})
  const decoded=c.decodeCustomerService(service)
  assert.equal(decoded.unitCode,'SESSION'); assert.equal(decoded.applicabilityScope,'PASSENGER'); assert.equal(decoded.requiresSchedule,true)
  const unknown=c.decodeCustomerService({...service,unitCode:undefined,requiresSchedule:undefined})
  assert.equal(unknown.unitCode,null); assert.equal(unknown.requiresSchedule,null)
  const saved=c.decodeCustomerServiceRequest(request)
  assert.equal(saved.unitPriceSnapshot,12.3456); assert.equal(saved.currencySnapshot,'USD'); assert.equal(saved.scheduleId,'window')
  assert.throws(()=>c.decodeCustomerService({...service,requiresSchedule:'true'}))
  assert.throws(()=>c.decodeCustomerServiceRequest({...request,unitPriceSnapshot:-1}))
})
test('schedule client filters by actual cruise, rejects foreign service and malformed capacity',async()=>{
  const calls=[]
  const c=client(async(path,options)=>{calls.push({path,options});return [window,{...window,id:'other',cruiseId:'other'}, {...window,id:'unknown',cruiseId:undefined}]})
  const rows=await c.customerExtrasApi.serviceSchedules('service','cruise')
  assert.equal(rows.length,1); assert.equal(rows[0].id,'window'); assert.equal(calls[0].path,'/servicepackage/services/service/schedules')
  await assert.rejects(client(async()=>[{...window,serviceId:'other'}]).customerExtrasApi.serviceSchedules('service','cruise'))
  for(const patch of [{remainingCapacity:4},{capacity:0},{endsAt:window.startsAt},{remainingCapacity:1.5}]) assert.throws(()=>c.decodeCustomerServiceSchedule({...window,...patch}))
})
test('request create sends the selected schedule and rejects mismatched readback rather than reporting success',async()=>{
  const calls=[]
  const c=client(async(path,options)=>{calls.push({path,options});return request})
  await c.customerExtrasApi.createRequest('service','person',2,' note ','window')
  assert.equal(calls[0].path,'/servicepackage/requests'); assert.equal(calls[0].options.method,'POST')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.body)),{serviceId:'service',bookingPassengerId:'person',quantity:2,note:'note',serviceScheduleId:'window'})
  await assert.rejects(client(async()=>({...request,scheduleId:'other'})).customerExtrasApi.createRequest('service','person',2,'','window'))
  await assert.rejects(client(async()=>({...request,status:'CANCELLED'})).customerExtrasApi.createRequest('service','person',2,'','window'))
  await assert.rejects(c.customerExtrasApi.createRequest('service','person',0,'','window'))
})
test('cancel readback must identify the cancelled object and cannot infer a refund',async()=>{
  const c=client(async()=>({...request,status:'CANCELLED'}))
  assert.equal((await c.customerExtrasApi.cancelRequest('request')).status,'CANCELLED')
  await assert.rejects(client(async()=>({...request,status:'ACCEPTED'})).customerExtrasApi.cancelRequest('request'))
  await assert.rejects(client(async()=>({...request,id:'other',status:'CANCELLED'})).customerExtrasApi.cancelRequest('request'))
})
test('payment creation blocks foreign currency before transport, while reading preserves historical currency',async()=>{
  let calls=0
  const row={paymentId:'payment',bookingId:'booking',requestedAmount:20,currency:'VND',paymentMethod:'Cash',status:'Pending'}
  const api=sourceLoader({'@/shared/api':{apiRequest:async()=>{calls++;return [row]}}})('features/booking/api/payment-api.ts').paymentApi
  await assert.rejects(api.create({bookingId:'booking',requestedAmount:20,currency:'VND',paymentMethod:'Cash',idempotencyKey:'test'}))
  assert.equal(calls,0); assert.equal((await api.list('booking'))[0].currency,'VND')
})
test('all cabin consumers use one approved enum mapping, payment labels remain object-specific',()=>{
  const load=sourceLoader()
  const shared=load('shared/i18n/business-copy.ts')
  assert.deepEqual(JSON.parse(JSON.stringify(shared.cabinTypeLabels)),{INTERIOR:'Phòng trong',OCEAN_VIEW:'Phòng hướng biển',BALCONY:'Phòng có ban công',SUITE:'Phòng Suite'})
  assert.strictEqual(load('features/ship-deck-cabin/model/types.ts').cabinTypes,shared.cabinTypeLabels)
  assert.strictEqual(load('features/ship-deck-cabin/model/ship-management.ts').roomTypeLabels,shared.cabinTypeLabels)
  assert.strictEqual(load('features/ship-model-viewer/model.ts').cabinTypes,shared.cabinTypeLabels)
  assert.equal(load('features/booking/model/booking-presentation.ts').cabinTypeName('SUITE'),'Phòng Suite')
  assert.match(shared.cabinTypeLabel('UNKNOWN'),/Chưa xác định/)
  const copy=load('features/booking/model/experience-copy.ts')
  assert.equal(copy.serviceQuantityLabel(null),'Số lượng'); assert.equal(copy.serviceQuantityLabel('UNKNOWN'),'Số lượng')
  assert.equal(copy.serviceQuantityLabel('DEVICE'),'Số thiết bị'); assert.equal(new Set(Object.values(copy.paymentStatusLabels)).size,4)
  assert.match(copy.paymentStatusLabels.Pending,/chờ xác nhận/); assert.match(copy.paymentStatusLabels.Confirmed,/khoản thanh toán/)
})

const jsx=(type,props,key)=>({type,props:props??{},key})
function nodes(value){ if(value==null||typeof value==='boolean')return [];if(Array.isArray(value))return value.flatMap(nodes);if(typeof value!=='object')return [value];if(typeof value.type==='function'&&['Passenger','Quantity','Price'].includes(value.type.name))return [value,...nodes(value.type(value.props))];return [value,...nodes(value.props?.children)] }
function serviceHarness({requiresSchedule=true,remaining=2,canCreate=true,status='Confirmed'}={}) {
  let state=[],cursor=0;const mutations=[]
  const api={...client(async()=>[]).customerExtrasApi,createRequest:async(...args)=>mutations.push(args)}
  const query=(key)=>({data:key==='customer-services'?[{...service,requiresSchedule}]:key.startsWith('customer-service:')?{...service,requiresSchedule}:key.startsWith('customer-service-schedules:')?[{...window,remainingCapacity:remaining}]:key.startsWith('customer-service-availability:')?true:null,loading:false,error:null,retry(){}})
  const ui=Object.fromEntries(['Button','Empty','Field','Notice','Panel','TechnicalDetails'].map(name=>[name,name]))
  const load=sourceLoader({react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value}]},useCallback:f=>f},'react/jsx-runtime':{jsx,jsxs:jsx},'@/shared/ui':ui,'./RealBookingUI':{BookingReadState:'BookingReadState'},'@/shared/api':{useReadQuery:query},'@/shared/auth':{useSessionAccess:()=>({userId:'user',canDo:()=>canCreate})},'../api/customer-extras-api':{customerExtrasApi:api},'../api/booking-api':{},'../model/use-extras-mutation':{useExtrasMutation:()=>({busy:false,uncertain:false,run:async(action)=>action()})}})
  const booking={bookingId:'booking',cruiseId:'cruise',bookingStatus:status,passengers:[{bookingPassengerId:'person',passengerId:'passenger',userId:'user',fullName:'Test',participationStatus:'Active'}]}
  const outer=load('features/booking/components/CustomerExperiences.tsx').CustomerServices
  // Select the service in the real parent, then render the actual ServiceSelection function.
  cursor=0;let parent=outer({booking});nodes(parent).find(n=>n?.props?.id==='customer-service').props.onChange({target:{value:'service'}})
  cursor=0;parent=outer({booking});const child=nodes(parent).find(n=>typeof n?.type==='function'&&n.type.name==='ServiceSelection')
  state=[]
  return {mutations,render(){cursor=0;return child.type(child.props)}}
}
test('scheduled service UI requires selected window, ownership selection and remaining capacity before submit',async()=>{
  const h=serviceHarness();let view=h.render()
  const find=id=>nodes(view).find(n=>n?.type==='select'&&n?.props?.id===id)
  find('service-passenger').props.onChange({target:{value:'person'}})
  view=h.render()
  assert.equal(nodes(view).find(n=>n?.props?.type==='submit').props.disabled,true)
  find('service-schedule').props.onChange({target:{value:'window'}})
  view=h.render();assert.equal(nodes(view).find(n=>n?.props?.type==='submit').props.disabled,false)
  await nodes(view).find(n=>n?.type==='form').props.onSubmit({preventDefault(){}})
  assert.deepEqual(h.mutations[0],['service','person',1,'','window'])
  const full=serviceHarness({remaining:0});const noData=serviceHarness({requiresSchedule:null})
  for(const x of [full,noData])assert.equal(nodes(x.render()).find(n=>n?.props?.type==='submit').props.disabled,true)
  assert.equal(nodes(serviceHarness({canCreate:false}).render()).some(n=>n?.props?.type==='submit'),false)
  assert.equal(nodes(serviceHarness({status:'Draft'}).render()).some(n=>n?.props?.type==='submit'),false)
})
