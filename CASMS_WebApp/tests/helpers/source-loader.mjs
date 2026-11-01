import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../src/', import.meta.url))
const nativeRequire = createRequire(import.meta.url)

/** Load real source and its dependencies, preserving explicit test doubles.
 * Vite aliases and import.meta.env are build-time syntax, not Node VM globals.
 * No API replies, session grants or domain results are supplied by this loader.
 */
export function sourceLoader(imports = {}, globals = {}) {
  const cache = new Map()
  const environment = {
    console, Date, Intl, URL, URLSearchParams, Error, AbortController,
    structuredClone, crypto: globalThis.crypto, setTimeout, clearTimeout,
    TextEncoder, TextDecoder, FormData, Headers, Request, Response,
    fetch: (...args) => globalThis.fetch(...args), ...globals,
  }
  environment.globalThis = new Proxy(globalThis, {
    get(target, key) { return Object.hasOwn(environment, key) ? environment[key] : Reflect.get(target, key) },
  })
  function load(relative) {
    let file = relative instanceof URL ? fileURLToPath(relative) : path.resolve(root, relative)
    if (!existsSync(file) || !path.extname(file)) {
      file = [file + '.ts', file + '.tsx', file + '.json', path.join(file, 'index.ts'), path.join(file, 'index.tsx')].find(existsSync) ?? file
    }
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    if (file.endsWith('.json')) {
      module.exports = JSON.parse(readFileSync(file, 'utf8'))
      return module.exports
    }
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, resolveJsonModule: true },
      transformers: { before: [context => {
        const visit = node => ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword
          ? ts.factory.createIdentifier('__sourceImportMeta')
          : ts.visitEachChild(node, visit, context)
        return node => ts.visitNode(node, visit)
      }] },
    }).outputText
    const resolve = id => {
      if (Object.hasOwn(imports, id)) {
        if (id === '@/shared/api') return { ApiError: load('shared/api/client.ts').ApiError, ...imports[id] }
        if (id === '@/shared/auth') return { ...load('shared/auth/permission-policy.ts'), ...load('shared/auth/work-policy.ts'), ...imports[id] }
        return imports[id]
      }
      if (id.endsWith('.css')) return { default: {} }
      if (id.startsWith('@/')) return load(id.slice(2))
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id))
      return nativeRequire(id)
    }
    const execute = vm.compileFunction(source, ['module', 'exports', 'require', '__sourceImportMeta', ...Object.keys(environment)], { filename: file })
    execute(module, module.exports, resolve, { env: { DEV: false, MODE: 'test', ...globals.__env }, url: pathToFileURL(file).href }, ...Object.values(environment))
    return module.exports
  }
  return load
}

export function loadSource(file, imports = {}, globals = {}) {
  return sourceLoader(imports, globals)(file)
}
