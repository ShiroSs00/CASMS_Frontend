import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import '../helpers/booking-loader.mjs'
import { captureActivationLink, validateActivationPassword, validActivationToken } from '../../src/features/account-activation/activation-link.ts'
import { activateBookingAccount, ActivationError } from '../../src/features/account-activation/activation-api.ts'
import { apiRequest, setApiAccessToken, subscribeApiUnauthorized } from '../../src/shared/api/client.ts'
import { PublicBookingRecord } from '../../src/features/booking/components/PublicBookingRecord.tsx'

const token = 'fixture_only_' + 'a'.repeat(30)
function browserAt(path) {
  const url = new URL(path, 'https://booking.example')
  const state = { idx: 4, key: 'fixture' }
  return { location: url, history: { state, replaceState(next, unused, path) { assert.equal(next, state); url.href = new URL(path, url).href } } }
}

test('captures the fragment in memory and scrubs it without adding a history entry', () => {
  const browser = browserAt('/activate-booking-account?lang=vi#token=' + token)
  const link = captureActivationLink(browser)
  assert.equal(link.read(), token)
  assert.equal(browser.location.href, 'https://booking.example/activate-booking-account?lang=vi')
  link.clear(); assert.equal(link.read(), null)
})

test('missing/malformed/duplicated/oversized tokens never become usable; fragments are still scrubbed', () => {
  for (const hash of ['', '#token=', '#token=%20secret', '#token=%ZZ', '#token=a&token=b', '#token=a&other=1', '#token=' + 'x'.repeat(129), '#access_token=a']) {
    const browser = browserAt('/activate-booking-account' + hash)
    assert.equal(captureActivationLink(browser).read(), null)
    assert.equal(browser.location.hash, '')
  }
  assert.equal(validActivationToken('x'.repeat(128)), true)
})

test('query tokens are never accepted or forwarded to navigation', () => {
  const browser = browserAt('/activate-booking-account?token=fixture-query&lang=vi#token=' + token)
  assert.equal(captureActivationLink(browser).read(), null)
  assert.equal(browser.location.search, '?lang=vi')
  assert.equal(browser.location.hash, '')
})

test('capture does not require browser storage and leaves unrelated booking fragments untouched', () => {
  const browser = browserAt('/booking/lookup#details')
  assert.equal(captureActivationLink(browser).read(), null)
  assert.equal(browser.location.hash, '#details')
  // The browser facade intentionally has no localStorage/sessionStorage/cookies API.
})

test('failure to scrub URL fails closed', () => {
  const browser = browserAt('/activate-booking-account#token=' + token)
  browser.history.replaceState = () => { throw new Error('unavailable') }
  assert.equal(captureActivationLink(browser).read(), null)
})

test('refresh and back to the cleaned history entry cannot restore the token', () => {
  const browser = browserAt('/activate-booking-account#token=' + token)
  const first = captureActivationLink(browser)
  first.clear()
  assert.equal(captureActivationLink(browser).read(), null)
})

test('password required/12–72 character limits and confirmation mismatch', () => {
  for (const value of ['', ' '.repeat(12), 'a'.repeat(11), 'a'.repeat(73)]) assert.ok(validateActivationPassword(value, value).password)
  for (const value of ['a'.repeat(12), 'a'.repeat(72)]) assert.deepEqual(validateActivationPassword(value, value), {})
  assert.ok(validateActivationPassword('a'.repeat(12), '').confirmation)
  assert.ok(validateActivationPassword('a'.repeat(12), 'b'.repeat(12)).confirmation)
})

test('UTF-8 boundary is checked without trimming or normalizing the password', () => {
  const exact = 'á'.repeat(36)
  assert.deepEqual(validateActivationPassword(exact, exact), {})
  assert.ok(validateActivationPassword('á'.repeat(37), 'á'.repeat(37)).password)
  assert.ok(validateActivationPassword('😀'.repeat(19), '😀'.repeat(19)).password)
  const spaced = '  secure-password  '
  assert.deepEqual(validateActivationPassword(spaced, spaced), {})
})

test('activation is exactly one public POST, no Authorization, and does not mutate the existing auth session', async () => {
  const original = globalThis.fetch, calls = []
  let unauthorized = 0
  const unsubscribe = subscribeApiUnauthorized(() => unauthorized++)
  setApiAccessToken('existing-fixture-session')
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return Response.json({ success: true, message: 'irrelevant server text' })
  }
  try {
    await activateBookingAccount(token, 'a'.repeat(12))
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, '/api/auth/booking-account/activate')
    assert.equal(calls[0].options.method, 'POST')
    assert.equal(calls[0].options.headers.Authorization, undefined)
    assert.deepEqual(JSON.parse(calls[0].options.body), { token, password: 'a'.repeat(12) })
    await apiRequest('/auth/me')
    assert.equal(calls[1].options.headers.Authorization, 'Bearer existing-fixture-session')
    assert.equal(unauthorized, 0)
  } finally { unsubscribe(); setApiAccessToken(null); globalThis.fetch = original }
})

for (const [code, status, expected] of [['ACCOUNT_SETUP_INVALID', 400, 'invalid'], ['ACCOUNT_DISABLED', 403, 'disabled'], ['PASSWORD_TOO_LONG', 400, 'password'], ['UNKNOWN_CODE', 400, 'rejected'], ['UNKNOWN_CODE', 503, 'uncertain']]) {
  test('safe activation error mapping: ' + code + '/' + status, async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => Response.json({ success: false, code, message: 'raw-private-server-detail', details: { token } }, { status })
    try {
      await assert.rejects(activateBookingAccount(token, 'a'.repeat(12)), error => error instanceof ActivationError && error.kind === expected && !error.message.includes('raw-private') && !error.message.includes(token))
    } finally { globalThis.fetch = original }
  })
}

test('network interruption has an uncertain outcome and is not automatically retried', async () => {
  const original = globalThis.fetch; let count = 0
  globalThis.fetch = async () => { count++; throw new TypeError('private connection details') }
  try {
    await assert.rejects(activateBookingAccount(token, 'a'.repeat(12)), error => error.kind === 'uncertain')
    assert.equal(count, 1)
  } finally { globalThis.fetch = original }
})

test('malformed success or a bare 204 cannot falsely confirm activation', async () => {
  const original = globalThis.fetch
  try {
    for (const response of [Response.json({ other: true }), new Response(null, { status: 204 }), Response.json({ success: true, data: { unexpected: true } })]) {
      globalThis.fetch = async () => response
      await assert.rejects(activateBookingAccount(token, 'a'.repeat(12)), error => error.kind === 'uncertain')
    }
  } finally { globalThis.fetch = original }
})

test('booking wording follows the server status, including paid-but-contract-pending Draft', () => {
  const base = { bookingReference: 'FIXTURE', cruiseName: 'Fixture cruise', passengers: [], installments: [], paymentPlan: 'FULL', contractStatus: 'Draft' }
  const draft = renderToStaticMarkup(createElement(PublicBookingRecord, { booking: { ...base, bookingStatus: 'Draft' } }))
  assert.match(draft, /Thanh toán thành công chưa đồng nghĩa/)
  assert.doesNotMatch(draft, /Bạn có thể nhận email xác nhận/)
  const confirmed = renderToStaticMarkup(createElement(PublicBookingRecord, { booking: { ...base, bookingStatus: 'Confirmed', contractStatus: 'Accepted' } }))
  assert.match(confirmed, /Bạn có thể nhận email xác nhận/)
  assert.match(confirmed, /Tài khoản đã có giữ nguyên mật khẩu/)
})
