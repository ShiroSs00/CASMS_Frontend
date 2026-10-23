import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(transport) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./payment-api.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, {
    module, exports: module.exports, require(id) { assert.equal(id, '@/shared/api'); return { apiRequest: transport } },
  })
  return module.exports.paymentApi
}
const row = { paymentId: 'payment', bookingId: 'booking', requestedAmount: 25, currency: 'USD', paymentMethod: 'Cash', status: 'Pending' }

test('payment ledger rejects foreign, duplicate and malformed rows and preserves read failures', async () => {
  for (const result of [[{ ...row, bookingId: 'other' }], [row, row], [{ ...row, requestedAmount: -1 }], [{ ...row, confirmedAmount: NaN }], [{ ...row, status: 'Paid' }], [{ ...row, currency: '' }]]) {
    await assert.rejects(load(async () => result).list('booking'))
  }
  const failure = new Error('Forbidden')
  await assert.rejects(load(async () => { throw failure }).list('booking'), error => error === failure)
  const rows = await load(async () => [row]).list('booking')
  assert.equal(rows[0].paymentId, 'payment')
})

test('confirmation verifies booking, payment, currency, status and full collected amount', async () => {
  const confirmed = { ...row, status: 'Confirmed', confirmedAmount: 25 }
  const calls = []
  await load(async (path, options) => { calls.push({ path, options }); return confirmed }).confirm(row, ' RECEIPT ')
  assert.equal(calls[0].path, '/payment/payment/confirm')
  assert.equal(calls[0].options.body.processorReference, 'RECEIPT')
  assert.equal(calls[0].options.body.confirmedAmount, 25)
  for (const patch of [{ paymentId: 'other' }, { bookingId: 'other' }, { currency: 'VND' }, { status: 'Pending' }, { confirmedAmount: 24 }]) {
    await assert.rejects(load(async () => ({ ...confirmed, ...patch })).confirm(row, 'RECEIPT'))
  }
})
