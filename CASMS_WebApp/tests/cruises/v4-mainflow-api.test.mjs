import { loadSource } from '../helpers/source-loader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'


const load=(file,imports={})=>loadSource(file,imports)
class ApiError extends Error{constructor(message,status,code,details){super(message);this.status=status;this.code=code;this.details=details}}
const plan={cruiseId:'c1',revision:3,planStatus:'SUBMITTED',readyStatus:'NOT_READY',allowedActions:[],planBlockers:[],readyBlockers:[],fingerprint:'f',windows:{expectedRevision:5}}
test('scoped plan action sends plan revision and verifies server readback',async()=>{
 const calls=[],saved={...plan,revision:4,planStatus:'APPROVED'}
 const {mainflowApi}=load('features/cruises/api/mainflow-api.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push([path,options]);return saved}}})
 assert.equal((await mainflowApi.action(plan,'approve','')).planStatus,'APPROVED');assert.equal(calls.length,2)
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1].body)),{expectedRevision:3,reason:'',fingerprint:'f'})
})
test('plan action refuses success when readback revision differs',async()=>{
 let n=0;const {mainflowApi}=load('features/cruises/api/mainflow-api.ts',{'@/shared/api':{ApiError,apiRequest:async()=>({...plan,revision:++n===1?4:5})}})
 await assert.rejects(mainflowApi.action(plan,'approve',''),e=>e.status===502)
})
test('plan decoder rejects foreign Cruise and unknown state',()=>{
 const {decodePlan}=load('features/cruises/api/mainflow-api.ts',{'@/shared/api':{ApiError}})
 assert.throws(()=>decodePlan(plan,'other'));assert.throws(()=>decodePlan({...plan,planStatus:'PUBLISHED'},'c1'))
})

