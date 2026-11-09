import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import console from 'node:console'
import process from 'node:process'
import { URL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { connectBrowser } from '../helpers/booking-browser.mjs'
import { installBookingFixture } from '../helpers/booking-fixture.mjs'

const origin = process.env.BOOKING_TEST_ORIGIN || 'http://127.0.0.1:5174'
const zoom = process.env.BOOKING_NATIVE_ZOOM === '1'
const evidence = new URL('../../../../CASMS_Backend/specs/006-booking-cruise-detail-itinerary/evidence/', import.meta.url)
const { send, evaluate, waitFor, close } = await connectBrowser()
const first = '10000000-0000-4000-8000-000000000001'
const second = '10000000-0000-4000-8000-000000000050'
const catalog = '/cruises?cruiseType=MULTI_DAYS&page=2'
const detail = '/cruises/' + first + '?from=' + encodeURIComponent(catalog)
let injection

async function load(path, mode = 'detail-ready') {
  if (injection) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection })
  await send('Page.navigate', { url: 'about:blank' })
  const script = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${installBookingFixture.toString()})(${JSON.stringify(mode)})`,
  })
  injection = script.identifier
  await send('Page.navigate', { url: origin + path })
  await waitFor('Boolean(window.__bookingFixture)')
}

async function click(selector) {
  await waitFor(`document.querySelector(${JSON.stringify(selector)})`)
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
}

async function key(name, code) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code })
}

async function focusAt(id) {
  await waitFor(`document.activeElement.matches('#${id} h2')`)
  const box = await evaluate(`(() => {
    const heading = document.activeElement.getBoundingClientRect()
    const header = document.querySelector('body header')
    return { top: heading.top, bottom: heading.bottom, height: innerHeight,
      overlap: getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0 }
  })()`)
  assert.ok(box.top >= box.overlap && box.bottom <= box.height, JSON.stringify(box))
}

async function layout() {
  const size = await evaluate(`({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    titleCount: document.querySelectorAll('main h1').length, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches })`)
  assert.ok(size.scroll <= size.width + 1, JSON.stringify(size))
  assert.equal(size.titleCount, 1)
  assert.equal(size.reduced, true)
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(new URL(name + '.png', evidence), Buffer.from(data, 'base64'))
}

const bodyIncludes = text => `document.querySelector('main')?.innerText.includes(${JSON.stringify(text)})`
const itineraryReads = () => evaluate("window.__bookingFixture.calls.filter(x => x.path.endsWith('/public-itinerary')).length")
const bookingLink = 'a[href^="/booking/party?"]'
const selected = '#cruise-extras ol li'

try {
  await mkdir(evidence, { recursive: true })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  if (!zoom) await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false })
  await load(catalog)
  await waitFor(`document.querySelectorAll('main article a[href$="#cruise-extras"]').length === 2`)
  assert.deepEqual(await evaluate('window.__bookingFixture.calls.map(x => x.path)'), ['/cruise'])
  const links = await evaluate(`[...document.querySelector('main article').querySelectorAll('a')].map(x => ({name:x.textContent, url:x.href}))`)
  const details = new URL(links.find(x => x.name === 'Xem chi tiết').url)
  assert.equal(details.pathname, '/cruises/' + first)
  assert.equal(details.searchParams.get('from'), catalog)
  assert.equal(details.hash, '')
  await evaluate("document.querySelector('main article h2 a').focus()")
  await key('Tab', 9)
  assert.ok(await evaluate(`document.activeElement.matches('main article a[href$="#cruise-extras"]')`))
  await key('Enter', 13)
  await focusAt('cruise-extras')
  await waitFor(`document.querySelector('${selected}') && ${bodyIncludes('Gardens by the Bay')}`)
  await layout()
  if (zoom) {
    const metrics = await evaluate(`({dpr:devicePixelRatio, width:innerWidth, scale:visualViewport.scale, cssZoom:getComputedStyle(document.documentElement).zoom})`)
    assert.ok(metrics.dpr >= 1.99 && metrics.dpr <= 2.01)
    assert.equal(metrics.scale, 1)
    assert.equal(metrics.cssZoom, '1')
    console.log('Native zoom metrics', metrics)
  }
  assert.equal(await itineraryReads(), 1)
  const itinerary = await evaluate("document.getElementById('cruise-extras').innerText")
  for (const value of ['0 đêm', '01/06/2099', '31/05/2099', '23:30', 'Giờ địa phương', 'Không có lần ghé cảng', 'Chưa có tên cảng', 'Chưa có tên điểm tham quan']) assert.ok(itinerary.includes(value), value)
  assert.ok(!itinerary.includes('null'))
  await shot(zoom ? 'timeline-zoom200' : 'timeline-desktop')

  for (const id of ['cruise-packages', 'cruise-facts', 'cruise-extras']) {
    await click(`main nav a[href$="#${id}"]`)
    await focusAt(id)
  }
  await evaluate('history.back()')
  await focusAt('cruise-facts')
  await evaluate('history.forward()')
  await focusAt('cruise-extras')
  assert.equal(await itineraryReads(), 1)
  await waitFor(bodyIncludes('Bữa tối trên tàu'))
  assert.ok(await evaluate(`document.querySelector('#cruise-packages').innerText.includes('100 USD') && document.querySelector('#cruise-packages').innerText.includes('120 USD')`))
  assert.ok(await evaluate(bodyIncludes('Cần đăng ký riêng')))
  assert.ok(await evaluate(`document.querySelector('main a[href="/ships"]')?.textContent.includes('Khám phá đội tàu')`))
  const booking = new URL(await evaluate(`document.querySelector('${bookingLink}').href`))
  assert.equal(booking.searchParams.get('cruiseId'), first)
  assert.equal(booking.searchParams.get('from'), catalog)
  assert.ok(await evaluate("window.__bookingFixture.calls.every(x => x.method === 'GET')"))
  await click('main a[href^="/cruises?cruiseType="]')
  await waitFor(`location.pathname + location.search === ${JSON.stringify(catalog)}`)
  await click(`main article a[href^="/cruises/${second}"][href$="#cruise-extras"]`)
  await focusAt('cruise-extras')
  assert.ok(await evaluate(bodyIncludes('nhiều điểm đến Đông Nam Á')))
  assert.ok(await evaluate("!document.querySelector('main h1').textContent.includes('Vịnh Hạ Long')"))
  await load(detail + '#cruise-extras')
  await focusAt('cruise-extras')
  await send('Page.reload')
  await focusAt('cruise-extras')
  await load('/cruises/' + first + '?from=' + encodeURIComponent('//example.invalid'))
  await waitFor(`document.querySelector('${bookingLink}')`)
  assert.equal(new URL(await evaluate(`document.querySelector('${bookingLink}').href`)).searchParams.get('from'), '/cruises')
  await shot(zoom ? 'detail-zoom200' : 'detail-desktop')

  if (!zoom) {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
    await load(detail)
    await waitFor(bodyIncludes('Bắt đầu đặt chỗ'))
    await layout()
    await shot('detail-mobile')
    await click('main nav a[href$="#cruise-extras"]')
    await focusAt('cruise-extras')
    await waitFor(bodyIncludes('Gardens by the Bay'))
    await layout()
    await shot('timeline-mobile')
    await click('main nav a[href$="#cruise-packages"]')
    await focusAt('cruise-packages')
    await shot('packages-mobile')
  }

  for (const [mode, expected, cta] of [
    ['detail-read-only', 'Chưa thể đặt chỗ cho chuyến này', false],
    ['detail-sale-error', 'Chưa thể kiểm tra khả năng đặt chỗ', false],
    ['detail-package-error', 'Chưa tải được hạng cabin và gói', true],
    ['detail-missing-ship', 'Chưa có thông tin tàu', true],
    ['detail-itinerary-pending', 'Lịch trình chưa sẵn sàng', true],
    ['detail-empty-itinerary', 'Chưa có lịch trình để hiển thị', true],
    ['detail-invalid-itinerary', 'Chưa tải được lịch trình', true],
  ]) {
    await load(detail, mode)
    await waitFor(bodyIncludes(expected))
    if (cta) await waitFor(`document.querySelector('${bookingLink}')`)
    else assert.equal(await evaluate(`Boolean(document.querySelector('${bookingLink}'))`), false)
    if (mode === 'detail-missing-ship') assert.equal(await evaluate("Boolean(document.querySelector('main a[href=\"/ships\"]'))"), false)
  }

  await load(detail + '#cruise-extras', 'detail-itinerary-error')
  await focusAt('cruise-extras')
  await waitFor(bodyIncludes('Chưa tải được lịch trình'))
  await evaluate("window.__bookingFixture.mode = 'detail-ready'; window.__bookingFixture.calls.length = 0")
  await evaluate("document.querySelector('#cruise-extras button').focus()")
  await click('#cruise-extras button')
  await waitFor(bodyIncludes('Gardens by the Bay'))
  assert.deepEqual(await evaluate('window.__bookingFixture.calls.map(x => x.path)'), ['/cruise/' + first + '/public-itinerary'])
  assert.equal(await evaluate("document.activeElement.matches('#cruise-extras h2')"), false)
  // Exercise denial independently of the transaction adapter.
  for (const mode of ['detail-sold-out', 'detail-revoked', 'detail-forbidden', 'detail-not-found']) {
    await load(detail, mode)
    await waitFor(bodyIncludes('Chuyến này hiện không có trong danh mục'))
    assert.equal(await evaluate(`Boolean(document.querySelector('#cruise-extras, ${bookingLink}'))`), false)
    assert.ok(await evaluate("window.__bookingFixture.calls.every(x => x.method === 'GET')"))
  }
  await load('/cruises/not-a-uuid')
  await waitFor(bodyIncludes('Chuyến này hiện không có trong danh mục'))
  assert.deepEqual(await evaluate('window.__bookingFixture.calls'), [])
  console.log('006 detail browser fixture passed', zoom ? 'native zoom 200%' : 'desktop and mobile')
} finally {
  if (injection) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection })
  close()
}
