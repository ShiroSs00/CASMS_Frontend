import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { registerHooks } from 'node:module';
import './register-typescript.mjs';

const values = new Map();
globalThis.__DEV__ = false;
process.env.EXPO_PUBLIC_API_URL = 'https://test.invalid/api';
globalThis.__secureStoreTest = {
  getItemAsync: async key => values.get(key) ?? null,
  setItemAsync: async (key, value) => { values.set(key, value); },
  deleteItemAsync: async key => { values.delete(key); },
};
const moduleUrl = source => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') return { url: moduleUrl("export const Platform = { OS: 'ios' };"), shortCircuit: true };
  if (specifier === 'expo-constants') return { url: moduleUrl('export default { expoConfig: {} };'), shortCircuit: true };
  if (specifier === 'expo-secure-store') return { url: moduleUrl('export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6; export const { getItemAsync, setItemAsync, deleteItemAsync } = globalThis.__secureStoreTest;'), shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const path = specifier === '@/lib/api' ? 'lib/api/index.ts' : `${specifier.slice(2)}.ts`;
    return nextResolve(new URL(`../src/${path}`, import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
} });
const { authActions, useAuth } = await import('../src/features/auth/session-store.ts');
const { queryClient } = await import('../src/lib/query-client.ts');
const { savePosSession, restorePosSession, savePendingSale, readPendingSale } = await import('../src/features/pos/pos-storage.ts');
const { scopedPos } = await import('../src/features/pos/pos-api.ts');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pos = { sessionToken: 'bound-pos-token', expiresAt: '2099-01-01T00:00:00Z', cruiseId: id(4), staffAssignmentId: null,
  terminal: { terminalId: id(1), shipId: id(2), areaId: id(3), enabled: true, permissions: [], code: 'POS', name: 'POS' } };
let user = 5;
const requests = [];
globalThis.fetch = async (url, options) => {
  requests.push({ url, ...options });
  if (url.endsWith('/auth/login') || url.endsWith('/auth/refresh')) return Response.json({ success: true, data: {
    accessToken: `employee-${user}`, tokenType: 'Bearer', expiresIn: 3600, userId: id(user), username: `staff-${user}`, roles: ['ONBOARD_STAFF'], effectivePermissions: ['POS_ACCESS'],
  } });
  if (url.endsWith('/pos/session') && options.method === 'DELETE') return new Response(null, { status: 204 });
  throw new Error(`Unexpected test request ${url}`);
};
after(async () => { await authActions.logout(); queryClient.clear(); });

test('logout revokes POS with outgoing employee JWT and clears auth, POS storage and query cache', async () => {
  user = 5;
  await authActions.login('staff-5', 'test-only-password');
  const login = useAuth.getState().session;
  await savePosSession(login.user.id, pos, login.signedInAt);
  queryClient.setQueryData(['pos', 'private'], { private: true });
  await authActions.logout();
  assert.equal(useAuth.getState().session, null);
  assert.equal(queryClient.getQueryData(['pos', 'private']), undefined);
  assert.equal((await restorePosSession(login.user.id, login.signedInAt)).session, null);
  const revoke = requests.find(row => row.url.endsWith('/pos/session'));
  assert.equal(revoke.method, 'DELETE');
  assert.equal(revoke.headers.Authorization, 'Bearer employee-5');
  assert.equal(revoke.headers['X-POS-Session'], pos.sessionToken);
  assert.ok(![...values.values()].some(value => value.includes('test-only-password') || value.includes(pos.sessionToken)));
});

test('account switching refuses old scoped client and never reveals another employee pending sale', async () => {
  user = 5; await authActions.login('staff-5', 'test-only-password');
  const old = useAuth.getState().session;
  await savePosSession(old.user.id, pos, old.signedInAt);
  const scope = { owner: old.user.id, terminalId: id(1), areaId: id(3), cruiseId: id(4) };
  const sale = { serviceName: 'Private service', input: { serviceId: id(10), onboardAccountId: id(11), bookingPassengerId: id(12), quantity: 1, idempotencyKey: 'same-key' } };
  await savePendingSale(scope, sale);
  const client = scopedPos(old.user.id, old.signedInAt, pos.sessionToken);
  user = 6; await authActions.login('staff-6', 'test-only-password');
  const next = useAuth.getState().session;
  const count = requests.length;
  await assert.rejects(client.services(), error => error.status === 401);
  assert.equal(requests.length, count);
  assert.equal((await restorePosSession(next.user.id, next.signedInAt)).session, null);
  assert.deepEqual(await readPendingSale({ ...scope, owner: next.user.id }), { kind: 'blocked' });
  assert.deepEqual(await readPendingSale(scope), { kind: 'own', sale });
});

test('expired stored POS session is removed instead of restored', async () => {
  const login = useAuth.getState().session;
  await savePosSession(login.user.id, { ...pos, expiresAt: '2020-01-01T00:00:00Z' }, login.signedInAt);
  const result = await restorePosSession(login.user.id, login.signedInAt);
  assert.equal(result.session, null); assert.equal(result.expired, true);
  assert.equal(values.has('ocevie.pos.session.v1'), false);
});

test('refresh cannot change account identity or retain the outgoing private cache', async () => {
  user = 5; await authActions.login('staff-5', 'test-only-password');
  queryClient.setQueryData(['private-refresh-data'], { owner: id(5) });
  user = 6;
  await authActions.refresh();
  assert.equal(useAuth.getState().status, 'expired');
  assert.equal(useAuth.getState().session, null);
  assert.equal(queryClient.getQueryData(['private-refresh-data']), undefined);
  assert.ok(![...values.values()].some(value => value.includes('employee-6')));
});

test('same-owner refresh preserves the login epoch and current account cache', async () => {
  user = 5; await authActions.login('staff-5', 'test-only-password');
  const original = useAuth.getState().session;
  queryClient.setQueryData(['current-account'], { owner: id(5) });
  await authActions.refresh();
  const refreshed = useAuth.getState().session;
  assert.equal(useAuth.getState().status, 'authenticated');
  assert.equal(refreshed.user.id, original.user.id);
  assert.equal(refreshed.signedInAt, original.signedInAt);
  assert.deepEqual(queryClient.getQueryData(['current-account']), { owner: id(5) });
});
