import test from 'node:test'
import assert from 'node:assert/strict'
import { lookupItinerary, toLiveDays, toLivePortCalls, toLiveShip } from './live-itinerary-contract.ts'

const cruiseId='3fa85f64-5717-4562-b3fc-2c963f66afa6'
const itineraryId='3fa85f64-5717-4562-b3fc-2c963f66afa7'
const otherId='3fa85f64-5717-4562-b3fc-2c963f66afa8'
const itinerary={itineraryId,cruiseId,itineraryName:'Lịch trình thật',status:'APPROVED'}
const page=(number,totalPages,content)=>({number,totalPages,totalElements:totalPages,content})

test('bounded paged lookup matches verified cruiseId only',async()=>{
  const requested=[]
  const result=await lookupItinerary(cruiseId,async n=>{requested.push(n);return n===0?page(0,3,[{...itinerary,itineraryId:otherId,cruiseId:otherId}]):page(1,3,[itinerary])})
  assert.equal(result.kind,'found')
  assert.equal(result.itinerary.id,itineraryId)
  assert.deepEqual(requested,[0,1])
  assert.deepEqual(await lookupItinerary(cruiseId,async n=>page(n,1,[])),{kind:'missing'})
  assert.deepEqual(await lookupItinerary(cruiseId,async n=>page(n,9,[]),2),{kind:'limit',pagesScanned:2,totalPages:9})
  await assert.rejects(()=>lookupItinerary(cruiseId,async()=>page(4,5,[])),/Phân trang/)
  await assert.rejects(()=>lookupItinerary(cruiseId,async n=>page(n,n===0?3:4,[])),/thay đổi/)
})

test('ship, days and port calls require matching backend identifiers',()=>{
  const ship=toLiveShip({shipId:otherId,shipName:'Ocean Voyager',totalDecks:4,totalCapacity:80})
  assert.equal(ship.decks,4)
  assert.equal('price' in ship,false)
  const days=toLiveDays([{itineraryDayId:otherId,itineraryId,dayNumber:2,description:'Tham quan'},{itineraryDayId:cruiseId,itineraryId,dayNumber:1}],itineraryId)
  assert.deepEqual(days.map(day=>day.number),[1,2])
  const stops=toLivePortCalls([{cruiseStopId:otherId,itineraryId,portName:'Cảng Tuần Châu',stopOrder:1,plannedArrival:'2026-11-20T02:00:00Z'}],itineraryId)
  assert.equal(stops[0].port,'Cảng Tuần Châu')
  assert.equal('available' in stops[0],false)
  assert.throws(()=>toLiveDays([{itineraryDayId:otherId,itineraryId:cruiseId,dayNumber:1}],itineraryId),/không thuộc/)
  assert.throws(()=>toLivePortCalls([{cruiseStopId:otherId,itineraryId:cruiseId}],itineraryId),/không thuộc/)
})
