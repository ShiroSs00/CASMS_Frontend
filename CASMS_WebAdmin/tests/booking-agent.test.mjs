import assert from 'node:assert/strict'
import test from 'node:test'
import { realBookingApi, decodeBookingDetail, bookingCruisePackageSelectionErrors, bookingFieldErrors } from '../src/features/booking/api/real-booking-api.ts'
import { recoverQuotedBooking, requestBookingQuote, createQuotedBooking } from '../src/features/booking/api/booking-quote-api.ts'
import { bookingLookupErrors, readBookingRecovery, writeBookingRecovery } from '../src/features/booking/model/booking-agent.ts'
import { bookingMutationFailure } from '../src/features/booking/model/booking-mutation.ts'
import { canManageBooking } from '../src/features/booking/model/booking-permissions.ts'
import { bookingBirthDate, bookingWhen } from '../src/features/booking/model/real-booking-view.ts'
import { ApiError, setApiAccessToken } from '../src/shared/api/client.ts'
import { setSessionAccess } from '../src/shared/auth/session-access.ts'
import { canRoleOpenAdminPath } from '../src/shared/ui/admin-v3/admin-navigation.ts'
const booking={bookingId:'booking',bookingReference:'BK-QA',bookingStatus:'Draft',cruiseId:'cruise',cruiseName:'History cruise',passengers:[],installments:[],agreedFareAmount:100,requiredDepositAmount:30,currency:'VND',contractStatus:'Draft'}
const actor=(permissions=[])=>({status:'ready',userId:'agent-a',roles:['BOOKING_AGENT'],permissions,has:p=>permissions.includes(p),canDo:p=>permissions.includes(p)})
function setup(t){setSessionAccess(actor(['BOOKING_READ','BOOKING_CREATE','BOOKING_CONFIRM','BOOKING_CANCEL','BOOKING_CABIN_ASSIGN']));setApiAccessToken('test-only');t.after(()=>{setApiAccessToken(null);setSessionAccess({status:'anonymous',roles:[],permissions:[],userId:null,has:()=>false})})}
const ok=data=>Response.json({success:true,data})
test('booking timestamps display Vietnam time with minutes and a padded calendar date', () => {
  assert.equal(bookingWhen('2026-11-19T17:05:00Z'), '00:05 · 20/11/2026')
  assert.equal(bookingWhen('2026-02-01T01:00:00Z'), '08:00 · 01/02/2026')
  assert.equal(bookingWhen('invalid'), 'Chưa có thông tin')
})

test('passenger birth date retains its date-only value when formatted', () => {
  assert.equal(bookingBirthDate('1993-05-08'), '08/05/1993')
  assert.equal(bookingBirthDate(null), 'Chưa cung cấp')
})

