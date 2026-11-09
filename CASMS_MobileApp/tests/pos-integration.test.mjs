import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
const { createScopedPosApi, openPosWithClient } = await import('../src/features/pos/pos-transport.ts');
const { matchesPosSession } = await import('../src/features/pos/pos-contracts.ts');
const { eligibleEmployee, passengersFromRequests } = await import('../src/features/pos/pos-access.ts');
const { activityActions } = await import('../src/features/pos/pos-lifecycle.ts');
const { createApiClient, ApiError } = await import('../src/lib/api/api-client.ts');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const terminal = { terminalId: id(1), shipId: id(2), areaId: id(3), code: 'BAR', name: 'OceVie', enabled: true, permissions: ['SERVICE_READ', 'SERVICE_SALE'] };
const session = { sessionToken: 'device-bound-session', expiresAt: '2099-01-01T00:00:00Z', terminal, cruiseId: id(4), staffAssignmentId: null };
const context = { terminal, cruiseId: id(4), staffAssignmentId: null, services: [] };
const sale = { saleId: id(8), terminalId: id(1), areaId: id(3), serviceId: id(5), onboardAccountId: id(6), bookingPassengerId: id(7), employeeId: id(9), quantity: 1, amount: 25, currency: 'USD', createdAt: '2026-11-09T00:00:00Z' };
const input = { serviceId: id(5), onboardAccountId: id(6), bookingPassengerId: id(7), quantity: 1, idempotencyKey: 'stable-sale' };

test('terminal bootstrap sends employee JWT and exactly one device credential without POS header', async () => {
  const calls = [];
  const transport = createApiClient({ baseUrl: () => 'https://test/api', fetch: async (url, options) => {
    calls.push({ url, ...options }); return Response.json({ success: true, data: session });
  } }); transport.setToken('employee-token');
  await openPosWithClient(transport, id(1), { deviceAccessToken: 'device-token', areaId: id(3), cruiseId: id(4) });
  assert.equal(calls[0].url, `https://test/api/pos-terminals/${id(1)}/sessions`);
  assert.equal(calls[0].headers.Authorization, 'Bearer employee-token');
  assert.equal(calls[0].headers['X-POS-Session'], undefined);
  assert.deepEqual(JSON.parse(calls[0].body), { deviceAccessToken: 'device-token', areaId: id(3), cruiseId: id(4) });
  for (const proof of [{}, { deviceSecret: 'x', deviceAccessToken: 'y' }, { deviceSecret: '' }]) {
    await assert.rejects(openPosWithClient(transport, id(1), proof));
  }
  assert.equal(calls.length, 1);
});

test('opening POS rejects invalid terminal, mismatched context and expired server session', async () => {
  let count = 0;
  const client = { request: async () => { count++; return session; } };
  await assert.rejects(openPosWithClient(client, 'invalid', { deviceSecret: 'proof' }));
  assert.equal(count, 0);
  for (const changed of [
    { terminal: { ...terminal, terminalId: id(10) } }, { terminal: { ...terminal, enabled: false } },
    { terminal: { ...terminal, areaId: id(10) } }, { cruiseId: id(10) }, { expiresAt: '2020-01-01T00:00:00Z' },
  ]) {
    await assert.rejects(openPosWithClient({ request: async () => ({ ...session, ...changed }) }, id(1),
      { deviceSecret: 'proof', areaId: id(3), cruiseId: id(4) }), error => error.code === 'POS_INVALID_RESPONSE');
  }
});

test('context comparison invalidates changed ship, terminal, area, cruise or assignment', () => {
  assert.equal(matchesPosSession(context, session), true);
  for (const changed of [{ cruiseId: id(10) }, { staffAssignmentId: id(10) },
    ...['shipId', 'terminalId', 'areaId'].map(key => ({ terminal: { ...terminal, [key]: id(10) } })),
    { terminal: { ...terminal, enabled: false } }]) {
    assert.equal(matchesPosSession({ ...context, ...changed }, session), false);
  }
});

