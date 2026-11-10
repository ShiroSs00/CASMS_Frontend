import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { connectBrowser } from '../helpers/booking-browser.mjs'
import { installBookingFixture } from '../helpers/booking-fixture.mjs'

const browser = await connectBrowser(), { send, evaluate, waitFor } = browser
const origin = 'http://127.0.0.1:5174', passed = [], artifacts = process.env.PAYMENT_ARTIFACT_DIR
async function screenshot(name) {
  if (!artifacts) return
  mkdirSync(artifacts, { recursive: true })
  await evaluate(`(async()=>{await document.fonts.ready;window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})()`)
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(result.data, 'base64'))
}
async function lookup(mode) {
  await send('Page.navigate', { url: 'about:blank' }); await waitFor(`location.href==='about:blank'`)
  await send('Page.navigate', { url: origin + '/booking/lookup?reference=PAY-A' })
  await waitFor(`document.getElementById('lookup-email')`)
  await evaluate(`window.__paymentMode=${JSON.stringify(mode)};document.getElementById('lookup-email').focus()`)
  await send('Input.insertText', { text: 'owner@example.test' })
  await evaluate(`document.querySelector('main form').requestSubmit()`)
  await waitFor(`document.querySelector('[aria-label="Kết quả tra cứu"]')||document.getElementById('lookup-error-summary')`)
}
const valueOf = label => evaluate(`(()=>{const dt=[...document.querySelectorAll('dt')].find(e=>e.textContent===${JSON.stringify(label)});return dt?.nextElementSibling?.textContent})()`)
try {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installBookingFixture.toString()})();
    window.__paymentMode='partial';window.__lookupProof=false;
    const previous=window.fetch;window.fetch=async(input,options={})=>{
      const url=new URL(String(input),location.href);if(url.pathname!=='/api/booking/lookup')return previous(input,options);
      window.__lookupProof=url.searchParams.get('reference')==='PAY-A'&&url.searchParams.get('email')==='owner@example.test';
      const row={bookingId:'booking-a',bookingReference:'PAY-A',bookingStatus:'Confirmed',cruiseId:'cruise-a',cruiseName:'Hải trình OceVie',agreedFareAmount:1000.5678,currency:'USD',requiredDepositAmount:300,paymentPlan:'DEPOSIT',contractStatus:'Accepted',totalPaidAmount:350.1234,outstandingBalance:650.4444,fullyPaid:false,
        installments:[{sequenceNo:1,requiredAmount:300,currency:'USD',status:'Scheduled',installmentType:'Deposit',paidAmount:300,outstandingAmount:0,paid:true},{sequenceNo:2,requiredAmount:700.5678,currency:'USD',status:'Scheduled',installmentType:'FinalFare',paidAmount:50.1234,outstandingAmount:650.4444,paid:false}],
        passengers:[{bookingPassengerId:'bp-a',passengerId:'p-a',fullName:'Hành khách kiểm thử',participationStatus:'Active'}],activationToken:'synthetic-must-not-render'};
      const mode=window.__paymentMode;
      if(mode==='full-draft')Object.assign(row,{bookingStatus:'Draft',contractStatus:'Draft',totalPaidAmount:1000.5678,outstandingBalance:0,fullyPaid:true});
      if(mode==='cancelled'){Object.assign(row,{bookingStatus:'Cancelled',contractStatus:'Cancelled',totalPaidAmount:50.1234,outstandingBalance:950.4444});row.installments=row.installments.map(i=>({...i,status:'Cancelled',paidAmount:0,outstandingAmount:i.requiredAmount,paid:false}))}
      if(mode==='missing'){delete row.totalPaidAmount;delete row.outstandingBalance;delete row.fullyPaid;row.installments=row.installments.map(i=>({...i,paidAmount:null,outstandingAmount:null,paid:null}))}
      if(mode==='invalid')row.totalPaidAmount='not-a-number';if(mode==='other')row.bookingReference='PAY-B';
      return Response.json({success:true,data:row});
    };` })
  await lookup('partial')
  assert.equal(await valueOf('Đã thanh toán'), '350,1234 USD')
  assert.equal(await valueOf('Còn phải thanh toán'), '650,4444 USD')
  assert.equal(await valueOf('Trạng thái thanh toán'), 'Chưa thanh toán đủ')
  assert.equal(await evaluate('window.__lookupProof'), true)
  assert.equal(await evaluate(`document.body.innerText.includes('synthetic-must-not-render')`), false)
  passed.push('partial/Confirmed shows exact server totals/installments, retains guest contact proof, excludes setup token')
  for (const width of [390,1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:false })
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true)
    await screenshot('web-payment-'+width)
  }
  passed.push('390 and 1440px financial summary has no horizontal page overflow')
  await lookup('full-draft')
  assert.equal(await valueOf('Trạng thái thanh toán'), 'Đã thanh toán đủ')
  assert.equal(await evaluate(`document.querySelector('[aria-label="Kết quả tra cứu"]').innerText.includes('Đặt chỗ đang chờ xác nhận')`), true)
  assert.equal(await evaluate(`document.querySelector('[aria-label="Kết quả tra cứu"]').innerText.includes('Bản nháp')`), true)
  await screenshot('web-paid-unsigned')
  passed.push('fully paid Draft remains awaiting physical contract/booking confirmation')
  await lookup('cancelled')
  assert.equal(await valueOf('Đã thanh toán'), '50,1234 USD')
  assert.equal(await valueOf('Còn phải thanh toán'), '950,4444 USD')
  assert.equal(await evaluate(`document.body.innerText.includes('không phải yêu cầu thanh toán hoặc xác nhận hoàn tiền')`), true)
  passed.push('cancelled/refund-adjusted data remains server-authoritative with reconciliation warning')
  await lookup('missing')
  assert.equal(await valueOf('Đã thanh toán'), 'Chưa cập nhật')
  assert.equal(await valueOf('Trạng thái thanh toán'), 'Chưa cập nhật')
  passed.push('missing financial projections render unknown, never zero/paid')
  for(const mode of ['invalid','other']) {
    await lookup(mode)
    assert.equal(await evaluate(`!!document.getElementById('lookup-error-summary')`),true)
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Kết quả tra cứu"]')`),false)
    passed.push(mode==='other'?'wrong booking reference cannot expose a financial record':'invalid financial response fails closed')
  }
  await evaluate(`document.getElementById('header-contact').click()`)
  await waitFor(`document.getElementById('header-contact-modal')`)
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('header-contact-modal')).position`), 'relative')
  await evaluate(`document.querySelector('[aria-label="Đóng bảng liên hệ"]').click()`)
  passed.push('shared PublicContact opens/closes with extracted styles; no feature-to-app dependency')
  const result={type:'WEB_BOOKING_PAYMENT_FIXTURE_QA',passed}
  if(artifacts)writeFileSync(path.join(artifacts,'web-browser-results.json'),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result,null,2))
} finally {browser.close()}
