import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loginQa, readQaConfig, verifyQaFixture, verifyQaReadiness } from './integration/qa-environment.mjs';

test('legacy booking and explore deep links reach companion screens', async () => {
  for (const [file, destination] of [
    ['bookings.tsx', '/passenger-bookings'],
    ['passenger-bookings/new.tsx', '/passenger-bookings'],
    ['explore.tsx', '/services'],
  ]) {
    const source = await readFile(new URL(`../src/app/${file}`, import.meta.url), 'utf8');
    assert.ok(source.includes(`<Redirect href="${destination}"`));
  }
  const cruise = await readFile(new URL('../src/app/cruise.tsx', import.meta.url), 'utf8');
  assert.match(cruise, /export default PassengerDestinationScreen/);
});

test('booking detail offers contact guidance and renders the server cancellation reason without a legacy mutation', async () => {
  const screen = await readFile(new URL('../src/features/passenger-actions/PassengerBookingScreens.tsx', import.meta.url), 'utf8');
  const adapter = await readFile(new URL('../src/features/passenger-actions/passenger-api.ts', import.meta.url), 'utf8');
  assert.match(screen, /liên hệ nhân viên đặt chỗ/);
  assert.match(screen, /data\.cancellationReason/);
  assert.doesNotMatch(screen, /cancelBooking|BOOKING_CANCEL|mutateAsync/);
  assert.doesNotMatch(adapter, /\/booking\/[^\r\n]*\/cancel/);
});

test('QA requires an explicit matching confirmation and has no default URL', () => {
  assert.throws(() => readQaConfig({ EXPO_PUBLIC_API_URL: 'https://app.example/api' }), /BLOCKED_BY_ENVIRONMENT/);
  assert.throws(() => readQaConfig({
    CASMS_MOBILE_QA_API_URL: 'https://qa.example/api',
    CASMS_MOBILE_QA_CONFIRMED_URL: 'https://other.example/api',
  }), /BLOCKED_BY_ENVIRONMENT/);
  assert.equal(readQaConfig({
    CASMS_MOBILE_QA_API_URL: 'https://qa.example',
    CASMS_MOBILE_QA_CONFIRMED_URL: 'https://qa.example/api/',
  }), 'https://qa.example/api');
});

test('QA readiness performs a read-only API contract probe without redirects or credentials', async () => {
  const url = 'https://qa.example/api';
  await verifyQaReadiness(url, async (target, options) => {
    assert.equal(target, `${url}/auth/me`);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({ success: false, code: 'AUTH_REQUIRED' }, { status: 401 });
  });
  await assert.rejects(verifyQaReadiness(url, async () => new Response('redirected')), /BLOCKED_BY_ENVIRONMENT/);
});

test('QA distinguishes missing setup, authentication and fixture failures', async () => {
  const client = { async request() { throw Object.assign(new Error('private response'), { status: 401 }); } };
  await assert.rejects(loginQa(client, 'STAFF', {}), /BLOCKED_BY_ENVIRONMENT/);
  await assert.rejects(loginQa(client, 'STAFF', {
    CASMS_MOBILE_QA_STAFF_USERNAME: 'fixture', CASMS_MOBILE_QA_STAFF_PASSWORD: 'test-only',
  }), error => /BLOCKED_BY_BACKEND/.test(error.message) && !error.message.includes('private response'));
  await assert.rejects(verifyQaFixture(() => assert.fail('wrong fixture')), /BLOCKED_BY_DATABASE/);
});
