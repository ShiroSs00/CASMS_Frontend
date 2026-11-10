import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver, focusManager } from '@tanstack/react-query';
import './register-typescript.mjs';
import { syncAppQueryFocus } from '../src/lib/app-query-focus.ts';

test('native resume revalidates stale observed data without replaying mutations', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.mount();
  syncAppQueryFocus('active', 'ios');
  let reads = 0, writes = 0;
  const observer = new QueryObserver(client, { queryKey: ['passenger', 'voyages'], queryFn: async () => ++reads, staleTime: 0 });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    const before = reads;
    syncAppQueryFocus('background', 'ios');
    await client.getMutationCache().build(client, { mutationFn: async () => ++writes }).execute();
    assert.equal(reads, before);
    syncAppQueryFocus('active', 'ios');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(reads, before + 1);
    assert.equal(observer.getCurrentResult().data, before + 1);
    assert.equal(writes, 1);
  } finally { unsubscribe(); client.unmount(); client.clear(); focusManager.setFocused(undefined); }
});

test('Android inactive/background and active update focus; web keeps browser visibility handling', () => {
  syncAppQueryFocus('inactive', 'android'); assert.equal(focusManager.isFocused(), false);
  syncAppQueryFocus('active', 'android'); assert.equal(focusManager.isFocused(), true);
  syncAppQueryFocus('background', 'web'); assert.equal(focusManager.isFocused(), true);
  syncAppQueryFocus(null, 'ios'); assert.equal(focusManager.isFocused(), true);
  syncAppQueryFocus('unknown', 'ios'); assert.equal(focusManager.isFocused(), true);
  focusManager.setFocused(undefined);
});