test('history filters traverse every scoped booking page, never the sale catalogue',async t=>{setup(t);const calls=[];t.mock.method(globalThis,'fetch',async url=>{calls.push(url);const page=Number(new URL(url,'http://test').searchParams.get('page'));return ok({number:page,totalPages:2,totalElements:21,content:[{...booking,cruiseId:page?'closed':'open',cruiseName:page?'Closed':'Open'}]})});assert.deepEqual((await realBookingApi.historyCruises()).map(c=>c.cruiseId),['closed','open']);assert.equal(calls.length,2);assert.ok(calls.every(url=>url.startsWith('/api/booking?')))})
test('server pagination and filters serialize, mismatched page rejects',async t=>{setup(t);t.mock.method(globalThis,'fetch',async url=>{const q=new URL(url,'http://test').searchParams;assert.equal(q.get('page'),'2');assert.equal(q.get('status'),'Confirmed');assert.equal(q.get('cruiseId'),'closed');return ok({number:0,totalPages:3,totalElements:41,content:[]})});await assert.rejects(realBookingApi.list(2,'Confirmed','closed'),/trang/)})
for(const status of [403,404,500])test('list HTTP '+status+' remains error, not empty',async t=>{setup(t);t.mock.method(globalThis,'fetch',async()=>Response.json({success:false},{status}));await assert.rejects(realBookingApi.list(0),e=>e instanceof ApiError&&e.status===status)})
test('creation excludes unsellable cruises, inspection retains server decisions',async t=>{setup(t);t.mock.method(globalThis,'fetch',async url=>url.includes('/sellability')?ok({cruiseId:url.includes('/closed/')?'closed':'open',sellable:!url.includes('/closed/')}):ok({content:['open','closed'].map(cruiseId=>({cruiseId,cruiseName:cruiseId,cruiseCode:cruiseId,status:'PUBLISHED',shipId:'ship',departureDatetime:'2099-01-01T00:00:00Z'})),totalPages:1}));assert.equal((await realBookingApi.saleCruises()).length,2);assert.deepEqual((await realBookingApi.cruises()).map(c=>c.cruiseId),['open'])})
test('lookup validates contact and reference',()=>{assert.ok(bookingLookupErrors('','','').reference);assert.ok(bookingLookupErrors('BK','bad','').email);assert.ok(bookingLookupErrors('BK','','123').phone);assert.deepEqual(bookingLookupErrors('BK','guest@example.test',''),{});assert.deepEqual(bookingLookupErrors('BK','','+84912345678'),{})})
test('detail validates financial and signed contract fields without fake defaults',()=>{assert.equal(decodeBookingDetail({...booking,totalPaidAmount:10,outstandingBalance:90}).totalPaidAmount,10);for(const patch of [{outstandingBalance:-1},{totalPaidAmount:'100'},{contractAcceptedAt:'invalid'},{shipName:123},{installments:null}])assert.throws(()=>decodeBookingDetail({...booking,...patch}))})
test('recovery is GET-only and checks cruise identity',async t=>{setup(t);const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push([url,options.method]);return ok(booking)});assert.equal((await recoverQuotedBooking({idempotencyKey:'key',cruiseId:'cruise'})).bookingId,'booking');assert.match(calls[0][0],/booking\/recovery\?idempotencyKey=key/);assert.equal(calls[0][1],'GET');await assert.rejects(recoverQuotedBooking({idempotencyKey:'key',cruiseId:'other'}))})
test('recovery persists only request references and isolates accounts',t=>{const store=new Map();Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});t.after(()=>delete globalThis.sessionStorage);writeBookingRecovery('A',{idempotencyKey:'key',cruiseId:'cruise'});assert.equal(readBookingRecovery('B'),null);assert.deepEqual(readBookingRecovery('A'),{idempotencyKey:'key',cruiseId:'cruise'});writeBookingRecovery('A',null);assert.equal(readBookingRecovery('A'),null)})
for(const status of [400,403,404,409,422,500,0])test('mutation uncertainty at HTTP '+status,()=>assert.equal(bookingMutationFailure(new ApiError('',status)).uncertain,status===0||status>=500))
test('lifecycle and route guards require real permissions',()=>{for(const action of ['confirm','cancel','cabin'])assert.equal(canManageBooking(action,'Draft',actor()),false);assert.equal(canManageBooking('confirm','Confirmed',actor(['BOOKING_CONFIRM'])),false);assert.equal(canManageBooking('cabin','Cancelled',actor(['BOOKING_CABIN_ASSIGN'])),false);assert.equal(canManageBooking('cabin','Draft',actor(['BOOKING_UPDATE'])),true);assert.equal(canRoleOpenAdminPath(['BOOKING_AGENT'],'/admin/bookings/cruises','',actor(['BOOKING_READ'])),true);assert.equal(canRoleOpenAdminPath(['BOOKING_AGENT'],'/admin/bookings/new','',actor(['BOOKING_READ'])),false)})
const draft={cruiseId:'cruise',currency:'VND',paymentPlan:'FULL',notes:'',passengers:[{fullName:'QA Guest',dateOfBirth:'',nationality:'VN',documentType:'',documentNumber:'',email:'guest@example.test',phoneNumber:'',cabinId:'cabin',tourPackageId:''}]}
test('a new fare price revision requires a fresh selection and stale quote rejection never creates a booking', async t => {
  setup(t)
  const fareDraft = { ...draft, passengers: [{
    ...draft.passengers[0], farePackageOfferId: 'offer', farePackagePriceRevisionId: 'quoted-price', cabinSelectionMode: 'PHYSICAL_CABIN',
  }] }
  const catalog = { cruiseId: draft.cruiseId, fareManaged: true, offers: [
    { selection: { offerId: 'offer', priceRevisionId: 'new-price' } },
  ] }
  assert.ok(bookingCruisePackageSelectionErrors(fareDraft, catalog)['person-0-farePackageOfferId'])
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    assert.equal(JSON.parse(options.body).passengers[0].farePackagePriceRevisionId, 'quoted-price')
    return Response.json({ success: false, code: 'FARE_QUOTED_PRICE_STALE' }, { status: 409 })
  })
  await assert.rejects(requestBookingQuote(fareDraft), error => error.status === 409 && error.code === 'FARE_QUOTED_PRICE_STALE')
  assert.deepEqual(calls, ['/api/booking/quotes'])
})

