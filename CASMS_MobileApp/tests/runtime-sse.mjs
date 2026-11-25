// Opt-in real HTTP fixture validation; never a native/proxy/Backend acceptance test.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import './register-typescript.mjs';
import { startNotificationStream } from '../src/features/notifications/notification-stream.ts';

const port=18106, baseUrl=`http://127.0.0.1:${port}/api`, began=Date.now();
const child=spawn(process.execPath,['tests/fixtures/passenger-api-server.mjs'],{env:{...process.env,UI_FIXTURE_PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
let stop;
try {
  await Promise.race([once(child.stdout,'data'),delay(10000).then(()=>{throw new Error('Fixture startup timeout');})]);
  const statuses=[], invalidations=[], calls=[]; let current=true;
  stop=startNotificationStream({baseUrl,token:'local-fixture-only',current:()=>current,
    fetch:(url,init)=>{calls.push({method:init.method});return fetch(url,init);},
    invalidate:kind=>invalidations.push(kind),status:value=>statuses.push(value)});
  for(let i=0;i<50&&!statuses.includes('live');i++) await delay(100);
  assert.ok(statuses.includes('live'),'Real HTTP handshake must establish');
  const idleStart=Date.now(); await delay(65000);
  assert.equal(calls.length,1,'Healthy idle must retain one stream beyond45s');
  assert.equal(statuses.at(-1),'live'); assert.ok(invalidations.length>=2,'REST reconciliation cadence remains active');
  current=false; stop(); stop=undefined;
  const before=invalidations.length; await delay(500); assert.equal(invalidations.length,before);
  console.log(JSON.stringify({classification:'FIXTURE_HTTP_CONTROLLER_ONLY',native:false,backendQA:false,result:'PASS',idleMs:Date.now()-idleStart,connections:calls.length,statuses,invalidations:invalidations.length,cleanup:'no late invalidation',elapsedMs:Date.now()-began},null,2));
} finally {
  stop?.(); child.kill();
  if(child.exitCode===null) await Promise.race([once(child,'exit'),delay(3000)]);
}
