import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import './register-typescript.mjs';
import { createPassengerApi } from '../src/features/passenger-actions/passenger-api.ts';
import { notificationSchema, notificationDestination, uniqueNotifications } from '../src/features/notifications/notification-contracts.ts';
import { readPublicModel } from '../src/features/home/ship-information.ts';
import { itineraryDaySelection } from '../src/features/home/voyage-home-model.ts';
import { createItineraryApi } from '../src/features/itinerary/itinerary-client.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const notification={notificationId:id(1),notificationType:'CRUISE_SCHEDULE_CHANGE',title:'Lịch mới',content:'Đã thay đổi',createdAt:'2026-11-25T00:00:00Z'};
test('notification nullable fields are explicit and exact duplicates do not render twice', () => {
  const row=notificationSchema.parse(notification); assert.equal(row.bookingPassengerId,null); assert.equal(row.readAt,null);
  assert.equal(uniqueNotifications([row,row]).length,1);
  assert.throws(()=>uniqueNotifications([row,{...row,content:'different'}]));
  for (const change of [{notificationId:'wrong'},{createdAt:'today'},{content:null},{readAt:'invalid'}]) assert.equal(notificationSchema.safeParse({...notification,...change}).success,false);
});
test('unread and mark-all use actual REST DTO and never implicitly ACK', async () => {
  const calls=[]; const api=createPassengerApi({request:async(path,options)=>{calls.push({path,...options}); return path.endsWith('/unread-count')?{unreadCount:3}:path.endsWith('/read-all')?{updatedCount:2}:{...notification,readAt:'2026-11-25T01:00:00Z'};}});
  assert.equal(await api.notificationUnread(),3); assert.equal(await api.markAllNotificationsRead(),2); await api.markNotificationRead(id(1));
  assert.deepEqual(calls.map(x=>[x.path,x.method]),[['/notifications/unread-count',undefined],['/notifications/read-all','PATCH'],[`/notifications/${id(1)}/read`,'PATCH']]);
  assert.ok(calls.every(x=>!x.path.endsWith('/ack')));
  for (const unreadCount of [null,undefined,-1,1.5,'2']) await assert.rejects(createPassengerApi({request:async()=>({unreadCount})}).notificationUnread());
});
test('notification list rejects malformed response and sorts actual instants across offsets', async () => {
  const api=createPassengerApi({request:async()=>[notification,{...notification,notificationId:id(2),createdAt:'2026-11-25T06:00:00+07:00'}]});
  assert.deepEqual((await api.notifications()).map(x=>x.notificationId),[id(1),id(2)]);
  await assert.rejects(createPassengerApi({request:async()=>({content:[]})}).notifications());
});
test('deep link requires exact verified BP and explicit switch for another voyage', () => {
  const voyages=[{bookingPassengerId:id(3),bookingId:id(4),cruiseId:id(5),itineraryId:id(6)}];
  const row=notificationSchema.parse({...notification,bookingPassengerId:id(3)});
  assert.equal(notificationDestination(row,voyages,id(3)).kind,'itinerary');
  assert.equal(notificationDestination(row,voyages,id(9)).kind,'switch');
  assert.equal(notificationDestination(row,[],id(3)).kind,'unavailable');
  for (const change of [{bookingPassengerId:null},{bookingPassengerId:id(9)},{notificationType:'PAYMENT_CONFIRMED'},{notificationType:'POS_SALE'},{notificationType:'https://evil.invalid'}]) assert.equal(notificationDestination({...row,...change},voyages,id(3)).kind,'unavailable');
});
test('day selection follows Home Today, preserves valid chosen day and reports removed identity', () => {
  const days=[{itineraryDayId:id(1),date:'2026-11-24',shipTimeZoneId:'Asia/Singapore'},{itineraryDayId:id(2),date:'2026-11-25',shipTimeZoneId:'Asia/Bangkok'}];
  const now=Date.parse('2026-11-25T01:00:00Z');
  assert.equal(itineraryDaySelection(days,undefined,now).day.itineraryDayId,id(2));
  assert.equal(itineraryDaySelection(days,id(1),now).day.itineraryDayId,id(1));
  assert.equal(itineraryDaySelection(days,id(9),now).removedDay,true);
  assert.equal(itineraryDaySelection([],id(1),now).day,undefined);
});
test('Passenger itinerary rejects a formerly published itinerary returned as an internal draft', async () => {
  let calls=0; const api=createItineraryApi({request:async()=>{calls++;return {itineraryId:id(1),cruiseId:id(2),itineraryName:'Plan',startDate:'2026-11-24',endDate:'2026-11-27',status:'DRAFT'};}});
  await assert.rejects(api.detail(id(1),undefined,{expectedCruiseId:id(2)})); assert.equal(calls,1);
});
const model={shipId:id(7),modelId:id(8),manifest:{modelId:'physical',name:'Published vessel',revision:'v1',units:'metre',assets:{exterior:'assets/exterior.glb'},decks:[{id:'deck1',number:1,name:'Deck',asset:'decks/one.glb'}]},cabinMappings:[{modelId:'cabin-node',cabinId:id(9)}]};
test('public model metadata must belong to selected ship and never accepts arbitrary asset URL or traversal', () => {
  assert.equal(readPublicModel(model,id(7)).manifest.revision,'v1'); assert.throws(()=>readPublicModel(model,id(9)));
  for (const asset of ['../other.glb','/root.glb','https://evil.invalid/model.glb','a/../../x.glb','image.png']) assert.throws(()=>readPublicModel({...model,manifest:{...model.manifest,assets:{full:asset}}},id(7)));
  assert.throws(()=>readPublicModel({...model,manifest:null},id(7)));
});
test('ship decks reject another ship instead of showing incomplete location metadata', async () => {
  const api=createPassengerApi({request:async()=>[{deckId:id(1),shipId:id(8),deckNumber:1}]});
  await assert.rejects(api.decks(id(7)));
});
test('Support has no fabricated contact, ticket mutation or chat success flow', async () => {
  const text=await readFile(new URL('../src/features/support/PassengerSupportScreen.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(text,/api\.request|\bfetch\(|tel:|mailto:|ticketId|gửi thành công/);
  assert.match(text,/Không chờ phản hồi trong ứng dụng/);
});