for (const scenario of [
  { run: () => realBookingApi.cancel('booking', 'QA'), code: 'CANCELLATION_CASE_REQUIRED', message: /gửi yêu cầu hủy/ },
  { run: () => realBookingApi.changeCabin('person', 'new-cabin', 'QA'), code: 'FARE_CABIN_CHANGE_NOT_SUPPORTED', message: /chưa hỗ trợ đổi cabin/i },
]) {
  test('booking mutation preserves Backend rejection ' + scenario.code, async t => {
    setup(t)
    t.mock.method(globalThis, 'fetch', async () => Response.json({ success: false, code: scenario.code }, { status: 409 }))
    await assert.rejects(scenario.run(), error => {
      assert.equal(error.code, scenario.code)
      assert.equal(bookingMutationFailure(error).uncertain, false)
      assert.match(bookingMutationFailure(error).message, scenario.message)
      return true
    })
  })
}

test('unsellable cruise and over-capacity cabin are invalid',()=>{const cruise={cruiseId:'cruise',status:'PUBLISHED',sellable:false,shipId:'ship',departureDatetime:'2099-01-01T00:00:00Z'},cabins=[{cabinId:'cabin',remainingCapacity:0,capacity:2}];assert.ok(bookingFieldErrors(draft,cruise,cabins)['real-booking-cruise']);assert.ok(bookingFieldErrors(draft,{...cruise,sellable:true},cabins)['person-0-cabinId'])})
test('BE quote price/currency and Idempotency-Key are retained',async t=>{setup(t);const quote={quoteId:'quote',cruiseId:'cruise',currency:'VND',status:'ACTIVE',expiresAt:'2099-01-01T00:00:00Z',totalAmount:100,policyVersion:'v1',fingerprint:'f1',paymentPlan:'FULL',lineItems:[{cabinId:'cabin'}]},calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push([url,options]);return ok(url==='/api/booking'?booking:quote)});const intent=await requestBookingQuote(draft);await createQuotedBooking(draft,intent);const req=calls.find(([url])=>url==='/api/booking')[1];assert.equal(req.headers['Idempotency-Key'],intent.idempotencyKey);assert.equal(JSON.parse(req.body).quoteId,'quote');assert.equal(JSON.parse(req.body).currency,'VND');assert.equal(Object.hasOwn(JSON.parse(req.body),'agreedFareAmount'),false)})
test('expired quote rejects without booking create',async t=>{setup(t);let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return ok({quoteId:'quote',cruiseId:'cruise',currency:'VND',status:'EXPIRED',expiresAt:'2000-01-01T00:00:00Z'})});await assert.rejects(requestBookingQuote(draft));assert.equal(calls,1)})
