import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync,existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root=fileURLToPath(new URL('../../src/',import.meta.url))
class ApiError extends Error {constructor(message,status,code,details){super(message);Object.assign(this,{status,code,details})}}
function loader(overrides={},globals={}) {
 const cache=new Map()
 function load(file) {
  if(cache.has(file))return cache.get(file)
  const module={exports:{}},source=ts.transpileModule(readFileSync(file,'utf8').replaceAll('import.meta.env','({})'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText
  vm.runInNewContext(source,{module,exports:module.exports,Date,Intl,URL,URLSearchParams,Error,crypto:globalThis.crypto,structuredClone,AbortController,FormData,setTimeout,clearTimeout,...globals,require(id){
   if(Object.hasOwn(overrides,id))return overrides[id]
   let target=id.startsWith('@/')?path.join(root,id.slice(2)):path.resolve(path.dirname(file),id)
   if(!path.extname(target))target=existsSync(target+'.ts')?target+'.ts':existsSync(target+'.tsx')?target+'.tsx':path.join(target,'index.ts')
   return load(target)
  }},{filename:file});cache.set(file,module.exports);return module.exports
 }
 return relative=>load(path.join(root,relative))
}
const draft={cruiseCode:'',cruiseName:'Lần khởi hành kiểm tra',cruiseType:'MULTI_DAYS',departureDatetime:'2027-01-01T08:00',returnDatetime:'2027-01-03T18:00',departurePortId:'port-a',returnPortId:'port-b'}
const storage=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}}
const intentFactory=()=>loader({'@/shared/api':{ApiError}})('features/cruises/model/create-intent.ts').cruiseCreateIntent

test('POST /cruise passes Idempotency-Key through the real API client to HTTP headers',async()=>{
 const requests=[],auth={apiPermissionRequirement:()=>null,getSessionAccess:()=>({}),hasPermissions:()=>true}
 const loadClient=loader({'@/shared/auth':auth},{fetch:async(url,options)=>{requests.push({url,...options});return{ok:true,status:201,json:async()=>({success:true,data:{cruiseId:'saved',...JSON.parse(options.body),status:'DRAFT'}})}}})
 const client=loadClient('shared/api/client.ts')
 const api=loader({'@/shared/api':client,'@/shared/auth':auth})('features/cruises/api/cruise-api.ts').cruiseApi
 const key=crypto.randomUUID();const saved=await api.createCruise(draft,key)
 assert.equal(saved.cruiseId,'saved');assert.equal(requests.length,1);assert.equal(requests[0].headers['Idempotency-Key'],key)
 assert.equal(JSON.parse(requests[0].body).departureDatetime,'2027-01-01T01:00:00.000Z')
 await assert.rejects(api.createCruise(draft,''),/Thiếu mã thao tác/);assert.equal(requests.length,1)
})

test('double submit shares one mutation and one payload/key',async()=>{
 const intent=intentFactory()('actor',storage());let finish,count=0
 const send=()=>{count++;return new Promise(resolve=>{finish=resolve})}
 const first=intent.execute(draft,send),second=intent.execute(draft,send)
 assert.equal(first,second);await Promise.resolve();assert.equal(count,1)
 finish({cruiseId:'saved'});await first;assert.equal(intent.record.status,'succeeded')
})

test('unknown outcome survives reload; retry retains exactly the original key and payload',async()=>{
 const store=storage(),factory=intentFactory(),first=factory('actor',store),calls=[]
 await assert.rejects(first.execute(draft,async(payload,key)=>{calls.push({payload,key});throw new ApiError('timeout',0)}))
 assert.equal(first.record.status,'unknown');assert.equal(first.startNew(),false)
 const recovered=factory('actor',store)
 await assert.rejects(recovered.execute({...draft,cruiseName:'Changed'},async()=>assert.fail('Must not send changed payload')))
 assert.equal(recovered.record.status,'unknown')
 await recovered.execute(draft,async(payload,key)=>{calls.push({payload,key});return{cruiseId:'saved'}})
 assert.equal(calls[0].key,calls[1].key);assert.deepEqual(calls[0].payload,calls[1].payload)
})

