import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
const { createCardReader, normalizeCardTag } = await import('../src/features/pos/card-reader.ts');
function port(overrides = {}) {
  return { supported: async () => true, enabled: async () => true, start: async () => {},
    request: async () => {}, tag: async () => ({ id: 'aabbccdd' }), cancel: async () => {}, ...overrides };
}
test('native identifier accepts supported hex UID only and does not substitute an identity', () => {
  assert.equal(normalizeCardTag({ id: 'aabbccdd', tech: 'mifare' }), 'AABBCCDD');
  for (const tag of [null, {}, { id: 'abc' }, { id: 'x'.repeat(8) }, { id: 'aabbccdd', tech: 'felica' }]) assert.throws(() => normalizeCardTag(tag));
});
test('NFC unsupported and disabled devices never request a tag', async () => {
  let requests = 0;
  for (const [override, reason] of [[{ supported: async () => false }, 'unsupported'], [{ enabled: async () => false }, 'disabled']]) {
    const reader = createCardReader(async () => port({ request: async () => { requests++; }, ...override }));
    await assert.rejects(reader.read(), error => error.reason === reason);
  }
  assert.equal(requests, 0);
});
test('read cancellation drops a late native tag, blocks overlap and waits for cleanup', async () => {
  let resolveRequest, started;
  const ready = new Promise(resolve => { started = resolve; });
  let cancels = 0;
  const reader = createCardReader(async () => port({ request: () => { started(); return new Promise(resolve => { resolveRequest = resolve; }); }, cancel: async () => { cancels++; } }));
  const pending = reader.read(); await ready;
  await assert.rejects(reader.read(), error => error.reason === 'busy');
  await reader.cancel(); resolveRequest();
  await assert.rejects(pending, error => error.reason === 'cancelled');
  assert.equal(cancels, 2);
});
test('cancellation during native module loading prevents opening a session', async () => {
  let finishLoad; let requests = 0;
  const reader = createCardReader(() => new Promise(resolve => { finishLoad = resolve; }));
  const pending = reader.read(); await reader.cancel();
  finishLoad(port({ request: async () => { requests++; } }));
  await assert.rejects(pending, error => error.reason === 'cancelled');
  assert.equal(requests, 0);
});
test('native failure always cleans the attempted request and permits another scan', async () => {
  let cancels = 0, attempts = 0;
  const reader = createCardReader(async () => port({ request: async () => { if (++attempts === 1) throw new Error('test native failure'); }, cancel: async () => { cancels++; } }));
  await assert.rejects(reader.read());
  assert.equal(await reader.read(), 'AABBCCDD'); assert.equal(cancels, 2);
});
