import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
import { createSseParser, decodeStreamEvent, startNotificationStream } from '../src/features/notifications/notification-stream.ts';
import { notificationQueryAllowed } from '../src/features/notifications/notification-queries.ts';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const notification = { notificationId: id(1), bookingPassengerId: id(2), title: 'Lịch trình mới', content: 'Cập nhật lịch', notificationType: 'CRUISE_SCHEDULE_CHANGE', createdAt: '2026-11-25T00:00:00Z' };
const flush = () => new Promise(resolve => setImmediate(resolve));
function clock() {
  let now=0, seq=0; const jobs=new Map();
  return { jobs, schedule: (fn,ms) => { const key=++seq; jobs.set(key,{ fn, at:now+ms }); return key; }, cancel:key => jobs.delete(key),
    async advance(ms) { const end=now+ms; let count=0; while (true) { const next=[...jobs].filter(([,job])=>job.at<=end).sort((a,b)=>a[1].at-b[1].at)[0]; if (!next) break; assert.ok(++count<100); now=next[1].at; jobs.delete(next[0]); next[1].fn(); await flush(); } now=end; await flush(); } };
}
function setup(fetch, token = 'test-token') {
  const time=clock(), invalidations=[], statuses=[], calls=[]; let current=true;
  const stop=startNotificationStream({ baseUrl:'https://qa.invalid/api',token,current:()=>current, random:()=>.5,
    fetch:async(url,init)=>{ calls.push({url,...init}); return fetch(url,init); }, invalidate:value=>invalidations.push(value),status:value=>statuses.push(value),schedule:time.schedule,cancel:time.cancel });
  return { time, invalidations, statuses, calls, stop, change:()=>{current=false;} };
}
test('SSE parser handles arbitrary CRLF boundaries, multiline data, comments and UTF-8 text', () => {
  const events=[], parse=createSseParser(value=>events.push(value));
  for (const part of [':ping\r','\nevent: notification\r','\ndata: {"a":\r\n','data: "Tiếng Việt"}\r\n\r','\n']) parse(part);
  assert.deepEqual(events,[{name:'notification',data:'{"a":\n"Tiếng Việt"}'}]);
  assert.deepEqual(decodeStreamEvent({name:'connected',data:'{"connected":true}'}),{kind:'connected'});
});
test('malformed or unknown SSE events never become business state', () => {
  for (const event of [{name:'other',data:'{}'},{name:'notification',data:'null'},{name:'connected',data:'{"connected":false}'},{name:'unread-count',data:'{"unreadCount":-1}'},{name:'notification',data:'{bad'}]) assert.equal(decodeStreamEvent(event),null);
  assert.throws(()=>createSseParser(()=>{})('data: '+'x'.repeat(262145)));
});
test('stream connects once using header auth and GET only, coalesces duplicates and ignores malformed frames', async () => {
  let controller;
  const run=setup(async()=>new Response(new ReadableStream({start(value){controller=value;}}),{headers:{'Content-Type':'text/event-stream'}}));
  await flush(); assert.equal(run.calls.length,1); assert.equal(run.calls[0].headers.Authorization,'Bearer test-token');
  assert.equal(run.calls[0].method,'GET'); assert.equal(run.calls[0].credentials,'omit'); assert.ok(!run.calls[0].url.includes('token'));
  const send=value=>controller.enqueue(new TextEncoder().encode(value));
  send('event: connected\ndata: {"connected":true}\n\n'); await flush(); const before=run.invalidations.length;
  const data=JSON.stringify({notification,unreadCount:1});
  send(`event: notification\ndata: ${data}\n\nevent: notification\ndata: ${data}\n\nevent: unread-count\ndata: {"unreadCount":1}\n\nevent: notification\ndata: BAD\n\n`);
  await flush(); await run.time.advance(250);
  assert.deepEqual(run.invalidations.slice(before),['all']); assert.ok(run.statuses.includes('live'));
  run.stop(); await flush(); assert.equal(run.calls[0].signal.aborted,true); assert.equal(run.time.jobs.size,0);
});
test('authorization denial stops reconnect and polling without logging out a valid session', async () => {
  for (const status of [401,403]) {
    const run=setup(async()=>new Response(null,{status})); await flush();
    assert.equal(run.calls.length,1); assert.ok(run.statuses.includes('denied')); assert.ok(run.invalidations.includes('auth'));
    const count=run.invalidations.length; await run.time.advance(300000);
    assert.equal(run.calls.length,1); assert.equal(run.invalidations.length,count); run.stop(); assert.equal(run.time.jobs.size,0);
  }
});
test('network retry is bounded with exponential backoff, then foreground REST fallback', async () => {
  const run=setup(async()=>{throw new Error('network');}); await flush();
  for (const delay of [1000,2000,4000,8000]) await run.time.advance(delay);
  assert.equal(run.calls.length,5); assert.equal(run.statuses.at(-1),'fallback');
  const before=run.invalidations.length; await run.time.advance(60000);
  assert.equal(run.calls.length,5); assert.equal(run.invalidations.length,before+1);
  run.stop(); assert.equal(run.time.jobs.size,0);
});
test('unanswered connection handshake times out, revalidates and schedules a bounded retry', async () => {
  const run=setup(async(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('abort')))));
  await flush(); await run.time.advance(45000); assert.equal(run.calls[0].signal.aborted,true); assert.ok(run.statuses.includes('retrying'));
  run.stop(); assert.equal(run.time.jobs.size,0);
});

