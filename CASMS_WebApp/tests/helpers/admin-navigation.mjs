import {readFileSync} from 'node:fs'
import {URL,URLSearchParams} from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import {permissionPolicy} from './permission-policy.mjs'

function compile(file,imports={}){
 const module={exports:{}}
 const source=ts.transpileModule(readFileSync(new URL('../../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
 vm.runInNewContext(source,{module,exports:module.exports,URL,URLSearchParams,require(id){
  if(Object.hasOwn(imports,id))return imports[id]
  throw new Error('Unexpected navigation dependency: '+id)
 }})
 return module.exports
}
// Use the production permission/work-scope logic. No role-to-grant fallback in the harness.
export const authPolicy={...permissionPolicy,...compile('shared/auth/work-policy.ts')}
export const copyPolicy=compile('shared/i18n/business-copy.ts',{'./vi-business-map.json':JSON.parse(readFileSync(new URL('../../src/shared/i18n/vi-business-map.json',import.meta.url),'utf8'))})
export const navigation=compile('shared/ui/admin-v3/admin-navigation.ts',{'@/shared/auth':authPolicy,'@/shared/i18n/business-copy':copyPolicy})
