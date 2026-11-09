import '../helpers/booking-loader.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = name => readFileSync(new URL('../../src/features/booking/' + name, import.meta.url), 'utf8')
test('quote identity and both unknown outcomes belong to the route-stable provider', () => {
  const provider = read('components/BookingProvider.tsx')
  for (const key of ['quoteIntent', 'quoteUnknown', 'submissionLockRef', 'uncertain']) assert.ok(provider.includes(key), key)
  assert.doesNotMatch(read('pages/RealBookingCreatePage.tsx'), /useState<BookingQuoteIntent/)
  assert.doesNotMatch(provider, /localStorage|sessionStorage|requestBookingQuote\(|createQuotedBooking\(/)
})
