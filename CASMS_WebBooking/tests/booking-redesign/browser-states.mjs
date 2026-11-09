import assert from 'node:assert/strict'
import { URL } from 'node:url'
import { Buffer } from 'node:buffer'
import console from 'node:console'
import { writeFile } from 'node:fs/promises'
import { connectBrowser } from '../helpers/booking-browser.mjs'
import { installBookingFixture } from '../helpers/booking-fixture.mjs'

const browser = await connectBrowser(), { send, evaluate, waitFor } = browser
const origin = 'http://127.0.0.1:5174', cruise = '10000000-0000-4000-8000-000000000001'
const evidence = new URL('../../../../CASMS_Backend/specs/005-customer-booking-redesign/evidence/', import.meta.url)
let injection
const reports = []
const click = async text => {
  await waitFor(`[...document.querySelectorAll('button,a')].some(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.matches(':disabled')&&e.getAttribute('aria-disabled')!=='true')`)
  return evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing action');b.focus();b.click()})()`)
}
const set = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`)
const start = async (mode = 'normal', path = `/booking/party?cruiseId=${cruise}`) => {
  if (injection) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection })
  const script = await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installBookingFixture.toString()})();window.__bookingFixture.mode=${JSON.stringify(mode)}` })
  injection = script.identifier
  await send('Page.navigate', { url: origin + path })
  await waitFor(`window.__bookingFixture && document.querySelector('h1')`)
}
const capture = async name => {
  const metrics = await evaluate(`({w:innerWidth,s:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length})`)
  assert.ok(metrics.s <= metrics.w + 1, JSON.stringify({ name, ...metrics })); assert.equal(metrics.h1, 1)
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(new URL(name + '.png', evidence), Buffer.from(data, 'base64'))
}
const review = async (mode = 'normal', categoryHold = false) => {
  await start(mode)
  await waitFor(`!document.querySelector('button[type=submit]')?.disabled`)
  await click('Tiếp tục chọn gói & cabin')
  await waitFor(`document.getElementById('person-0-farePackageOfferId')`)
  await set('person-0-farePackageOfferId', '10000000-0000-4000-8000-000000000006')
  await set('person-0-cabinSelectionMode', categoryHold ? 'CATEGORY_HOLD' : 'PHYSICAL_CABIN')
  if (!categoryHold) { await waitFor(`document.querySelector('input[type=radio]')`); await evaluate(`document.querySelector('input[type=radio]').click()`) }
  if (mode === 'expiry') {
    await capture('allocation-mobile')
    await click('Mở 3D · Phòng 1'); await waitFor(`document.querySelector('dialog[open]')`); await capture('model-mobile')
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await waitFor(`!document.querySelector('dialog[open]')`)
  }
  await click('Tiếp tục nhập thông tin'); await waitFor(`document.getElementById('person-0-fullName')`)
  await set('person-0-fullName', 'Fixture Guest'); await set('person-0-email', 'fixture@example.test')
  await click('Kiểm tra đặt chỗ'); await waitFor(`document.querySelector('h1')?.textContent==='Kiểm tra đặt chỗ'`)
}
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  for (const path of ['/booking/cabin-experience', '/booking/travellers', '/booking/review']) {
    await start('normal', path + '?cruiseId=' + cruise + '&from=' + encodeURIComponent('/cruises?page=2&cruiseType=MULTI_DAYS'))
    await waitFor(`location.pathname==='/booking/party' && !document.querySelector('button[type=submit]')?.disabled`)
    assert.ok((await evaluate(`location.search`)).includes('from=')); assert.equal(await evaluate(`window.__bookingFixture.createCount+window.__bookingFixture.quoteCount`), 0)
  }
  reports.push('old route deep links guard missing party and preserve query; zero automatic POST')
  await capture('party-mobile')
  await click('Thêm hành khách'); await set('party-1-group', '__new')
  assert.ok((await evaluate(`document.body.innerText`)).includes('2 khách · 2 phòng'))
  await capture('two-groups-mobile')
  await start('normal', '/cruises'); await waitFor(`document.querySelector('article h2 a')`); await capture('discovery-mobile')
  await evaluate(`document.querySelector('article h2 a').click()`); await waitFor(`document.querySelector('a[href^="/booking/party"]')`); await capture('detail-mobile')
  await review('normal', true)
  await click('Kiểm tra giá'); await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Xác nhận đặt chỗ')`)
  assert.equal(await evaluate(`window.__bookingFixture.calls.find(c=>c.path==='/booking/quotes'&&c.method==='POST').body.passengers[0].cabinId`), null)
  await click('Sửa thông tin hành khách'); await waitFor(`document.getElementById('real-booking-plan')`); await capture('travellers-mobile')
  await set('real-booking-plan', 'FULL'); await click('Kiểm tra đặt chỗ'); await waitFor(`document.querySelector('h1')?.textContent==='Kiểm tra đặt chỗ'`)
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Xác nhận đặt chỗ')`), false)
  reports.push('category hold sends null cabin; payment-plan edit invalidates quote')
  await review('expiry'); await click('Kiểm tra giá')
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Xác nhận đặt chỗ')`)
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra giá')`)
  assert.equal(await evaluate(`window.__bookingFixture.createCount`), 0)
  reports.push('expired quote revokes confirmation without create')
  await review('knownRejection'); await click('Kiểm tra giá')
  await waitFor(`document.querySelector('[role=alert]')`)
  assert.equal(await evaluate(`document.querySelector('button[type=submit]').disabled`), false)
  reports.push('known quote rejection retains editable draft')
  for (const mode of ['quoteUnknown', 'bookingUnknown']) {
    await review(mode)
    await click('Kiểm tra giá')
    if (mode === 'bookingUnknown') { await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Xác nhận đặt chỗ')`); await click('Xác nhận đặt chỗ') }
    await waitFor(`document.querySelector('[aria-label="Cần đối chiếu kết quả"]')`)
    const expected = mode === 'quoteUnknown' ? { q: 1, c: 0 } : { q: 1, c: 1 }
    await evaluate(`document.querySelector('header a[href="/cruises"]').click()`)
    await waitFor(`document.querySelector('article h2 a')`); await evaluate(`document.querySelector('article h2 a').click()`)
    await waitFor(`document.querySelector('a[href^="/booking/party"]')`); await click('Bắt đầu đặt chỗ')
    await waitFor(`document.querySelector('[aria-label="Cần đối chiếu kết quả"]')`)
    assert.equal(await evaluate(`document.querySelector('button[type=submit]').disabled`), true)
    assert.deepEqual(await evaluate(`({q:window.__bookingFixture.quoteCount,c:window.__bookingFixture.createCount})`), expected)
    reports.push(mode + ' lock survives route unmount/remount; no duplicate POST')
  }
  await start('empty', '/cruises'); await waitFor(`document.body.innerText.includes('Chưa có hành trình để hiển thị')`); await capture('empty-mobile')
  await start('discoveryError', '/cruises'); await waitFor(`document.body.innerText.includes('Không tải được danh mục')`)
  await start('soldOut', '/cruises/' + cruise); await waitFor(`document.body.innerText.includes('Chuyến này hiện không có trong danh mục')`)
  assert.equal(await evaluate(`Boolean(document.querySelector('a[href^="/booking/party"]'))`), false)
  reports.push('empty/error/sold-out states with no ineligible booking CTA')
  await start('normal', '/booking/review?cruiseId=' + cruise); await waitFor(`location.pathname==='/booking/party'`)
  assert.equal(await evaluate(`window.__bookingFixture.createCount+window.__bookingFixture.quoteCount`), 0)
  reports.push('reload loses in-memory session safely; no automatic mutation')
  console.log(JSON.stringify({ type: 'MOCK_BROWSER_ONLY', reports }))
} finally { browser.close() }
