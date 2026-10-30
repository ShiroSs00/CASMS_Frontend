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
