import '../helpers/booking-loader.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { LiveCruiseSearch } from '../../src/features/booking/components/LiveCruiseCatalog.tsx'
import { liveCruiseCatalogApi } from '../../src/features/booking/api/booking-api.ts'

test('discovery presents one title and no repeated promotional subtext', () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(LiveCruiseSearch)))
  assert.equal((html.match(/<h1/g) ?? []).length, 1)
  assert.ok(!html.includes('KHÁM PHÁ HẢI TRÌNH'))
})
test('catalog sends server page/type and preserves an empty response', async () => {
  const original = globalThis.fetch
  let requested
  globalThis.fetch = async url => { requested = new URL(url, 'http://local'); return Response.json({ success: true, data: { content: [], number: 1, totalPages: 2, totalElements: 6 } }) }
  try {
    const page = await liveCruiseCatalogApi.list(2, undefined, 'ONE_DAY')
    assert.equal(requested.searchParams.get('page'), '1')
    assert.equal(requested.searchParams.get('cruiseType'), 'ONE_DAY')
    assert.deepEqual(page.items, [])
    assert.equal(page.total, 6)
  } finally { globalThis.fetch = original }
})
