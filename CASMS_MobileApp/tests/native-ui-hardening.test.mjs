import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { posColumns } from '../src/features/pos/pos-layout-metrics.ts';
import { brand, lightTheme } from '../src/constants/ocevie.ts';
import { startForegroundClock } from '../src/hooks/foreground-clock.ts';

test('display clocks pause in background, refresh on resume and ignore ticks after cleanup', () => {
  let change, scheduled, ticks=0, canceled=0, removed=0;
  const stop=startForegroundClock({ initialState:'active', subscribe: listener=>{change=listener; return ()=>removed++;},
    tick:()=>ticks++, schedule: tick=>{ scheduled=tick; return 1; }, cancel:()=>canceled++ });
  assert.equal(ticks,1); scheduled(); assert.equal(ticks,2);
  change('background'); scheduled(); assert.equal(ticks,2); assert.equal(canceled,1);
  change('active'); assert.equal(ticks,3); stop(); scheduled(); change('active');
  assert.equal(ticks,3); assert.equal(canceled,2); assert.equal(removed,1);
});

test('a restored background app does not create a display interval before activation', () => {
  let change, schedules=0, ticks=0;
  const stop=startForegroundClock({ initialState:'background', subscribe: listener=>{change=listener; return ()=>{};},
    tick:()=>ticks++, schedule:()=>++schedules, cancel:()=>{} });
  assert.equal(schedules,0); assert.equal(ticks,0);
  change('active'); assert.equal(schedules,1); assert.equal(ticks,1); stop();
});

test('POS columns follow available width and preserve a single column for large text or split windows', () => {
  for (const width of [320,375,430,768,839]) assert.equal(posColumns(width,1),1);
  for (const width of [840,1024,1280]) assert.equal(posColumns(width,1),2);
  assert.equal(posColumns(1024,1.5),1);
  assert.equal(posColumns(1280,2),1);
  assert.equal(posColumns(1280,1.3),2);
  for (const [width,scale] of [[NaN,1],[1000,0],[1000,NaN]]) assert.equal(posColumns(width,scale),1);
});
function luminance(hex) {
  return hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
}
const contrast=(a,b)=>{ const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
test('OceVie input boundary and focus meet non-text contrast while readable text meets AA', () => {
  for (const surface of [brand.white,lightTheme.background]) {
    assert.ok(contrast(lightTheme.controlBorder,surface)>=3);
    assert.ok(contrast(brand.teal,surface)>=3);
    assert.ok(contrast(lightTheme.textSecondary,surface)>=4.5);
    assert.ok(contrast(lightTheme.placeholder,surface)>=4.5);
  }
});
test('static UI contract: notifications own one virtualized scroller and do not unlock ACK or folio', async () => {
  const source=await readFile(new URL('../src/features/notifications/PassengerNotificationsScreen.tsx',import.meta.url),'utf8');
  assert.match(source,/<FlatList/); assert.match(source,/scroll=\{false\}/);
  assert.match(source,/keyExtractor=\{item => item.notificationId\}/);
  assert.doesNotMatch(source,/inbox\.data\?\.map|ackNotification|\/ack|\/folio/);
});
