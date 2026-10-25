import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { URL } from 'node:url'
import ts from 'typescript'

export const apiRules = JSON.parse(readFileSync(new URL('../../src/shared/auth/api-permissions.json', import.meta.url), 'utf8'))
const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/shared/auth/permission-policy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText, { module, exports: module.exports, require(id) {
  if (id === './api-permissions.json') return apiRules
  throw new Error('Unexpected policy import: ' + id)
} })
export const permissionPolicy = module.exports
