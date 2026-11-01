import { sourceLoader } from '../helpers/source-loader.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import test from 'node:test'


import { permissionPolicy } from '../helpers/permission-policy.mjs'

const root=fileURLToPath(new URL('../../src/',import.meta.url))
class ApiError extends Error {constructor(message,status,code){super(message);Object.assign(this,{status,code})}}


test('public Booking paths precede private Booking identity rule without granting private read',()=>{
 for(const path of ['/booking/available-cabins','/booking/3d-available-cabins','/booking/lookup','/booking/recovery','/booking/quotes/q'])assert.equal(permissionPolicy.apiPermissionRequirement(path,'GET'),null,path)
 assert.equal(permissionPolicy.apiPermissionRequirement('/booking/quotes','POST'),null)
 const privateRead=permissionPolicy.apiPermissionRequirement('/booking/'+id,'GET')
 assert.ok(privateRead.permissions.includes('BOOKING_READ'))
 assert.equal(permissionPolicy.hasPermissions({status:'anonymous',permissions:[]},privateRead),false)
})

test('Cruise deck selector uses only assigned-ship rows and never loads an unknown ship catalog',()=>{
 const {CruiseDeckField}=loader({'@/shared/ui':{Field:'Field'}})('features/cruises/components/CruiseDeckField.tsx')
 const options={ship:{id:'ship-a',name:'Assigned ship'},decks:[{id:'deck-a',name:'Deck A',number:1,shipId:'ship-a'},{id:'deck-b',name:'Foreign deck',number:1,shipId:'ship-b'}]}
 let tree=nodes(CruiseDeckField({options,value:'deck-a'}))
 assert.ok(tree.some(n=>n.type==='option'&&n.props.value==='deck-a'))
 assert.ok(!tree.some(n=>n.type==='option'&&n.props.value==='deck-b'))
 assert.equal(tree.find(n=>n.type==='select').props.defaultValue,'deck-a')
 tree=nodes(CruiseDeckField({options:{...options,ship:{id:null,name:null}}}))
 assert.equal(tree.find(n=>n.type==='select').props.disabled,true)
 assert.equal(tree.filter(n=>n.type==='option').length,1)
 tree=nodes(CruiseDeckField({options,value:'deck-a',disabled:true}))
 assert.equal(tree.find(n=>n.type==='select').props.disabled,true)
})
function loader(overrides={}) { return sourceLoader(overrides, overrides.__globals); }
const model=()=>loader({'@/shared/api':{ApiError}})('features/cruises/model/departure-contract.ts')
test('v4.1 program wall clocks resolve Vietnam08 to01Z and reject unknown or ambiguous shore zones',()=>{
 const {programInstant}=loader()('features/cruises/model/program-time.ts')
 assert.equal(programInstant('2026-10-29T08:00',false),'2026-10-29T01:00:00.000Z')
 assert.equal(programInstant('2026-10-29T08:00',true,'Asia/Singapore'),'2026-10-29T00:00:00.000Z')
 assert.throws(()=>programInstant('2026-10-29T08:00',true))
 for(const wall of ['2026-03-29T02:30','2026-10-25T02:30'])assert.throws(()=>programInstant(wall,true,'Europe/Paris'))
})
test('Plan booking windows and guidance use Vietnam wall time without changing stored seconds',()=>{
 const {preparationWallTime,preparationInstant}=loader()('features/cruises/model/preparation-time.ts')
 assert.equal(preparationWallTime('2026-10-29T01:00:25Z'),'2026-10-29T08:00:25')
 assert.equal(preparationInstant('2026-10-29T08:00:25'),'2026-10-29T01:00:25.000Z')
 assert.equal(preparationInstant('2026-10-29T08:00'),'2026-10-29T01:00:00.000Z')
 assert.equal(preparationWallTime(null),'');assert.equal(preparationInstant(''),null)
 assert.throws(()=>preparationInstant('2026-02-30T08:00'))
 const files=['CruisePlanReview.tsx','CruiseGuidance.tsx'].map(file=>readFileSync(path.join(root,'features/cruises/components',file),'utf8'))
 assert.ok(files.every(source=>!source.includes(' · UTC')&&!source.includes("+':00Z'")))
})
function hooks(){
  const values=[],effects=[];let cursor=0
  return {reset(){cursor=0},effects,useCallback:fn=>fn,useMemo:fn=>fn(),useEffect:fn=>{effects.push(fn)},useRef(value){const i=cursor++;return values[i]??= {current:value}},useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],value=>{values[i]=typeof value==='function'?value(values[i]):value}]}}
}
const ui={Panel:'Panel',Notice:'Notice',Button:'Button',ButtonLink:'ButtonLink',Field:'Field',Loading:'Loading',Empty:'Empty',DataTable:'DataTable',RecordFacts:'RecordFacts',Modal:'Modal',Badge:'Badge',EditorLayout:'EditorLayout',FormSection:'FormSection',PageHeader:'PageHeader',FormErrorSummary:'FormErrorSummary'}

