import assert from 'node:assert/strict'
import console from 'node:console'
import { connectBrowser } from '../helpers/booking-browser.mjs'
import { installBookingFixture } from '../helpers/booking-fixture.mjs'
const browser = await connectBrowser(), { send, evaluate, waitFor } = browser
const passed = []
try {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installBookingFixture.toString()})();window.__uncaught=0;addEventListener('error',e=>{if(e instanceof ErrorEvent)window.__uncaught++});addEventListener('unhandledrejection',()=>window.__uncaught++)` })
  for (const route of ['/', '/ships', '/booking/lookup', '/my-bookings/fixture-id?reference=UI-TEST-REF#details', '/login?reference=UI-TEST-REF#details']) {
    await send('Page.navigate', { url: 'http://127.0.0.1:5174' + route })
    await waitFor(`document.querySelector('h1') && document.querySelector('header a[href="/cruises"]') && document.querySelector('footer')`)
    assert.equal(await evaluate(`window.__uncaught`), 0)
    if (route.startsWith('/my-bookings') || route.startsWith('/login')) {
      assert.equal(await evaluate(`location.pathname`), '/booking/lookup')
      assert.equal(await evaluate(`location.hash`), '#details')
      assert.equal(await evaluate(`new URLSearchParams(location.search).get('reference')`), 'UI-TEST-REF')
      if (route.startsWith('/my-bookings')) assert.equal(await evaluate(`new URLSearchParams(location.search).get('bookingId')`), 'fixture-id')
    }
    passed.push(route)
  }
  await send('Page.navigate', { url: 'http://127.0.0.1:5174/booking/party?cruiseId=10000000-0000-4000-8000-000000000001' })
  await waitFor(`document.getElementById('real-booking-cruise') && !document.querySelector('button[type=submit]')?.disabled`)
  const styles = await evaluate(`(()=>{const el=document.getElementById('real-booking-cruise'),s=getComputedStyle(el);return {controlHeight:el.getBoundingClientRect().height,radius:s.borderRadius,font:s.fontFamily,token:getComputedStyle(document.documentElement).getPropertyValue('--ocevie-control-height-default').trim()}})()`)
  assert.ok(styles.controlHeight >= 44); assert.equal(styles.radius, '6px'); assert.equal(styles.token, '44px')
  console.log(JSON.stringify({ type: 'MOCK_BROWSER_REGRESSION', passed, measuredStyles: styles }))
} finally { browser.close() }
