import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { Buffer } from 'node:buffer'
import { setTimeout } from 'node:timers'
import { connectBrowser } from '../helpers/booking-browser.mjs'
import { installBookingFixture } from '../helpers/booking-fixture.mjs'

// Run against a local CDP browser and Vite server. All API responses are synthetic.
const origin = process.env.BOOKING_ORIGIN || 'http://127.0.0.1:5174'
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/)
const token = 'fixture_only_' + 'a'.repeat(30), password = 'fixture-password-2026'
const browser = await connectBrowser(), { send, evaluate, waitFor } = browser
const passed = []
const artifacts = process.env.ACTIVATION_ARTIFACT_DIR
async function open(hash = '#token=' + token) {
  await send('Page.navigate', { url: 'about:blank' })
  await waitFor(`location.href==='about:blank'`)
  await send('Page.navigate', { url: origin + '/activate-booking-account' + hash })
  await waitFor(`document.getElementById('activation-title')`)
}
async function fill(value = password, repeated = value) {
  await evaluate(`document.getElementById('activation-password').value=${JSON.stringify(value)};document.getElementById('activation-confirmation').value=${JSON.stringify(repeated)}`)
}
const submit = () => evaluate(`document.querySelector('main form').requestSubmit()`)
async function screenshot(name) {
  if (!artifacts) return
  mkdirSync(artifacts, { recursive: true })
  await evaluate(`(async()=>{await document.fonts.ready;window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})()`)
  const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(image.data, 'base64'))
}
try {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installBookingFixture.toString()})();
    window.__activation={count:0,mode:'success',leaked:false,unauthorized:false,badBody:false,errors:0};
    addEventListener('error',()=>window.__activation.errors++);addEventListener('unhandledrejection',()=>window.__activation.errors++);
    const originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(String(value).includes(${JSON.stringify(token)})||String(value).includes(${JSON.stringify(password)}))window.__activation.leaked=true;return originalSet.call(this,key,value)};
    const fixtureFetch=window.fetch;window.fetch=async(input,options={})=>{
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      if(url.pathname!=='/api/auth/booking-account/activate')return fixtureFetch(input,options);
      const f=window.__activation;f.count++;f.unauthorized=!!new Headers(options.headers).get('Authorization');
      const body=JSON.parse(options.body);f.badBody=url.search!==''||options.method!=='POST'||Object.keys(body).sort().join(',')!=='password,token'||body.token!==${JSON.stringify(token)};
      await new Promise(resolve=>setTimeout(resolve,250));
      if(f.mode==='network')throw new TypeError('private-backend-detail');
      if(f.mode==='timeout')return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
      if(f.mode==='success')return Response.json({success:true,message:'not rendered'});
      return Response.json({success:false,code:f.mode,message:'private-backend-detail',details:{token:body.token}},{status:f.mode==='ACCOUNT_DISABLED'?403:f.mode==='server-error'?503:400});
    };` })

  await open()
  assert.equal(await evaluate('location.hash'), '')
  assert.equal(await evaluate(`window.__activation.count`), 0)
  assert.equal(await evaluate(`JSON.stringify(history.state).includes(${JSON.stringify(token)})`), false)
  assert.equal(await evaluate(`document.body?.innerText.includes(${JSON.stringify(token)})`), false)
  passed.push('email deep link: fragment scrubbed before router history, no automatic submission or visible token')
  await screenshot('activation-desktop')

  await submit()
  await waitFor(`document.getElementById('activation-password').getAttribute('aria-invalid')==='true'`)
  assert.equal(await evaluate('document.activeElement.id'), 'activation-password')
  assert.equal(await evaluate('window.__activation.count'), 0)
  await fill('short'); await submit()
  assert.equal(await evaluate('window.__activation.count'), 0)
  await fill('a'.repeat(73)); await submit()
  assert.equal(await evaluate('window.__activation.count'), 0)
  await fill('á'.repeat(37)); await submit()
  assert.equal(await evaluate('window.__activation.count'), 0)
  await fill(password, 'mismatch'); await submit()
  assert.equal(await evaluate('document.activeElement.id'), 'activation-confirmation')
  assert.equal(await evaluate('window.__activation.count'), 0)
  passed.push('required, short/long, UTF-8 and confirmation errors prevent requests and focus the right field')

  await fill()
  assert.equal(await evaluate(`document.cookie.includes(${JSON.stringify(token)}) || JSON.stringify(localStorage).includes(${JSON.stringify(token)}) || JSON.stringify(sessionStorage).includes(${JSON.stringify(token)})`), false)
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Hiện mật khẩu').click()`)
  assert.equal(await evaluate(`document.getElementById('activation-password').type`), 'text')
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Ẩn mật khẩu').click()`)
  assert.equal(await evaluate(`document.getElementById('activation-password').type`), 'password')
  passed.push('password visibility control works without losing the input')
  await evaluate(`document.querySelector('main form').requestSubmit();document.querySelector('main form').requestSubmit()`)
  assert.equal(await evaluate(`document.getElementById('activation-password').disabled && document.querySelector('button[type=submit]').disabled`), true)
  await waitFor(`document.body?.innerText.includes('Tài khoản đã được kích hoạt.')`)
  assert.equal(await evaluate('window.__activation.count'), 1)
  assert.equal(await evaluate('window.__activation.badBody || window.__activation.unauthorized || window.__activation.leaked'), false)
  assert.equal(await evaluate(`!!document.querySelector('input[type=password],input[autocomplete=new-password]')`), false)
  await screenshot('activation-success')
  passed.push('double submit sends one public POST; success clears fields/token and does not log in')

  await send('Page.reload'); await waitFor(`document.body?.innerText.includes('Liên kết kích hoạt không hợp lệ.')`)
  assert.equal(await evaluate('window.__activation.count'), 0)
  passed.push('refresh after activation has no retained token and sends no request')

  await open()
  await evaluate(`document.querySelector('main a[href="/"]').click()`)
  await waitFor(`!document.getElementById('activation-title')`)
  await evaluate('history.back()')
  await waitFor(`document.body?.innerText.includes('Liên kết kích hoạt không hợp lệ.')`)
  passed.push('SPA back after leaving cannot recover a retained activation token')

  await open(); await fill()
  await evaluate(`dispatchEvent(new PageTransitionEvent('pagehide'));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))`)
  await waitFor(`document.body?.innerText.includes('Liên kết kích hoạt không hợp lệ.')`)
  assert.equal(await evaluate('window.__activation.count'),0)
  passed.push('pagehide/BFCache restore lifecycle clears passwords and invalidates the retained token')

  for (const [mode, expected] of [['ACCOUNT_SETUP_INVALID','Liên kết không còn sử dụng được'],['ACCOUNT_DISABLED','Tài khoản hiện không thể kích hoạt'],['PASSWORD_TOO_LONG','rút ngắn mật khẩu'],['unknown-code','Chưa thể kích hoạt tài khoản'],['server-error','Chưa xác định được kết quả kích hoạt'],['network','Chưa xác định được kết quả kích hoạt'],['timeout','Chưa xác định được kết quả kích hoạt']]) {
    await open(); await evaluate(`window.__activation.mode=${JSON.stringify(mode)}`); await fill(); await submit()
    if(mode==='timeout') await new Promise(resolve=>setTimeout(resolve,20500))
    await waitFor(`document.querySelector('main').innerText.includes(${JSON.stringify(expected)})`)
    assert.equal(await evaluate(`document.body?.innerText.includes('private-backend-detail')`), false)
    assert.equal(await evaluate('window.__activation.count'), 1)
    if(['server-error','network','timeout'].includes(mode)) assert.equal(await evaluate(`!!document.querySelector('button[type=submit]')`), false)
    passed.push('safe UI response: '+mode)
    if(mode==='network') await screenshot('activation-uncertain')
  }

  for (const hash of ['', '#token=%20bad', '#token=a&token=b', '?token=fixture-query']) {
    await open(hash)
    await waitFor(`document.body?.innerText.includes('Liên kết kích hoạt không hợp lệ.')`)
    assert.equal(await evaluate('window.__activation.count'), 0)
  }
  passed.push('missing, malformed, repeated and query tokens are blocked')

  for (const width of [320,390,768,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await open()
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
    const target = await evaluate(`(()=>{const p=document.getElementById('activation-password').getBoundingClientRect(),b=document.querySelector('button[type=submit]').getBoundingClientRect();return {input:p.height,button:b.height}})()`)
    assert.ok(target.input>=44 && target.button>=44)
    await screenshot('activation-'+width)
  }
  passed.push('320/390/768/1440 widths fit with touch targets >=44px')
  await send('Emulation.clearDeviceMetricsOverride')
  await evaluate(`document.querySelector('a[href="/booking/lookup"]').click()`)
  await waitFor(`document.getElementById('lookup-email')`)
  await evaluate(`document.querySelector('header a[href="/cruises"]').click()`)
  await waitFor(`location.pathname==='/cruises' && document.querySelector('h1')`)
  assert.equal(await evaluate('window.__activation.errors'), 0)
  passed.push('existing lookup/catalog navigation preserved; no uncaught errors')
  const output={type:'SYNTHETIC_ACTIVATION_BROWSER_QA',passed}
  if(artifacts) writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify(output,null,2))
  console.log(JSON.stringify(output,null,2))
} finally { browser.close() }
