import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
function client(fetch) {
  const source=readFileSync(new URL('../../src/shared/api/client.ts',import.meta.url),'utf8').replaceAll('import.meta.env','({})'),module={exports:{}}
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module,exports:module.exports,fetch,AbortController,Uint8Array,FormData,URLSearchParams,setTimeout,clearTimeout,require:()=>({prepareCreateBody:(_path,_method,body)=>body})})
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
  await assert.rejects(api.apiAsset(path,controller.signal),e=>e.name==='AbortError')
})
