// Runs only against the reconstructed baseline router in Backend/target, not the redesigned app.
import assert from 'node:assert/strict'
import console from 'node:console'
import { connectBrowser } from '../helpers/booking-browser.mjs'
import { installBookingFixture } from '../helpers/booking-fixture.mjs'
const browser = await connectBrowser(), { send, evaluate, waitFor } = browser
const cruise = '10000000-0000-4000-8000-000000000001'
const click = async text => {
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent===${JSON.stringify(text)}&&!b.disabled)`)
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)}).click()`)
}
const set = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`)
try {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installBookingFixture.toString()})()` })
  await send('Page.navigate', { url: 'http://127.0.0.1:5175/booking/cabin-experience?cruiseId=' + cruise + '&from=' + encodeURIComponent('/cruises?page=2') })
  await waitFor(`document.getElementById('person-0-farePackageOfferId')`)
  await set('person-0-farePackageOfferId', '10000000-0000-4000-8000-000000000006')
  await set('person-0-cabinSelectionMode', 'CATEGORY_HOLD')
  await click('Tiếp tục nhập hành khách')
  await waitFor(`document.getElementById('person-0-fullName')`)
  assert.equal(await evaluate(`location.pathname`), '/booking/travellers')
  await set('person-0-fullName', 'Fixture Guest'); await set('person-0-email', 'fixture@example.test')
  await click('Kiểm tra đặt chỗ')
  await waitFor(`location.pathname==='/booking/review'`)
  await click('Kiểm tra và gửi đặt chỗ')
  await waitFor(`document.querySelector('dialog[open]')?.textContent.includes('Xác nhận gửi đặt chỗ')`)
  assert.deepEqual(await evaluate(`({q:window.__bookingFixture.quoteCount,c:window.__bookingFixture.createCount})`), { q: 1, c: 0 })
  const quote = await evaluate(`window.__bookingFixture.calls.find(c=>c.path==='/booking/quotes'&&c.method==='POST').body`)
  assert.equal(quote.currency, 'USD'); assert.equal(quote.passengers[0].cabinId, null)
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('from')`), '/cruises?page=2')
  console.log(JSON.stringify({ type: 'RECONSTRUCTED_FOUNDATION_CHECKPOINT_WITH_MOCK_API', routes: 3, quoteCount: 1, createCount: 0, preserved: ['category hold', 'validator stages', 'USD payload', 'catalog query'] }))
} finally { browser.close() }
