import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {permissionPolicy} from './permission-policy.mjs'
import {loadSource} from './source-loader.mjs'
const copy=JSON.parse(readFileSync(new URL('../../src/shared/i18n/vi-business-map.json',import.meta.url),'utf8'))
const time={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/shared/lib/journey-time.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module:time,exports:time.exports,Date,Intl})
const work={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/shared/auth/work-policy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module:work,exports:work.exports})
export function explicitTestAccess(roles,permissions){
 const access={status:'ready',userId:'test-user',roles,permissions}
 return {...access,has:permission=>permissionPolicy.hasPermissions(access,{mode:'ALL',permissions:[permission]}),canDo:permission=>permissionPolicy.hasPermissions(access,{mode:'ALL',permissions:[permission]})&&work.exports.actionInWorkScope(roles,permission)}
}
export const pureAuthPolicy={...permissionPolicy,...work.exports}
/** Render the real protected link using explicit role/grant fixtures. */
export function permissionLinkFor(roles,permissions){
 const jsx=(type,props)=>({type,props})
 return loadSource('shared/ui/PermissionLink.tsx',{
  react:{useContext:()=>roles},'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-router':{Link:'Link',useResolvedPath:to=>{const url=new URL(to,'https://fixture.invalid');return {pathname:url.pathname,search:url.search}}},
  '@/shared/auth':{useSessionAccess:()=>explicitTestAccess(roles,permissions)},
  './admin-v3/admin-account-context':{AdminRoleContext:{}},
 }).PermissionLink
}
/** Actual pure production helpers; cancellation tests still control every API promise. */
export function reviewedSourceModule(id){
 if(id==='@/shared/i18n/business-copy')return {businessCopy:key=>copy[key],domainStatus:(domain,status)=>copy[`${domain}.${status}`]??'Chưa xác định'}
 if(id==='@/domain/trip-duration')return loadSource('domain/trip-duration/index.ts')
 if(id==='@/shared/lib/journey-time')return time.exports
 const pureFiles={'@/shared/lib/mutation-outcome':'shared/lib/mutation-outcome.ts','../model/create-intent':'features/cruises/model/create-intent.ts','../model/creation-return':'features/cruises/model/creation-return.ts','../api/source-version':'features/cruises/api/source-version.ts'}
 if(pureFiles[id]){
  const module={exports:{}}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/'+pureFiles[id],import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module,exports:module.exports,structuredClone,require(name){if(name==='@/domain/trip-duration')return loadSource('domain/trip-duration/index.ts');if(name==='@/shared/api')return {ApiError:Error,apiRequest(){throw Error('Unexpected source API in isolated legacy cancellation test')}};throw Error('Unexpected pure-helper import '+name)}})
  return module.exports
 }
 return undefined
}
