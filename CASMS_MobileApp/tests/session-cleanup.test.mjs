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
const { savePosSession, restorePosSession, savePendingSale, readPendingSale, clearPendingSale } = await import('../src/features/pos/pos-storage.ts');
const { scopedPos } = await import('../src/features/pos/pos-api.ts');
const { chooseVoyage, useVoyageSelection } = await import('../src/features/passenger-actions/voyage-selection.ts');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pos = { sessionToken: 'bound-pos-token', expiresAt: '2099-01-01T00:00:00Z', cruiseId: id(4), staffAssignmentId: null,
  terminal: { terminalId: id(1), shipId: id(2), areaId: id(3), enabled: true, permissions: [], code: 'POS', name: 'POS' } };
let user = 5;
let refreshStatus;
const requests = [];
globalThis.fetch = async (url, options) => {
  requests.push({ url, ...options });
  if (url.endsWith('/auth/refresh') && refreshStatus) return new Response(null, { status: refreshStatus });
  if (url.endsWith('/auth/login') || url.endsWith('/auth/refresh')) return Response.json({ success: true, data: {
    accessToken: `employee-${user}`, tokenType: 'Bearer', expiresIn: 3600, userId: id(user), username: `staff-${user}`, roles: ['ONBOARD_STAFF'], effectivePermissions: ['POS_ACCESS'],
  } });
  if (url.endsWith('/pos/session') && options.method === 'DELETE') return new Response(null, { status: 204 });
  throw new Error(`Unexpected test request ${url}`);
};
after(async () => { await authActions.logout(); queryClient.clear(); });

test('restore ignores a persisted token scoped to a different API URL', async () => {
  const key = 'aurora.auth.v1';
  values.set(key, JSON.stringify({ backend: 'https://other.invalid/api', session: {
    accessToken: 'previous-environment-token', expiresAt: Date.now() + 3600000, signedInAt: 1,
    user: { id: id(5), username: 'staff-5', roles: ['ONBOARD_STAFF'] },
  } }));
  await authActions.restore();
  assert.equal(useAuth.getState().status, 'anonymous');
  assert.equal(useAuth.getState().session, null);
  assert.equal(requests.length, 0);
});

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

test('403 during refresh preserves unexpired auth and account data', async () => {
  user = 5; await authActions.login('staff-5', 'test-only-password');
  const original = useAuth.getState().session;
  queryClient.setQueryData(['current-account'], { owner: id(5) });
  refreshStatus = 403;
  try {
    await authActions.refresh();
    assert.equal(useAuth.getState().status, 'authenticated');
    assert.equal(useAuth.getState().session, original);
    assert.deepEqual(queryClient.getQueryData(['current-account']), { owner: id(5) });
  } finally {
    refreshStatus = undefined;
    await authActions.logout();
  }
});

test('selection persists beside the active JWT, survives refresh, and clears on logout', async () => {
  user = 5; await authActions.login('staff-5', 'test-only-password');
  const original = useAuth.getState().session;
  const selected = { bookingId: id(10), bookingPassengerId: id(11), bookingStatus: 'Confirmed', cruiseStatus: 'PUBLISHED', participationStatus: 'Active' };
  assert.equal(chooseVoyage({ owner: original.user.id, signedInAt: original.signedInAt, apiUrl: process.env.EXPO_PUBLIC_API_URL },
    [selected], selected.bookingId, selected.bookingPassengerId), true);
  await authActions.refresh();
  const saved = JSON.parse(values.get('aurora.auth.v1'));
  assert.deepEqual(saved.voyage, { bookingId: selected.bookingId, bookingPassengerId: selected.bookingPassengerId });
  assert.equal(saved.session.accessToken, useAuth.getState().session.accessToken);
  await authActions.logout();
  assert.equal(useAuth.getState().status, 'signed-out');
  assert.equal(useVoyageSelection.getState().selection, null);
  assert.equal(values.has('aurora.auth.v1'), false);
});

test('resume expires the session before any request when the clock passed expiry', async () => {
  await authActions.login('staff-5', 'test-only-password');
  const session = useAuth.getState().session;
  useAuth.setState({ session: { ...session, expiresAt: Date.now() - 1 } });
  const calls = requests.length;
  authActions.resume();
  assert.equal(useAuth.getState().status, 'expired');
  assert.equal(requests.length, calls);
});


