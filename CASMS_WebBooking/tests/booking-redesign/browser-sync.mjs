import assert from 'node:assert/strict'
import console from 'node:console'
import { connectBrowser } from '../helpers/booking-browser.mjs'
import { installBookingFixture } from '../helpers/booking-fixture.mjs'
const browser = await connectBrowser(), { send, evaluate, waitFor } = browser
try {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installBookingFixture.toString()})()` })
  await send('Page.navigate', { url: 'http://127.0.0.1:5174/tests/helpers/cabin-harness.html' })
  await waitFor(`document.querySelectorAll('input[type=radio]').length===2`)
  await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.startsWith('Mở 3D'));b.focus();b.click()})()`)
  await waitFor(`document.querySelector('dialog[open] [data-model-cabin]')`)
  await evaluate(`document.querySelector('[data-model-cabin]').click()`)
  const first = '10000000-0000-4000-8000-000000000003', second = '10000000-0000-4000-8000-000000000004'
  assert.equal(await evaluate(`document.querySelector('input[type=radio]:checked').value`), first)
  assert.equal(await evaluate(`document.getElementById('selected-cabins').textContent`), `${first},${first}`)
  await evaluate(`document.getElementById('invalid-model-choice').click()`)
  assert.equal(await evaluate(`document.querySelector('input[type=radio]:checked').value`), first)
  await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent==='Xong').click()`)
  await waitFor(`!document.querySelector('dialog[open]')`)
  await evaluate(`document.querySelectorAll('input[type=radio]')[1].click()`)
  await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.startsWith('Mở 3D')).click()`)
  await waitFor(`document.getElementById('model-selected')`)
  assert.equal(await evaluate(`document.getElementById('model-selected').textContent`), second)
  await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent==='Xong').click()`)
  await waitFor(`!document.querySelector('dialog[open]')`)
  await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent==='Bỏ hành khách 1').click()`)
  await waitFor(`document.querySelector('dialog[open]')`)
  assert.equal(await evaluate(`document.querySelectorAll('input[type=radio]').length`), 2)
  await evaluate(`[...document.querySelectorAll('dialog button')].find(e=>e.textContent==='Giữ nguyên').click()`)
  await waitFor(`!document.querySelector('dialog[open]')`)
  assert.equal(await evaluate(`document.getElementById('selected-cabins').textContent`), `${second},${second}`)
  assert.equal(await evaluate(`window.__bookingFixture.calls.filter(c=>c.path.includes('public-model')).length`), 0)
  console.log(JSON.stringify({ type: 'MOCK_RENDERER_ONLY', passed: 'model→list and list→model; whole-group selection; invalid renderer ID rejected; destructive party edit protected' }))
} finally { browser.close() }
