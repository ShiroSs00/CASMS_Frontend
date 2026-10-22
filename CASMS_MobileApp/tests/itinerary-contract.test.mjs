import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === '../../lib/api/api-client' ? `${specifier}.ts` : specifier, context);
} });
const { createItineraryApi } = await import('../src/features/itinerary/itinerary-client.ts');
import { createApiClient, ApiError } from '../src/lib/api/api-client.ts';

function fixture(handler) {
  const calls = [];
  const api = createApiClient({ baseUrl: () => 'http://backend.test/api', fetch: async (url, options) => {
    const parsed = new URL(url); calls.push(parsed.pathname + parsed.search);
    return handler(parsed.pathname.replace('/api', ''), parsed.searchParams, options);
  } });
  return { api: createItineraryApi(api), transport: api, calls };
}
const detailResponse = path => {
  if (path === '/itineraries/i1') return Response.json({ success: true, data: { itineraryId: 'i1', cruiseId: 'c1' } });
  if (path === '/itineraries/i1/days') return Response.json({ success: true, data: [{ itineraryDayId: 'd2', dayNumber: 2 }, { itineraryDayId: 'd1', dayNumber: 1 }] });
  if (path === '/cruise-stops/by-itinerary/i1') return Response.json({ success: true, data: [{ cruiseStopId: 's1', stopOrder: 1 }] });
  if (path === '/cruise/c1') return Response.json({ success: true, data: { cruiseId: 'c1' } });
  if (path === '/itinerary-change-history/itineraries/i1') return Response.json([{ changeHistoryId: 'h1' }]);
  throw new Error(`Unexpected endpoint ${path}`);
};

test('old itinerary detail uses existing BE alias and accepts wrapped sections/raw history', async () => {
  const f = fixture(detailResponse); const result = await f.api.detail('i1');
  assert.deepEqual(result.days.map(d => d.itineraryDayId), ['d1', 'd2']);
  assert.equal(result.cruise.cruiseId, 'c1'); assert.equal(result.history.items[0].changeHistoryId, 'h1');
  assert.equal(f.calls.length, 5); assert.deepEqual(result.accessErrors, []);
});

test('old catalog follows every BE page and rejects inconsistent or duplicate pages', async () => {
  const f = fixture((path, q) => Response.json({ success: true, data: { content: [{ itineraryId: `i${q.get('page')}` }], number: Number(q.get('page')), totalPages: 2, totalElements: 2 } }));
  assert.equal((await f.api.catalog()).itineraries.length, 2);
  for (const data of [
    { content: [], number: 4, totalPages: 1, totalElements: 0 },
    { content: [{ itineraryId: 'i1' }], number: 0, totalPages: 1, totalElements: 2 },
    { content: [{ itineraryId: 'i1' }, { itineraryId: 'i1' }], number: 0, totalPages: 1, totalElements: 2 },
  ]) await assert.rejects(fixture(() => Response.json(data)).api.catalog(), ApiError);
});

test('old sections preserve 403 separately; 401 invalidates the session', async () => {
  const denied = fixture(path => path.startsWith('/cruise-stops') ? new Response(null, { status: 403 }) : detailResponse(path));
  const result = await denied.api.detail('i1');
  assert.equal(result.days.length, 2); assert.equal(result.stopsDenied, true); assert.equal(result.accessErrors.length, 1);
  let expired = 0;
  const invalid = fixture(path => path.startsWith('/cruise-stops') ? new Response(null, { status: 401 }) : detailResponse(path));
  invalid.transport.setToken('test'); invalid.transport.onUnauthorized(() => expired++);
  await assert.rejects(invalid.api.detail('i1'), error => error.status === 401); assert.equal(expired, 1);
});

test('malformed history remains an error section and cannot crash list rendering', async () => {
  const f = fixture(path => path.startsWith('/itinerary-change-history') ? Response.json({ wrong: [] }) : detailResponse(path));
  const result = await f.api.detail('i1');
  assert.deepEqual(result.history.items, []); assert.match(result.history.error, /không đúng định dạng/);
});

test('old excursions/group requests retain exact BE filter names and reject missing selections', async () => {
  const f = fixture(() => Response.json([]));
  await f.api.tours('s/1'); await f.api.groups('e1');
  assert.deepEqual(f.calls, ['/api/shore-excursions?cruiseStopId=s%2F1', '/api/tour-groups?excursionId=e1']);
  await assert.rejects(f.api.detail(''), error => error.status === 400);
  await assert.rejects(f.api.tours(''), error => error.status === 400);
  await assert.rejects(f.api.groups(''), error => error.status === 400);
});

test('old refresh sends the current bearer without a fabricated refresh-token body', async () => {
  const f = fixture((path, q, options) => {
    assert.equal(path, '/auth/refresh'); assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer current'); assert.equal(options.body, undefined);
    return Response.json({ success: true, data: { accessToken: 'next' } });
  });
  f.transport.setToken('current');
  assert.equal((await f.transport.request('/auth/refresh', { method: 'POST' })).accessToken, 'next');
});
