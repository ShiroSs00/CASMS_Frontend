import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { isOnboardStaff, staffPermissions, productInput, requestActions } from '../src/features/staff-pos/staff-model.ts';
registerHooks({ resolve(specifier, context, next) { return next(specifier === './staff-model' ? './staff-model.ts' : specifier, context); } });
const { createStaffApi } = await import('../src/features/staff-pos/staff-api.ts');
const owner = 'b1000000-0000-4000-8000-000000000001';
const target = 'b1000000-0000-4000-8000-000000000002';
const permissions = ['PRODUCT_MANAGE', 'SERVICE_REQUEST_ASSIGN', 'SERVICE_REQUEST_EXECUTE'];
test('staff permission gate checks current identity, active status and onboard role', () => {
  const me = { userId: owner, status: 'ACTIVE', roles: ['ONBOARD_STAFF'], effectivePermissions: permissions };
  assert.equal(isOnboardStaff(['PASSENGER']), false);
  assert.equal(isOnboardStaff(['ONBOARD_STAFF']), true);
  assert.deepEqual(staffPermissions(owner, me), permissions);
  assert.equal(staffPermissions(target, me), null);
  assert.equal(staffPermissions(owner, { ...me, roles: ['ADMIN'] }), null);
  assert.equal(staffPermissions(owner, { ...me, status: 'LOCKED' }), null);
});
test('staff actions obey assignment ownership and current lifecycle', () => {
  const row = { status: 'REQUESTED', assignedUserId: null };
  assert.deepEqual(requestActions(row, owner, permissions), ['assign']);
  assert.deepEqual(requestActions({ ...row, assignedUserId: owner }, owner, permissions), ['accept', 'reject']);
  assert.deepEqual(requestActions({ ...row, assignedUserId: target }, owner, permissions), []);
  for (const [status, actions] of [['ACCEPTED', ['start']], ['IN_PROGRESS', ['complete']], ['COMPLETED', []], ['CANCELLED', []], ['REJECTED', []]]) {
    assert.deepEqual(requestActions({ status, assignedUserId: owner }, owner, permissions), actions);
    assert.deepEqual(requestActions({ status, assignedUserId: target }, owner, permissions), []);
  }
  assert.deepEqual(requestActions(row, owner, []), []);
});
const form = { code: ' QA ', name: ' Trà ', type: ' DRINK ', description: '  ', price: '12,5000', currency: ' usd ' };
test('product form preserves price precision and rejects invalid financial input', () => {
  assert.deepEqual(productInput(form), { productCode: 'QA', productName: 'Trà', productType: 'DRINK', description: null, unitPrice: 12.5, currencyCode: 'USD' });
  for (const price of ['', '-1', '1e3', '12.34567', 'NaN', '1,000,000', '999999999999.9999']) assert.throws(() => productInput({ ...form, price }));
  assert.equal(productInput({ ...form, price: '0' }).unitPrice, 0);
  assert.throws(() => productInput({ ...form, currency: 'US' }));
  assert.throws(() => productInput({ ...form, name: ' ' }));
});
test('staff adapter calls actual management routes and never attempts unfinished sales', async () => {
  const calls = [];
  const api = createStaffApi({ async request(path, options) { calls.push({ path, ...options }); return path.endsWith('/products') && !options?.method ? [] : {}; } });
  await api.products(); await api.saveProduct(form); await api.saveProduct(form, target);
  await api.productStatus(target, 'discontinue');
  for (const action of ['assign', 'accept', 'start', 'complete']) await api.requestAction(target, action);
  assert.equal(calls[1].method, 'POST'); assert.equal(calls[2].method, 'PUT');
  assert.equal(calls[1].body.currencyCode, 'USD');
  assert.equal(calls[3].path, `/servicepackage/products/${target}/status/discontinue`);
  assert.equal(calls.at(-1).path, `/servicepackage/requests/${target}/actions/complete`);
  assert.ok(calls.every(c => !c.path.includes('/sales') && !c.path.includes('/payment')));
  assert.throws(() => api.productStatus('invalid', 'activate'));
});