function prepView(){return {cruiseId:'c1',coordinatorUserId:'crm',coordinatorUsername:'Coordinator',cruiseRevision:3,canAssignCoordinator:false,sections:['TECHNICAL_NAUTICAL','HOTEL_CABIN','ENTERTAINMENT_SHORE','SAFETY_CREW'].map(sectionCode=>({sectionCode,ownerRole:sectionCode==='TECHNICAL_NAUTICAL'?'SHIP_MANAGER':sectionCode==='SAFETY_CREW'?'OPERATIONS_MANAGER':'CRUISE_MANAGER',submitterRole:'CRUISE_MANAGER',status:'NOT_STARTED',revision:0,allowedActions:['SUBMIT'],submittedByUserId:null,submittedAt:null,confirmedAt:null,evidence:null,returnReason:null,checkItems:[{itemCode:'SHIP_ASSIGNED',ready:false,required:true}]}))}}
test('preparation CRM submits all professional owners only inside assigned server capability; OPS never submits',()=>{const react=hooks();let view=prepView(),userId='crm',roles=['CRUISE_MANAGER'],opened=0;const {PreparationEvidence}=loader({react,'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>({userId,roles,has:p=>['CRUISE_PREPARATION_READ','CRUISE_PREPARATION_SUBMIT','CRUISE_PREPARATION_CONFIRM'].includes(p)})},'@/shared/api':{ApiError,useReadQuery:()=>({data:view,loading:false,error:null})}})('features/cruises/components/PreparationEvidence.tsx');const render=()=>{react.reset();return nodes(PreparationEvidence({cruiseId:'c1',onChanged(){},onSubmit:()=>opened++}))};const buttons=label=>render().filter(n=>n.type==='Button'&&n.props.children===label);assert.equal(view.sections.length,4);assert.equal(buttons('Gửi hồ sơ chuẩn bị').length,0);assert.equal(buttons('Nộp hồ sơ chuẩn bị').length,0);const shared=buttons('Kiểm tra và gửi hồ sơ chuyến khởi hành');assert.equal(shared.length,1);shared[0].props.onClick();assert.equal(opened,1);assert.equal(buttons('Xác nhận hồ sơ chuẩn bị').length,0);userId='other-crm';assert.equal(buttons('Nộp hồ sơ chuẩn bị').length,0);assert.equal(buttons('Kiểm tra và gửi hồ sơ chuyến khởi hành').length,1);roles=['OPERATIONS_MANAGER'];userId='ops';view={...view,sections:view.sections.map(section=>({...section,status:'SUBMITTED',allowedActions:['CONFIRM','RETURN'],checkItems:[{itemCode:'SHIP_ASSIGNED',ready:true,required:true}]}))};assert.equal(buttons('Kiểm tra và gửi hồ sơ chuyến khởi hành').length,0);assert.equal(buttons('Xác nhận hồ sơ chuẩn bị').length,4);assert.equal(buttons('Yêu cầu bổ sung hồ sơ').length,4);view={...view,sections:view.sections.map(section=>({...section,allowedActions:['RETURN']}))};assert.ok(buttons('Xác nhận hồ sơ chuẩn bị').every(button=>button.props.disabled))})
test('preparation adapter requires four scoped records, captured revision and exact readback',async()=>{
 let view=prepView(),calls=[],saved={...view.sections[0],revision:1,status:'SUBMITTED',evidence:'Actual source compilation'}
 const api=loader({'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push({path,...options});return options?.method==='POST'?saved:view}}})('features/cruises/api/preparation-api.ts')
 assert.equal(api.decodePreparation(view,'c1').sections.length,4)
 assert.throws(()=>api.decodePreparation({...view,sections:[]},'c1'));assert.throws(()=>api.decodePreparation(view,'foreign'))
 const original=view.sections[0];view={...view,sections:[saved,...view.sections.slice(1)]}
 await api.preparationApi.action('c1',original,'submit','Actual source compilation')
 assert.equal(calls[0].body.expectedRevision,0);assert.equal(calls[0].body.evidence,'Actual source compilation')
 view={...view,sections:[{...saved,evidence:'Divergent'},...view.sections.slice(1)]}
 await assert.rejects(api.preparationApi.action('c1',original,'submit','Actual source compilation'))
 const before=calls.length;await assert.rejects(api.preparationApi.action('c1',{...original,allowedActions:[]},'submit','text'));assert.equal(calls.length,before)
})
test('preparation evidence re-reads authoritative checks when Cruise configuration revision changes',async()=>{
 const react=hooks(),requests=[],queries=[]
 const {PreparationEvidence}=loader({react,'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>({roles:['CRUISE_MANAGER'],has:()=>true})},'../api/preparation-api':{preparationApi:{get:async id=>{requests.push('/cruise/'+id+'/preparation');return {sections:[]}}}},'@/shared/api':{ApiError,useReadQuery:(key,fetch)=>{queries.push({key,fetch});return {data:null,loading:false,error:null}}}})('features/cruises/components/PreparationEvidence.tsx')
 for(const refreshKey of [9,10]){react.reset();PreparationEvidence({cruiseId:'c1',refreshKey,onChanged:()=>{}})}
 assert.notEqual(queries[0].key,queries[1].key)
 for(const query of queries)await query.fetch()
 assert.deepEqual(requests,['/cruise/c1/preparation','/cruise/c1/preparation'])
})
const id='10000000-0000-4000-8000-000000000001',ship='20000000-0000-4000-8000-000000000001'
const record={cruiseId:id,cruiseCode:'CR-TEST',cruiseName:'Test fixture only',cruiseType:'MULTI_DAYS',departureDatetime:'2027-01-01T00:00:00Z',returnDatetime:'2027-01-03T00:00:00Z',departurePortId:'a',returnPortId:'b',status:'DRAFT',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',revision:2}
const schedule={sourceVersionId:'v',sourceVersionRevision:3,departureDatetime:record.departureDatetime,returnDatetime:record.returnDatetime,days:[{dayNumber:1,shipTimeZoneId:'Asia/Ho_Chi_Minh',stops:[],entries:[]}]}
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[]}

test('F04 snapshot requires current effective permission and includes both impact aliases',()=>{
  for(const endpoint of ['preview-change-impact','change-impact']){
    const requirement=permissionPolicy.apiPermissionRequirement('/cruise/'+id+'/'+endpoint,'POST')
    assert.ok(requirement.permissions.includes('CRUISE_UPDATE_DRAFT'))
    assert.equal(permissionPolicy.hasPermissions({status:'ready',permissions:['CRUISE_UPDATE_DRAFT']},requirement),true)
    assert.equal(permissionPolicy.hasPermissions({status:'loading',permissions:requirement.permissions},requirement),false)
  }
  assert.deepEqual(Array.from(permissionPolicy.apiPermissionRequirement('/cruise/'+id+'/schedule').permissions),['CRUISE_READ','TRIP_READ','ITINERARY_READ'])
  assert.deepEqual(Array.from(permissionPolicy.apiPermissionRequirement('/booking/'+id+'/contract/accept','POST').permissions),['BOOKING_CONTRACT_MANAGE'])
})

test('F05 UTC+7/UTC+8 cross-date display and DST gaps/folds keep the original Instant',()=>{
  const time=loader()('shared/lib/journey-time.ts'),instant='2026-10-26T16:30:00Z'
  assert.match(time.zonedInput(instant,'Asia/Ho_Chi_Minh'),/^2026-10-26T23:30/)
  assert.match(time.zonedInput(instant,'Asia/Singapore'),/^2026-10-27T00:30/)
  assert.match(time.zonedInput(instant,'Asia/Tokyo'),/^2026-10-27T01:30/)
  assert.throws(()=>time.wallTimeToInstant('2026-03-29T02:30','Europe/Paris'))
  assert.throws(()=>time.wallTimeToInstant('2026-10-25T02:30','Europe/Paris'))
  assert.equal(time.wallTimeToInstant('2026-10-26T23:30','Asia/Ho_Chi_Minh'),instant.replace('Z','.000Z'))
  assert.throws(()=>time.wallTimeToInstant('2026-03-08T02:30','America/New_York'))
  assert.throws(()=>time.wallTimeToInstant('2026-11-01T01:30','America/New_York'))
})

test('C01 eligible-source request uses exact keyword/page/tripId and retains server metadata',async()=>{
  const calls=[],response={content:[{versionId:'v',versionNumber:2,revision:3,tripId:'t',tripCode:'TR',tripName:'Fixture',durationDays:3,durationNights:2,departurePortName:null}],number:1,size:10,totalPages:2,totalElements:11}
  const {eligibleSources}=loader({'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return response}}})('features/cruises/api/source-version.ts')
  const result=await eligibleSources('  abc  ',1,undefined,'t')
  assert.equal(calls[0].url,'/trip-schedule-versions/eligible-sources');assert.equal(calls[0].query.keyword,'abc');assert.equal(calls[0].query.tripId,'t');assert.equal(result.content[0].revision,3)
  response.number=0;await assert.rejects(eligibleSources('abc',1),error=>error.status===502)
})

test('C02 preview is read-only POST, preserves materialization metadata and rejects a foreign source',async()=>{
  const calls=[],response={...schedule,materialized:false,itineraryId:null,warnings:['Fixture warning']}
  const api=loader({'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return response}}})('features/cruises/api/departure-api.ts').departureApi
  const result=await api.preview('v',record.departureDatetime)
  assert.equal(result.materialized,false);assert.equal(result.sourceVersionRevision,3);assert.equal(calls[0].url,'/cruise/preview-schedule');assert.equal(calls[0].body.sourceVersionId,'v')
  response.sourceVersionId='foreign';await assert.rejects(api.preview('v',record.departureDatetime),error=>error.status===502)
  assert.ok(calls.every(call=>!call.url.endsWith('/cruise')))
})

test('C03 create sends preview revision/key, omits ship for source flow, and lets BE infer optional category',async()=>{
  const calls=[]
  const api=loader({'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return {...record,sourceVersionId:'v'}}},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
  await api.createCruise({...record,cruiseType:'',sourceVersionId:'v',shipId:ship,expectedSourceVersionRevision:3},'stable-test-key')
  assert.equal(calls[0].url,'/cruise');assert.equal(calls[0].idempotencyKey,'stable-test-key');assert.equal(calls[0].body.expectedSourceVersionRevision,3)
  assert.equal(calls[0].body.shipId,undefined);assert.equal(calls[0].body.cruiseType,undefined)
})

test('C03 repeated/unknown intent shares immutable key/payload across reload instead of creating a second intent',async()=>{
  const storage=new Map(),store={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}
  const {cruiseCreateIntent}=loader({'@/shared/api':{ApiError}})('features/cruises/model/create-intent.ts')
  const intent=cruiseCreateIntent('user',store),calls=[],payload={...record,cruiseCode:'',expectedSourceVersionRevision:3}
  const send=async(draft,key)=>{calls.push({draft,key});throw new ApiError('Unknown response',0)}
  const a=intent.execute(payload,send),b=intent.execute(payload,send);assert.equal(a,b);await assert.rejects(a)
  const restored=cruiseCreateIntent('user',store);assert.equal(restored.record.status,'unknown');await assert.rejects(restored.execute(payload,send))
  assert.equal(calls[0].key,calls[1].key);assert.equal(restored.startNew(),false)
})

test('C04/P01/P02/S02/S03 assignment uses scoped safety facts without manifest access and rejects stale context',async()=>{
  for(const [status,total,allowed,fresh=true] of [['DRAFT',0,true],['DRAFT',1,false],['PUBLISHED',0,false],['DRAFT',null,false],['DRAFT',0,false,false]]){
    const calls=[],access={status:'ready',roles:['CRUISE_MANAGER'],permissions:['CRUISE_READ','ITINERARY_READ','CRUISE_ASSIGN_SHIP']}
    const api=loader({'@/shared/auth':{getSessionAccess:()=>access,hasPermissions:permissionPolicy.hasPermissions},'@/shared/api':{ApiError,apiRequest:async(url)=>{
      calls.push(url)
      if(url==='/cruise/'+id)return {...record,status}
      if(url.endsWith('/schedule'))return {...schedule,materialized:true,itineraryId:'plan',itineraryStatus:'DRAFT'}
      if(url==='/itineraries/plan')return {itineraryId:'plan',cruiseId:id,status:'DRAFT'}
      if(url.endsWith('/ship-assignment-context'))return {cruiseId:id,cruiseRevision:fresh?record.revision:99,hasBookings:total==null?null:total>0,editablePlan:status==='DRAFT'}
      throw Error('Unexpected request '+url)
    }}})('features/cruises/api/cruise-api.ts').cruiseApi
    const detail=await api.getDetail(id)
    assert.equal(detail.itinerary.status,'DRAFT');assert.equal(detail.assignmentCapabilities.assign.allowed,allowed)
    assert.ok(!calls.includes('/itineraries'));assert.ok(!calls.some(url=>url.endsWith('/readiness')))
    assert.ok(!calls.some(url=>url.endsWith('/downstream-handoff')))
    assert.equal(detail.bookingHasData,total==null?null:total>0)
  }
})

test('FE-INT-04 CRUISE_READ without manifest permission never probes handoff or infers zero bookings',async()=>{
  const calls=[],access={status:'ready',permissions:['CRUISE_READ']}
  const api=loader({'@/shared/auth':{getSessionAccess:()=>access,hasPermissions:permissionPolicy.hasPermissions},'@/shared/api':{ApiError,apiRequest:async url=>{calls.push(url);if(url==='/cruise/'+id)return record;throw Error('Forbidden probe '+url)}}})('features/cruises/api/cruise-api.ts').cruiseApi
  const detail=await api.getDetail(id);assert.equal(detail.bookingHasData,null);assert.equal(detail.assignmentCapabilities.assign.allowed,false)
  assert.ok(!calls.some(url=>url.endsWith('/downstream-handoff')))
})

test('P03/P04/P12 return targets reject external and cross-cruise context, including foreign ship blockers',()=>{
  const context=loader()('shared/lib/cruise-context.ts')
  assert.equal(context.cruiseContextReturn('https://external.invalid/admin/cruises/'+id,id),'/admin/cruises/'+id+'?section=program')
  assert.equal(context.cruiseContextReturn('/admin/cruises/'+ship,id),'/admin/cruises/'+id+'?section=program')
  const {readinessTarget}=loader()('features/cruises/model/readiness-target.ts')
  assert.equal(readinessTarget({targetType:'SHIP',targetId:id},id,ship),null)
  assert.equal(readinessTarget({targetType:'SHIP',targetId:ship},id,ship),'/admin/ships/'+ship+'/edit')
  assert.equal(readinessTarget({targetType:'CABIN',targetId:'javascript:alert(1)'},id,ship),null)
})

test('P06 expiry, infrastructure indeterminate and revision mismatch cannot render operational READY',()=>{
  const {readinessSnapshot}=loader()('features/cruises/model/readiness.ts')
  const ready={ready:true,cruiseRevision:2,evaluatedAt:'2027-01-01T00:00:00Z'}
  assert.equal(readinessSnapshot({...ready,status:'INDETERMINATE'},undefined,2).state,'UNKNOWN')
  assert.equal(readinessSnapshot({...ready,validUntil:'2027-01-01T00:01:00Z'},undefined,2,Date.parse('2027-01-01T00:02:00Z')).state,'UNKNOWN')
  assert.equal(readinessSnapshot(ready,undefined,3).state,'UNKNOWN')
})

test('F06/P08 inventory missing counts remain unknown and sync/ship responses cannot cross context',()=>{
  const data=model()
  assert.equal(data.decodeInventory({cruiseId:id},id).remainingCapacity,null)
  assert.throws(()=>data.decodeShipCompatibility({cruiseId:id,shipId:'foreign',compatible:true,issues:[]},id,ship),ApiError)
  const sync=data.decodeProgramSync({cruiseId:id,onboardActivitiesCount:1,shoreExcursionsCount:0,servingWindowsCount:1,warnings:[],items:[{sourceEntryId:'entry',status:'FAILED',reason:'Fixture missing data'}]},id)
  assert.equal(sync.items[0].status,'FAILED');assert.equal(sync.servingWindowsCount,1)
})

test('UX-DEP-01 overview offers only permitted work areas without fabricating section status',()=>{
  const access={roles:[],has:p=>p==='CRUISE_READ',canDo:()=>false}
  const {PreparationOverview}=loader({react:{useCallback:fn=>fn},'@/shared/api':{useReadQuery:()=>({data:null,loading:false,error:null})},'@/shared/auth':{useSessionAccess:()=>access},'@/shared/ui':ui,'@/shared/ui/admin-v3':{},'../api/cruise-api':{}})('features/cruises/components/DeparturePreparation.tsx')
  const tree=nodes(PreparationOverview({detail:{cruise:record,ship:null,departurePort:{portName:'A'},returnPort:{portName:'B'},readiness:{state:'UNKNOWN',checks:[]}},loading:false,onSection(){}}))
  const buttons=tree.filter(n=>n.type==='button').map(n=>n.props.children[0].props.children)
  assert.ok(buttons.includes('Lịch thực tế'));assert.ok(!buttons.includes('Tàu và nhân sự'))
  assert.ok(!tree.some(n=>n.props?.children==='Đã xác nhận hồ sơ chuẩn bị'))
})

test('DELTA-05 hub keeps four BE groups in one Cruise without inventing section evidence',()=>{
  const access={roles:['OPERATIONS_MANAGER'],has:()=>true,canDo:()=>true},changes=[]
  const {PreparationOverview}=loader({react:{useCallback:fn=>fn},'@/shared/api':{useReadQuery:()=>({data:null,loading:false,error:null})},'@/shared/auth':{useSessionAccess:()=>access},'@/shared/ui':ui,'@/shared/ui/admin-v3':{},'../api/cruise-api':{}})('features/cruises/components/DeparturePreparation.tsx')
  const tree=nodes(PreparationOverview({detail:{cruise:record,ship:null,departurePort:{portName:'A'},returnPort:{portName:'B'},readiness:{state:'UNKNOWN',checks:[]}},loading:false,onSection:s=>changes.push(s)}))
  const groups=tree.filter(n=>n.type==='section'&&nodes(n).some(x=>x.type==='h3'))
  assert.equal(groups.length,4);assert.equal(groups.filter(n=>nodes(n).some(x=>typeof x.props?.children==='string'&&x.props.children==='Chưa xác định')).length,4)
  const buttons=groups.map(group=>nodes(group).find(n=>n.type==='Button'))
  buttons.forEach(button=>button.props.onClick());assert.deepEqual(changes,['resources','preparation','program','resources'])
})

test('UX-DEP-03 inventory preserves zero and unknown blocked cabins without asserting sellability',()=>{
  const data={physicalCapacity:0,bookedPassengersCount:0,heldPassengersCount:null,remainingCapacity:0,totalCabins:0,operationalCabins:0,blockedCabins:null,cabinTypeInventory:[]}
  const {DepartureInventory}=loader({react:{useCallback:fn=>fn},'@/shared/api':{ApiError,useReadQuery:()=>({loading:false,error:null,retry(){},data})},'@/shared/auth':{useSessionAccess:()=>({has:p=>p==='CRUISE_READ'})},'@/shared/ui':ui,'./DepartureCommand':{},'./ReadinessIssues':{},'../api/departure-api':{},'../api/cruise-api':{},'../api/departure-management-api':{}})('features/cruises/components/DepartureData.tsx')
  const tree=nodes(DepartureInventory({cruise:record}))
  const entries=tree.find(n=>n.props?.entries)?.props.entries
  assert.equal(entries.find(([key])=>key==='Tổng cabin')[1],0);assert.equal(entries.find(([key])=>key==='Cabin bảo trì hoặc ngừng sử dụng')[1],'Chưa xác định')
  assert.ok(tree.some(n=>typeof n.props?.children==='string'&&n.props.children.includes('không xác nhận số cabin')))
})

test('DELTA-02 unassigned filter is server-side and refuses a runtime without the contract',async()=>{
  let supported=true,calls=[]
  const api=loader({'@/shared/api':{ApiError,apiRequestRaw:async(path,decode)=>decode({paths:{'/cruise':{get:{parameters:supported?[{name:'unassigned',in:'query'}]:[]}}}}),apiRequest:async(path,options)=>{calls.push({path,...options});return {content:[],totalElements:0,number:1,size:4,totalPages:0}}},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
  const base={status:'',shipId:'UNASSIGNED',cruiseType:'',page:2,pageSize:4}
  await api.list(base);assert.equal(calls[0].query.unassigned,true);assert.equal(calls[0].query.shipId,undefined);assert.equal(calls[0].query.page,1)
  await api.list({...base,page:1});assert.equal(calls[1].query.unassigned,true);assert.equal(calls[1].query.page,0);assert.equal(calls[1].query.shipId,undefined)
  calls=[];await api.list({...base,shipId:'ship-id'});assert.equal(calls[0].query.shipId,'ship-id');assert.equal(calls[0].query.unassigned,undefined)
  supported=false;calls=[];await assert.rejects(api.list(base),error=>error.status===502);assert.equal(calls.length,0)
})

test('DELTA-01 pricing decoder preserves null versus zero and rejects invalid identity or rates',()=>{
  const {decodePricingPolicy}=loader({'@/shared/api':{ApiError}})('features/cruises/model/pricing-policy.ts')
  const p=decodePricingPolicy({cruiseId:id,status:'DRAFT',currency:'VND',interiorBaseFare:0,depositPercentage:.3},id)
  assert.equal(p.interiorBaseFare,0);assert.equal(p.suiteBaseFare,null);assert.equal(p.depositPercentage,.3)
  assert.throws(()=>decodePricingPolicy({cruiseId:ship,status:'DRAFT'},id));assert.throws(()=>decodePricingPolicy({cruiseId:id,depositPercentage:1.5},id))
})

test('DELTA-03 read-only pricing distinguishes missing policy and valid zero fare',()=>{let response={loading:false,error:null,retry(){},data:{cruiseId:id,status:'APPROVED',policyVersion:'v',currency:'VND',interiorBaseFare:0,oceanViewBaseFare:null,balconyBaseFare:null,suiteBaseFare:null,portFeePerPassenger:null,taxRate:null,depositPercentage:.3,finalPaymentDueDays:0,fullPaymentCutoffDays:null,cancellationPolicy:null}};const {DeparturePricingPolicy}=loader({react:{useCallback:fn=>fn},'@/shared/api':{ApiError,apiRequest(){},useReadQuery:()=>response},'@/shared/auth':{useSessionAccess:()=>({userId:'u',roles:[],status:'ready',permissions:['CRUISE_READ'],has:p=>p==='CRUISE_READ'})},'@/shared/ui':ui})('features/cruises/components/DeparturePricingPolicy.tsx');let tree=nodes(DeparturePricingPolicy({cruiseId:id}));assert.ok(tree.some(n=>n.type==='Badge'&&n.props.label==='Giá đã được duyệt'));assert.ok(JSON.stringify(tree).includes('30%'));const rows=tree.filter(n=>n.type==='tr');assert.ok(JSON.stringify(rows.find(n=>JSON.stringify(n).includes('Phòng trong'))).includes('0'));assert.ok(JSON.stringify(rows.find(n=>JSON.stringify(n).includes('Phòng ban công'))).includes('Chưa thiết lập'));response={...response,data:null,error:new ApiError('missing',404,'PRICING_POLICY_NOT_FOUND')};tree=nodes(DeparturePricingPolicy({cruiseId:id}));assert.ok(tree.some(n=>n.props?.title==='Chưa thiết lập chính sách giá'));response={...response,error:new ApiError('missing',404,'RESOURCE_NOT_FOUND')};tree=nodes(DeparturePricingPolicy({cruiseId:id}));assert.ok(tree.some(n=>n.props?.title==='Chưa đọc được chính sách giá'))})

test('v4 draft pricing preserves zero, requires revision, writes draft only and verifies GET',async()=>{
  const react=hooks(),calls=[];let savedCount=0
  let persisted;const policy={cruiseId:id,pricingPolicyId:'p1',revision:4,policyNumber:1,status:'DRAFT',policyVersion:'PRC-CR-V1',currency:'USD',interiorBaseFare:0,oceanViewBaseFare:0,balconyBaseFare:0,suiteBaseFare:0,portFeePerPassenger:0,taxRate:0,depositPercentage:.3,finalPaymentDueDays:0,fullPaymentCutoffDays:0,cancellationPolicy:'Fixture terms'}
  const {PricingDraftFields}=loader({react,'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push({path,...options});if(options?.method==='PUT')persisted={...policy,...options.body,revision:5};return persisted??policy}},'../api/mainflow-api':{mainflowApi:{get:async()=>({planStatus:'DRAFT',windows:{expectedRevision:7}})}},'@/shared/ui':ui,__globals:{FormData:class{get(key){return key==='depositPercentage'?30:policy[key]??''}}}})('features/cruises/components/PricingDraftFields.tsx')
  const render=()=>{react.reset();return nodes(PricingDraftFields({policy,cruiseId:id,onSaved:()=>savedCount++}))}
  let tree=render()
  tree.find(n=>n.type==='Button'&&n.props.children===JSON.parse(readFileSync(path.join(root,'shared/i18n/vi-business-map.json'),'utf8'))['pricing.action.edit']).props.onClick()
  tree=render()
  assert.equal(tree.find(n=>n.type==='Modal').props.busy,true);assert.equal(tree.some(n=>n.type==='fieldset'),false);assert.equal(tree.some(n=>n.props?.name==='currency'),false)
  assert.ok(!tree.some(n=>n.props?.children==='Đọc phiên bản hiện tại để chỉnh sửa'))
  await new Promise(resolve=>setImmediate(resolve))
  tree=render();assert.equal(tree.find(n=>n.type==='fieldset').props.disabled,false)
  assert.equal(tree.find(n=>n.props?.name==='interiorBaseFare').props.defaultValue,0)
  assert.equal(tree.find(n=>n.props?.name==='depositPercentage').props.defaultValue,30)
  tree.find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{}});await new Promise(resolve=>setImmediate(resolve))
  assert.equal(calls.length,3);assert.equal(calls[1].method,'PUT');assert.equal(calls[1].ifMatch,7);assert.equal(Object.hasOwn(calls[1].body,'autoApprove'),false);assert.equal(calls[1].body.expectedRevision,4);assert.equal(calls[1].body.currency,'USD');assert.equal(calls[1].body.interiorBaseFare,0)
  assert.equal(calls[2].path,'/cruise/'+id+'/pricing-policy');assert.equal(savedCount,1)
})

test('v4 sale scope is sent to readiness and U-PRICE blocks open-sale mutation',async()=>{
  const react=hooks(),calls=[],loads=[]
  const raw={cruiseId:id,ready:false,status:'NOT_READY',fingerprint:'held',cruiseRevision:2,validUntil:'2035-01-01T00:00:00Z',blockers:['PRICING_APPROVER_UNRESOLVED']}
  const {DepartureSaleReadiness}=loader({react,'@/shared/api':{ApiError,apiRequest:async(path,options)=>{calls.push({path,...options});return raw},useReadQuery:(key,load)=>{loads.push({key,load});return {loading:false,error:null,data:key.startsWith('scoped-sale:')?raw:key.startsWith('scoped-sale-packages:')?[]:null,retry(){}}}},'@/shared/auth':{useSessionAccess:()=>({roles:['OPERATIONS_MANAGER'],has:p=>p==='CRUISE_OPEN_SALE'})},'@/shared/ui':ui,'./DepartureCommand':{},'../hooks/useReadinessClock':{useReadinessClock:()=>0},'../api/departure-api':{departureApi:{}},'../api/cruise-api':{},'../api/departure-management-api':{}})('features/cruises/components/DepartureData.tsx')
  const parent=nodes(DepartureSaleReadiness({cruise:record})),guide=parent.find(n=>typeof n.type==='function')
  react.reset();const tree=nodes(guide.type(guide.props))
  assert.deepEqual(tree.filter(n=>n.type==='option').map(n=>n.props.value),['WHOLE_CRUISE','CABIN_ONLY','SELECTED_PACKAGES'])
  tree.find(n=>n.type==='select').props.onChange({target:{value:'CABIN_ONLY'}});react.reset()
  const after=nodes(guide.type(guide.props));assert.equal(after.find(n=>n.props?.children==='Xác nhận mở bán').props.disabled,true)
  await loads.filter(v=>v.key.startsWith('scoped-sale:')).at(-1).load(new AbortController().signal)
  assert.equal(calls.length,1);assert.equal(calls[0].query.saleScope,'CABIN_ONLY');assert.equal(calls[0].method,undefined)
})

test('FE-INT-01A rejects null source rows as a controlled contract error',async()=>{
  for(const field of ['days','stops','entries']){
    const version={versionId:'v',versionNumber:1,tripId:'t',status:'PUBLISHED',days:[{dayNumber:1}],stops:[],entries:[],[field]:[null]}
    const source=loader({'@/shared/api':{ApiError,apiRequest:async url=>url.startsWith('/trips/')?{tripId:'t',tripCode:'T',name:'Trip'}:version}})('features/cruises/api/source-version.ts')
    await assert.rejects(source.readPublishedSource('v'),error=>error instanceof ApiError&&error.status===502)
  }
})

test('FE-INT-01B reads separate readiness/sellability DTOs without treating server slots as safe booking',async()=>{
  const calls=[],responses={
    ['/cruise/'+id+'/departure-readiness']:{cruiseId:id,ready:false,status:'INDETERMINATE',validUntil:'2027-01-01T00:00:00Z',details:[]},
    ['/cruise/'+id+'/sellability']:{cruiseId:id,sellable:true,saleState:'OPEN_FOR_SALE',pricingPolicyVersion:'fixture',cabinTypes:[{cabinType:'SUITE',availableSlots:2,sellable:true}],availablePackages:[],manifest:['never exposed']},
  }
  const api=loader({'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return responses[url]}}})('features/cruises/api/departure-api.ts').departureApi
  assert.equal((await api.departureReadiness(id)).status,'INDETERMINATE')
  const sale=await api.publicSellability(id);assert.equal(sale.cabinTypes[0].availableSlots,2);assert.equal(sale.manifest,undefined)
  assert.ok(calls.every(call=>!call.method));responses['/cruise/'+id+'/sellability']={cruiseId:ship,sellable:true};await assert.rejects(api.publicSellability(id))
  const inventory=model().decodeInventory({cruiseId:id,blockedCabins:3,canSell:false,cabinTypeInventory:[{blockedCabins:2,bookedSlots:1,heldSlots:0,canSell:false}]},id)
  assert.equal(inventory.blockedCabins,3);assert.equal(inventory.cabinTypeInventory[0].canSell,false)
  assert.equal(model().decodePublicSellability({cruiseId:id},id).sellable,null)
})

test('FE-INT-01B preserves source readiness gate and remediation metadata without trusting malformed fields',()=>{
  const d=model()
  const departure=d.decodeReadiness({cruiseId:id,ready:false,gateType:'DEPARTURE_GATE',policyVersion:'v3.0-2026',preparationSectionsConfirmed:false,unconfirmedPreparationSectionsCount:2,details:[{code:'PREPARATION',ownerRole:'SHIP_MANAGER',remediationUrl:'/admin/cruises',remediationOperation:'UPDATE'}]},id)
  assert.equal(departure.gateType,'DEPARTURE_GATE');assert.equal(departure.unconfirmedPreparationSectionsCount,2)
  assert.equal(departure.details[0].ownerRole,'SHIP_MANAGER');assert.equal(departure.details[0].remediationOperation,'UPDATE')
  const sale=d.decodeSaleReadiness({cruiseId:id,ready:false,gateType:'SALE_GATE',cabinOnlySalePermitted:true,priceVersion:'p',shipVersion:'s',supplierVersion:'v'},id)
  assert.equal(sale.cabinOnlySalePermitted,true);assert.equal(sale.priceVersion,'p');assert.equal(sale.policyVersion,null)
  assert.throws(()=>d.decodeReadiness({cruiseId:id,ready:false,details:[{ownerRole:1}]},id),ApiError)
  assert.throws(()=>d.decodeSaleReadiness({cruiseId:id,ready:false,cabinOnlySalePermitted:'true'},id),ApiError)
})

test('FE-INT-01C preparation and audit decode unknown actors, missing sections and foreign Cruise safely',()=>{
  const d=model(),partial=d.decodePreparation({cruiseId:id,sections:[{sectionCode:'TECHNICAL_NAUTICAL',ownerRole:'SHIP_MANAGER',revision:0,checkItems:[]}]},id)
  assert.equal(partial.allConfirmed,null);assert.equal(partial.sections[0].submittedByUserId,null)
  assert.throws(()=>d.decodePreparation({cruiseId:id},id));assert.throws(()=>d.decodePreparation({cruiseId:ship,sections:[]},id))
  assert.throws(()=>d.decodePreparation({cruiseId:id,sections:[{sectionCode:'x'},{sectionCode:'x'}]},id))
  assert.equal(d.decodeAuditEvents([{cruiseId:id,eventId:'event'}],id)[0].actorRole,null)
  assert.equal(d.decodeNotificationAggregate({cruiseId:id,notificationsPendingCount:2},id).notificationsSentCount,null)
})

test('FE-INT-11 audit displays missing actor as unknown and does not claim email delivery',()=>{
  const access={userId:'user',status:'ready',permissions:['CRUISE_READ'],has:p=>p==='CRUISE_READ'}
  const {DepartureAudit}=loader({react:{useCallback:fn=>fn},'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>access},'@/shared/api':{ApiError,useReadQuery:key=>({loading:false,error:null,retry(){},data:key.startsWith('departure-audit:')?[{eventId:'e',eventType:'CHANGE',timestamp:null,actorUsername:null}]:{notificationsSentCount:2}})},'./DepartureCommand':{},'./ReadinessIssues':{},'../api/departure-api':{},'../api/cruise-api':{},'../api/departure-management-api':{}})('features/cruises/components/DepartureData.tsx')
  const tree=nodes(DepartureAudit({cruise:record}));assert.ok(tree.some(n=>Array.isArray(n.props?.children)&&n.props.children.includes('Chưa xác định')))
  assert.ok(tree.some(n=>typeof n.props?.children==='string'&&n.props.children.includes('chưa xác nhận email')))
})

test('FE-INT-01D quote keeps missing financial values unknown and rejects foreign identities and malformed expiry',()=>{
  const {decodeQuote}=loader({'@/shared/api':{ApiError}})('features/booking/api/quote-contract.ts')
  const raw={quoteId:'q',cruiseId:id,policyVersion:'v',expiresAt:'2027-01-01T00:00:00Z',lineItems:[{cabinId:ship,itemTotal:10}]}
  const quote=decodeQuote(raw,id,'q');assert.equal(quote.lineItems[0].cabinId,ship);assert.equal(quote.totalAmount,null);assert.equal(quote.fingerprint,null)
  assert.throws(()=>decodeQuote(raw,ship));assert.throws(()=>decodeQuote(raw,id,'other'));assert.throws(()=>decodeQuote({...raw,expiresAt:'invalid'},id))
})

test('F07/B01 public projection drops internal metadata and booking CTA fails closed without probing internal APIs',()=>{
  const {toPublishedCruise}=loader()('features/booking/api/live-cruise-contract.ts')
  const result=toPublishedCruise({...record,status:'PUBLISHED',staff:[{name:'Synthetic fixture'}],manifest:['Synthetic'],stopEvidence:'Synthetic'})
  for(const key of ['staff','manifest','stopEvidence','revision'])assert.equal(result[key],undefined)
  const {PublicCruiseBookingEntry}=loader({react:{useCallback:fn=>fn},'@/shared/ui':{ButtonLink:'ButtonLink'},'@/shared/api':{useReadQuery:()=>({loading:false,error:null,data:null})},'../api/booking-api':{},'../model/booking-feedback':{}})('features/booking/components/PublicCruiseBookingEntry.tsx')
  const tree=PublicCruiseBookingEntry({cruiseId:id,back:'/cruises'})
  assert.ok(!nodes(tree).some(node=>node.type==='a'||node.props?.to));assert.equal(tree.props.role,'status')
})

test('FE-INT-07 only authoritative sellable opens booking; stopped, sold out and denied reads stay closed',()=>{
  let result={loading:false,error:null,data:{saleState:'STOPPED',sellable:false},retry(){}}
  const {PublicCruiseBookingEntry}=loader({react:{useCallback:fn=>fn},'@/shared/ui':{ButtonLink:'ButtonLink'},'@/shared/api':{ApiError,useReadQuery:()=>result},'../api/booking-api':{liveCruiseCatalogApi:{}},'../model/booking-feedback':{bookingReadFailure:status=>'read '+status}})('features/booking/components/PublicCruiseBookingEntry.tsx')
  const render=()=>nodes(PublicCruiseBookingEntry({cruiseId:id,back:'/cruises'}))
  assert.ok(render().some(n=>typeof n.props?.children==='string'&&n.props.children.includes('tạm dừng bán')))
  result={...result,data:{saleState:'SOLD_OUT',sellable:false}};assert.ok(render().some(n=>typeof n.props?.children==='string'&&n.props.children.includes('tình trạng cabin cần được đối chiếu')))
  result={...result,data:{saleState:'NOT_YET_OPEN',sellable:false}};assert.ok(render().some(n=>typeof n.props?.children==='string'&&n.props.children.includes('chưa mở nhận đặt chỗ')))
  result={...result,data:{saleState:'CANCELLED',sellable:false}};assert.ok(render().some(n=>typeof n.props?.children==='string'&&n.props.children.includes('đã được hủy')))
  result={...result,data:{saleState:'OPEN_FOR_SALE',sellable:false}};assert.ok(!render().some(n=>n.props?.to))
  result={...result,data:{saleState:'OPEN_FOR_SALE',sellable:true}};assert.ok(render().some(n=>n.props?.to?.startsWith('/booking/cabin-experience?')))
  result={...result,data:null,error:new ApiError('Forbidden',403)};assert.ok(render().some(n=>n.props?.children==='read 403'))
})

test('B05 payment remains Pending until BE confirms',async()=>{
  const payments=loader({'@/shared/api':{apiRequest:async()=>[{paymentId:'p',bookingId:id,requestedAmount:10,currency:'USD',paymentMethod:'GatewaySandbox',status:'Pending'}]}})('features/booking/api/payment-api.ts').paymentApi
  assert.equal((await payments.list(id))[0].status,'Pending')
})

test('C01 only the exact PUBLISHED version is accepted; DRAFT and IN_REVIEW fail closed',async()=>{
  for(const status of ['DRAFT','IN_REVIEW','PUBLISHED']){
    const source=loader({'@/shared/api':{ApiError,apiRequest:async url=>url.startsWith('/trips/')?{tripId:'t',tripCode:'T',name:'Fixture',status:'ACTIVE',durationGroup:'SHORT',durationDays:1,durationNights:0}:{versionId:'v',tripId:'t',versionNumber:2,revision:3,status,days:[{dayNumber:1}],stops:[],entries:[]}}})('features/cruises/api/source-version.ts')
    if(status==='PUBLISHED')assert.equal((await source.readPublishedSource('v')).revision,3)
    else await assert.rejects(source.readPublishedSource('v'),error=>error.code==='VERSION_NOT_PUBLISHED')
  }
})

test('P02 single-role detail matrix never grants create/assign to another department',()=>{
  const work=loader()('shared/auth/work-policy.ts'),nav=loader({'@/shared/auth':{...permissionPolicy,...work}})('shared/ui/admin-v3/admin-navigation.ts')
  for(const role of ['CRUISE_MANAGER','SHIP_MANAGER','ACTIVITY_SERVICE_MANAGER','FINANCE_OFFICER','BOOKING_AGENT','OPERATIONS_MANAGER']){
    const access={status:'ready',roles:[role],permissions:['CRUISE_READ','CRUISE_CREATE','CRUISE_ASSIGN_SHIP']}
    assert.equal(nav.canRoleOpenAdminPath([role],'/admin/cruises/'+id,'',access),true,role)
    assert.equal(nav.canRoleOpenAdminPath([role],'/admin/cruises/new','',access),role==='CRUISE_MANAGER',role)
    assert.equal(work.actionInWorkScope([role],'CRUISE_ASSIGN_SHIP'),role==='CRUISE_MANAGER',role)
  }
})

test('B02 cabin filters preserve category/minimum and do not infer sale authority from ship capacity',async()=>{
  const calls=[],api=loader({'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return [{cabinId:'balcony',cabinNumber:'B1',cabinType:'BALCONY',remainingCapacity:0,capacity:2}] }},'@/domain/booking-context':{}})('features/booking/api/real-booking-api.ts').realBookingApi
  const cabins=await api.cabins(id,undefined,{cabinType:'BALCONY',minCapacity:2})
  assert.equal(calls[0].url,'/booking/available-cabins');assert.equal(calls[0].query.cabinType,'BALCONY');assert.equal(cabins[0].remainingCapacity,0)
})

test('B03/B04 booking deep links delegate to the live quoted flow and retain recovery',()=>{
  const state={saved:null,uncertain:false}
  const {RealBookingCreatePage}=loader({
    react:{},'react-router':{},'@/shared/auth':{},'@/shared/api':{ApiError,useReadQuery(){assert.fail('No public booking probe')}} ,
    '@/shared/ui':{Notice:'Notice',PageHeader:'PageHeader',ButtonLink:'ButtonLink'},
    '../components/BookingExperience':{},'../api/real-booking-api':{},'../components/LiveBookingFields':{},
    '../components/RealBookingUI':{RealBookingFrame:'RealBookingFrame'},'../model/booking-mutation':{},
    '../model/live-booking-context':{useLiveBooking:()=>state},'../model/booking-progress':{},'../model/live-booking-navigation':{},
    '../model/real-booking-view':{},'../model/booking-feedback':{},'./RealBookingPages':{},
  })('features/booking/pages/RealBookingCreatePage.tsx')
  for(const admin of [false,true]){
    const tree=RealBookingCreatePage({admin})
    assert.equal(typeof tree.type,'function')
    assert.equal(tree.props.admin,admin)
  }
  state.uncertain=true
  assert.equal(typeof RealBookingCreatePage({admin:false}).type,'function','recovery is not discarded')
})

test('B03/B04 quote readback gates booking, carries guest proof and one stable intent, rejects expiry and changed selections',async()=>{
 const draft={cruiseId:id,currency:'USD',paymentPlan:'FULL',notes:'',passengers:[{cabinId:ship,tourPackageId:'',fullName:'Fixture',email:'qa@example.invalid',nationality:'',documentNumber:'',dateOfBirth:'',documentType:'',phoneNumber:''}]}
 const calls=[]
 let quote={quoteId:'q',cruiseId:id,currency:'USD',status:'ACTIVE',policyVersion:'PRC-1',fingerprint:'hash',totalAmount:100,paymentPlan:'FULL',expiresAt:new Date(Date.now()+60000).toISOString(),lineItems:[{cabinId:ship,tourPackageId:null}],guestToken:'test-only-guest-proof'}
 const detail={bookingId:id,bookingReference:'TEST',bookingStatus:'Draft',cruiseId:id,cruiseName:'Fixture',passengers:[],agreedFareAmount:100,requiredDepositAmount:100,currency:'USD',installments:[]}
 const context=loader({'@/shared/api':{}})('domain/booking-context/booking-context-api.ts')
 const api=loader({'@/domain/booking-context':context,'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return url==='/booking'?detail:quote}}})('features/booking/api/booking-quote-api.ts')
 const intent=await api.requestBookingQuote(draft)
 assert.equal(calls[0].url,'/booking/quotes');assert.equal(calls[0].body.currency,'USD')
 assert.equal(calls[1].guestToken,'test-only-guest-proof')
 await api.createQuotedBooking(draft,intent);await api.createQuotedBooking(draft,intent)
 const writes=calls.filter(c=>c.url==='/booking')
 assert.equal(writes.length,2);assert.equal(writes[0].idempotencyKey,writes[1].idempotencyKey)
 assert.equal(writes[0].body.quoteId,'q');assert.equal(writes[0].body.quoteGuestToken,'test-only-guest-proof')
 await assert.rejects(api.createQuotedBooking({...draft,passengers:[{...draft.passengers[0],cabinId:id}]},intent),e=>e.code==='QUOTE_SELECTION_MISMATCH')
 quote={...quote,status:'INVALIDATED'}
 await assert.rejects(api.createQuotedBooking(draft,intent),e=>e.code==='QUOTE_INVALIDATED')
 quote={...quote,status:'ACTIVE',expiresAt:new Date(Date.now()-1000).toISOString()}
 await assert.rejects(api.requestBookingQuote(draft),e=>e.code==='QUOTE_INVALIDATED')
 assert.equal(calls.filter(c=>c.url==='/booking').length,2)
})

test('B05 accepting a signed contract sends only its own BE fields and never confirms payment/booking',async()=>{
  const calls=[],context=loader({'@/shared/api':{}})('domain/booking-context/booking-context-api.ts')
  const response={bookingId:id,bookingReference:'TEST',bookingStatus:'Draft',cruiseId:id,cruiseName:'Fixture',passengers:[],agreedFareAmount:100,requiredDepositAmount:20,currency:'USD',installments:[],contractStatus:'Accepted'}
  const api=loader({'@/domain/booking-context':context,'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return response}}})('features/booking/api/real-booking-api.ts').realBookingApi
  const saved=await api.acceptContract(id,'  DOC-TEST  ','  Fixture notes  ')
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/booking/'+id+'/contract/accept');assert.equal(calls[0].body.documentReference,'DOC-TEST')
  assert.equal(calls[0].body.notes,'Fixture notes');assert.equal(calls[0].body.acceptedAt,undefined);assert.equal(saved.bookingStatus,'Draft')
})

test('X02 tab keyboard controls target the matching panel and move focus in order',()=>{
  const changed=[],focused=[],access={has:()=>true,canDo:()=>true,roles:['CRUISE_MANAGER']}
  const {DepartureTabs}=loader({react:{},'@/shared/api':{},'@/shared/auth':{useSessionAccess:()=>access},'@/shared/ui':{},'@/shared/ui/admin-v3':{},'../api/cruise-api':{},__globals:{document:{getElementById:id=>({focus:()=>focused.push(id)})}}})('features/cruises/components/DeparturePreparation.tsx')
  const tree=DepartureTabs({section:'overview',onChange:key=>changed.push(key)}),tabs=nodes(tree).filter(node=>node.props?.role==='tab')
  assert.equal(tabs[0].props['aria-controls'],'departure-panel-overview')
  tabs[0].props.onKeyDown({key:'ArrowRight',preventDefault(){}})
  assert.deepEqual(changed,['schedule']);assert.deepEqual(focused,['departure-tab-schedule'])
})

test('X01 impact retains signed date shift and task revision; resolve sends expectedRevision as query',async()=>{
  const decoded=model().decodeChange({cruiseId:id,dateShiftDays:-1,canProceed:false,blockers:['Fixture blocker'],generatedTasks:[]},id)
  assert.equal(decoded.dateShiftDays,-1);assert.equal(decoded.canProceed,false)
  const calls=[],api=loader({'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return {taskId:'task',cruiseId:id,status:'RESOLVED',revision:5}}}})('features/cruises/api/departure-api.ts').departureApi
  await api.resolveTask(id,'task','Fixture resolution',4)
  assert.equal(calls[0].query.expectedRevision,4);assert.equal(calls[0].query.resolutionNotes,'Fixture resolution')
})

test('HTTP failures keep the exact ApiError status/code through resource clients',async()=>{
  const rejection=new ApiError('Fixture forbidden',403,'ACCESS_DENIED')
  const api=loader({'@/shared/api':{ApiError,apiRequest:async()=>{throw rejection}},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
  await assert.rejects(api.shipCompatibility(id,ship),error=>error===rejection&&error.status===403&&error.code==='ACCESS_DENIED')
})

test('X02 ambiguous writes include timeout and unreadable 2xx, while 403/409 remain rejected',()=>{
  const {mutationOutcomeUnknown}=loader({'@/shared/api':{ApiError}})('shared/lib/mutation-outcome.ts')
  for(const status of [0,200,201,204,408,500,503])assert.equal(mutationOutcomeUnknown(new ApiError('fixture',status)),true)
  for(const status of [400,401,403,404,409,422])assert.equal(mutationOutcomeUnknown(new ApiError('fixture',status)),false)
})

test('C01 source picker loading, empty, forbidden and retry preserve version ID across paging',()=>{
  const react=hooks(),query={data:null,error:null,loading:true,retry(){query.retried=true}},changes=[]
  const {DepartureSourcePicker}=loader({react,'@/shared/ui':ui,'@/shared/api':{useReadQuery:()=>query},'../api/source-version':{}})('features/cruises/components/DepartureSourcePicker.tsx')
  const render=()=>{react.reset();return nodes(DepartureSourcePicker({value:'v',disabled:false,onChange:id=>changes.push(id)}))}
  assert.ok(render().some(n=>n.type==='Loading'))
  query.loading=false;query.error=new ApiError('Forbidden fixture',403)
  let tree=render();assert.ok(tree.some(n=>n.type==='Notice'));tree.find(n=>n.props?.children==='Tải lại').props.onClick();assert.equal(query.retried,true)
  query.error=null;query.data={content:[],totalPages:0}
  tree=render();assert.ok(tree.some(n=>typeof n.props?.children==='string'&&n.props.children.includes('Chưa có phiên bản')))
  assert.equal(tree.find(n=>n.type==='select').props.value,'v');assert.equal(changes.length,0)
  query.data={content:[{versionId:'other',tripName:'Fixture',tripCode:'T',versionNumber:2,durationDays:3}],totalPages:2}
  tree=render();tree.find(n=>n.props?.children==='Trang sau').props.onClick();tree=render()
  assert.equal(tree.find(n=>n.type==='select').props.value,'v','paging never replaces selected version')
  tree.find(n=>n.type==='select').props.onChange({target:{value:'other'}});assert.deepEqual(changes,['other'])
})

test('C04 schedule view preserves materialized DRAFT and refuses wrong source/timestamps after reload',()=>{
  const query={loading:false,error:null,retry(){},data:{...schedule,materialized:true,itineraryStatus:'DRAFT'}}
  const {DepartureScheduleRead}=loader({react:{useCallback:fn=>fn},'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>({roles:['OPERATIONS_MANAGER'],has:()=>true,canDo:()=>true})},'@/shared/api':{ApiError,useReadQuery:()=>query},'./DepartureCommand':{},'./ReadinessIssues':{},'../api/departure-api':{},'../api/cruise-api':{},'../api/departure-management-api':{}})('features/cruises/components/DepartureData.tsx')
  const render=()=>nodes(DepartureScheduleRead({cruise:{...record,sourceVersionId:'v'}}))
  for(let reload=0;reload<2;reload++)assert.ok(render().some(n=>n.props?.entries?.some(([key,value])=>key==='Trạng thái lịch thực tế'&&value==='Nháp')))
  query.data={...query.data,departureDatetime:'2028-01-01T00:00:00Z'}
  assert.ok(render().some(n=>n.props?.title==='Lịch chưa khớp nguồn'))
  assert.ok(!render().some(n=>n.props?.schedule),'mismatched schedule is never rendered')
})

test('P01 overview with no ship/unknown readiness cannot imply configured or approved',()=>{
  const {PreparationOverview}=loader({react:{useCallback:fn=>fn},'@/shared/api':{useReadQuery:()=>({data:null,loading:false,error:null})},'@/shared/auth':{useSessionAccess:()=>({roles:['OPERATIONS_MANAGER'],canDo:()=>true,has:()=>true})},'@/shared/ui':ui,'@/shared/ui/admin-v3':{},'../api/cruise-api':{}})('features/cruises/components/DeparturePreparation.tsx')
  const tree=nodes(PreparationOverview({detail:{cruise:record,ship:null,departurePort:{portName:'A'},returnPort:{portName:'B'},readiness:{state:'UNKNOWN',checks:[]}},loading:false,onSection(){}}))
  assert.ok(tree.some(n=>n.props?.children==='Chưa xác định điều kiện vận hành'))
  assert.ok(!tree.some(n=>n.props?.children==='Đạt kiểm tra sẵn sàng vận hành'))
})

test('P06 contradictory readiness, missing freshness and INDETERMINATE never become READY',()=>{
  const {readinessSnapshot}=loader()('features/cruises/model/readiness.ts')
  const ready={ready:true,evaluatedAt:'2027-01-01T00:00:00Z',cruiseRevision:2}
  assert.equal(readinessSnapshot({ready:true}).state,'UNKNOWN')
  assert.equal(readinessSnapshot({...ready,status:'NOT_READY'}).state,'BLOCKED')
  assert.equal(readinessSnapshot({...ready,details:[{severity:'BLOCKER'}]}).state,'BLOCKED')
  const sale=model().saleAssessment,base={...ready,blockers:[],validUntil:'2027-01-01T00:01:00Z'}
  assert.equal(sale({...base,status:'INDETERMINATE'},2,undefined,0),'UNKNOWN')
  assert.equal(sale(base,2,undefined,Date.parse('2027-01-01T00:02:00Z')),'STALE')
})

test('P06 expiry timer invalidates a visible result and does not spin after expiration',()=>{
  const react=hooks(),timers=[],listeners=new Map();let current=Date.parse('2027-01-01T00:00:00Z')
  class Clock extends Date{static now(){return current}}
  const {useReadinessClock}=loader({react,__globals:{Date:Clock,setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length},clearTimeout(){},window:{addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}}}})('features/cruises/hooks/useReadinessClock.ts')
  const render=()=>{react.reset();return useReadinessClock('2027-01-01T00:01:00Z')}
  assert.equal(render(),current);react.effects.pop()();assert.equal(timers[0].delay,60001)
  current+=60002;timers[0].fn();assert.equal(render(),current);react.effects.pop()();assert.equal(timers.length,1)
})

test('P09 package read model rejects foreign/missing/duplicate identities and keeps active as a link state',async()=>{
  let response=[{cruiseId:id,cruiseTourPackageId:'link',tourPackageId:'package',packageCode:'P',packageName:'Fixture',active:true}]
  const api=loader({'@/shared/api':{ApiError,apiRequest:async()=>response},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
  assert.equal((await api.listPackages(id))[0].active,true)
  for(const rows of [[{...response[0],tourPackageId:''}],[{...response[0],cruiseId:ship}],[response[0],response[0]]]){response=rows;await assert.rejects(api.listPackages(id))}
})

test('P09 package manager displays active as applied and never as open for sale, keeps passenger assignment out',()=>{
  const react=hooks(),linked={data:[{cruiseId:id,cruiseTourPackageId:'link',tourPackageId:ship,packageCode:'P',packageName:'Fixture',active:true}],loading:false,error:null,retry(){}}
  const {DeparturePackageManager}=loader({react,'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>({canDo:()=>false})},'@/shared/api':{useReadQuery:key=>key.startsWith('departure-package-links:')?linked:{data:[],loading:false,error:null,retry(){}}},'../api/cruise-api':{},'../api/departure-management-api':{},'./DepartureCommand':{DepartureCommand:'DepartureCommand'},'./DepartureData':{ReadState:'ReadState'}})('features/cruises/components/DeparturePackageManager.tsx')
  const tree=nodes(DeparturePackageManager({cruiseId:id,onChanged(){}}))
  assert.ok(tree.some(n=>n.props?.children==='Đang áp dụng'));assert.ok(tree.some(n=>n.props?.title==='Liên kết gói chưa xác nhận quyền bán'))
  assert.ok(!tree.some(n=>n.props?.to?.includes('package-assignments')))
})

test('P12 exact remediation target returns to same Cruise and permission failure supplies reason without CTA',()=>{
  const context=loader()('shared/lib/cruise-context.ts'),params=new URLSearchParams({cruiseId:id,targetType:'CABIN',targetId:ship,returnTo:'/admin/cruises/'+id+'?section=checks'})
  assert.equal(context.readinessContextReturn(params,'CABIN',ship),'/admin/cruises/'+id+'?section=checks')
  assert.equal(context.readinessContextReturn(params,'CABIN',id),null)
  let allowed=true
  const {ReadinessIssues}=loader({'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>({roles:['SHIP_MANAGER'],canDo:()=>allowed})},'@/shared/ui/admin-v3':{canRoleOpenAdminPath:()=>allowed}})('features/cruises/components/ReadinessIssues.tsx')
  const issue={code:'FIXTURE_BLOCKER',message:'Fixture blocker',severity:'BLOCKER',targetType:'CABIN',targetId:ship,requiredPermission:'CABIN_UPDATE'}
  const render=()=>nodes(ReadinessIssues({items:[issue],cruiseId:id,shipId:ship}))
  const link=render().find(n=>n.type==='ButtonLink');assert.ok(link.props.to.startsWith('/admin/cabins/'+ship+'/edit?'));assert.ok(link.props.to.includes('targetId='+ship))
  allowed=false;assert.ok(!render().some(n=>n.type==='ButtonLink'));assert.ok(render().some(n=>typeof n.props?.children==='string'&&n.props.children.includes('chưa có đủ quyền')))
})

test('v4 readiness uses reviewed Plan copy and never exposes raw server message or enum as main instructions',()=>{
 const {ReadinessIssues}=loader({'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>({roles:['OPERATIONS_MANAGER'],canDo:()=>true})},'@/shared/ui/admin-v3':{canRoleOpenAdminPath:()=>true}})('features/cruises/components/ReadinessIssues.tsx')
 const issue={code:'PLAN_APPROVAL_REQUIRED',message:'Itinerary DRAFT use /itineraries/approve',severity:'BLOCKER',scope:'CRUISE',ownerRole:'OPERATIONS_MANAGER',targetType:'CRUISE',targetId:id,requiredPermission:'ITINERARY_APPROVE'}
 const tree=nodes(ReadinessIssues({items:[issue],cruiseId:id,shipId:ship}))
 assert.ok(tree.some(n=>n.type==='Notice'&&n.props.title==='Kế hoạch khởi hành chưa được Quản lý vận hành phê duyệt.'))
 assert.ok(!JSON.stringify(tree).includes(issue.message));assert.ok(tree.some(n=>n.type==='ButtonLink'&&n.props.to.startsWith('/admin/cruises/'+id+'?section=checks')))
 const unknown=nodes(ReadinessIssues({items:[{...issue,code:'UNKNOWN_BACKEND_CODE',ownerRole:'NEW_ROLE',scope:'UNREVIEWED_SCOPE'}],cruiseId:id,shipId:ship}))
 assert.ok(unknown.some(n=>n.type==='Notice'&&n.props.title==='Điều kiện chưa xác định. Cần đối chiếu với bộ phận phụ trách.'))
 assert.ok(!JSON.stringify(unknown).includes('NEW_ROLE'));assert.ok(!JSON.stringify(unknown).includes('UNREVIEWED_SCOPE'))
})

test('B05 payment retry keeps persisted immutable payload/key through double click, timeout and reload',async()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)}
  const {paymentIntent}=loader({'@/shared/api':{ApiError}})('features/booking/model/payment-intent.ts')
  const payload={bookingId:id,requestedAmount:10,currency:'USD',paymentMethod:'Cash'},intent=paymentIntent('fixture-user',id,storage),calls=[]
  const send=async body=>{calls.push(body);throw new ApiError('Timeout fixture',408)}
  const a=intent.execute(payload,send),b=intent.execute(payload,send);assert.equal(a,b);await assert.rejects(a)
  assert.equal(intent.record.status,'unknown');const restored=paymentIntent('fixture-user',id,storage)
  await assert.rejects(restored.execute({...payload,requestedAmount:20},send));assert.equal(calls.length,1)
  const saved=await restored.execute(payload,async body=>{calls.push(body);return {...payload,paymentId:'payment',status:'Pending'}})
  assert.equal(calls[0].idempotencyKey,calls[1].idempotencyKey);assert.equal(saved.status,'Pending');assert.equal(restored.record,null)
})

test('FE-INT-10B confirmation barrier survives reload and is scoped to user and booking',()=>{
  const {paymentConfirmation}=loader({'@/shared/api':{ApiError}})('features/booking/model/payment-intent.ts')
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
  const first=paymentConfirmation('user-a',id,storage)
  assert.equal(first.begin('payment-a'),true);assert.equal(first.begin('payment-b'),false)
  const restored=paymentConfirmation('user-a',id,storage)
  assert.equal(restored.pending,'payment-a');assert.equal(restored.begin('payment-a'),false)
  assert.equal(paymentConfirmation('user-b',id,storage).pending,null)
  assert.equal(paymentConfirmation('user-a',ship,storage).pending,null)
  assert.equal(restored.clear(),true);assert.equal(paymentConfirmation('user-a',id,storage).pending,null)
  const broken=paymentConfirmation('user-a',id,{getItem:()=>null,setItem(){throw Error('storage failure')}})
  assert.equal(broken.begin('payment-a'),false);assert.equal(broken.storageError,true)
})

test('FE-INT-10B reconciliation requires a matching confirmed server payment',()=>{
  const values=new Map([['ocvviet:payment-confirm:v1:user:'+id,JSON.stringify('payment-a')]])
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}
  const react={useCallback:fn=>fn,useRef:value=>({current:value}),useState:initial=>[typeof initial==='function'?initial():initial,()=>{}]}
  let query={loading:false,error:null,retry(){},data:[{paymentId:'payment-a',bookingId:id,status:'Pending',requestedAmount:10,currency:'USD',paymentMethod:'Cash'}]}
  const component=loader({react,'@/shared/api':{ApiError,useReadQuery:()=>query},'@/shared/auth':{useSessionAccess:()=>({userId:'user',canDo:()=>true})},'@/shared/ui':ui,'./RealBookingUI':{BookingReadState:'BookingReadState'},'../api/payment-api':{paymentApi:{}},__globals:{sessionStorage:storage}})('features/booking/components/PaymentLedger.tsx')
  const render=()=>{const outer=component.PaymentLedger({bookingId:id,currency:'USD',onChanged(){}});return nodes(outer.type(outer.props))}
  const button=tree=>tree.find(n=>n.props?.children==='Đã đối chiếu giao dịch đã xác nhận')
  assert.equal(button(render()),undefined)
  query={...query,data:[{...query.data[0],paymentId:'foreign',status:'Confirmed'}]};assert.equal(button(render()),undefined)
  query={...query,data:[{...query.data[0],paymentId:'payment-a'}],error:new Error('read failed')};assert.equal(button(render()),undefined)
  query={...query,error:null};const confirmed=button(render());assert.ok(confirmed);confirmed.props.onClick()
  assert.equal(JSON.parse(values.get('ocvviet:payment-confirm:v1:user:'+id)),null)
})

test('B05 payment persistence failure sends nothing and foreign success remains unknown',async()=>{
  const {paymentIntent}=loader({'@/shared/api':{ApiError}})('features/booking/model/payment-intent.ts'),payload={bookingId:id,requestedAmount:10,currency:'USD',paymentMethod:'Cash'}
  const broken=paymentIntent('user',id,{getItem(){return null},setItem(){throw Error('Fixture quota')}})
  await assert.rejects(broken.execute(payload,()=>assert.fail('No write without durable key')))
  const data=new Map(),intent=paymentIntent('user',id,{getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)})
  await assert.rejects(intent.execute(payload,async()=>({...payload,bookingId:ship,paymentId:'p',status:'Confirmed'})))
  assert.equal(intent.record.status,'unknown')
})

test('B05 Pending, Failed, Confirmed and Cancelled stay distinct; foreign and malformed payments are rejected',async()=>{
  let rows=['Pending','Failed','Confirmed','Cancelled'].map((status,index)=>({paymentId:'p'+index,bookingId:id,requestedAmount:10,currency:'USD',paymentMethod:'GatewaySandbox',status}))
  const api=loader({'@/shared/api':{apiRequest:async()=>rows}})('features/booking/api/payment-api.ts').paymentApi
  assert.deepEqual(Array.from(await api.list(id),row=>row.status),['Pending','Failed','Confirmed','Cancelled'])
  rows=[{...rows[0],bookingId:ship}];await assert.rejects(api.list(id));rows=[{...rows[0],bookingId:id,status:'Verified'}];await assert.rejects(api.list(id))
})

test('C04/P02 detail reload keeps identity, drops foreign session data and ignores an earlier request',async()=>{
  const react=hooks(),requests=[];let access={userId:'first',status:'ready',permissions:['CRUISE_READ']}
  const {useCruiseDetail}=loader({react,'@/shared/auth':{useSessionAccess:()=>access},'./useReadinessClock':{useReadinessClock:()=>0},'../api/cruise-api':{cruiseApi:{getDetail:(id,signal,onCore)=>new Promise(resolve=>requests.push({id,signal,onCore,resolve}))}}})('features/cruises/hooks/useCruiseDetail.ts')
  const render=(cruiseId=id)=>{react.reset();return useCruiseDetail(cruiseId)}
  assert.equal(render().state.data,null);const cleanup=react.effects.pop()()
  const detail={cruise:record,readiness:{state:'UNKNOWN',checks:[]}}
  requests[0].resolve(detail);await Promise.resolve();assert.equal(render().state.data.cruise.cruiseId,id)
  access={...access,userId:'second'};assert.equal(render().state.data,null,'identity changes clear data before the next effect')
  cleanup();react.effects.pop()();const current=requests[1]
  assert.equal(render(ship).state.data,null);react.effects.pop()()
  current.resolve(detail);await Promise.resolve();assert.equal(render(ship).state.data,null)
  requests[2].resolve({cruise:{...record,cruiseId:ship},readiness:{state:'UNKNOWN',checks:[]}});await Promise.resolve()
  assert.equal(render(ship).state.data.cruise.cruiseId,ship)
})

test('P03 activity create uses locked Cruise and safe return, denies changed URL and preserves 403 draft',async()=>{
  const react=hooks(),navigated=[],sent=[];let params=new URLSearchParams({cruiseId:id,returnTo:'/admin/cruises/'+id+'?section=program'}),failure=null
  const {ActivityFormPage}=loader({react,'react-router':{useParams:()=>({}),useSearchParams:()=>[params],useNavigate:()=>to=>navigated.push(to)},'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>({canDo:()=>true})},'@/shared/api':{ApiError,useReadQuery:()=>({data:[{cruiseId:id,...record}],loading:false,error:null})},'../api/activity-api':{activityApi:{cruises(){},save:async draft=>{sent.push(draft);if(failure)throw failure;return {id:'activity',cruiseId:draft.cruiseId}}}},'../components/ActivityUI':{ActivityFrame:'ActivityFrame',ActivityState:'ActivityState'}})('features/activities/pages/ActivityFormPage.tsx')
  const editor=ActivityFormPage().type,render=()=>{react.reset();return nodes(editor())}
  let tree=render();assert.equal(tree.find(n=>n.props?.id==='activity-cruiseId').props.disabled,true)
  for(const [field,value] of [['activityName','Fixture'],['startTime','2027-01-02T01:00'],['endTime','2027-01-02T02:00']])tree.find(n=>n.props?.id==='activity-'+field).props.onChange({target:{value}})
  params=new URLSearchParams({cruiseId:ship});await render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(sent.length,0)
  params=new URLSearchParams({cruiseId:id,returnTo:'/admin/cruises/'+id+'?section=program'});failure=new ApiError('Forbidden fixture',403)
  await render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
  assert.equal(sent.length,1);assert.equal(navigated.length,0);assert.equal(render().find(n=>n.props?.id==='activity-activityName').props.value,'Fixture')
  failure=null;await render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
  assert.equal(sent[1].cruiseId,id);assert.equal(navigated[0],'/admin/cruises/'+id+'?section=program')
})

test('P04 excursion writer rejects foreign stop success and never navigates to a false saved result',async()=>{
  const react=hooks(),navigated=[],params=new URLSearchParams({cruiseId:id,cruiseStopId:ship,returnTo:'/admin/cruises/'+id+'?section=schedule'})
  const {ShoreExcursionFormPage}=loader({react,'react-router':{useParams:()=>({}),useSearchParams:()=>[params],useNavigate:()=>to=>navigated.push(to)},'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>({canDo:()=>true})},'@/shared/api':{ApiError},'../api/shore-excursion-api':{shoreExcursionApi:{create:async()=>({shoreExcursionId:'excursion',cruiseStopId:id})}},'../api/excursion-context-api':{},'../components/ExcursionForm':{ExcursionForm:'ExcursionForm'},'../components/ExcursionActions':{},'../components/ShoreUI':{ShoreLayout:'ShoreLayout',ShoreError:'ShoreError'}})('features/shore-excursions/pages/ShoreExcursionPages.tsx')
  const element=nodes(ShoreExcursionFormPage()).find(n=>typeof n.type==='function'&&n.type.name==='SaveExcursion')
  const render=()=>{react.reset();return nodes(element.type(element.props))}
  await render().find(n=>n.type==='ExcursionForm').props.onSave({cruiseStopId:ship})
  assert.equal(navigated.length,0);assert.ok(render().some(n=>n.props?.title==='Cần kiểm tra kết quả trước khi gửi lại'))
  assert.equal(render().find(n=>n.type==='ExcursionForm').props.busy,true)
})

test('S02 ship assignment rechecks conditions, handles server conflict and blocks resubmit after unknown result',async()=>{
  const react=hooks(),candidate={ship:{shipId:ship,shipName:'Fixture'},state:'AVAILABLE',reasons:[]};let writes=0,changed=0,failure=new ApiError('Race fixture',409)
  const detail={cruise:record,ship:null,bookingHasData:false,assignmentCapabilities:{assign:{allowed:true}}}
  const {ShipAssignmentDialog}=loader({react,'@/shared/api':{ApiError},'@/shared/auth':{useSessionAccess:()=>({userId:'fixture',canDo:()=>true}),getSessionAccess:()=>({userId:'fixture',status:'ready',permissions:['CRUISE_ASSIGN_SHIP'],roles:['CRUISE_MANAGER']}),actionInWorkScope:()=>true},'@/shared/ui':ui,'../api/cruise-api':{cruiseApi:{getShipCandidates:async()=>[candidate],getDetail:async()=>detail,checkShip:async()=>({allowed:true}),assignShip:async()=>{writes++;if(failure)throw failure}}}})('features/cruises/components/ShipAssignmentDialog.tsx')
  const render=()=>{react.reset();return ShipAssignmentDialog({detail,mode:'assign',onClose(){},onChanged(){changed++}})}
  render();react.effects.pop()();await Promise.resolve()
  nodes(render()).find(n=>n.props?.role==='radio').props.onClick()
  const confirm=async()=>{nodes(render().props.footer).find(n=>n.props?.children==='Xác nhận phân công').props.onClick();await new Promise(resolve=>setImmediate(resolve))}
  await confirm();assert.equal(writes,1);assert.equal(changed,0);assert.equal(nodes(render().props.footer).find(n=>n.props?.children==='Xác nhận phân công').props.disabled,false)
  failure=new ApiError('Timeout fixture',408);await confirm();assert.equal(writes,2)
  await confirm();assert.equal(writes,2);assert.ok(nodes(render()).some(n=>n.props?.title==='Cần đối chiếu phân công'))
})

test('P11 staff-only workspace never requests passenger manifest and distinguishes read denial from empty',async()=>{
  const react=hooks(),loads=[],calls=[];let allowed=true
  const {CruiseOperations}=loader({react,'@/shared/ui':ui,'@/shared/api':{ApiError,apiRequest:async path=>{calls.push(path);return []},useReadQuery:(_key,load)=>{loads.push(load);return {data:null,loading:false,error:null,retry(){}}}},'@/shared/auth':{useSessionAccess:()=>({canDo:p=>allowed&&p==='CRUISE_STAFF_READ'})},'./DepartureCommand':{},'../api/departure-management-api':{}})('features/cruises/components/CruiseOperations.tsx')
  let tree=nodes(CruiseOperations({cruiseId:id,view:'staff'}));await Promise.all(loads.map(load=>load(new AbortController().signal)))
  assert.deepEqual(calls,['/cruise/'+id+'/staff']);assert.ok(tree.some(n=>n.type==='Empty'&&n.props.title==='Chưa có nhân sự được phân công'))
  allowed=false;react.reset();tree=nodes(CruiseOperations({cruiseId:id,view:'staff'}));assert.ok(tree.some(n=>n.props?.title==='Nhân sự phân công chưa được phép xem'))
})

test('S02 assignment adapters reject foreign Cruise, wrong ship and unconfirmed unassignment',async()=>{
  let response={...record,shipId:ship}
  const api=loader({'@/shared/api':{ApiError,apiRequest:async()=>response},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
  assert.equal((await api.assignShip(id,ship)).shipId,ship)
  response={...record,cruiseId:ship,shipId:ship};await assert.rejects(api.assignShip(id,ship))
  response={...record,shipId:null};await assert.rejects(api.changeShip(id,ship))
  response={...record,shipId:ship};await assert.rejects(api.unassignShip(id))
  response={...record,shipId:null};assert.equal((await api.unassignShip(id)).shipId,null)
})

test('P12 ship-change and supplier-verification issues route to actual action owners instead of unrelated edit forms',()=>{
  const {readinessTarget}=loader()('features/cruises/model/readiness-target.ts')
  assert.equal(readinessTarget({targetType:'SHIP',targetId:ship,requiredPermission:'CRUISE_CHANGE_SHIP'},id,ship),'/admin/cruises/'+id+'?section=resources')
  assert.equal(readinessTarget({targetType:'SUPPLIER',targetId:ship,requiredPermission:'SUPPLIER_VERIFY'},id,null),'/admin/suppliers/'+ship)
})

test('X01 port preview keeps selected IDs/revision, clears stale results and never applies change',async()=>{
  const react=hooks(),calls=[];let lastLoad,cruise={...record,sourceTripId:'trip'}
  const {DepartureImpact}=loader({react,'@/shared/ui':ui,'@/shared/auth':{useSessionAccess:()=>({has:p=>p==='PORT_READ'})},'@/shared/api':{ApiError,useReadQuery:(key,load)=>{
    let data=key.startsWith('impact-ports:')?[{portId:ship,portName:'Fixture port'}]:key.startsWith('departure-tasks:')?[]:null
    if(key.startsWith('departure-change:')&&!key.endsWith(':none')){lastLoad=load;data={currentRevision:2,affectedBookingsCount:1,generatedTasks:[]}}
    return {data,error:null,loading:false,retry(){}}
  }},'./DepartureCommand':{DepartureCommand:'DepartureCommand'},'./ReadinessIssues':{},'../api/departure-api':{departureApi:{impact:async(id,input)=>{calls.push({id,input});return {currentRevision:2}}}},'../api/cruise-api':{cruiseApi:{}},'../api/departure-management-api':{}})('features/cruises/components/DepartureData.tsx')
  const render=()=>{react.reset();return nodes(DepartureImpact({cruise}))}
  render().find(n=>n.props?.id==='impact-departure-port').props.onChange({target:{value:ship}})
  render().find(n=>n.props?.id==='impact-reason').props.onChange({target:{value:'Fixture reason'}})
  render().find(n=>n.props?.children==='Xem tác động').props.onClick();let tree=render();await lastLoad(new AbortController().signal)
  assert.equal(calls[0].input.newDeparturePortId,ship);assert.equal(calls[0].input.expectedRevision,2)
  assert.equal(tree.find(n=>n.type==='DepartureCommand').props.disabled,false)
  cruise={...cruise,revision:3};assert.ok(!render().some(n=>n.type==='DepartureCommand'),'changing revision hides prior preview')
  render().find(n=>n.props?.children==='Xem tác động').props.onClick();tree=render()
  assert.equal(tree.find(n=>n.type==='DepartureCommand').props.disabled,true)
  tree.find(n=>n.props?.children==='Bỏ kết quả xem trước').props.onClick();assert.ok(!render().some(n=>n.type==='DepartureCommand'))
  assert.ok(!tree.some(n=>n.props?.label?.includes('Áp dụng')))
})

test('X02 disabled command exposes its reason and 403 keeps a form editable while timeout locks repeated writes',async()=>{
  const react=hooks();let attempts=0,failure=new ApiError('Forbidden fixture',403)
  const {DepartureCommand}=loader({react,'@/shared/ui':ui,'@/shared/api':{ApiError},'@/shared/auth':{useSessionAccess:()=>({canDo:()=>true})}})('features/cruises/components/DepartureCommand.tsx')
  const props={label:'Fixture action',permissions:['TEST_FIXTURE'],disabledReason:'Fixture prerequisite',run:async()=>{attempts++;throw failure}}
  const render=(extra={})=>{react.reset();return nodes(DepartureCommand({...props,...extra}))}
  let tree=render({disabled:true});assert.ok(tree.some(n=>n.props?.role==='note'&&n.props.children==='Fixture prerequisite'))
  tree=render();tree.find(n=>n.type==='Button').props.onClick();tree=render();let modal=tree.find(n=>n.type==='Modal')
  nodes(modal.props.footer).at(-1).props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(attempts,1)
  modal=render().find(n=>n.type==='Modal');assert.equal(nodes(modal.props.footer).at(-1).props.disabled,false)
  failure=new ApiError('Fixture timeout',408);nodes(modal.props.footer).at(-1).props.onClick();await new Promise(resolve=>setImmediate(resolve))
  modal=render().find(n=>n.type==='Modal');assert.equal(nodes(modal.props.footer).at(-1).props.disabled,true)
  nodes(modal.props.footer).at(-1).props.onClick();await Promise.resolve();assert.equal(attempts,2)
})

test('B06 own booking identity and Draft/Confirmed states survive reads; unauthorized cancellation stays an error',async()=>{
  const context=loader({'@/shared/api':{}})('domain/booking-context/booking-context-api.ts')
  let response={bookingId:id,bookingReference:'TEST',bookingStatus:'Draft',cruiseId:id,cruiseName:'Fixture',passengers:[],agreedFareAmount:100,requiredDepositAmount:20,currency:'USD',installments:[]},failure=null
  const api=loader({'@/domain/booking-context':context,'@/shared/api':{ApiError,apiRequest:async()=>{if(failure)throw failure;return response}}})('features/booking/api/real-booking-api.ts').realBookingApi
  assert.equal((await api.get(id)).bookingStatus,'Draft');response={...response,bookingStatus:'Confirmed'};assert.equal((await api.get(id)).bookingStatus,'Confirmed')
  response={...response,bookingId:ship};await assert.rejects(api.get(id))
  failure=new ApiError('Forbidden fixture',403);await assert.rejects(api.cancel(id,'Fixture reason'),error=>error===failure)
})

test('X02 native modal restores trigger focus, handles Escape and blocks dismissal while a write is busy',()=>{
  const react=hooks();let sequence=0,closed=0,shown=0,restored=0
  class Element {constructor(){this.isConnected=true}focus(){restored++}}
  const trigger=new Element(),document={activeElement:trigger,documentElement:{style:{overflow:'auto'}}}
  const {Modal}=loader({react:{...react,useId:()=>String(sequence++)},__globals:{document,HTMLElement:Element}})('shared/ui/Overlay.tsx')
  const render=busy=>{react.reset();return Modal({title:'Fixture',busy,onClose:()=>closed++,children:'Fixture form'})}
  let tree=render(false);tree.props.ref.current={showModal(){shown++},close(){}}
  const cleanup=react.effects.shift()();react.effects.shift()();assert.equal(shown,1);assert.equal(document.documentElement.style.overflow,'hidden')
  tree.props.onCancel({preventDefault(){}});assert.equal(closed,1)
  tree=render(true);tree.props.onCancel({preventDefault(){}});assert.equal(closed,1)
  cleanup();assert.equal(restored,1);assert.equal(document.documentElement.style.overflow,'auto')
})

test('X02 itinerary open-for-sale alone does not label the Cruise as accepting bookings',()=>{
  const {DepartureMilestones}=loader()('features/cruises/components/DepartureMilestones.tsx')
  const tree=nodes(DepartureMilestones({receivingBookings:true}))
  assert.ok(!tree.some(n=>n.props?.children==='Đang nhận đặt chỗ'))
  assert.ok(tree.some(n=>Array.isArray(n.props?.children)&&n.props.children.includes('Kiểm tra phạm vi nhận đặt chỗ')))
})


test('Plan and pricing share one Cruise workspace without coupling their approval commands',()=>{
 const copy={businessCopy:key=>key}
 const {CruisePlanWorkspace}=loader({'@/shared/auth':{useSessionAccess:()=>({roles:['CRUISE_MANAGER'],has:()=>true,canDo:()=>true})},'@/shared/i18n/business-copy':copy,'@/shared/ui':{Panel:'Panel',Button:'Button'},'./CruisePlanReview':{CruisePlanReview:'PlanReview'},'./DeparturePricingPolicy':{DeparturePricingPolicy:'Pricing'}})('features/cruises/components/CruisePlanWorkspace.tsx')
 const changes=[],opened=[]
 const tree=nodes(CruisePlanWorkspace({cruiseId:id,refreshKey:'fixture:3',onChanged:()=>changes.push('changed'),onSection:section=>opened.push(section),sections:['schedule','program']}))
 const plan=tree.filter(n=>n.type==='PlanReview'),pricing=tree.filter(n=>n.type==='Pricing')
 assert.equal(plan.length,2);assert.equal(pricing.length,1)
 assert.equal(plan[0].props.cruiseId,id);assert.equal(pricing[0].props.cruiseId,id)
 assert.equal(plan[0].props.refreshKey,'fixture:3')
 pricing[0].props.onChanged();assert.deepEqual(changes,['changed'])
 for(const button of tree.filter(n=>n.type==='Button'))button.props.onClick()
 assert.deepEqual(opened,['schedule','program'])
 assert.equal(plan[0].props.onApprovePricing,undefined)
 assert.equal(plan[0].props.mode,'summary');assert.equal(plan[1].props.mode,'prepare')
 const page=readFileSync(new URL('../../src/features/cruises/pages/CruiseDetailPage.tsx',import.meta.url),'utf8')
 assert.equal((page.match(/<CruisePlanWorkspace /g)||[]).length,1)
 assert.equal((page.match(/<DeparturePackageManager /g)||[]).length,1)
 assert.match(page,/reviewStep\?\(operations\?/);assert.equal((page.match(/<DeparturePricingPolicy /g)||[]).length,1,'OPS review keeps a separate pricing decision in the shared workspace')
})

test('booking role sees sale state filter without removing CRM or OPS workspaces',()=>{
 const {bookingCruiseView}=loader()('features/cruises/model/cruise-visibility.ts')
 assert.equal(bookingCruiseView(['BOOKING_AGENT']),true)
 assert.equal(bookingCruiseView(['BOOKING_AGENT','PASSENGER']),true)
 for(const role of ['CRUISE_MANAGER','OPERATIONS_MANAGER','SHIP_MANAGER','ADMIN'])assert.equal(bookingCruiseView(['BOOKING_AGENT',role]),false)
 const {CruiseFilters,CruiseTable}=loader({'@/shared/auth':{useSessionAccess:()=>({roles:['BOOKING_AGENT']})},'@/shared/ui':ui,'@/shared/ui/admin-v3':{AdminShell:'AdminShell'}})('features/cruises/components/CruiseUI.tsx')
 const tree=nodes(CruiseFilters({query:{status:'DRAFT',cruiseType:'',shipId:''},ships:[],onChange(){},onReset(){},bookingOnly:true}))
 const filter=tree.find(n=>n.type==='select'&&n.props.id==='cruise-status')
 assert.equal(filter,undefined);assert.ok(tree.some(n=>n.type==='Badge'&&n.props.label==='Đang nhận đặt chỗ'))
 assert.ok(!tree.some(n=>n.type==='option'&&n.props.value==='PUBLISHED'))
 const table=nodes(CruiseTable({items:[{cruise:{...record,status:'PUBLISHED'},ship:null}],bookingOnly:true}))
 assert.ok(table.find(n=>n.type==='DataTable').props.headers.includes('Trạng thái bán'))
 assert.ok(!table.find(n=>n.type==='DataTable').props.headers.includes('Kiểm tra vận hành'))
 assert.ok(table.some(n=>n.type==='Badge'&&n.props.label==='Đang nhận đặt chỗ'))
})

test('public booking catalog always requests sale visibility including when user has operational access',async()=>{
 const calls=[]
 const {liveCruiseCatalogApi}=loader({'@/shared/api':{ApiError,apiRequest:async(url,options)=>{
  calls.push({url,...options});return url==='/cruise'?{content:[],number:0,totalElements:0,totalPages:0}:{...record,status:'PUBLISHED'}
 }}})('features/booking/api/booking-api.ts')
 await liveCruiseCatalogApi.list(1);await liveCruiseCatalogApi.detail(id)
 assert.ok(calls.every(call=>call.query.saleState==='OPEN_FOR_SALE'))
})

test('switching CRM to booking hides the old list and cancels its pending response',async()=>{
 const react=hooks(),requests=[]
 let access={userId:'crm',status:'ready',roles:['CRUISE_MANAGER'],permissions:['CRUISE_READ'],has:()=>false}
 const params=new URLSearchParams({status:'DRAFT'})
 const {useCruiseList}=loader({react,'react-router':{useSearchParams:()=>[params,()=>{}]},'@/shared/auth':{useSessionAccess:()=>access},'../api/cruise-api':{cruiseApi:{list:(query,signal)=>new Promise(resolve=>requests.push({query,signal,resolve}))}}})('features/cruises/hooks/useCruiseList.ts')
 const render=()=>{react.reset();return useCruiseList()}
 render();const cancel=react.effects[0]()
 requests[0].resolve({items:[{cruise:{status:'DRAFT'}}],total:1});await new Promise(resolve=>setImmediate(resolve))
 assert.equal(render().state.status,'ready')
 cancel();assert.equal(requests[0].signal.aborted,true)
 access={...access,userId:'booking',roles:['BOOKING_AGENT']}
 const switched=render()
 assert.equal(switched.state.status,'loading');assert.equal(switched.state.data,null);assert.equal(switched.query.status,'')
})
