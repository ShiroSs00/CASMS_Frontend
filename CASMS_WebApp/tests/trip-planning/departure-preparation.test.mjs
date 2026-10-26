import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
const root=fileURLToPath(new URL('../../src/',import.meta.url)),cache=new Map()
function load(relative){
 const file=path.join(root,relative);if(cache.has(file))return cache.get(file)
 const module={exports:{}}
 const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
 vm.runInNewContext(source,{module,exports:module.exports,Intl,Date,URL,Error,crypto:globalThis.crypto,require(id){if(id.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(file),id+(path.extname(id)?'':'.ts'))));throw Error(id)}},{filename:file})
 cache.set(file,module.exports);return module.exports
}
const r=load('features/trip-planning/model/port-rules.ts'),p=load('features/cruises/model/preparation.ts')
const scope=countryCodes=>({scope:'INTERNATIONAL',countryCodes,regionIds:[]})
const stop=(key,from='15:30',to='16:40',extra={})=>({clientKey:key,portId:'port-'+key,portName:'Port '+key,stopOrder:key==='a'?1:2,arrivalDayNumber:1,departureDayNumber:1,plannedArrivalTime:from,plannedDepartureTime:to,timeZoneId:'Asia/Ho_Chi_Minh',allAboardDayNumber:1,allAboardTime:to,...extra})
const content=(stops,entries=[])=>({days:[],stops,entries})
for(const [countries,country,expected] of [[['VN'],'VN',true],[['VN'],'TH',false],[['TH'],'TH',true],[['TH'],'VN',false],[['VN','TH'],'VN',true],[['VN','TH'],'TH',true],[['VN','TH'],'SG',false],[['VN'],undefined,false],[[],'VN',false]])test('country '+countries+' / '+country,()=>assert.equal(r.portMatchesScope({countryCode:country},scope(countries)),expected))
test('domestic region comes from API metadata',()=>{
 const info={scope:'DOMESTIC',regionIds:['BAC_BO','TRUNG_BO'],countryCodes:[]}
 assert.equal(r.portMatchesScope({countryCode:'VN',domesticRegion:'BAC_BO'},info),true)
 assert.equal(r.portMatchesScope({countryCode:'VN',domesticRegion:'NAM_BO'},info),false)
 assert.equal(r.portMatchesScope({countryCode:'VN'},info),false)
 assert.equal(r.portMatchesScope({countryCode:'TH',domesticRegion:'BAC_BO'},info),false)
})
test('scope change identifies occurrence without deleting it or its tour',()=>{
 const calls=[stop('a'),stop('b')],tour={clientKey:'tour',kind:'SHORE_EXCURSION',stopClientKey:'a'},before=JSON.stringify({calls,tour})
 const issues=r.portScopeViolations({stops:calls},scope(['TH']),[{id:'port-a',countryCode:'VN'},{id:'port-b',countryCode:'TH'}])
 assert.equal(issues.length,1);assert.equal(issues[0].clientKey,'a');assert.equal(issues[0].field,'portId');assert.equal(JSON.stringify({calls,tour}),before)
})
for(const [from,to,expected] of [['15:45','16:00',true],['15:00','16:00',true],['16:00','17:00',true],['15:00','17:00',true],['15:30','16:40',true],['16:40','17:30',false],['17:10','18:00',false]])test('occupancy '+from+'–'+to,()=>assert.equal(r.overlappingStops(stop('a'),[stop('b',from,to)]).length>0,expected))
test('overnight and repeated port IDs retain occurrence identity',()=>{
 const a=stop('a','23:00','02:00',{departureDayNumber:2,portId:'same'}),b=stop('b','01:30','03:00',{arrivalDayNumber:2,departureDayNumber:2,portId:'same'})
 assert.equal(r.overlappingStops(a,[a,b]).length,1)
 const issues=r.stopTimingViolations(content([a,b]));assert.equal(issues.length,2);assert.equal(issues[0].clientKey,'a');assert.equal(issues[1].clientKey,'b')
 assert.equal(r.overlappingStops(a,[{...b,arrivalDayNumber:3,departureDayNumber:3}]).length,0)
})
test('different or absent clocks are not compared as instants',()=>{
 assert.equal(r.overlappingStops(stop('a'),[stop('b','15:40','16:00',{timeZoneId:'Asia/Singapore'})]).length,0)
 assert.equal(r.overlappingStops(stop('a'),[stop('b','15:40','16:00',{timeZoneId:undefined})]).length,0)
})
test('invalid route order is exposed without rewriting route',()=>{
 const calls=[stop('a'),stop('b','10:00','11:00')],before=JSON.stringify(calls),issues=r.routeOrderViolations({stops:calls})
 assert.equal(issues.length,1);assert.equal(issues[0].clientKey,'b');assert.equal(JSON.stringify(calls),before)
})
test('shortening a call identifies its affected tour and preserves entries',()=>{
 const call=stop('a','15:30','16:40',{allAboardTime:'16:30'}),tour={clientKey:'tour-a',title:'Tour test',kind:'SHORE_EXCURSION',stopClientKey:'a',startDayNumber:1,endDayNumber:1,plannedStartTime:'15:40',plannedEndTime:'16:30'},other={...tour,clientKey:'tour-b',stopClientKey:'b'}
 assert.equal(r.linkedTourViolations(call,content([call],[tour,other])).length,0)
 const changed={...call,plannedDepartureTime:'16:20',allAboardTime:'16:10'},before=JSON.stringify(tour),issues=r.linkedTourViolations(changed,content([changed],[tour,other]))
 assert.equal(issues.length,1);assert.equal(issues[0].clientKey,'tour-a');assert.equal(JSON.stringify(tour),before)
})
test('safe list return retains filters and rejects external destinations',()=>{
 assert.equal(p.preparationSection('resources'),'resources');assert.equal(p.preparationSection('fake'),'overview')
 assert.equal(p.cruiseListReturn('/admin/cruises?status=DRAFT&page=2'),'/admin/cruises?status=DRAFT&page=2')
 for(const url of ['https://evil.test/admin/cruises','//evil.test/admin/cruises','javascript:alert(1)','/admin/bookings'])assert.equal(p.cruiseListReturn(url),'/admin/cruises')
})
test('unknown evidence remains a preparation problem',()=>{
 const checks=[{key:'SHIP',state:'BLOCKED'},{key:'SCHEDULE',state:'PASS'},{key:'ITINERARY',state:'UNKNOWN'}]
 assert.equal(p.preparationProblems({readiness:{checks}}).length,2);assert.equal(p.preparationIssueSection(checks[0]),'resources');assert.equal(p.preparationIssueSection(checks[2]),'schedule')
})
test('mapper preserves technical enums, sources and revision without inventing API fields',()=>{
 const mapper=load('features/trip-planning/api/mappers.ts'),entry={clientKey:'e',kind:'SERVING_WINDOW',sourceId:'service-id',startDayNumber:2,endDayNumber:2,plannedStartTime:'09:00',plannedEndTime:'18:00',timeZoneId:'Asia/Ho_Chi_Minh',title:'Serving test'}
 const payload=mapper.contentRequest({revision:9},content([stop('a')],[entry]))
 assert.equal(payload.expectedRevision,9);assert.equal(payload.entries[0].kind,'SERVING_WINDOW');assert.equal(payload.entries[0].serviceId,'service-id');assert.equal(payload.entries[0].plannedStartTime,'09:00:00')
 assert.equal(payload.stops[0].timeZoneId,undefined);assert.equal(payload.sourceVersionId,undefined);assert.equal(payload.entries[0].reservationId,undefined)
})

