import assert from 'node:assert/strict'
import test from 'node:test'
import { mockActionResult, previewBooking, defaultScenario, cabinConflict, bookingStatusLabel } from './booking-scenarios.ts'
import { searchCruiseFixtures } from './cruise-search.ts'
import { initialDraft } from './booking-draft.ts'

test('port, month and quick filters compose; count and sorting reflect the adapter result',()=>{
 const cruises=[{id:'a',title:'Lan Hạ',port:'Tuần Châu',departure:'2026-11-20',duration:3,balcony:true,price:4800000},{id:'b',title:'Hạ Long',port:'Hòn Gai',departure:'2026-12-02',duration:2,balcony:false,price:3900000}]
 const query={destination:'',port:'',month:'',quick:[],sort:'price'}
 assert.equal(searchCruiseFixtures(cruises,query).totalResults,2)
 assert.deepEqual(searchCruiseFixtures(cruises,{...query,port:'Hòn Gai'}).items.map(c=>c.id),['b'])
 assert.equal(searchCruiseFixtures(cruises,{...query,port:'Hòn Gai',month:'2026-11'}).totalResults,0)
 assert.equal(searchCruiseFixtures(cruises,{...query,port:'missing'}).totalResults,0)
 assert.equal(searchCruiseFixtures(cruises,query).certainty,'fixture')
 assert.equal(cruises[0].id,'a')
})
test('stale cabin detection retains every field until an explicit replacement',()=>{
 const draft=initialDraft();draft.selectedCabinCategory='deluxe';draft.passengerPackages[draft.travellers[0].id]='Plus'
 const before=structuredClone(draft)
 assert.equal(cabinConflict(draft,'deluxe'),true)
 assert.deepEqual(draft,before)
 assert.equal(cabinConflict({...draft,selectedCabinCategory:'balcony'},'deluxe'),false)
})
test('deterministic actions expose all outcomes, with a reference only from received fixtures',()=>{
 for(const scenario of ['missing','received','validation','conflict','network-error','unknown','no-access','expired']){
  const result=mockActionResult('booking-create',scenario)
  assert.equal(result.state,scenario==='network-error'?'error':scenario)
  assert.equal(Boolean(result.reference),scenario==='received')
  assert.deepEqual(mockActionResult('booking-create',scenario),result)
 }
 for(const capability of ['payment-start','payment-status','contract-read','contract-accept','boarding-pass'])assert.equal(mockActionResult(capability,'received').state,'missing')
 assert.match(mockActionResult('arrival-save','received').message,/Chưa lưu lên hệ thống/)
})
test('payment, request and passenger scenarios never change booking status or confer boarding readiness',()=>{
 const booking={status:'Draft',payment:'Pending',fare:100,paid:0,passengers:[{id:'a',checkin:'Completed'}]}
 const original=structuredClone(booking)
 for(const payment of ['Pending','Confirmed','Failed','Cancelled']){
  const result=previewBooking(booking,{...defaultScenario,payment,requestStage:'decision'})
  assert.equal(result.payment,payment);assert.equal(result.status,'Draft')
  assert.equal(result.passengers[0].checkin,'Completed')
 }
 assert.equal(previewBooking(booking,{...defaultScenario,checkin:'BoardingReady'}).passengers[0].checkin,'BoardingReady')
 assert.equal(bookingStatusLabel.Draft,'Chờ xử lý')
 assert.deepEqual(booking,original)
})
