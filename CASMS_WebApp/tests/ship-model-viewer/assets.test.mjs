import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { apiRules, permissionPolicy } from '../helpers/permission-policy.mjs'
function client(fetch, access = { status: 'ready', permissions: apiRules.flatMap(rule => rule.permissions) }) {
  const source=readFileSync(new URL('../../src/shared/api/client.ts',import.meta.url),'utf8').replaceAll('import.meta.env','({})'),module={exports:{}}
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module,exports:module.exports,fetch,AbortController,Uint8Array,FormData,URLSearchParams,setTimeout,clearTimeout,require:id=>id==='@/shared/auth'?{...permissionPolicy,getSessionAccess:()=>access}:{prepareCreateBody:(_path,_method,body)=>body}})
  return module.exports
}
const path='/ships/s1/models/v1/assets/decks/deck_01.glb'
test('binary asset transport authenticates configured API only and reports byte progress',async()=>{
  const calls=[],progress=[]
  const api=client(async(url,options)=>{calls.push({url,options});return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Length':'3'}})})
  api.setApiAccessToken('unit-only-token')
  const bytes=await api.apiAsset(path,new AbortController().signal,(loaded,total)=>progress.push({loaded,total}))
  assert.deepEqual([...new Uint8Array(bytes)],[1,2,3]);assert.equal(calls[0].url,'/api'+path);assert.equal(calls[0].options.headers.Authorization,'Bearer unit-only-token');assert.deepEqual(progress.at(-1),{loaded:3,total:3})
  await assert.rejects(api.apiAsset('https://outside.test/a.glb',new AbortController().signal));assert.equal(calls.length,1)
})
test('asset 401 retires current session and 403 remains a permission error',async()=>{
  let status=401,retired=0
  const api=client(async()=>new Response(null,{status}));api.setApiAccessToken('unit-only-token');api.subscribeApiUnauthorized(()=>retired++)
  await assert.rejects(api.apiAsset(path,new AbortController().signal),e=>e.status===401);assert.equal(retired,1)
  status=403;await assert.rejects(api.apiAsset(path,new AbortController().signal),e=>e.status===403);assert.equal(retired,1)
})
test('completed obsolete asset reads cannot be applied after cancellation',async()=>{
  const controller=new AbortController(),api=client(async()=>{controller.abort();return new Response(new Uint8Array([1]))})
  api.setApiAccessToken('unit-only-token')
  await assert.rejects(api.apiAsset(path,controller.signal),e=>e.name==='AbortError')
})

test('nested model assets follow the actual controller permission and never fetch when denied',async()=>{
  assert.deepEqual(Array.from(permissionPolicy.apiPermissionRequirement(path).permissions),['SHIP_READ'])
  let calls=0
  for(const access of [{status:'loading',permissions:['SHIP_READ']},{status:'ready',permissions:[]}]) {
    const api=client(async()=>{calls++;return new Response(null)},access)
    api.setApiAccessToken('unit-only-token')
    await assert.rejects(api.apiAsset(path,new AbortController().signal),e=>e.status===403)
  }
  assert.equal(calls,0)
})

test('changing session aborts a streaming asset and rejects an obsolete response',async()=>{
  let capturedSignal, release
  const api=client((_url,options)=>{capturedSignal=options.signal;return new Promise(resolve=>{release=resolve})})
  api.setApiAccessToken('old-unit-token')
  const pending=api.apiAsset(path,new AbortController().signal)
  api.setApiAccessToken('new-unit-token')
  assert.equal(capturedSignal.aborted,true)
  release(new Response(new Uint8Array([1])))
  await assert.rejects(pending,e=>e.code==='SESSION_CHANGED')
})

test('multipart upload preserves FormData and custom timeout while using session authorization',async()=>{
  let options
  const api=client(async(_url,value)=>{options=value;return new Response(JSON.stringify({success:true,data:{fileCount:1}}))})
  api.setApiAccessToken('unit-only-token')
  const body=new FormData();body.append('bundle',new Blob(['zip']),'model.zip')
  const result=await api.apiRequest('/ship-model-assets',{method:'POST',body,timeoutMs:60_000})
  assert.equal(result.fileCount,1)
  assert.equal(options.body,body)
  assert.equal(options.headers['Content-Type'],undefined)
  assert.equal(options.headers.Authorization,'Bearer unit-only-token')
})
