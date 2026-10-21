import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('../../src/', import.meta.url)
function load(file, imports, globals = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, Date, AbortController, ...globals, require(id) { assert.ok(Object.hasOwn(imports, id), id); return imports[id] } })
  return module.exports
}
test('Complete: existing auth login/refresh/logout exact methods, anonymous login and typed session DTO', async () => {
  const types = load('features/auth/model/auth-types.ts', {}), dto = load('features/auth/api/dto.ts', { '../model/auth-types': types }), calls = []
  let result = { accessToken: 'fixture-only-token', tokenType: 'Bearer', expiresIn: 3600, userId: 'u', username: 'fixture', roles: ['PASSENGER'] }
  const { authApi } = load('features/auth/api/auth-api.ts', { './dto': dto, '@/shared/api': { apiRequest: async (path, options) => { calls.push({ path, ...options }); return result } } })
  assert.equal((await authApi.login('fixture', 'fixture-only')).user.id, 'u'); assert.equal(calls.at(-1).path, '/auth/login'); assert.equal(calls.at(-1).method, 'POST'); assert.equal(calls.at(-1).authenticated, false); assert.equal(JSON.stringify(calls.at(-1).body), JSON.stringify({ username: 'fixture', password: 'fixture-only' }))
  await authApi.refresh(); assert.equal(calls.at(-1).path, '/auth/refresh'); assert.equal(calls.at(-1).method, 'POST'); assert.equal(calls.at(-1).authenticated, undefined)
  result = undefined; await authApi.logout(); assert.equal(calls.at(-1).path, '/auth/logout'); assert.equal(calls.at(-1).method, 'POST')
  result = { accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 3600, userId: 'u', username: 'fixture', roles: ['FAKE_ADMIN'] }; await assert.rejects(authApi.refresh(), /không hợp lệ/)
})
test('Complete: existing auth provider GET /auth/me decodes effective permissions and retires aborted session data', async () => {
  const session = load('shared/auth/session-access.ts', { react: { useSyncExternalStore: () => {} } })
  const effects = [], states = [], calls = []; let resolve, stopped = 0
  const { AuthProvider } = load('features/auth/AuthProvider.tsx', {
    react: { useEffect: effect => effects.push(effect) }, './model/auth-session': { authSession: { start: () => {} } }, './useAuth': { useAuth: () => ({ session: { accessToken: 'fixture-only' } }) },
    '@/shared/api': { apiRequest: (path, options) => { calls.push({ path, ...options }); return new Promise(yes => { resolve = yes }) } },
    '@/shared/auth': { decodeSessionAccess: session.decodeSessionAccess, setSessionAccess: state => states.push(state) },
  })
  AuthProvider({ children: 'children' }); const cleanup = effects[1]()
  assert.equal(calls[0].path, '/auth/me'); assert.equal(calls[0].method, undefined); assert.equal(calls[0].signal.aborted, false)
  resolve({ userId: 'u', effectivePermissions: ['BOOKING_READ'] }); await new Promise(yes => setImmediate(yes)); assert.equal(states.at(-1).status, 'ready'); assert.equal(states.at(-1).permissions[0], 'BOOKING_READ')
  calls[0].signal.addEventListener('abort', () => { stopped += 1 }); cleanup(); assert.equal(stopped, 1); assert.equal(states.at(-1).status, 'anonymous')
  for (const malformed of [null, { userId: 'u' }, { userId: 'u', effectivePermissions: [123] }]) assert.throws(() => session.decodeSessionAccess(malformed))
})