test('window save verifies all four instants and returned Cruise revision before success',async()=>{
 const windows={expectedRevision:5,bookingOpensAt:'2027-01-01T00:00:00Z',bookingClosesAt:'2027-01-20T00:00:00Z',guidanceOpensAt:'2027-01-21T00:00:00Z',guidanceClosesAt:'2027-01-22T00:00:00Z'}
 const saved={...plan,windows:{...windows,expectedRevision:6}},calls=[]
 const {mainflowApi}=load('features/cruises/api/mainflow-api.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push({path,options});return saved}}})
 assert.equal((await mainflowApi.windows(plan,windows)).windows.expectedRevision,6);assert.equal(calls.length,2);assert.equal(calls[0].options.body.expectedRevision,5)
})
test('window save rejects readback with a different instant despite HTTP success',async()=>{
 const windows={expectedRevision:5,bookingOpensAt:'2027-01-01T00:00:00Z',bookingClosesAt:'2027-01-20T00:00:00Z',guidanceOpensAt:'2027-01-21T00:00:00Z',guidanceClosesAt:'2027-01-22T00:00:00Z'}
 const saved={...plan,windows:{...windows,expectedRevision:6}};let n=0
 const {mainflowApi}=load('features/cruises/api/mainflow-api.ts',{'@/shared/api':{ApiError,apiRequest:async()=>++n===1?saved:{...saved,windows:{...saved.windows,guidanceClosesAt:'2027-01-23T00:00:00Z'}}}})
 await assert.rejects(mainflowApi.windows(plan,windows),e=>e.status===502)
})
test('unknown server text never becomes business copy',()=>{
 const copy=JSON.parse(readFileSync(new URL('../../src/shared/i18n/vi-business-map.json',import.meta.url),'utf8'))
 const {businessErrorMessage}=load('shared/api/business-errors.ts',{'@/shared/i18n/business-copy':{businessCopy:key=>copy[key]}})
 assert.equal(businessErrorMessage('NEW_UNKNOWN','SQLException: private secret'),'Không thể hoàn tất thao tác. Vui lòng tải lại và thử lại.')
 assert.match(businessErrorMessage('QUOTE_EXPIRED','wrong'),/Báo giá đã hết hạn/)
})

const activity={id:'a1',cruiseId:'c1',name:'Hoạt động',description:null,startTime:'2027-04-01T02:00:00Z',endTime:'2027-04-01T03:00:00Z',location:'Sảnh',deckId:null,cabinId:null,capacity:20,price:0,currencyCode:'VND'}

test('itinerary CRM reads activities from its Cruise endpoint without global activity access',async()=>{
 let rows=[{...activity,status:'PLANNED'}];const calls=[]
 const {programApi}=load('features/itineraries/api/program-api.ts',{'@/shared/api':{apiRequest:async(path)=>{calls.push(path);return rows}}})
 assert.equal((await programApi.activities('c1',undefined,true))[0].id,'a1')
 assert.deepEqual(calls,['/cruise-plans/c1/activities'])
 rows=[{...rows[0],cruiseId:'foreign'}]
 await assert.rejects(programApi.activities('c1',undefined,true),/không thuộc/)
})

test('itinerary excludes port-only catalog tours and retains the raw excursion API contract',async()=>{
 const linked={shoreExcursionId:'e1',cruiseStopId:'stop1',excursionName:'Linked',startTime:activity.startTime,plannedReturnTime:activity.endTime,status:'PLANNED',supplierId:'s1',meetingPoint:'Port',maximumCapacity:10,minimumParticipants:null,price:0,currencyCode:'USD'}
 let rows=[{...linked,shoreExcursionId:'catalog1',cruiseStopId:null},linked],saved
 const {programApi}=load('features/itineraries/api/program-api.ts',{'@/shared/api':{apiRequestRaw:async(path,decode,options)=>{if(options?.method){saved=options;return decode({...linked,...options.body},200)}return decode(rows,200)}}})
 const result=await programApi.excursions();assert.equal(result.length,1);assert.equal(result[0].shoreExcursionId,'e1')
 assert.equal((await programApi.updateExcursion(linked,linked.startTime,linked.plannedReturnTime,'Updated')).meetingPoint,'Updated')
 assert.equal(saved.method,'PUT');assert.equal(saved.body.cruiseStopId,'stop1')
 rows=[{...linked,cruiseStopId:''}];await assert.rejects(programApi.excursions())
 rows=[{shoreExcursionId:'malformed'}];await assert.rejects(programApi.excursions())
})
test('unconfigured source activity keeps null capacity price and currency while explicit zero stays zero',()=>{
 const {decodeActivities}=load('features/cruises/api/scoped-activity.ts',{'@/shared/api':{ApiError}})
 const unknown=decodeActivities([{...activity,capacity:null,price:null,currencyCode:null}],'c1')[0]
 assert.equal(unknown.capacity,null);assert.equal(unknown.price,null);assert.equal(unknown.currencyCode,null)
 assert.equal(decodeActivities([activity],'c1')[0].price,0)
})
test('legacy itinerary reader accepts unknown draft capacity and preserves venue IDs in update payload',async()=>{
 const row={...activity,status:'PLANNED',capacity:null,deckId:'d1',cabinId:'r1'},calls=[]
 const {programApi}=load('features/itineraries/api/program-api.ts',{'@/shared/api':{apiRequest:async(path,options)=>{calls.push({path,options});return options?.method?{...row,...options.body}:[row]}}})
 assert.equal((await programApi.activities('c1'))[0].capacity,null)
 const body={activityName:row.name,description:row.description,cruiseId:row.cruiseId,startTime:row.startTime,endTime:row.endTime,location:row.location,capacity:12,deckId:row.deckId,cabinId:row.cabinId,price:0,currencyCode:'USD'}
 await programApi.updateActivity('a1',body)
 assert.equal(calls[1].options.body.deckId,'d1');assert.equal(calls[1].options.body.cabinId,'r1')
})
test('scoped activity update keeps zero price and source fields, uses Cruise revision and verifies GET',async()=>{
 const calls=[],body={...activity,activityName:activity.name};delete body.id;delete body.name
 const {updateScopedActivity}=load('features/cruises/api/scoped-activity.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push({path,options});return options?.method==='PUT'?activity:[{...activity,startTime:'2027-04-01T02:00:00.000Z'}]}}})
 assert.equal((await updateScopedActivity('c1','a1',7,body)).price,0)
 assert.equal(calls[0].options.ifMatch,7);assert.equal(calls[0].options.method,'PUT');assert.equal(calls[1].path,'/cruise-plans/c1/activities')
 assert.equal(calls[0].options.body.description,null);assert.equal(calls[0].options.body.startTime,activity.startTime)
})
test('activity update rejects missing or divergent readback instead of claiming saved',async()=>{
 for(const readback of [[],[{...activity,price:100}],[{...activity,cruiseId:'other'}]]){
  const body={...activity,activityName:activity.name};delete body.id;delete body.name
  const {updateScopedActivity}=load('features/cruises/api/scoped-activity.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>options?.method==='PUT'?activity:readback}})
  await assert.rejects(updateScopedActivity('c1','a1',7,body),e=>e.status===502)
 }
})
test('activity update forbids a foreign Cruise before issuing any request',async()=>{
 let calls=0;const {updateScopedActivity}=load('features/cruises/api/scoped-activity.ts',{'@/shared/api':{ApiError,apiRequest:()=>{calls++}}})
 await assert.rejects(updateScopedActivity('other','a1',7,activity),e=>e.status===403);assert.equal(calls,0)
})

test('capacity field accepts only reviewed code and valid field-specific numeric metadata',()=>{
 const {activityCapacityConflict}=load('features/cruises/api/scoped-activity.ts',{'@/shared/api':{ApiError}})
 const error=details=>new ApiError('raw server message',422,'CAPACITY_BELOW_ALLOCATED',details)
 assert.equal(activityCapacityConflict(error({fieldPath:'capacity',allocatedParticipants:5})),5)
 for(const details of [{fieldPath:'maximumCapacity',allocatedParticipants:5},{fieldPath:'capacity',allocatedParticipants:'5'},{fieldPath:'capacity',allocatedParticipants:-1},{fieldPath:'capacity',allocatedParticipants:1.5},null])assert.equal(activityCapacityConflict(error(details)),null)
 assert.equal(activityCapacityConflict(new ApiError('capacity=99',422,'OTHER_CODE',{fieldPath:'capacity',allocatedParticipants:99})),null)
})

test('activity schedule focus follows only validated field metadata from its reviewed code',()=>{
 const {activityScheduleConflict}=load('features/cruises/api/scoped-activity.ts',{'@/shared/api':{ApiError}})
 for(const fieldPath of ['startTime','endTime'])assert.equal(activityScheduleConflict(new ApiError('private raw text',422,'ACTIVITY_OUTSIDE_CRUISE',{fieldPath})),fieldPath)
 for(const fieldPath of ['capacity','unknown',null])assert.equal(activityScheduleConflict(new ApiError('endTime',422,'ACTIVITY_OUTSIDE_CRUISE',{fieldPath})),null)
 assert.equal(activityScheduleConflict(new ApiError('endTime',422,'OTHER_CODE',{fieldPath:'endTime'})),null)
})

test('package composition uses scoped revision and exact benefit, and verifies persisted membership',async()=>{
 const calls=[],component={kind:'activities',referenceId:'a1',name:'Activity',benefitType:'INCLUDED'}
 const {addScopedPackageComponent}=load('features/cruises/api/scoped-package.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push({path,options});return options?.method==='POST'?null:{cruiseId:'c1',packageId:'p1',components:[component]}}}})
 assert.equal((await addScopedPackageComponent('c1','p1',8,component)).length,1)
 assert.equal(calls[0].path,'/cruise-plans/c1/packages/p1/activities');assert.equal(calls[0].options.ifMatch,8);assert.equal(calls[0].options.body.benefitType,'INCLUDED');assert.equal(calls.length,2)
})
test('package composition rejects foreign context, unknown benefit and unverified save',async()=>{
 for(const response of [{cruiseId:'other',packageId:'p1',components:[]},{cruiseId:'c1',packageId:'other',components:[]},{cruiseId:'c1',packageId:'p1',components:[{kind:'activities',referenceId:'a1',name:'Activity',benefitType:'AUTO'}]},{cruiseId:'c1',packageId:'p1',components:[]}]){
  const {addScopedPackageComponent}=load('features/cruises/api/scoped-package.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>options?.method==='POST'?null:response}})
  await assert.rejects(addScopedPackageComponent('c1','p1',8,{kind:'activities',referenceId:'a1',benefitType:'INCLUDED'}),e=>e.status===502)
 }
})
test('duplicate component409 remains a failure without a fabricated successful readback',async()=>{
 let calls=0;const {addScopedPackageComponent}=load('features/cruises/api/scoped-package.ts',{'@/shared/api':{ApiError,apiRequest:async()=>{calls++;throw new ApiError('',409,'PACKAGE_COMPONENT_DUPLICATE')}}})
 await assert.rejects(addScopedPackageComponent('c1','p1',8,{kind:'services',referenceId:'s1',benefitType:'OPTIONAL'}),e=>e.code==='PACKAGE_COMPONENT_DUPLICATE');assert.equal(calls,1)
})
test('package edit preserves current package type and zero price, verifies GET, and rejects shared catalog edits',async()=>{
 const base={id:'p1',ownerCruiseId:'c1',type:'BASIC',name:'Before',description:null,price:1,currency:'VND'},body={name:'After',description:'',price:0,currency:'VND'},calls=[]
 const {updateScopedPackage}=load('features/cruises/api/scoped-package.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push({path,options});return options?.method==='PUT'?{id:'p1',cruiseId:'c1'}:[{...base,...body}]}}})
 assert.equal((await updateScopedPackage('c1',base,9,body)).price,0);assert.equal(calls[0].options.body.type,'BASIC');assert.equal(calls[0].options.ifMatch,9)
 await assert.rejects(updateScopedPackage('c1',{...base,ownerCruiseId:null},9,body),e=>e.status===403);assert.equal(calls.length,2)
})

test('excursion commercial PATCH sends only three operational fields and verifies zero-price readback',async()=>{
 const calls=[],body={maximumCapacity:11,price:0,currencyCode:'VND'}
 const {updateExcursionCommercial,decodeCommercialExcursions}=load('features/cruises/api/scoped-excursion.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push({path,options});return options?.method==='PATCH'?{shoreExcursionId:'e1',...body}:[{id:'e1',name:'Tour',capacity:11,price:0,currency:'VND'}]}}})
 assert.equal(decodeCommercialExcursions([{id:'e1',name:'Tour',capacity:10,price:null,currency:null}])[0].price,null)
 assert.equal((await updateExcursionCommercial('c1','e1',6,body)).capacity,11)
 assert.equal(calls[0].path,'/cruise-plans/c1/excursions/e1/commercial');assert.equal(calls[0].options.ifMatch,6);assert.equal(calls[0].options.method,'PATCH')
 assert.deepEqual(Object.keys(calls[0].options.body).sort(),['currencyCode','maximumCapacity','price'])
})
test('excursion commercial PATCH never accepts missing or divergent persisted rows',async()=>{
 for(const rows of [[],[{id:'e1',name:'Tour',capacity:10,price:0,currency:'VND'}],[{id:'e1',name:'Tour',capacity:11,price:null,currency:'VND'}]]){
  const body={maximumCapacity:11,price:0,currencyCode:'VND'}
  const {updateExcursionCommercial}=load('features/cruises/api/scoped-excursion.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>options?.method==='PATCH'?{shoreExcursionId:'e1',...body}:rows}})
  await assert.rejects(updateExcursionCommercial('c1','e1',6,body),e=>e.status===502)
 }
})
test('excursion capacity metadata cannot be borrowed from activity or arbitrary server text',()=>{
 const {excursionCapacityConflict}=load('features/cruises/api/scoped-excursion.ts',{'@/shared/api':{ApiError}})
 assert.equal(excursionCapacityConflict(new ApiError('raw',422,'CAPACITY_BELOW_ALLOCATED',{fieldPath:'maximumCapacity',allocatedParticipants:5})),5)
 assert.equal(excursionCapacityConflict(new ApiError('raw',422,'CAPACITY_BELOW_ALLOCATED',{fieldPath:'capacity',allocatedParticipants:5})),null)
 assert.equal(excursionCapacityConflict(new ApiError('maximumCapacity=5',422,'UNKNOWN')),null)
})
test('mainflow API policy requires both actor role and effective grant',()=>{
 const rules=JSON.parse(readFileSync(new URL('../../src/shared/auth/api-permissions.json',import.meta.url),'utf8'))
 const {apiPermissionRequirement,hasPermissions}=load('shared/auth/permission-policy.ts',{'./api-permissions.json':rules})
 const rule=apiPermissionRequirement('/cruise-plans/c1/approve','POST');assert.equal(rule.mode,'ALL')
 assert.equal(hasPermissions({status:'ready',roles:['CRUISE_MANAGER'],permissions:['ITINERARY_APPROVE']},rule),false)
 assert.equal(hasPermissions({status:'ready',roles:['OPERATIONS_MANAGER'],permissions:[]},rule),false)
 assert.equal(hasPermissions({status:'ready',roles:['OPERATIONS_MANAGER'],permissions:['ITINERARY_APPROVE']},rule),true)
})
test('pricing review posts captured policy revision and verifies exact persisted state',async()=>{
 const policy={...{cruiseId:'c1',pricingPolicyId:'p1',policyNumber:2,revision:4,status:'PENDING_APPROVAL',currency:'USD'},policyVersion:'PRC-C1-V2'},calls=[]
 const decode=load('features/cruises/model/pricing-policy.ts',{'@/shared/api':{ApiError}}).decodePricingPolicy
 const saved=decode({...policy,revision:5,status:'APPROVED',reviewedBy:'opsB'},'c1')
 const {reviewPricing}=load('features/cruises/api/pricing-review.ts',{'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push({path,options});return saved}},'../model/pricing-policy':{decodePricingPolicy:decode}})
 assert.equal((await reviewPricing(decode(policy,'c1'),'approve','')).status,'APPROVED');assert.equal(calls.length,2)
 assert.equal(calls[0].path,'/cruise/c1/pricing-policy/approve');assert.equal(calls[0].options.body.expectedRevision,4)
})
test('pricing review refuses divergent readback and legacy responses without a revision',async()=>{
 const decode=load('features/cruises/model/pricing-policy.ts',{'@/shared/api':{ApiError}}).decodePricingPolicy,policy=decode({cruiseId:'c1',pricingPolicyId:'p1',revision:4,status:'DRAFT',currency:'USD'},'c1')
 let calls=0
 const {reviewPricing}=load('features/cruises/api/pricing-review.ts',{'@/shared/api':{ApiError,apiRequest:async()=>({cruiseId:'c1',pricingPolicyId:'p1',revision:++calls===1?5:6,status:'PENDING_APPROVAL',currency:'USD'})},'../model/pricing-policy':{decodePricingPolicy:decode}})
 await assert.rejects(reviewPricing(policy,'submit',''),e=>e.status===502)
 await assert.rejects(reviewPricing({...policy,revision:null},'submit',''),e=>e.status===409)
})
test('pricing approve requires OPS and dedicated pricing grant rather than open sale or draft edit',()=>{
 const rules=JSON.parse(readFileSync(new URL('../../src/shared/auth/api-permissions.json',import.meta.url),'utf8'))
 const {apiPermissionRequirement,hasPermissions}=load('shared/auth/permission-policy.ts',{'./api-permissions.json':rules})
 const rule=apiPermissionRequirement('/cruise/c1/pricing-policy/approve','POST')
 for(const permissions of [['CRUISE_OPEN_SALE'],['CRUISE_UPDATE_DRAFT'],[]])assert.equal(hasPermissions({status:'ready',roles:['OPERATIONS_MANAGER'],permissions},rule),false)
 assert.equal(hasPermissions({status:'ready',roles:['OPERATIONS_MANAGER'],permissions:['CRUISE_PRICING_APPROVE']},rule),true)
 assert.equal(hasPermissions({status:'ready',roles:['CRUISE_MANAGER'],permissions:['CRUISE_PRICING_APPROVE']},rule),false)
})