test('POS reads/actions/sales/revocation use only scoped endpoints and session header', async () => {
  const calls = [];
  const request = { id: id(11), serviceId: id(5), quantity: 1, status: 'REQUESTED', requestTime: sale.createdAt };
  const transport = createApiClient({ baseUrl: () => 'https://test/api', fetch: async (url, options) => {
    calls.push({ url, ...options });
    const path = new URL(url).pathname;
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ success: true, data: path.endsWith('/session') ? context
      : path.endsWith('/services') ? [] : path.endsWith('/requests') ? [request]
        : path.includes('/actions/') ? request : sale });
  } }); transport.setToken('employee-token');
  const pos = createScopedPosApi(transport, session.sessionToken);
  await pos.context(); await pos.services(); await pos.requests();
  for (const action of ['assign', 'accept', 'reject', 'start', 'complete', 'cancel']) await pos.requestAction(id(11), action);
  await pos.recordSale(input); await pos.sale(id(8)); await pos.close();
  for (const call of calls) {
    assert.ok(call.url.startsWith('https://test/api/pos/'));
    assert.equal(call.headers['X-POS-Session'], session.sessionToken);
    assert.equal(call.headers.Authorization, 'Bearer employee-token');
    assert.ok(!call.url.includes('servicepackage'));
  }
  const recorded = calls.find(call => call.url.endsWith('/sales'));
  assert.equal(JSON.parse(recorded.body).idempotencyKey, input.idempotencyKey);
});

test('POS rejects invalid quantities/credentials and never retries timeout or forbidden mutations', async () => {
  for (const status of [0, 403, 409, 422]) {
    let calls = 0;
    const transport = createApiClient({ baseUrl: () => 'https://test/api', fetch: async () => {
      calls++;
      if (status === 0) throw new Error('network');
      return Response.json({ success: false, code: 'DENIED' }, { status });
    } }); transport.setToken('employee-token');
    const pos = createScopedPosApi(transport, session.sessionToken);
    await assert.rejects(pos.recordSale(input), error => error instanceof ApiError && error.status === status);
    assert.equal(calls, 1);
    await assert.rejects(pos.recordSale({ ...input, quantity: 2 }));
    assert.equal(calls, 1);
  }
  const pos = createScopedPosApi({ request: async () => { throw new Error('Must not send'); } }, '');
  await assert.rejects(pos.services(), error => error.code === 'POS_SESSION_REQUIRED');
});

test('uncertain sale retry preserves exact body and idempotency key', async () => {
  const bodies = [];
  const pos = createScopedPosApi({ request: async (_path, options) => {
    bodies.push(options.body);
    if (bodies.length === 1) throw new ApiError('timeout', 0, 'POS_TIMEOUT');
    return sale;
  } }, session.sessionToken);
  await assert.rejects(pos.recordSale(input));
  assert.equal((await pos.recordSale(input)).saleId, sale.saleId);
  assert.deepEqual(bodies, [input, input]);
});

test('statement preserves authoritative allowance and rejects wrong account or malformed amounts', async () => {
  const value = { budget: { accountId: id(6), passengerId: id(12), allocatedAmount: 100, usedAmount: 25, accountRemaining: 75, remainingAmount: 30, currency: 'USD' }, history: [] };
  const pos = createScopedPosApi({ request: async path => {
    assert.equal(path, `/pos/accounts/${id(6)}/passengers/${id(7)}/statement`); return value;
  } }, session.sessionToken);
  assert.deepEqual(await pos.statement(id(6), id(7)), value);
  for (const changed of [{ accountId: id(10) }, { remainingAmount: '30' }, { usedAmount: Infinity }]) {
    await assert.rejects(createScopedPosApi({ request: async () => ({ ...value, budget: { ...value.budget, ...changed } }) }, session.sessionToken).statement(id(6), id(7)));
  }
});