test('healthy silent SSE remains connected beyond 45 seconds and REST still reconciles', async () => {
  let stream;
  const run=setup(async(_url,init)=>new Response(new ReadableStream({start(value) {
    stream=value;
    init.signal.addEventListener('abort',()=>value.error(new Error('aborted')));
    value.enqueue(new TextEncoder().encode('event: connected\ndata: {"connected":true}\n\n'));
  }}),{headers:{'Content-Type':'text/event-stream'}}));
  await flush(); await run.time.advance(250); const count=run.invalidations.length;
  await run.time.advance(120000);
  assert.equal(run.calls.length,1); assert.equal(run.calls[0].signal.aborted,false);
  assert.equal(run.statuses.at(-1),'live'); assert.equal(run.invalidations.length,count+2);
  // A duplicated handshake is not a fresh invalidation or another emitter.
  stream.enqueue(new TextEncoder().encode('event: connected\ndata: {"connected":true}\n\n'));
  await flush(); await run.time.advance(250); assert.equal(run.invalidations.length,count+2);
  run.stop(); await flush(); assert.equal(run.time.jobs.size,0);
});

test('SSE body without a valid connected handshake cannot become live or keep extending the deadline', async () => {
  const run=setup(async(_url,init)=>new Response(new ReadableStream({start(value) {
    init.signal.addEventListener('abort',()=>value.error(new Error('aborted')));
    value.enqueue(new TextEncoder().encode(':comment\nevent: connected\ndata: BAD\n\n'));
  }}),{headers:{'Content-Type':'text/event-stream'}}));
  await flush(); await run.time.advance(45000);
  assert.equal(run.calls[0].signal.aborted,true); assert.ok(!run.statuses.includes('live'));
  assert.equal(run.statuses.at(-1),'retrying'); run.stop(); assert.equal(run.time.jobs.size,0);
});

test('server EOF reconnects; a stable connection resets failures and rotates at the verified 30-minute lease', async () => {
  let stream;
  const run=setup(async(_url,init)=>new Response(new ReadableStream({start(value) {
    stream=value;
    init.signal.addEventListener('abort',()=>value.error(new Error('aborted')));
    value.enqueue(new TextEncoder().encode('event: connected\ndata: {"connected":true}\n\n'));
  }}),{headers:{'Content-Type':'text/event-stream'}}));
  await flush(); stream.close(); await flush(); await run.time.advance(1000);
  assert.equal(run.calls.length,2);
  await run.time.advance(30*60*1000); await run.time.advance(1000);
  assert.equal(run.calls.length,3); assert.equal(run.calls[1].signal.aborted,true);
  assert.equal(run.statuses.at(-1),'live'); run.stop(); await flush(); assert.equal(run.time.jobs.size,0);
});

test('repeated immediate accepted stream closures still exhaust the reconnect budget', async () => {
  const run=setup(async()=>new Response('event: connected\ndata: {"connected":true}\n\n',{headers:{'Content-Type':'text/event-stream'}}));
  await flush();
  for (const delay of [1000,2000,4000,8000]) await run.time.advance(delay);
  assert.equal(run.calls.length,5); assert.equal(run.statuses.at(-1),'fallback');
  run.stop(); assert.equal(run.time.jobs.size,0);
});
test('late response after account, epoch, environment or background change cannot invalidate the new context', async () => {
  for (const change of ['account','epoch','environment','background']) {
    let resolve; const run=setup(async()=>new Promise(done=>{resolve=done;})); await flush(); const before=run.invalidations.length;
    run.change(); resolve(new Response('event: connected\ndata: {"connected":true}\n\n',{headers:{'Content-Type':'text/event-stream'}}));
    await flush(); await run.time.advance(60000); assert.equal(run.invalidations.length,before,change); assert.equal(run.calls.length,1); run.stop();
  }
});
test('token refresh replaces the old stream and cleanup prevents late event callbacks', async () => {
  const old=setup(async()=>new Response(null,{status:503}), 'old-test-token'); await flush(); old.stop();
  const next=setup(async()=>new Response(null,{status:403}), 'new-test-token'); await flush(); await old.time.advance(100000);
  assert.equal(old.calls.length,1); assert.equal(next.calls.length,1);
  assert.equal(old.calls[0].headers.Authorization,'Bearer old-test-token'); assert.equal(next.calls[0].headers.Authorization,'Bearer new-test-token'); next.stop();
});
test('invalidation predicate isolates owner/API/epoch and excludes financial, POS and pending journal queries', () => {
  const scope={backend:'https://qa.invalid/api',owner:id(3),epoch:4}; const key=['passenger',scope.backend,scope.owner,scope.epoch,'itinerary',id(9)];
  assert.equal(notificationQueryAllowed(key,scope,['ITINERARY_READ'],'all'),true);
  for (const [index,value] of [[1,'https://other.invalid/api'],[2,id(8)],[3,5]]) {const changed=[...key]; changed[index]=value; assert.equal(notificationQueryAllowed(changed,scope,['ITINERARY_READ'],'all'),false);}
  for (const name of ['folio','pos','pending-sale','service-operation','spending']) assert.equal(notificationQueryAllowed([...key.slice(0,4),name],scope,['BOOKING_READ','POS_ACCESS'],'all'),false);
  assert.equal(notificationQueryAllowed(key,scope,[],'all'),false);
  assert.equal(notificationQueryAllowed(key,scope,['ITINERARY_READ'],'inbox'),false);
  assert.equal(notificationQueryAllowed([...key.slice(0,4),'service-requests'],scope,['SERVICE_REQUEST_READ'],'all'),true);
});
