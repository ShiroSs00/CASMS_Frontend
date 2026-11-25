import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import './register-typescript.mjs';
const values = new Map();
globalThis.__journalApi = 'https://a.invalid/api';
globalThis.__journalStore = { getItemAsync: async key => values.get(key) ?? null, setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } };
const moduleUrl = source => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') return { url: moduleUrl("export const Platform = { OS: 'ios' };"), shortCircuit: true };
  if (specifier === 'expo-secure-store') return { url: moduleUrl('export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6; export const {getItemAsync,setItemAsync,deleteItemAsync} = globalThis.__journalStore;'), shortCircuit: true };
  if (specifier === '@/lib/api') return { url: moduleUrl('export const getApiUrl = () => globalThis.__journalApi;'), shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { beginServiceOperation, clearServiceOperation, readServiceOperation } = await import('../src/features/passenger-actions/service-operation-store.ts');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const proposed = key => ({ key, bookingId: id(1), bookingPassengerId: id(2), serviceId: id(3), payload: { quantity: 2, scheduleId: null, noteFingerprint: 'cbf29ce484222325' } });
test('serialized double tap keeps one original key and original payload, and clear checks the key', async () => {
  const [a, b] = await Promise.all([beginServiceOperation('owner', proposed('original')), beginServiceOperation('owner', proposed('other'))]);
  assert.equal(a.key, 'original'); assert.equal(b.key, 'original'); assert.equal(b.payload.quantity, 2);
  await clearServiceOperation('owner', 'other'); assert.equal((await readServiceOperation('owner')).key, 'original');
  await clearServiceOperation('owner', 'original'); assert.equal(await readServiceOperation('owner'), null);
});
test('queued journal writes capture API environment at call time and isolate owners', async () => {
  globalThis.__journalApi = 'https://a.invalid/api';
  const a = beginServiceOperation('owner', proposed('a'));
  globalThis.__journalApi = 'https://b.invalid/api';
  const b = beginServiceOperation('owner', proposed('b'));
  globalThis.__journalApi = 'https://c.invalid/api';
  await Promise.all([a, b]);
  assert.equal((await readServiceOperation('owner', 'https://a.invalid/api')).key, 'a');
  assert.equal((await readServiceOperation('owner', 'https://b.invalid/api')).key, 'b');
  assert.equal(await readServiceOperation('owner'), null); assert.equal(await readServiceOperation('another', 'https://a.invalid/api'), null);
});
