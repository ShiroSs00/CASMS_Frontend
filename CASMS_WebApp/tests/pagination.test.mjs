import assert from 'node:assert/strict'
import test from 'node:test'
import { URLSearchParams } from 'node:url'

import {
  buildPaginationRange,
  paginateItems,
  sanitizePageSize,
} from '../src/shared/pagination.ts'
import {
  DEFAULT_ISSUE_QUERY,
  parseIssueQuery,
} from '../src/features/operational-issues/model/issue-query.ts'
import {
  DEFAULT_REGULATION_LIST_QUERY,
  parseRegulationListQuery,
  serializeRegulationListQuery,
} from '../src/features/regulations/model/regulation-query.ts'

const rows = Array.from({ length: 23 }, (_, index) => index + 1)

test('client pagination returns the requested slice and display range', () => {
  const result = paginateItems(rows, 2, 10)

  assert.deepEqual(result.items, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 3)
  assert.equal(result.start, 11)
  assert.equal(result.end, 20)
  assert.equal(result.hasPrevious, true)
  assert.equal(result.hasNext, true)
})

test('client pagination clamps an out-of-range page to the final page', () => {
  const result = paginateItems(rows, 99, 10)

  assert.equal(result.page, 3)
  assert.deepEqual(result.items, [21, 22, 23])
  assert.equal(result.start, 21)
  assert.equal(result.end, 23)
  assert.equal(result.hasNext, false)
})

test('empty client pagination keeps a stable first page and zero range', () => {
  const result = paginateItems([], -3, 10)

  assert.equal(result.page, 1)
  assert.equal(result.totalPages, 1)
  assert.equal(result.start, 0)
  assert.equal(result.end, 0)
  assert.deepEqual(result.items, [])
})

test('page size accepts only the configured frontend choices', () => {
  assert.equal(sanitizePageSize(20, [10, 20, 50], 10), 20)
  assert.equal(sanitizePageSize(999, [10, 20, 50], 10), 10)
  assert.equal(sanitizePageSize(Number.NaN, [10, 20, 50], 10), 10)
})

test('pagination range stays compact while preserving boundaries', () => {
  assert.deepEqual(buildPaginationRange(6, 10), [1, 'ellipsis', 5, 6, 7, 'ellipsis', 10])
  assert.deepEqual(buildPaginationRange(2, 4), [1, 2, 3, 4])
})

test('OIM URL query rejects unbounded page sizes in the browser', () => {
  const parsed = parseIssueQuery(new URLSearchParams('page=0&pageSize=999'))

  assert.equal(parsed.page, 1)
  assert.equal(parsed.pageSize, DEFAULT_ISSUE_QUERY.pageSize)
})

test('Regulation URL query round-trips filters and frontend pagination', () => {
  const parsed = parseRegulationListQuery(new URLSearchParams(
    'q=speed&type=SPEED&scope=SHIP&status=ACTIVE&effectiveAt=2026-11-20T08%3A00&page=3&pageSize=20',
  ))

  assert.deepEqual(parsed, {
    search: 'speed',
    type: 'SPEED',
    scope: 'SHIP',
    status: 'ACTIVE',
    effectiveAt: '2026-11-20T08:00',
    page: 3,
    pageSize: 20,
  })
  assert.equal(
    serializeRegulationListQuery(parsed).toString(),
    'q=speed&type=SPEED&scope=SHIP&status=ACTIVE&effectiveAt=2026-11-20T08%3A00&page=3&pageSize=20',
  )
})

test('Regulation URL query restores safe defaults for invalid values', () => {
  const parsed = parseRegulationListQuery(new URLSearchParams(
    'type=SERVICE&scope=PORT&status=OPEN&page=-2&pageSize=999&effectiveAt=invalid',
  ))

  assert.deepEqual(parsed, DEFAULT_REGULATION_LIST_QUERY)
  assert.equal(serializeRegulationListQuery(parsed).toString(), '')
})