test('POS journal serializes concurrent intents and refuses stale clear or another owner', async () => {
  const scope = { owner: id(5), terminalId: id(31), areaId: id(3), cruiseId: id(4), signedInAt: 1 };
  const work = { serviceName: 'Service', input: { serviceId: id(10), onboardAccountId: id(11), bookingPassengerId: id(12), quantity: 1, idempotencyKey: 'journal-a' } };
  const next = { ...work, input: { ...work.input, idempotencyKey: 'journal-b' } };
  const results = await Promise.allSettled([savePendingSale(scope, work), savePendingSale(scope, next)]);
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'rejected');
  await assert.rejects(clearPendingSale(scope, 'journal-b'), e => e.code === 'POS_SALE_BUSY');
  await assert.rejects(savePendingSale({ ...scope, owner: id(6) }, work));
  await assert.rejects(clearPendingSale({ ...scope, owner: id(6) }, 'journal-a'));
  assert.deepEqual((await readPendingSale(scope)).sale, work);
  await clearPendingSale(scope, 'journal-a'); assert.equal(await readPendingSale(scope), null);
});

test('POS journal survives session epoch change and blocks another voyage or environment', async () => {
  const scope = { owner: id(5), terminalId: id(32), areaId: id(3), cruiseId: id(4), signedInAt: 1 };
  const work = { serviceName: 'Service', input: { serviceId: id(10), onboardAccountId: id(11), bookingPassengerId: id(12), quantity: 1, idempotencyKey: 'epoch-a' } };
  await savePendingSale(scope, work);
  assert.equal((await readPendingSale({ ...scope, signedInAt: 2 })).previousSession, true);
  assert.deepEqual(await readPendingSale({ ...scope, cruiseId: id(99) }), { kind: 'blocked' });
  assert.deepEqual(await readPendingSale(scope, 'https://other.invalid/api'), { kind: 'blocked' });
  const reordered = { ...work, input: { idempotencyKey: 'epoch-a', quantity: 1, bookingPassengerId: id(12), onboardAccountId: id(11), serviceId: id(10) } };
  await savePendingSale(scope, reordered);
  await clearPendingSale(scope, 'epoch-a');
});

test('in-flight POS response after employee switch is uncertain and never accepted', async () => {
  user = 5; await authActions.login('staff-5', 'test-only-password');
  const login = useAuth.getState().session;
  const client = scopedPos(login.user.id, login.signedInAt, pos.sessionToken);
  const previousFetch = globalThis.fetch;
  let resolve;
  globalThis.fetch = () => new Promise(done => { resolve = done; });
  try {
    const operation = client.services();
    await Promise.resolve();
    useAuth.setState({ session: { ...login, user: { ...login.user, id: id(6) } } });
    resolve(Response.json({ success: true, data: [] }));
    await assert.rejects(operation, e => e.status === 502 && e.code === 'POS_STALE_RESULT');
  } finally { globalThis.fetch = previousFetch; useAuth.setState({ session: login }); }
});


test('different legacy and terminal pending intents stay blocked and neither is deleted', async () => {
  const scope = { owner: id(5), terminalId: id(33), areaId: id(3), cruiseId: id(4), signedInAt: 2 };
  const work = { serviceName: 'Service', input: { serviceId: id(10), onboardAccountId: id(11), bookingPassengerId: id(12), quantity: 1, idempotencyKey: 'terminal-intent' } };
  await savePendingSale(scope, work);
  const legacyKey = `ocevie.pos.pending.${scope.owner}.${scope.terminalId}.${scope.areaId}.${scope.cruiseId}`;
  const terminalKey = `ocevie.pos.pending-terminal.${scope.terminalId}`;
  values.set(legacyKey, JSON.stringify({ ...work, backend: process.env.EXPO_PUBLIC_API_URL, input: { ...work.input, idempotencyKey: 'legacy-intent' } }));
  assert.deepEqual(await readPendingSale(scope), { kind: 'blocked' });
  await assert.rejects(clearPendingSale(scope, 'terminal-intent'), e => e.code === 'POS_SALE_BUSY');
  await assert.rejects(savePendingSale(scope, work));
  assert.ok(values.has(legacyKey)); assert.ok(values.has(terminalKey));
  values.delete(legacyKey);
  await clearPendingSale(scope, 'terminal-intent');
});
