import { loadSource } from '../helpers/source-loader.mjs'
import assert from 'node:assert/strict'

import test from 'node:test'



const root = new URL('../../src/', import.meta.url)
function load(file, imports, globals = {}) { return loadSource(new URL(file, root), { 'react/jsx-runtime': { jsx: (type, props, key) => ({type, props, key}), jsxs: (type, props, key) => ({type, props, key}), Fragment: 'Fragment' }, ...imports }, globals); }
test('activity service manager login response is accepted as a staff session', () => {
  const types = load('features/auth/model/auth-types.ts', {})
  const dto = load('features/auth/api/dto.ts', { '../model/auth-types': types })
  const session = dto.toSession({ accessToken: 'fixture-only', tokenType: 'Bearer', expiresIn: 3600,
    userId: 'shore-fixture', username: 'shore-fixture', roles: ['ACTIVITY_SERVICE_MANAGER'] }, Date.now())
  assert.equal(types.isStaff(session.user), true)
  assert.equal(session.user.roles[0], 'ACTIVITY_SERVICE_MANAGER')
  for(const role of ['SHORE_MANAGER','ACTIVITY_MANAGER']) assert.throws(()=>dto.toSession({accessToken:'fixture-only',tokenType:'Bearer',expiresIn:3600,userId:'legacy',username:'legacy',roles:[role]},Date.now()),/không hợp lệ/)
})

test('all 11 BE roles decode, and only PASSENGER is outside the staff area',()=>{
  const types=load('features/auth/model/auth-types.ts',{})
  const dto=load('features/auth/api/dto.ts',{'../model/auth-types':types})
  assert.equal(types.AUTH_ROLES.length,11)
  for(const role of types.AUTH_ROLES){
    const session=dto.toSession({accessToken:'fixture',tokenType:'Bearer',expiresIn:3600,userId:'fixture',username:'fixture',roles:[role]},Date.now())
    assert.equal(types.isStaff(session.user),role!=='PASSENGER')
  }
})

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
    react: { useEffect: effect => effects.push(effect), useState: value => [value,()=>{}] }, './model/auth-session': { authSession: { start: () => {} } }, './useAuth': { useAuth: () => ({ session: { accessToken: 'fixture-only' }, user: {id:'u'} }) },
    '@/shared/api': { apiRequest: (path, options) => { calls.push({ path, ...options }); return new Promise(yes => { resolve = yes }) } },
    '@/shared/auth': { decodeSessionAccess: session.decodeSessionAccess, setSessionAccess: state => states.push(state), subscribeAccessRetry:()=>()=>{} },
  })
  AuthProvider({ children: 'children' }); const cleanup = effects[3](); const unmount = effects[1]()
  assert.equal(calls[0].path, '/auth/me'); assert.equal(calls[0].method, undefined); assert.equal(calls[0].signal.aborted, false)
  resolve({ userId: 'u', roles:['BOOKING_AGENT'], effectivePermissions: ['BOOKING_READ'] }); await new Promise(yes => setImmediate(yes)); assert.equal(states.at(-1).status, 'ready'); assert.equal(states.at(-1).permissions[0], 'BOOKING_READ')
  calls[0].signal.addEventListener('abort', () => { stopped += 1 }); cleanup(); unmount(); assert.equal(stopped, 1); assert.equal(states.at(-1).status, 'anonymous')
  for (const malformed of [null, { userId: 'u' }, { userId: 'u', effectivePermissions: [123] }]) assert.throws(() => session.decodeSessionAccess(malformed))
})
