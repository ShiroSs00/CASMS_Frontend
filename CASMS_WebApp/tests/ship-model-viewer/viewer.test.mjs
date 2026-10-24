import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
function load(path,imports={}) {const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module,exports:module.exports,URLSearchParams,TextDecoder,require:id=>{assert.ok(id in imports,id);return imports[id]}});return module.exports}
const model=load('features/ship-model-viewer/model.ts')
test('asset references remain inside the selected ship/version and reject traversal and external URLs',()=>{
  assert.equal(model.assetPath('ship 1','version 2','decks/deck_01.glb'),'/ships/ship%201/models/version%202/assets/decks/deck_01.glb')
  for(const file of ['../ship.glb','https://outside.test/a.glb','//outside.test/a.glb','/ship.glb','decks/%2e%2e/ship.glb','decks/./ship.glb','decks\\ship.glb','ship.glb?token=x','ship.html'])assert.throws(()=>model.assetPath('s','m',file))
})
const manifest={assets:{exterior:'exterior.glb'},decks:[{id:'d1',number:1,asset:'decks/d1.glb'},{id:'d2',number:2,asset:'decks/d2.glb'}],cabins:[{id:'c1',nodeName:'CABIN_1',deckId:'d1',cabinNumber:'C01-001',cabinType:'SUITE'},{id:'c2',nodeName:'CABIN_2',deckId:'d2',cabinNumber:'C02-002',cabinType:'INTERIOR'}]}
test('manifest identity is required and cabin filtering preserves source geometry',()=>{
  assert.equal(model.decodeManifest(manifest),manifest)
  assert.throws(()=>model.decodeManifest({...manifest,cabins:[{id:'c',deckId:'d1'}]}))
  assert.throws(()=>model.decodeManifest({...manifest,decks:null}))
  const before=JSON.stringify(manifest)
  assert.equal(model.selectedCabins(manifest,'d1',' suite ').length,1)
  assert.equal(model.selectedCabins(manifest,'d2','C01').length,0)
  assert.equal(JSON.stringify(manifest),before)
})
test('model viewer is restricted to Admin with effective read permission',()=>{
  const nav=load('shared/ui/admin-v3/admin-navigation.ts')
  const access={status:'ready',permissions:['SHIP_MODEL_READ','SHIP_READ']}
  assert.equal(nav.canRoleOpenAdminPath(['ADMIN'],'/admin/ship-models','',access),true)
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'],'/admin/ship-models','',access),false)
  assert.equal(nav.canRoleOpenAdminPath(['ADMIN'],'/admin/ship-models','',{status:'ready',permissions:[]}),false)
  assert.ok(nav.roleNavigationItems(['ADMIN'],access).some(x=>x.to==='/admin/ship-models'))
})
test('asset metadata uses actual backend id/revision fields and rejects a stale model',()=>{
  const dto={id:'v1',revision:'whole-ship-corridors-v10',cabinCount:305,mappedCabinCount:305,deckCount:15,mappedDeckCount:15}
  assert.equal(model.decodeAsset(dto,'v1').revision,'whole-ship-corridors-v10')
  assert.throws(()=>model.decodeAsset(dto,'v2'))
  assert.throws(()=>model.decodeAsset({...dto,deckCount:-1},'v1'))
})
test('ship choices retrieve all pages and use cancellation',async()=>{
  const calls=[];const signal=new AbortController().signal
  const {viewerApi}=load('features/ship-model-viewer/api.ts',{'./model':model,'@/shared/api':{apiRequest:async(path,options)=>{calls.push({path,...options});return {content:[{shipId:'s'+options.query.page}],totalPages:2}},apiAsset:()=>{throw Error('Unexpected asset read')}}})
  assert.equal((await viewerApi.ships(signal)).length,2)
  assert.ok(calls.every(c=>c.signal===signal&&c.path==='/ships'))
})
