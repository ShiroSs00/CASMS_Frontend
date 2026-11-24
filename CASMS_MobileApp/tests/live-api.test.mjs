import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient, resolveApiUrl, ApiError, readSection, readErrorMessage } from '../src/lib/api/api-client.ts';
import { toSession, readSession } from '../src/features/auth/session-model.ts';
import { formatTime, stopsForDay } from '../src/features/itinerary/api-format.ts';

const make = impl => createApiClient({ baseUrl: () => 'http://backend.test/api', fetch: impl });

test('transport timeout aborts passenger and POS writes once without expiring auth or replaying', async () => {
  for (const path of ['/servicepackage/requests', '/pos/sales']) {
    let attempts = 0, expired = false;
    const client = createApiClient({ baseUrl: () => 'https://test.invalid/api', timeoutMs: 10,
      fetch: async (_url, { signal }) => {
        attempts++;
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
      },
    });
    client.setToken('fixture-token'); client.onUnauthorized(() => { expired = true; });
    await assert.rejects(client.request(path, { method: 'POST', body: {} }), error =>
      error instanceof ApiError && error.status === 0 && /quá thời gian/.test(error.message)
      && (path === '/servicepackage/requests' ? error.code === undefined : error.code === 'POS_TIMEOUT'));
    assert.equal(attempts, 1); assert.equal(expired, false);
  }
});

test('navigation cancellation propagates AbortError rather than reporting a timeout', async () => {
  const controller = new AbortController();
  const client = make(async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const pending = client.request('/booking', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError' && !(error instanceof ApiError));
});
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
test('normalizes explicit API URLs without a Metro, QA or production fallback', () => {
  assert.equal(resolveApiUrl(' http://127.0.0.1:8080 '), 'http://127.0.0.1:8080/api');
  assert.equal(resolveApiUrl('http://10.0.2.2:8080/api/'), 'http://10.0.2.2:8080/api');
  assert.equal(resolveApiUrl('https://api.example/gateway/api/api///'), 'https://api.example/gateway/api');
  assert.equal(resolveApiUrl('http://[::1]:8080/'), 'http://[::1]:8080/api');
  for (const value of [undefined, '', 'api.example/api', 'file:///secret', 'https://user:password@api.example/api', 'https://api.example/?']) {
    assert.throws(() => resolveApiUrl(value), error => error.code === 'API_CONFIGURATION');
  }
});
test('transport distinguishes intentional void responses from invalid payloads', async () => {
  for (const response of [new Response(null, { status: 204 }), new Response(null, { status: 205 }), Response.json({ success: true })]) {
    assert.equal(await make(async () => response).request('/logout'), undefined);
  }
  for (const response of [new Response(null), new Response('<html>debug</html>'), Response.json(null)]) {
    await assert.rejects(make(async () => response).request('/booking'), error => error.status === 502 && error.code === 'INVALID_RESPONSE');
  }
});
test('HTTP errors preserve codes and status while hiding backend implementation messages', async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429, 500]) {
    const client = make(async () => Response.json({ success: false, message: 'Hibernate stack trace', code: 'KNOWN_CODE' }, { status }));
    await assert.rejects(client.request('/booking'), error => error.status === status && error.code === 'KNOWN_CODE'
      && !error.message.includes('Hibernate'));
  }
});
test('an aborted request cannot invalidate a session even if a stale 401 arrives', async () => {
  const controller = new AbortController();
  let respond, attempts = 0, expired = false;
  const client = make(async () => {
    attempts++;
    return new Promise(resolve => { respond = resolve; });
  });
  client.setToken('token');
  client.onUnauthorized(() => { expired = true; });
  const pending = client.request('/booking', { signal: controller.signal });
  controller.abort();
  respond(new Response(null, { status: 401 }));
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(client.request('/booking', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(attempts, 1);
  assert.equal(expired, false);
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
  const payload = { accessToken: 'token', tokenType: 'Bearer', expiresIn: 3600, userId: '00000000-0000-4000-8000-000000000001', username: 'p1', roles: ['PASSENGER'], password: 'must-not-persist' };
  const session = toSession(payload);
  assert.equal(JSON.stringify(session).includes('password'), false);
  assert.equal(readSession(JSON.stringify(session)).user.id, payload.userId);
  assert.equal(readSession(JSON.stringify({ ...session, expiresAt: 1 })), null);
  assert.throws(() => toSession({ accessToken: 'token', tokenType: 'Bearer', expiresIn: -1, userId: 'u1', username: 'p1', roles: [] }));
  assert.throws(() => toSession({ ...payload, tokenType: 42 }), /Phản hồi đăng nhập không hợp lệ/);
  assert.throws(() => toSession({ ...payload, email: {} }), /Phản hồi đăng nhập không hợp lệ/);
  assert.throws(() => toSession({ ...payload, userId: 'u1' }), /Phản hồi đăng nhập không hợp lệ/);
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
