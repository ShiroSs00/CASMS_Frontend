import assert from 'node:assert/strict'
import { URL } from 'node:url'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import console from 'node:console'
import { mkdir, writeFile } from 'node:fs/promises'
import { connectBrowser } from '../helpers/booking-browser.mjs'
import { installBookingFixture } from '../helpers/booking-fixture.mjs'

const browser = await connectBrowser()
const nativeZoom = process.env.BOOKING_NATIVE_ZOOM === '1'
const { send, evaluate, waitFor } = browser
const evidence = new URL('../../../../CASMS_Backend/specs/005-customer-booking-redesign/evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const clickText = async text => {
  await waitFor(`[...document.querySelectorAll('button,a')].some(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.matches(':disabled')&&e.getAttribute('aria-disabled')!=='true')`)
  return evaluate(`(() => { const el=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)}); if(!el)throw Error('Missing action'); el.focus(); el.click() })()`)
}
const set = (id, value) => evaluate(`(() => { const e=document.getElementById(${JSON.stringify(id)}); const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true})); })()`)
const screenshot = async name => { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(new URL(name + (nativeZoom ? '-zoom200' : '') + '.png', evidence), Buffer.from(data, 'base64')) }
const checkLayout = async () => {
  const metrics = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length})`)
  assert.ok(metrics.scroll <= metrics.width + 1, JSON.stringify(metrics))
  assert.equal(metrics.h1, 1)
}
try {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installBookingFixture.toString()})()` })
  if (!nativeZoom) await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: (process.env.BOOKING_TEST_ORIGIN || 'http://127.0.0.1:5174') + '/cruises' })
  await waitFor(`document.querySelector('article h2 a')`)
  if (nativeZoom) {
    const zoom = await evaluate(`({dpr:devicePixelRatio,width:innerWidth,scale:visualViewport.scale,cssZoom:getComputedStyle(document.documentElement).zoom})`)
    assert.ok(zoom.dpr >= 1.99, JSON.stringify(zoom)); assert.equal(zoom.scale, 1); assert.equal(zoom.cssZoom, '1')
    console.log(JSON.stringify({ nativeZoomMetrics: zoom }))
  }
  await checkLayout(); await screenshot('discovery-desktop')
  await evaluate(`document.querySelector('article h2 a').click()`)
  await waitFor(`document.querySelector('a[href^="/booking/party"]')`)
  await checkLayout(); await screenshot('detail-desktop')
  await clickText('Bắt đầu đặt chỗ')
  await waitFor(`document.querySelector('h1')?.textContent==='Người đi & phòng' && !document.querySelector('button[type=submit]')?.disabled`)
  assert.equal(await evaluate(`window.__bookingFixture.quoteCount`), 0)
  await clickText('Thêm hành khách')
  await screenshot('party-desktop')
  await clickText('Tiếp tục chọn gói & cabin')
  await waitFor(`document.getElementById('person-1-farePackageOfferId')`)
  const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  for (let i = 0; i < 2; i++) { await set(`person-${i}-farePackageOfferId`, id(i ? 16 : 6)); await set(`person-${i}-cabinSelectionMode`, 'PHYSICAL_CABIN') }
  await waitFor(`document.querySelector('input[type=radio]')`)
  await evaluate(`document.querySelector('input[type=radio]').click()`)
  await evaluate(`document.querySelector('input[type=radio]').focus()`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
  assert.equal(await evaluate(`document.querySelector('input[type=radio]:checked').value`), id(4))
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 })
  assert.ok((await evaluate(`document.body.innerText`)).includes('2 khách · 1 phòng'))
  assert.equal(await evaluate(`window.__bookingFixture.calls.filter(c=>c.path.includes('public-model')).length`), 0)
  await checkLayout(); await screenshot('allocation-desktop')
  await clickText('Mở 3D · Phòng 1')
  await waitFor(`document.querySelector('dialog[open]')`)
  await screenshot('model-fallback')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`!document.querySelector('dialog[open]')`)
  assert.ok((await evaluate(`document.activeElement.textContent`)).includes('Mở 3D'))
  await clickText('Tiếp tục nhập thông tin')
  await waitFor(`document.getElementById('person-0-fullName')`)
  await clickText('Kiểm tra đặt chỗ')
  await waitFor(`document.getElementById('person-0-fullName')?.getAttribute('aria-invalid')==='true'`)
  assert.equal(await evaluate(`document.activeElement.id`), 'person-0-fullName')
  for (let i = 0; i < 2; i++) await set(`person-${i}-fullName`, `Fixture Guest ${i + 1}`)
  await set('person-0-email', 'fixture@example.test')
  await checkLayout(); await screenshot('travellers-desktop')
  await clickText('Kiểm tra đặt chỗ')
  await waitFor(`document.querySelector('h1')?.textContent==='Kiểm tra đặt chỗ'`)
  assert.equal(await evaluate(`window.__bookingFixture.quoteCount`), 0)
  await clickText('Kiểm tra giá')
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Xác nhận đặt chỗ')`)
  await checkLayout(); await screenshot('review-desktop')
  await clickText('Sửa thông tin hành khách')
  await waitFor(`document.getElementById('person-0-email')`)
  await set('person-0-email', 'fixture-updated@example.test')
  await clickText('Kiểm tra đặt chỗ')
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Xác nhận đặt chỗ')`)
  assert.equal(await evaluate(`window.__bookingFixture.quoteCount`), 1)
  if (!nativeZoom) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
  await checkLayout(); await screenshot('review-mobile')
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Xác nhận đặt chỗ'); b.click(); b.click(); })()`)
  await waitFor(`document.querySelector('h1')?.textContent==='Đã tiếp nhận đặt chỗ'`)
  assert.equal(await evaluate(`window.__bookingFixture.createCount`), 1)
  assert.ok(!(await evaluate(`document.body.innerText`)).includes('Đã thanh toán'))
  await checkLayout(); await screenshot('receipt-mobile')
  if (!nativeZoom) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false })
    await checkLayout(); await screenshot('receipt-desktop')
  }
  const results = await evaluate(`({quoteCount:window.__bookingFixture.quoteCount, createCount:window.__bookingFixture.createCount, noPIIInQuote: !JSON.stringify(window.__bookingFixture.calls.find(c=>c.method==='POST'&&c.path==='/booking/quotes').body).includes('@'), noMetadataInCreate: !JSON.stringify(window.__bookingFixture.calls.find(c=>c.method==='POST'&&c.path==='/booking').body).includes('personIds'), reference:window.__bookingFixture.saved.bookingReference,status:window.__bookingFixture.saved.bookingStatus})`)
  assert.equal(results.noPIIInQuote, true); assert.equal(results.noMetadataInCreate, true)
  console.log(JSON.stringify({ type: 'MOCK_BROWSER_ONLY', ...results }))
} finally { browser.close() }
