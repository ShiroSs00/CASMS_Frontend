import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const copy=JSON.parse(readFileSync(new URL('../../src/shared/i18n/vi-business-map.json',import.meta.url),'utf8'))
const pairs=[
 ['trip.READY','cruise.ready.READY'],['trip.template.PUBLISHED','cruise.plan.APPROVED'],
 ['cruise.plan.APPROVED','pricing.policy.APPROVED'],['cruise.DRAFT','cruise.sale.OPEN'],
 ['cruise.plan.SUBMITTED','preparation.section.SUBMITTED'],['cruise.plan.REJECTED','cruise.plan.REVISION_REQUESTED'],
 ['cruise.plan.WITHDRAW_ACTION','preparation.section.RETURN_ACTION'],['preparation.section.CONFIRMED','cruise.ready.READY'],
 ['booking.CREATED','booking.PAYMENT_PENDING'],['cruise.itinerary.FIXED','route.type.ROUND_TRIP'],
 ['cruise.itinerary.CUSTOM','route.type.ONE_WAY'],['source.scope.DOMESTIC','cruise.duration.ONE_DAY'],
 ['source.scope.INTERNATIONAL','cruise.duration.MULTI_DAYS'],['program.SHORE_EXCURSION','program.TOUR_PACKAGE'],
 ['booking.quote.CREATED','booking.CREATED'],['cruise.sale.NOT_OPEN','cruise.sale.SOLD_OUT']
]
for(const [a,b] of pairs)test(`v4 semantic distinction ${a} vs ${b}`,()=>{
 assert.equal(typeof copy[a],'string');assert.equal(typeof copy[b],'string');assert.notEqual(copy[a],copy[b])
})
test('CRM template completion names the source decision only',()=>{
 assert.equal(copy['trip.template.FINALIZE_ACTION'],'Chốt mẫu lịch trình')
 assert.equal(copy['trip.template.PUBLISHED'],'Mẫu đã chốt')
 assert.equal(copy['cruise.plan.APPROVE_ACTION'],'Phê duyệt kế hoạch khởi hành')
})
