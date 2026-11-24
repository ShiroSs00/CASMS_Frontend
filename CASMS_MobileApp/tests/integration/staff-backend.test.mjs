import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { registerHooks } from 'node:module';
import { loginQa, qaReadOnlyDatabase, qaTransport, readQaConfig, verifyQaFixture, verifyQaReadiness } from './qa-environment.mjs';
registerHooks({ resolve(specifier, context, next) { return next(specifier === './staff-model' ? './staff-model.ts' : specifier, context); } });
const { createStaffApi } = await import('../../src/features/staff-pos/staff-api.ts');
const url = readQaConfig();
const transport = qaTransport(url);
const passenger = qaTransport(url);
const staff = createStaffApi(transport);
const owner = 'b1000000-0000-4000-8000-000000000001';
before(async () => {
  await verifyQaReadiness(url);
  qaReadOnlyDatabase();
  const me = await loginQa(transport, 'STAFF');
  const guest = await loginQa(passenger, 'PASSENGER');
  await verifyQaFixture(async () => {
    assert.equal(me.userId, owner); assert.deepEqual(me.roles, ['ONBOARD_STAFF']);
    assert.ok(me.effectivePermissions.includes('PRODUCT_MANAGE'));
    assert.equal(guest.userId, 'a1000000-0000-4000-8000-000000000001');
    assert.deepEqual(guest.roles, ['PASSENGER']);
    const booking = await passenger.request('/booking/a1000000-0000-4000-8000-000000000061');
    assert.ok(booking.passengers.some(person => person.bookingPassengerId === 'a1000000-0000-4000-8000-000000000071'));
  });
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
