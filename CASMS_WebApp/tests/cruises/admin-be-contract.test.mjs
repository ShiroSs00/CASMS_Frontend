import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(file,imports={}) {
  const module={exports:{}}
  const source=ts.transpileModule(readFileSync(new URL('../../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
  vm.runInNewContext(source,{module,exports:module.exports,Date,Intl,Error,require:id=>{assert.ok(Object.hasOwn(imports,id),id);return imports[id]}})
  return module.exports
}
class ApiError extends Error {constructor(message,status){super(message);this.status=status}}
const validation=load('features/cruises/model/cruise-validation.ts')
function client(handler){
  const calls=[]
  const api=load('features/cruises/api/cruise-api.ts',{'../model/cruise-validation':validation,'@/shared/api':{ApiError,apiRequest:async(path,options={})=>{calls.push({path,...options});return handler(path,options)}}}).cruiseApi
  return {api,calls}
}
const port=id=>({portId:id,portName:'Cảng '+id,countryCode:'VN',timeZoneId:'Asia/Ho_Chi_Minh',status:'ACTIVE'})
const draft={cruiseCode:' ',cruiseName:' Chuyến thử ',cruiseType:'',departureDatetime:'2027-01-01T08:00',returnDatetime:'2027-01-10T18:00',departurePortId:'port-a',returnPortId:'port-d'}

test('create sends scalar endpoint ports, Vietnam instants and lets BE infer omitted optional fields',async()=>{
  const {api,calls}=client((path,options)=>({cruiseId:'saved',...options.body,status:'DRAFT'}))
  await api.createCruise({...draft,shipId:'not-an-assignment',status:'PUBLISHED',returnPortIds:['not-a-BE-field']})
  assert.equal(calls.length,1)
  assert.equal(calls[0].path,'/cruise');assert.equal(calls[0].method,'POST')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)),{cruiseName:'Chuyến thử',departureDatetime:'2027-01-01T01:00:00.000Z',returnDatetime:'2027-01-10T11:00:00.000Z',departurePortId:'port-a',returnPortId:'port-d'})
  assert.equal(validation.localCruiseInput('2027-01-01T01:00:00Z'),'2027-01-01T08:00')
})

test('draft PATCH excludes generated code and ship assignment; explicit type follows BE DTO',async()=>{
  const {api,calls}=client((path,options)=>({cruiseId:'saved',...options.body,status:'DRAFT'}))
  await api.updateCruise('saved',{...draft,cruiseCode:'CUSTOM-CODE',cruiseType:'MULTI_DAYS'})
  assert.equal(calls[0].path,'/cruise/saved/draft');assert.equal(calls[0].method,'PATCH')
  assert.equal(calls[0].body.cruiseCode,undefined);assert.equal(calls[0].body.shipId,undefined)
  assert.equal(calls[0].body.cruiseType,'MULTI_DAYS');assert.equal(calls[0].body.returnPortId,'port-d')
})

test('both endpoint selectors receive all active ports without filtering the return against departure',async()=>{
  const values=['a','b','c','d'].map(port)
  const {api,calls}=client(()=>values)
  const ports=await api.listPorts()
  assert.equal(calls[0].path,'/ports/active')
  assert.equal(ports.length,4)
  assert.deepEqual(Array.from(ports,item=>item.portId).sort(),values.map(item=>item.portId).sort())
  assert.ok(ports.some(item=>item.portId==='a'),'round trips are supported')
})

test('broken or failed active-port responses never become a successful empty choice list',async()=>{
  for(const value of [null,{},[{}],[port('a'),port('a')]]) await assert.rejects(client(()=>value).api.listPorts(),/danh sách cảng/)
  await assert.rejects(client(()=>{throw new ApiError('403 ports unavailable',403)}).api.listPorts(),/403/)
})

test('ship choice lookup fetches every Spring page and rejects malformed paging',async()=>{
  const signal=new AbortController().signal
  const {api,calls}=client((path,options)=>({content:[{shipId:'ship-'+options.query.page}],totalPages:3}))
  assert.equal((await api.listShips(signal)).length,3)
  assert.deepEqual(calls.map(call=>call.query.page),[0,1,2])
  assert.ok(calls.every(call=>call.signal===signal))
  await assert.rejects(client(()=>({content:[],totalPages:undefined})).api.listShips(),/phân trang/)
})

test('cruise rows remain available when an independent ship supplement is forbidden',async()=>{
  const row={cruiseId:'c',shipId:'s',cruiseName:'Chuyến có thật',departurePortId:'a',returnPortId:'b',status:'PUBLISHED'}
  const {api}=client(path=>{
    if(path==='/cruise')return{content:[row],totalPages:1,totalElements:1,number:0,size:4}
    if(path==='/ships/s')throw new ApiError('403 ship',403)
    if(path.endsWith('/readiness'))throw new ApiError('403 readiness',403)
    throw new Error(path)
  })
  const result=await api.list({page:1,pageSize:4})
  assert.equal(result.items.length,1);assert.equal(result.items[0].cruise.cruiseName,row.cruiseName)
  assert.equal(result.items[0].ship,null);assert.equal(result.metrics.conflict,undefined)
})
