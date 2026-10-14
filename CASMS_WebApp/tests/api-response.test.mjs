import assert from 'node:assert/strict'
import test from 'node:test'

import { extractApiData } from '../src/shared/api/response.ts'

test('extractApiData accepts the backend ApiResponse envelope', () => {
  assert.deepEqual(extractApiData({ success: true, data: { id: 'ship-1' } }, 200), {
    id: 'ship-1',
  })
})

test('extractApiData accepts raw Operational Issue and Regulation success bodies', () => {
  assert.deepEqual(extractApiData([{ regulationId: 'reg-1' }], 200), [
    { regulationId: 'reg-1' },
  ])
})

test('extractApiData rejects an error envelope even with a 2xx response', () => {
  assert.throws(
    () => extractApiData({ success: false, error: 'Conflict' }, 200),
    /Conflict/,
  )
})