test('HTTP 400 is rejected, preserves draft, and never reports creation success',async()=>{
 const intent=intentFactory()('actor',storage()),before=JSON.stringify(draft)
 await assert.rejects(intent.execute(draft,async()=>{throw new ApiError('invalid',400,'INVALID_INPUT')}))
 assert.equal(intent.record.status,'rejected');assert.equal(intent.record.cruiseId,undefined);assert.equal(JSON.stringify(draft),before)
 const previous=intent.record.key
 await intent.execute({...draft,cruiseName:'Corrected'},async()=>({cruiseId:'saved'}))
 assert.notEqual(intent.record.key,previous)
})

test('corrupt pending intent blocks creation instead of silently generating a fresh key',async()=>{
 const store=storage();store.setItem('ocvviet:cruise-create:v1:actor','broken')
 const intent=intentFactory()('actor',store)
 await assert.rejects(intent.execute(draft,async()=>assert.fail('Must not create')))
 assert.equal(intent.storageError,true)
})

test('create preserves the exact selected source; response-only fields never leak into create or PATCH',async()=>{
 const calls=[],source={sourceTripId:'trip-source',sourceTripCode:'TR-1',sourceVersionId:'published-v1',sourceVersionNumber:1}
 const api=loader({'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return{cruiseId:'saved',...source,status:'DRAFT'}}},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
 const saved=await api.createCruise({...draft,...source,shipId:'optional-ship'},crypto.randomUUID())
 assert.equal(calls[0].body.sourceVersionId,'published-v1');assert.equal(calls[0].body.sourceTripId,undefined);assert.equal(calls[0].body.sourceTripCode,undefined);assert.equal(calls[0].body.sourceVersionNumber,undefined)
 assert.equal(calls[0].body.shipId,'optional-ship');for(const key of Object.keys(source))assert.equal(saved[key],source[key])
 await api.updateCruise('saved',{...draft,...source,shipId:'not-updatable'})
 assert.equal(calls[1].body.sourceVersionId,undefined);assert.equal(calls[1].body.shipId,undefined)
})

test('legacy Cruise response remains readable without source fields',async()=>{
 const api=loader({'@/shared/api':{ApiError,apiRequest:async()=>({cruiseId:'legacy',status:'DRAFT'})},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
 const saved=await api.createCruise(draft,crypto.randomUUID())
 assert.equal(saved.cruiseId,'legacy');assert.equal(saved.sourceVersionId,null);assert.equal(saved.sourceTripId,null)
})

test('source lookup reads exactly the requested published version, never selects latest or copies schedule',async()=>{
 const calls=[]
 const apiRequest=async(url,options)=>{calls.push({url,...options});return url.startsWith('/trips/')?{tripId:'trip',tripCode:'TR-1',name:'Source trip',latestVersionNumber:3}:{versionId:'v1',versionNumber:1,status:'PUBLISHED',tripId:'trip',stops:[{}],entries:[{}]}}
 const read=loader({'@/shared/api':{ApiError,apiRequest}})('features/cruises/api/source-version.ts').readPublishedSource
 const source=await read('v1',new AbortController().signal)
 assert.equal(source.versionId,'v1');assert.equal(source.versionNumber,1);assert.equal(source.tripCode,'TR-1')
 assert.deepEqual(calls.map(call=>call.url),['/trip-schedule-versions/v1','/trips/trip']);assert.ok(calls.every(call=>!call.method||call.method==='GET'))
 assert.equal(source.stops,undefined);assert.equal(source.entries,undefined)
})

test('unpublished, mismatched and inaccessible source versions fail without fallback',async()=>{
 for(const response of [{versionId:'v1',versionNumber:1,tripId:'trip',status:'DRAFT'},{versionId:'v2',versionNumber:2,tripId:'trip',status:'PUBLISHED'}]){
  let count=0
  const read=loader({'@/shared/api':{ApiError,apiRequest:async()=>{count++;return response}}})('features/cruises/api/source-version.ts').readPublishedSource
  await assert.rejects(read('v1'));assert.equal(count,1)
 }
 const read=loader({'@/shared/api':{ApiError,apiRequest:async()=>{throw new ApiError('no access',403)}}})('features/cruises/api/source-version.ts').readPublishedSource
 await assert.rejects(read('v1'),/no access/)
})

test('planning port request sends the exact Trip ID and supported country query only',async()=>{
 const calls=[],apiRequest=async(url,options)=>{calls.push({url,...options});return[{portId:'port',portName:'Cảng kiểm tra',countryCode:'VN',domesticRegion:'BAC_BO'}]}
 const sources=loader({'@/shared/api':{ApiError,apiRequest}})('features/trip-planning/api/catalogs.ts').planningSources
 await sources('ports',new AbortController().signal,{tripId:'trip-a',countryCode:'VN',countryCodes:['VN','TH'],destinationId:'destination',keyword:'  cảng  '})
 assert.equal(calls[0].url,'/trip-planning/catalogs/sources/ports');assert.equal(calls[0].query.tripId,'trip-a');assert.equal(calls[0].query.countryCodes,'VN,TH');assert.equal(calls[0].query.keyword,'cảng')
 assert.equal(calls[0].query.revision,undefined);assert.equal(calls[0].query.page,undefined)
})

test('Trip, country scope and revision changes cannot reuse an old port query key',()=>{
 const key=loader()('features/trip-planning/model/source-query.ts').sourceQueryKey
 const original=key('ports',{tripId:'trip-a',countryCodes:['VN']},1)
 for(const query of [{tripId:'trip-b',countryCodes:['VN']},{tripId:'trip-a',countryCodes:['TH']}])assert.notEqual(original,key('ports',query,1))
 assert.notEqual(original,key('ports',{tripId:'trip-a',countryCodes:['VN']},2))
})

test('missing authoritative scope stays an error and never triggers unscoped fallback',async()=>{
 let calls=0
 const sources=loader({'@/shared/api':{ApiError,apiRequest:async()=>{calls++;throw new ApiError('Chưa cấu hình quốc gia',400,'SCOPE_COUNTRY_REQUIRED')}}})('features/trip-planning/api/catalogs.ts').planningSources
 await assert.rejects(sources('ports',new AbortController().signal,{tripId:'trip-a'}),error=>error.code==='SCOPE_COUNTRY_REQUIRED')
 assert.equal(calls,1)
})

test('known business errors translate without merging distinct endpoint codes',()=>{
 const message=loader()('shared/api/business-errors.ts').businessErrorMessage
 for(const [code,expected] of [['PORT_CALL_OVERLAP',/chồng/],['NON_POSITIVE_TRANSIT_TIME',/lớn hơn 0/],['INVALID_STOP_SEQUENCE_TIME',/Thứ tự/],['INVALID_PORT_CALL_TIMES',/Ngày giờ/],['SHORE_EXCURSION_OUTSIDE_PORT_WINDOW',/Tour tham quan/],['PORT_OUTSIDE_COUNTRY_SCOPE',/quốc gia/],['PORT_OUTSIDE_DOMESTIC_REGION',/miền/],['SCOPE_COUNTRY_REQUIRED',/phạm vi/],['EXISTING_STOPS_OUTSIDE_NEW_SCOPE',/phạm vi mới/],['PORT_COUNTRY_SCOPE_VIOLATION',/lần khởi hành/]])assert.match(message(code,'Validation failed'),expected)
 assert.equal(message('PORT_CALL_OVERLAP','Cảng A chồng giờ với cảng B.'),'Cảng A chồng giờ với cảng B.')
 assert.equal(message('UNKNOWN_CODE','Unrecognized detail'),'Unrecognized detail')
})

test('direct save errors retain BE location metadata; messages alone never fabricate a location',async()=>{
 const live=loader({'@/shared/api':{ApiError,apiRequest:async()=>{throw new ApiError('overlap',400,'PORT_CALL_OVERLAP',{clientKey:'call-b',fieldPath:'stops[clientKey=call-b].plannedArrivalTime',dayNumber:2})}}})('features/trip-planning/api/live.ts')
 const content={days:[],stops:[],entries:[]},before=JSON.stringify(content)
 await assert.rejects(live.liveGateway.save({versionId:'version',revision:4},content),error=>{
  const fault=live.failure(error);assert.equal(fault.status,400);assert.equal(fault.code,'PORT_CALL_OVERLAP');assert.equal(fault.violations[0].clientKey,'call-b');assert.equal(fault.violations[0].dayNumber,2);assert.match(fault.message,/chồng/);return true
 })
 assert.equal(JSON.stringify(content),before)
 const unlocated=live.failure(new ApiError('overlap',400,'PORT_CALL_OVERLAP'))
 assert.equal(unlocated.violations.length,0)
 const conflict=live.failure(new ApiError('Conflict',409,'REVISION_CONFLICT'))
 assert.equal(conflict.status,409);assert.equal(JSON.stringify(content),before)
})

test('validation report preserves exact cross-day target and remains separate from a save rejection',async()=>{
 const live=loader({'@/shared/api':{ApiError,apiRequest:async()=>({versionId:'v',revision:7,validForSubmit:false,deferredChecks:[],violations:[{code:'NON_POSITIVE_TRANSIT_TIME',severity:'ERROR',message:'Transit must be positive',clientKey:'b',dayNumber:3,fieldPath:'stops[clientKey=b].plannedArrivalTime'}]})}})('features/trip-planning/api/live.ts').liveGateway
 const report=await live.validate({versionId:'v',revision:7})
 assert.equal(report.validForSubmit,false);assert.equal(report.revision,7);assert.equal(report.violations[0].dayNumber,3);assert.equal(report.violations[0].clientKey,'b');assert.match(report.violations[0].message,/lớn hơn 0/)
})

test('operational READY never changes Cruise status; missing evidence differs from BLOCKED',()=>{
 const snapshot=loader()('features/cruises/model/readiness.ts').readinessSnapshot
 const cruise={status:'DRAFT'},before=JSON.stringify(cruise)
 assert.equal(snapshot({ready:true,evaluatedAt:'2026-10-26T09:00:00Z',cruiseRevision:4}).state,'READY')
 assert.equal(snapshot(null).state,'UNKNOWN');assert.equal(snapshot({ready:false}).state,'BLOCKED');assert.equal(snapshot({}).state,'UNKNOWN')
 const stale=snapshot({ready:true,evaluatedAt:'2026-10-26T09:00:00Z',cruiseRevision:4},'2026-10-26T10:00:00Z')
 assert.equal(stale.state,'UNKNOWN');assert.equal(stale.stale,true);assert.equal(stale.cruiseRevision,4);assert.equal(JSON.stringify(cruise),before)
})

test('readiness API errors and invalid responses remain errors, never a BLOCKED result',async()=>{
 for(const response of [null,{}, {ready:true,cruiseId:'another'}]){
  const api=loader({'@/shared/api':{ApiError,apiRequest:async()=>response},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
  await assert.rejects(api.readiness('selected'))
 }
 const api=loader({'@/shared/api':{ApiError,apiRequest:async()=>{throw new ApiError('readiness unavailable',503)}},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
 await assert.rejects(api.readiness('selected'),/unavailable/)
})

test('a new intent after confirmed success survives reload without corrupt recovery state',async()=>{
 const store=storage(),factory=intentFactory(),intent=factory('actor',store)
 await intent.execute(draft,async()=>({cruiseId:'saved'}));assert.equal(intent.startNew(),true)
 const next=factory('actor',store);assert.equal(next.record,null);assert.equal(next.storageError,false)
})

test('actual source hook aborts old Trip requests and cannot apply a late response to another Trip',async()=>{
 let stateIndex=0,effectIndex=0;const states=[],effects=[],pendingEffects=[],requests=[],starters=[]
 const context={gateway:{sources(_kind,signal,query){return new Promise(resolve=>{requests.push({signal,query,resolve});starters.shift()?.()})}}}
 const react={createContext:()=>({}),useContext:()=>context,useCallback:fn=>fn,
  useState(initial){const index=stateIndex++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return[states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value}]},
  useEffect(setup,deps){const index=effectIndex++,old=effects[index];if(!old||deps.some((dep,i)=>!Object.is(dep,old.deps[i])))pendingEffects.push(()=>{old?.cleanup?.();effects[index]={deps,cleanup:setup()}})},
 }
 const hook=loader({'react':react,'react-router':{},'react/jsx-runtime':{},'@/shared/ui':{},'@/shared/api':{ApiError}})('features/trip-planning/hooks.tsx').useSources
 const render=tripId=>{stateIndex=0;effectIndex=0;const result=hook('ports',{tripId});while(pendingEffects.length)pendingEffects.shift()();return result}
 let started=new Promise(resolve=>starters.push(resolve));assert.equal(render('trip-a').loading,true);await started
 started=new Promise(resolve=>starters.push(resolve));assert.equal(render('trip-b').data.length,0);await started
 assert.equal(requests[0].signal.aborted,true);assert.equal(requests[1].query.tripId,'trip-b')
 requests[1].resolve([{id:'port-b'}]);await new Promise(setImmediate);assert.equal(render('trip-b').data[0].id,'port-b')
 requests[0].resolve([{id:'stale-port-a'}]);await new Promise(setImmediate);assert.equal(render('trip-b').data[0].id,'port-b')
 for(const effect of effects)effect.cleanup?.()
})

test('source-based Cruise choices use the source Trip catalog; legacy choice requests stay unchanged',async()=>{
 const calls=[],api=loader({'@/shared/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,...options});return[{portId:'p',portName:'Port',status:'ACTIVE'}]}},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
 await api.listPorts(new AbortController().signal,'source-trip')
 assert.equal(calls[0].url,'/trip-planning/catalogs/sources/ports');assert.equal(calls[0].query.tripId,'source-trip')
 await api.listPorts();assert.equal(calls[1].url,'/ports/active');assert.equal(calls[1].query,undefined)
})

test('real envelope decoder keeps HTTP 400 and its field metadata as a rejected mutation',async()=>{
 const auth={apiPermissionRequirement:()=>null,getSessionAccess:()=>({}),hasPermissions:()=>true}
 const client=loader({'@/shared/auth':auth},{fetch:async()=>({ok:false,status:400,json:async()=>({success:false,code:'SHORE_EXCURSION_OUTSIDE_PORT_WINDOW',error:'Excursion outside port window',details:{clientKey:'tour-1',dayNumber:2}})})})('shared/api/client.ts')
 await assert.rejects(client.apiRequest('/trip-schedule-versions/v/content',{method:'PUT',body:{expectedRevision:1}}),error=>{
  assert.equal(error.status,400);assert.equal(error.code,'SHORE_EXCURSION_OUTSIDE_PORT_WINDOW');assert.equal(error.details.clientKey,'tour-1');assert.match(error.message,/Tour tham quan/);return true
 })
})

test('a malformed successful create response is unknown, never a saved record',async()=>{
 const api=loader({'@/shared/api':{ApiError,apiRequest:async()=>({})},'@/shared/auth':{}})('features/cruises/api/cruise-api.ts').cruiseApi
 const intent=intentFactory()('actor',storage())
 await assert.rejects(intent.execute(draft,api.createCruise))
 assert.equal(intent.record.status,'unknown');assert.equal(intent.record.cruiseId,undefined)
})
