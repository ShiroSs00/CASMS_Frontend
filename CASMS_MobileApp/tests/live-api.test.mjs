import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient, resolveApiUrl, ApiError, readSection, readErrorMessage } from '../src/lib/api/api-client.ts';
import { toSession, readSession } from '../src/features/auth/session-model.ts';
import { formatTime, stopsForDay } from '../src/features/itinerary/api-format.ts';

const make = impl => createApiClient({ baseUrl: () => 'http://backend.test/api', fetch: impl });
test('tour and history access messages distinguish denied permissions from server failures', () => {
  assert.equal(readErrorMessage(new ApiError('Forbidden', 403), 'nhóm tour'), 'Tài khoản chưa được cấp quyền xem nhóm tour.');
  assert.equal(readErrorMessage(new ApiError('Server failed (500)', 500), 'nhóm tour'), 'Server failed (500)');
  assert.equal(readErrorMessage(new ApiError('Session expired', 401), 'lịch sử'), 'Session expired');
});
test('a denied section preserves permitted sections and is distinct from an empty list', async () => {
  const [days, stops, cruise] = await Promise.all([
    readSection(Promise.resolve([{ itineraryDayId: 'day-1' }]), 'ngày trong hải trình'),
    readSection(Promise.reject(new ApiError('Forbidden', 403)), 'điểm dừng'),
    readSection(Promise.resolve({ cruiseId: 'cruise-1' }), 'chuyến tàu'),
  ]);
  assert.equal(days.data.length, 1);
  assert.equal(cruise.data.cruiseId, 'cruise-1');
  assert.equal(stops.data, null);
  assert.match(stops.error, /quyền xem điểm dừng/);
  assert.deepEqual(await readSection(Promise.resolve([]), 'điểm dừng'), { data: [], error: null });
});
test('section permission handling propagates expiry and server/network failures', async () => {
  for (const status of [0, 401, 404, 500]) {
    const failure = new ApiError('failure', status);
    await assert.rejects(readSection(Promise.reject(failure), 'điểm dừng'), error => error === failure);
  }
});
test('iPhone resolves backend from Metro host, with explicit environment override', () => {
  assert.equal(resolveApiUrl(undefined, '192.168.1.7:8082', true), 'http://192.168.1.7:8080/api');
  assert.equal(resolveApiUrl('https://api.example/api/', '192.168.1.7:8082', true), 'https://api.example/api');
  assert.throws(() => resolveApiUrl(undefined, undefined, false));
  assert.throws(() => resolveApiUrl('file:///secret', undefined, true));
  assert.throws(() => resolveApiUrl('https://user:password@api.example/api', undefined, false));
});
test('login posts username/password without sending a previous bearer token', async () => {
  const client = make(async (url, options) => {
    assert.equal(url, 'http://backend.test/api/auth/login');
    assert.equal(options.method, 'POST'); assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { username: 'passenger', password: 'test-only' });
    return Response.json({ success: true, data: { username: 'passenger' } });
  });
  client.setToken('previous-session');
  assert.deepEqual(await client.request('/auth/login', { method: 'POST', body: { username: 'passenger', password: 'test-only' }, authenticated: false }), { username: 'passenger' });
});
test('client supports both ApiResponse and raw activity/history arrays with query encoding', async () => {
  const client = make(async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.match(url, /cruiseStopId=stop%2Fone/);
    return Response.json([{ shoreExcursionId: 'tour-1' }]);
  }); client.setToken('test-token');
  assert.equal((await client.request('/shore-excursions', { query: { cruiseStopId: 'stop/one' } }))[0].shoreExcursionId, 'tour-1');
});
test('401 expires current session even if backend response has no JSON; 403 does not log out', async () => {
  let expired = 0;
  const unauthorized = make(async () => new Response(null, { status: 401 }));
  unauthorized.setToken('token'); unauthorized.onUnauthorized(() => expired++);
  await assert.rejects(unauthorized.request('/itineraries'), error => error instanceof ApiError && error.status === 401);
  assert.equal(expired, 1);
  const forbidden = make(async () => new Response(null, { status: 403 }));
  forbidden.setToken('token'); forbidden.onUnauthorized(() => expired++);
  await assert.rejects(forbidden.request('/itineraries'), error => error.status === 403);
  assert.equal(expired, 1);
});
test('late 401 from an old token cannot expire a newly signed-in session', async () => {
  let resolveResponse; let expired = false;
  const client = make(() => new Promise(resolve => { resolveResponse = resolve; }));
  client.onUnauthorized(() => { expired = true; }); client.setToken('old');
  const pending = client.request('/itineraries'); client.setToken('new');
  resolveResponse(new Response(null, { status: 401 }));
  await assert.rejects(pending); assert.equal(expired, false);
});
test('a valid session stores only token, expiry and identity, never credentials', () => {
  const session = toSession({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 3600, userId: 'u1', username: 'p1', roles: ['PASSENGER'], password: 'must-not-persist' });
  assert.equal(JSON.stringify(session).includes('password'), false);
  assert.equal(readSession(JSON.stringify(session)).user.id, 'u1');
  assert.equal(readSession(JSON.stringify({ ...session, expiresAt: 1 })), null);
  assert.throws(() => toSession({ accessToken: 'token', tokenType: 'Bearer', expiresIn: -1, userId: 'u1', username: 'p1', roles: [] }));
});
test('time formatting honors ship timezone and never invents missing times', () => {
  assert.equal(formatTime('2026-10-19T03:00:00Z', 'Asia/Ho_Chi_Minh'), '10:00');
  assert.equal(formatTime(null, 'Asia/Ho_Chi_Minh'), 'Chưa cập nhật');
});
test('overnight stops remain visible on intermediate itinerary days', () => {
  const day = { itineraryDayId: 'day2', date: '2026-10-19', shipTimeZoneId: 'Asia/Ho_Chi_Minh' };
  const stop = { arrivalItineraryDayId: 'day1', departureItineraryDayId: 'day3', plannedArrival: '2026-10-18T03:00:00Z', plannedDeparture: '2026-10-20T03:00:00Z' };
  assert.equal(stopsForDay(day, [stop]).length, 1);
  assert.equal(stopsForDay({ ...day, date: '2026-10-21' }, [stop]).length, 0);
});