test('sale detail rejects a response for a different sale', async () => {
  await assert.rejects(createScopedPosApi({ request: async () => sale }, session.sessionToken).sale(id(10)), error => error.code === 'POS_INVALID_RESPONSE');
});

test('device-bound credential is never sent to passenger endpoints', async () => {
  let calls = 0;
  const transport = createApiClient({ baseUrl: () => 'https://test/api', fetch: async () => { calls++; return Response.json({}); } });
  transport.setToken('employee');
  await assert.rejects(transport.request('/booking', { posSession: session.sessionToken }), error => error.status === 401);
  assert.equal(calls, 0);
});

test('late 401 cannot clear a newer session even when the JWT text is reused', async () => {
  let respond;
  let expired = 0;
  const transport = createApiClient({ baseUrl: () => 'https://test/api', fetch: () => new Promise(resolve => { respond = resolve; }) });
  transport.onUnauthorized(() => { expired++; });
  transport.setToken('same-jwt');
  const old = transport.request('/pos/session', { posSession: session.sessionToken });
  transport.setToken(null);
  transport.setToken('same-jwt');
  respond(Response.json({ success: false }, { status: 401 }));
  await assert.rejects(old, error => error.status === 401);
  assert.equal(expired, 0);
});

test('POS employee gate requires server POS_ACCESS, active identity and an employee role', () => {
  const me = { userId: id(9), status: 'ACTIVE', roles: ['ONBOARD_STAFF'], effectivePermissions: ['POS_ACCESS'] };
  assert.equal(eligibleEmployee(id(9), me), true);
  for (const changed of [{ effectivePermissions: [] }, { userId: id(10) }, { status: 'LOCKED' },
    ...[['POS'], ['ADMIN'], ['PASSENGER'], ['ONBOARD_STAFF', 'POS']].map(roles => ({ roles }))]) {
    assert.equal(eligibleEmployee(id(9), { ...me, ...changed }), false);
  }
});

test('passenger options exclude requests outside server-readable services', () => {
  const rows = [{ serviceId: id(5), bookingPassengerId: id(7), requestTime: sale.createdAt }, { serviceId: id(10), bookingPassengerId: id(12), requestTime: sale.createdAt }];
  assert.deepEqual(passengersFromRequests([{ serviceId: id(5), name: 'Tea', permissions: ['SERVICE_SALE'] }], rows), []);
  const permitted = passengersFromRequests([{ serviceId: id(5), name: 'Tea', permissions: ['SERVICE_REQUEST_READ'] }], rows);
  assert.deepEqual(permitted.map(item => item.id), [id(7)]);
});

test('activity lifecycle respects backend states and uses POS-scoped action transport', async () => {
  const activity = { id: id(13), name: 'Yoga', code: 'YOGA', status: 'OPEN', startTime: '2026-11-09T00:00:00Z', endTime: '2026-11-09T02:00:00Z' };
  assert.deepEqual(activityActions(activity, Date.parse('2026-11-08T23:00:00Z')), ['cancel']);
  assert.deepEqual(activityActions(activity, Date.parse(activity.startTime)), ['start', 'cancel']);
  assert.deepEqual(activityActions({ ...activity, status: 'COMPLETED' }, Date.now()), []);
  assert.deepEqual(activityActions({ ...activity, status: 'PLANNED' }, Date.now()), ['open', 'cancel']);
  const pos = createScopedPosApi({ request: async (path, options) => {
    assert.equal(path, `/pos/activities/${id(13)}/actions/start`);
    assert.equal(options.method, 'POST'); assert.equal(options.posSession, session.sessionToken);
    return { ...activity, status: 'IN_PROGRESS' };
  } }, session.sessionToken);
  assert.equal((await pos.activityAction(id(13), 'start')).status, 'IN_PROGRESS');
});
