import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import './register-typescript.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const backend = 'https://fixture.invalid/api';
process.env.EXPO_PUBLIC_API_URL = backend;
let stored = JSON.stringify({
  backend, session: { accessToken: 'stored-fixture', expiresAt: Date.now() + 3600000, signedInAt: 15,
    user: { id: id(1), username: 'guest', email: null, roles: ['PASSENGER'] } },
  voyage: { bookingId: id(2), bookingPassengerId: id(3) },
});
let reads = 0;
globalThis.__authRestoreTest = {
  getItemAsync: async () => { reads++; return stored; },
  setItemAsync: async (_key, value) => { stored = value; },
  deleteItemAsync: async () => { stored = null; },
};
const fixture = source => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react-native') return fixture("export const Platform = { OS: 'ios' };");
  if (specifier === 'expo-secure-store') return fixture('export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6; export const { getItemAsync, setItemAsync, deleteItemAsync } = globalThis.__authRestoreTest;');
  if (specifier === '@/lib/api') return next(new URL('../src/lib/api/index.ts', import.meta.url).href, context);
  if (specifier === '@/lib/query-client') return next(new URL('../src/lib/query-client.ts', import.meta.url).href, context);
  return next(specifier, context);
} });

test('cold restore waits for storage once and restores only same-scope session and selected pair', async () => {
  const { authActions, useAuth } = await import('../src/features/auth/session-store.ts');
  const { useVoyageSelection } = await import('../src/features/passenger-actions/voyage-selection.ts');
  assert.equal(useAuth.getState().status, 'restoring');
  try {
    const first = authActions.restore();
    assert.equal(first, authActions.restore());
    await first;
    assert.equal(reads, 1);
    assert.equal(useAuth.getState().status, 'authenticated');
    assert.deepEqual(useVoyageSelection.getState().selection, {
      owner: id(1), signedInAt: 15, apiUrl: backend, bookingId: id(2), bookingPassengerId: id(3),
    });
  } finally {
    await authActions.logout();
  }
});
