import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { BookingCabinChoices } from '../src/features/booking/components/BookingCabinChoices.tsx'

function render(cabins, selectedCabinId) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(BookingCabinChoices, {
    cabins, selectedCabinId, onSelect() {}, name: 'passenger-0-cabin',
  })))
}
const cabins = Array.from({ length: 291 }, (_, index) => ({
  cabinId: `cabin-${index}`, cabinNumber: `Z-${index + 1}`, cabinType: 'OCEAN_VIEW',
  deckNumber: 1, capacity: 2, remainingCapacity: 1,
}))

test('large real-world inventory stays bounded while all pages remain reachable', () => {
  const html = render(cabins)
  assert.equal((html.match(/type="radio"/g) ?? []).length, 12)
  assert.match(html, /1–12 \/ 291 cabin phù hợp/)
  assert.match(html, /Trang 1 \/ 25/)
  assert.match(html, /Cabin tiếp/)
  assert.match(html, /Tìm số cabin/)
})

test('selection on a later page remains visible in the summary after navigating back', () => {
  const html = render(cabins, 'cabin-290')
  assert.match(html, /Đã chọn: <strong>Cabin Z-291<\/strong>/)
  assert.equal((html.match(/type="radio"/g) ?? []).length, 12)
})

test('empty inventory offers a clear filter recovery without invented cabins', () => {
  const html = render([])
  assert.doesNotMatch(html, /type="radio"/)
  assert.match(html, /Không có cabin phù hợp/)
  assert.match(html, /Xóa bộ lọc cabin/)
  assert.doesNotMatch(html, /Cabin tiếp/)
})
