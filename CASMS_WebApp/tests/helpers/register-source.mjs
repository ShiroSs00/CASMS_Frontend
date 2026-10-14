import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

// Exercise actual FE modules without installing another test runner.
const source = new URL('../../src/', import.meta.url)
registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = specifier.startsWith('@/') ? new URL(specifier.slice(2), source)
      : specifier.startsWith('.') ? new URL(specifier, context.parentURL) : null
    if (url) {
      for (const suffix of ['', '.ts', '/index.ts']) {
        const candidate = new URL(url.href + suffix)
        if (candidate.pathname.endsWith('.ts') && existsSync(fileURLToPath(candidate))) {
          return nextResolve(candidate.href, context)
        }
      }
    }
    return nextResolve(specifier, context)
  },
})
