import test from 'node:test'
import assert from 'node:assert/strict'
import { createRegistrationStore, importScope, prepareImport } from '../src/features/ship-model-viewer/import/registration-store.ts'
import { emptySession, restoreSession, importStage } from '../src/features/ship-model-viewer/import/model.ts'
import { previewFingerprint } from '../src/features/ship-model-viewer/import/preview-proof.ts'
import { shipImportApi } from '../src/features/ship-model-viewer/import/api.ts'
import { isPassengerDeckCount, manifestPassengerDeckCountError, passengerDeckCountError } from '../src/shared/lib/ship-deck-count.ts'
import { setSessionAccess } from '../src/shared/auth/session-access.ts'
import { setApiAccessToken } from '../src/shared/api/client.ts'
test('passenger deck count accepts integers from 8 to 24', () => {
  for (const value of [8, 12, 24]) assert.equal(isPassengerDeckCount(value), true)
  for (const value of [7, 25, 8.5, null, '8']) assert.equal(isPassengerDeckCount(value), false)
})

test('manifest count permits partial structure but rejects a contradictory count', () => {
  assert.equal(manifestPassengerDeckCountError(12, 9), '')
  assert.equal(manifestPassengerDeckCountError(8, 9), 'Số boong khai báo ít hơn số boong hành khách trong mô hình.')
  assert.equal(manifestPassengerDeckCountError(25, 8), passengerDeckCountError)
})

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const registration={shipId:uuid(2),shipModelId:uuid(3),shipCreated:true}
const manifest={modelId:'same-model',name:'Fixture ship',passengerCapacity:20,deckCount:1,decks:[],cabins:[]}
class MemoryStorage {
  rows=new Map()
  get length(){return this.rows.size}
  key(i){return [...this.rows.keys()][i]??null}
  getItem(k){return this.rows.get(k)??null}
  setItem(k,v){this.rows.set(k,String(v))}
  removeItem(k){this.rows.delete(k)}
}
function fixture(){
  const local=new MemoryStorage(),tab=new MemoryStorage(),scope=importScope(uuid(1),'/api','https://admin.test')
  const store=createRegistrationStore(scope,uuid(1),local,tab)
  return {local,tab,scope,store,draft:{...emptySession,modelKey:'same-model',fileName:'same.zip'}}
}
async function prepared(f){return prepareImport(f.draft,new File(['zip'],'same.zip'),f.store,async()=>{})}
async function confirmed(f){return {...await prepared(f),previewFingerprint:await previewFingerprint(manifest)}}
test('new ZIP with legacy successful modelKey registration uploads and stays at confirmation',async()=>{
  const f=fixture();f.local.setItem(`ocevie:ship-import:${uuid(1)}:register:${JSON.stringify(['same-model'])}`,JSON.stringify(registration))
  let uploads=0;const draft=await prepareImport(f.draft,new File(['new ZIP'],'same.zip'),f.store,async()=>{uploads++})
  assert.equal(uploads,1);assert.equal(draft.registration,null);assert.equal(importStage(draft,false),1)
})
test('same filename and modelKey replacement receives a fresh attempt',async()=>{
  const f=fixture(),old=await confirmed(f);f.store.registered(old,registration)
  const next=await prepared(f);assert.notEqual(next.attemptId,old.attemptId);assert.equal(next.registration,null)
})
test('reload retains known IDs but cannot unlock structure without backend verification',async()=>{
  const f=fixture(),old=await confirmed(f);f.store.pending(old);f.store.registered(old,registration)
  const next=f.store.restore();assert.deepEqual(next.draft.registration,registration);assert.equal(next.pending,false)
  assert.equal(importStage(next.draft,false),1);assert.equal(importStage(next.draft,true),2)
})
test('backend and account switches isolate known registrations',async()=>{
  const f=fixture(),old=await confirmed(f);f.store.registered(old,registration)
  for(const scope of [importScope(uuid(1),'https://other.test/api','https://admin.test'),importScope(uuid(4),'/api','https://admin.test')]){
    const store=createRegistrationStore(scope,uuid(4),f.local,f.tab)
    assert.equal(store.restore().draft.uploaded,false);assert.equal(restoreSession(JSON.stringify(old),scope),null)
  }
})
test('malformed stale session and journal never become verified',async()=>{
  const f=fixture();f.tab.setItem(f.store.key,'bad json');assert.equal(f.store.restore().draft.uploaded,false)
  f.local.setItem(f.store.registerKey(f.draft.modelKey),'{broken');assert.equal(f.store.read(f.draft).pending,true)
  await assert.rejects(prepared(f));assert.equal(importStage({...f.draft,uploaded:true,registration},false),1)
})
test('lost registration response survives reload and prevents replacement upload or retry',async()=>{
  const f=fixture(),old=await confirmed(f);f.store.pending(old)
  assert.equal(f.store.restore().pending,true);await assert.rejects(prepared(f));assert.throws(()=>f.store.pending(old))
})
test('known result from another tab recovers only the exact attempt',async()=>{
  const f=fixture(),old=await confirmed(f);f.store.pending(old);f.store.registered(old,registration)
  assert.deepEqual(f.store.read(old).draft.registration,registration)
  assert.equal(f.store.read({...old,attemptId:uuid(9),registration:null}).draft.registration,null)
})
test('a later completed attempt cannot erase an older known result and permit duplicate creation',async()=>{
  const f=fixture(),old=await confirmed(f);f.store.registered(old,registration)
  const newer=await confirmed(f);f.store.registered(newer,{...registration,shipId:uuid(7),shipModelId:uuid(8)})
  assert.deepEqual(f.store.read({...old,registration:null}).draft.registration,registration)
})
test('API scope canonicalizes relative endpoints and separates different backend paths',()=>{
  assert.equal(importScope(uuid(1),'/api/','https://admin.test'),importScope(uuid(1),'https://admin.test/api','https://ignored.test'))
  assert.notEqual(importScope(uuid(1),'/api','https://admin.test'),importScope(uuid(1),'/other/api','https://admin.test'))
  assert.throws(()=>importScope(uuid(1),'https://user:password@api.test','https://admin.test'))
})
test('legacy uncertain outcomes block both old cache formats',async()=>{
  for(const parts of [['same-model'],['same-model','zip-version']]){
    const f=fixture();f.local.setItem(`ocevie:ship-import:${uuid(1)}:register:${JSON.stringify(parts)}`,'pending');await assert.rejects(prepared(f))
  }
})
test('rejected registration clears only its own intent; known outcome stays recoverable',async()=>{
  const f=fixture(),old=await confirmed(f);f.store.pending(old);f.store.rejected({...old,attemptId:uuid(9)})
  assert.equal(f.store.read(old).pending,true);f.store.rejected(old);assert.equal(f.store.read(old).pending,false)
})
test('storage failure prevents mutation intent from being accepted',async()=>{
  const f=fixture(),old=await confirmed(f);f.tab.setItem=()=>{throw Error('quota')}
  assert.throws(()=>f.store.pending(old));assert.equal(f.local.getItem(f.store.registerKey(old.modelKey)),null)
})
test('preview proof ignores root revision and object ordering, detects changed structure',async()=>{
  const hash=await previewFingerprint(manifest)
  assert.equal(hash,await previewFingerprint({revision:999,...manifest}))
  assert.equal(await previewFingerprint({a:{b:2,a:1}}),await previewFingerprint({a:{a:1,b:2}}))
  assert.notEqual(hash,await previewFingerprint({...manifest,cabins:[{deckId:'d',cabinNumber:'01'}]}))
})
setSessionAccess({status:'ready',userId:uuid(1),roles:['ADMIN'],permissions:['SHIP_READ','SHIP_MODEL_READ'],error:''})
setApiAccessToken('fixture-token')
const originalFetch=globalThis.fetch
function transport({missingModel=false,wrongModel=false,wrongManifest=false,emptyShip=false}={}){
  const calls=[]
  globalThis.fetch=async url=>{
    const p=String(url);calls.push(p)
    if(p.endsWith('/manifest.json')) return new Response(JSON.stringify({...manifest,...(wrongManifest?{name:'Different ship'}:{}),revision:2}),{status:200})
    let data=p.includes('/models/')?{id:wrongModel?uuid(5):registration.shipModelId,modelKey:'same-model',status:'DRAFT'}:{shipId:registration.shipId,shipName:emptyShip?'':'Fixture ship',shipCode:'SH001',totalCapacity:20,totalDecks:1}
    const status=missingModel&&p.includes('/models/')?404:200
    return new Response(JSON.stringify({success:status===200,data,message:status===404?'Ship model not found':undefined}),{status,headers:{'Content-Type':'application/json'}})
  }
  return calls
}
for(const [name,options] of [['missing model',{missingModel:true}],['wrong model',{wrongModel:true}],['mismatched manifest',{wrongManifest:true}],['missing ship details',{emptyShip:true}]]){
  test(`backend validation rejects ${name} before structure unlock`,async()=>{
    const f=fixture(),draft={...await confirmed(f),registration};const calls=transport(options)
    try{await assert.rejects(shipImportApi.verifyRegistration(draft,new AbortController().signal));assert.ok(calls.length>0)}finally{globalThis.fetch=originalFetch}
  })
}
test('valid ship/model relationship and immutable manifest permit structure',async()=>{
  const f=fixture(),draft={...await confirmed(f),registration};const calls=transport()
  try{assert.deepEqual(await shipImportApi.verifyRegistration(draft,new AbortController().signal),registration);assert.equal(calls.length,3)}finally{globalThis.fetch=originalFetch}
})
