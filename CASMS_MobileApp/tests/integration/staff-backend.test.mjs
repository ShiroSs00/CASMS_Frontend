import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { registerHooks } from 'node:module';
import { createApiClient } from '../../src/lib/api/api-client.ts';
registerHooks({ resolve(specifier, context, next) { return next(specifier === './staff-model' ? './staff-model.ts' : specifier, context); } });
const { createStaffApi } = await import('../../src/features/staff-pos/staff-api.ts');
const transport = createApiClient({ baseUrl: () => 'http://127.0.0.1:18080/api' });
const passenger = createApiClient({ baseUrl: () => 'http://127.0.0.1:18080/api' });
const staff = createStaffApi(transport);
const owner = 'b1000000-0000-4000-8000-000000000001';
before(async () => {
  const login = await transport.request('/auth/login', { method: 'POST', authenticated: false, body: { username: 'ocevie.staff.qa', password: 'OcevieStaffQa@2026' } });
  transport.setToken(login.accessToken);
  const me = await transport.request('/auth/me');
  assert.equal(me.userId, owner); assert.deepEqual(me.roles, ['ONBOARD_STAFF']);
  assert.ok(me.effectivePermissions.includes('PRODUCT_MANAGE'));
  const session = await passenger.request('/auth/login', { method: 'POST', authenticated: false, body: { username: 'ocevie.mobile.qa', password: 'OcevieQa@2026' } });
  passenger.setToken(session.accessToken);
  assert.equal((await passenger.request('/auth/me')).userId, 'a1000000-0000-4000-8000-000000000001');
});
test('staff creates, edits and discontinues real products; passengers cannot read them', async () => {
  const form = { code: `QA-STAFF-${Date.now()}`, name: 'QA Tea', type: 'DRINK', description: 'Staff API verification', price: '12.5', currency: 'USD' };
  const product = await staff.saveProduct(form);
  try {
    assert.equal(product.status, 'ACTIVE'); assert.equal(product.price, 12.5);
    assert.ok((await staff.products()).some(p => p.id === product.id));
    const edited = await staff.saveProduct({ ...form, name: 'QA Tea Updated', price: '14.25' }, product.id);
    assert.equal(edited.name, 'QA Tea Updated'); assert.equal(edited.price, 14.25);
    assert.equal((await staff.productStatus(product.id, 'discontinue')).status, 'DISCONTINUED');
    await assert.rejects(passenger.request('/servicepackage/products'), e => e.status === 403);
  } finally {
    await transport.request(`/servicepackage/products/${product.id}`, { method: 'DELETE' });
  }
});
test('staff processes passenger request through assignment, accept, start and complete', async () => {
  const created = await passenger.request('/servicepackage/requests', { method: 'POST', body: { serviceId: 'a1000000-0000-4000-8000-000000000091', bookingPassengerId: 'a1000000-0000-4000-8000-000000000071', quantity: 1, note: 'QA staff lifecycle' } });
  assert.ok((await staff.requests()).some(r => r.id === created.id));
  assert.equal((await staff.requestAction(created.id, 'assign')).assignedUserId, owner);
  assert.equal((await staff.requestAction(created.id, 'accept')).status, 'ACCEPTED');
  assert.equal((await staff.requestAction(created.id, 'start')).status, 'IN_PROGRESS');
  const result = await staff.requestAction(created.id, 'complete');
  assert.equal(result.status, 'COMPLETED'); assert.ok(result.completedAt);
  assert.equal((await passenger.request(`/servicepackage/requests/${created.id}`)).status, 'COMPLETED');
  await assert.rejects(passenger.request(`/servicepackage/requests/${created.id}/actions/complete`, { method: 'POST' }), e => e.status === 403);
});