test('read-only roles see only sections supported by their permissions',()=>{
 const access=permissions=>({has:permission=>permissions.includes(permission),canDo:()=>false})
 assert.deepEqual(Array.from(p.allowedDepartureSections(access([])),([key])=>key),['overview'])
 assert.deepEqual(Array.from(p.allowedDepartureSections(access(['SHIP_READ'])),([key])=>key),['overview','resources'])
 assert.deepEqual(Array.from(p.allowedDepartureSections(access(['ITINERARY_READ','CRUISE_MANIFEST_READ'])),([key])=>key),['overview','schedule','sales'])
})

test('readiness access alone does not expose ship or sales sections',()=>{
 const access={has:()=>false,canDo:permission=>permission==='CRUISE_VALIDATE'}
 assert.deepEqual(Array.from(p.allowedDepartureSections(access),([key])=>key),['overview','checks'])
})

test('shore tour before arrival points at start time; late return points at end time',()=>{
 const call=stop('a'),tour={clientKey:'tour',kind:'SHORE_EXCURSION',stopClientKey:'a',title:'Tour test',startDayNumber:1,endDayNumber:1,plannedStartTime:'15:00',plannedEndTime:'16:00'}
 let issue=r.linkedTourViolations(call,content([call],[tour]))[0]
 assert.equal(issue.field,'plannedStartTime');assert.equal(issue.fieldPath,'entries[clientKey=tour].plannedStartTime')
 issue=r.linkedTourViolations(call,content([call],[{...tour,plannedStartTime:'15:40',plannedEndTime:'17:00'}]))[0]
 assert.equal(issue.field,'plannedEndTime');assert.equal(issue.fieldPath,'entries[clientKey=tour].plannedEndTime')
})
