import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path,imports={}){
 const module={exports:{}}
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/features/ship-deck-cabin/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module,exports:module.exports,require:key=>{assert.ok(Object.hasOwn(imports,key),key);return imports[key]}})
 return module.exports
}
const model=load('model/ship-areas.ts')
const facility=(id,deckId='d1')=>({objectId:id,modelNodeKey:id,name:'Phòng tập',kind:'gym',deckId,position:{x:0,y:-2,z:3},rotation:null,scale:{x:1,y:1,z:1},dimensions:{x:8,y:3,z:10},metadataJson:'{"source":"model"}'})
const config=()=>({shipId:'s1',shipName:'Tàu 1',configurationVersion:'rev-1',model:{unit:'m'},decks:[
 {deckId:'d1',modelNodeKey:'D0',deckNumber:0,name:'Kỹ thuật',serviceLevel:true,facilities:[facility('gym')]},
 {deckId:'d2',modelNodeKey:'D1',deckNumber:1,name:'Boong 1',serviceLevel:false,facilities:[{...facility('lounge','d2'),name:'Ocean Lounge',kind:'lounge'}]},
]})
test('areas follow BE facilities, including physical service decks, dimensions and metadata',()=>{
 const result=model.decodeShipAreas(config(),'s1')
 assert.equal(result.supported,true);assert.equal(result.areas.length,2)
 assert.equal(result.areas[0].deckNumber,0);assert.equal(result.areas[0].serviceLevel,true)
 assert.equal(result.areas[0].position.x,0);assert.equal(result.areas[0].position.y,-2)
 assert.equal(result.areas[0].dimensions.z,10);assert.equal(result.unit,'m')
 assert.equal(result.areas[0].metadataJson,'{"source":"model"}')
})
test('rejects cross-ship configurations and facilities assigned to another deck',()=>{
 assert.throws(()=>model.decodeShipAreas(config(),'s2'))
 const value=config();value.decks[0].facilities[0].deckId='d2'
 assert.throws(()=>model.decodeShipAreas(value,'s1'))
})
test('rejects duplicate area identities and malformed coordinates instead of rendering corrupt geometry',()=>{
 const duplicate=config();duplicate.decks[1].facilities[0].objectId='gym'
 assert.throws(()=>model.decodeShipAreas(duplicate,'s1'))
 for(const position of [{x:NaN,y:1,z:2},{x:'0',y:1,z:2},{x:0,y:1}]){
  const value=config();value.decks[0].facilities[0].position=position
  assert.throws(()=>model.decodeShipAreas(value,'s1'))
 }
})
test('an older BE without facilities is distinguished from a supported empty model',()=>{
 const old=config();delete old.decks[0].facilities
 assert.equal(model.decodeShipAreas(old,'s1').supported,false)
 const empty=config();empty.decks.forEach(deck=>deck.facilities=[])
 const result=model.decodeShipAreas(empty,'s1');assert.equal(result.supported,true);assert.equal(result.areas.length,0)
})
test('nullable geometry and unknown area kinds are retained without invented values',()=>{
 const value=config();Object.assign(value.decks[0].facilities[0],{kind:'future-area',position:null,dimensions:null})
 const area=model.decodeShipAreas(value,'s1').areas[0]
 assert.equal(area.position,null);assert.equal(area.dimensions,null);assert.equal(model.areaKindLabel(area.kind),'future-area')
})
test('search is accent insensitive, filters intersect and do not mix decks',()=>{
 const areas=model.decodeShipAreas(config(),'s1').areas
 assert.equal(model.filterShipAreas(areas,'phong tap','','').length,1)
 assert.equal(model.filterShipAreas(areas,'','d1','lounge').length,0)
 assert.equal(model.filterShipAreas(areas,'ocean','d2','lounge').length,1)
 assert.equal(model.filterShipAreas(areas,'missing','','').length,0)
})
test('adapter reads exactly the ship configuration endpoint and forwards cancellation',async()=>{
 const calls=[],signal=new AbortController().signal
 const {readShipAreas}=load('api/ship-areas-api.ts',{'../model/ship-areas':model,'@/shared/api':{apiRequest:async(path,options)=>{calls.push({path,options});return config()}}})
 const data=await readShipAreas('s1',signal)
 assert.equal(data.areas.length,2);assert.equal(calls.length,1)
 assert.equal(calls[0].path,'/ships/s1/3d-configuration');assert.equal(calls[0].options.signal,signal)
 assert.equal(calls[0].options.method,undefined)
})

const mappings=()=>[
 {objectId:'deck-object',shipModelId:'m1',nodeKey:'D0',objectType:'DECK',deckId:'d1',metadataJson:JSON.stringify({id:'D0',name:'Kỹ thuật',number:0})},
 {objectId:'gym',shipModelId:'m1',nodeKey:'gym-node',objectType:'FACILITY',deckId:'d1',position:{x:3,y:0,z:1},rotation:null,scale:{x:1,y:1,z:1},metadataJson:JSON.stringify({id:'gym-node',name:'Phòng tập',kind:'gym',size:[8,3,10]})},
]
test('draft areas come from persisted FACILITY mappings with matching model and deck identities',()=>{
 const data=model.decodeImportedAreas(mappings(),'s1','m1','conquest@v10','metre')
 assert.equal(data.draftVersion,'conquest@v10');assert.equal(data.areas.length,1)
 assert.equal(data.areas[0].position.x,3);assert.equal(data.areas[0].dimensions.z,10)
 assert.throws(()=>model.decodeImportedAreas(mappings(),'s1','another-model','v10','m'))
 const foreign=mappings();foreign[1].deckId='other-deck'
 assert.throws(()=>model.decodeImportedAreas(foreign,'s1','m1','v10','m'))
 const corrupt=mappings();corrupt[1].metadataJson=JSON.stringify({id:'another-node',name:'Gym',kind:'gym',size:[1,2,3]})
 assert.throws(()=>model.decodeImportedAreas(corrupt,'s1','m1','v10','m'))
})
test('only model-not-ready permits draft reads, and only with effective model read access',async()=>{
 class ApiError extends Error {constructor(code,status=409){super(code);this.code=code;this.status=status}}
 const signal=new AbortController().signal,calls=[]
 let failure=new ApiError('SHIP_MODEL_NOT_READY')
 const {readShipAreas}=load('api/ship-areas-api.ts',{'../model/ship-areas':model,'@/shared/api':{ApiError,apiRequest:async(path,options)=>{
  calls.push({path,options})
  if(path.endsWith('/3d-configuration'))throw failure
  if(path.endsWith('/models'))return [{shipId:'s1',shipModelId:'m1',version:'v10',status:'DRAFT',coordinateUnit:'metre',createdAt:'2026-10-30T00:00:00Z'}]
  if(path.endsWith('/m1/objects'))return mappings()
  assert.fail(path)
 }}})
 await assert.rejects(readShipAreas('s1',signal),/SHIP_MODEL_NOT_READY/)
 assert.equal(calls.length,1);calls.length=0
 assert.equal((await readShipAreas('s1',signal,true)).areas.length,1)
 assert.deepEqual(calls.map(c=>c.path),['/ships/s1/3d-configuration','/ships/s1/models','/ships/s1/models/m1/objects'])
 assert.ok(calls.every(c=>c.options.signal===signal))
 for(const code of ['FORBIDDEN','SERVER_ERROR']){calls.length=0;failure=new ApiError(code,code==='FORBIDDEN'?403:500);await assert.rejects(readShipAreas('s1',signal,true));assert.equal(calls.length,1)}
})
