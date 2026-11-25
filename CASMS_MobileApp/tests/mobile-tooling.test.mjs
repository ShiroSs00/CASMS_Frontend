import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { mobilePort, validDevId, assertFreePort, checkedToolchain, requiredAndroidPackages } from '../scripts/mobile-tooling.mjs';
import windowsGlob from '../scripts/windows-expo-glob.cjs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reserveMetroRecord, setMetroPid, readMetroRecord, removeMetroRecord, verifyMetroOwner } from '../scripts/managed-metro.mjs';

test('Metro reserves ownership before spawn and concurrent starts cannot overwrite it', () => {
  const dir=mkdtempSync(join(tmpdir(),'casms-record-')), path=join(dir,'metro-8086.json');
  try {
    const first=reserveMetroRecord(path,'expo-cli',8086);
    assert.equal(first.pid,null);
    assert.throws(()=>reserveMetroRecord(path,'another-cli',8086),{code:'EEXIST'});
    setMetroPid(path,first.token,1234);
    assert.equal(readMetroRecord(path).pid,1234);
    assert.equal(readMetroRecord(path).token,first.token);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('Metro cleanup is idempotent and cannot delete a replacement reservation', () => {
  const dir=mkdtempSync(join(tmpdir(),'casms-record-')), path=join(dir,'metro-8086.json');
  try {
    const first=reserveMetroRecord(path,'expo-cli',8086);
    assert.equal(removeMetroRecord(path,first.token),true);
    assert.equal(removeMetroRecord(path,first.token),false);
    const second=reserveMetroRecord(path,'expo-cli',8086);
    assert.equal(removeMetroRecord(path,first.token),false);
    writeFileSync(`${path}.lock`,'');
    assert.equal(removeMetroRecord(path,second.token),false);
    assert.equal(readMetroRecord(path).token,second.token);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('Metro stop verifies executable and exact CLI/port arguments independently of record contents', () => {
  const dir=mkdtempSync(join(tmpdir(),'casms-owner-')), path=join(dir,'metro-8086.json');
  const node=join(dir,'node.exe'), cli=join(dir,'expo cli');
  try {
    const record={...reserveMetroRecord(path,cli,8086),pid:1234};
    const actual={executable:node,created:new Date(record.createdAt).toISOString(),command:`"${node}" "${cli}" start --port 8086 --dev-client`};
    assert.equal(verifyMetroOwner(record,8086,cli,actual,node),true);
    for(const invalid of [{...record,cli:''},{...record,port:''},{...record,pid:null},{...record,createdAt:NaN}]) assert.equal(verifyMetroOwner(invalid,8086,cli,actual,node),false);
    assert.equal(verifyMetroOwner(record,8087,cli,actual,node),false);
    for(const command of [actual.command.replace('8086','18086'),actual.command.replace(' start ',' restart '),actual.command+' extra',actual.command.replace(cli,cli+'-other')]) assert.equal(verifyMetroOwner(record,8086,cli,{...actual,command},node),false);
    assert.equal(verifyMetroOwner(record,8086,cli,{...actual,executable:cli},node),false);
    assert.equal(verifyMetroOwner(record,8086,cli,{...actual,created:new Date(record.createdAt+20000).toISOString()},node),false);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('prebuild workaround normalizes only absolute Windows patterns and preserves glob expressions', () => {
  const {normalizePattern}=windowsGlob;
  assert.equal(normalizePattern('C:\\Work\\Máy tính\\app\\**\\*.@(java|kt)'),'C:/Work/Máy tính/app/**/*.@(java|kt)');
  assert.deepEqual(normalizePattern(['C:\\a\\*','android/**/*.kt']),['C:/a/*','android/**/*.kt']);
  assert.equal(normalizePattern('relative\\escaped*'),'relative\\escaped*');
});

test('startup ports reject invalid or privileged ports instead of silently choosing another server', () => {
  assert.equal(mobilePort(),8081); assert.equal(mobilePort('8086'),8086);
  for(const value of ['8086 --tunnel','0','80','65536','abc','1.5']) assert.throws(()=>mobilePort(value));
});
test('native build requires an explicit development application identity and an existing JDK', () => {
  assert.equal(validDevId('com.casms.mobile.dev'),'com.casms.mobile.dev');
  for(const id of [undefined,'com.casms.mobile','com.casms.mobile.dev;echo','a','com.-app.dev']) assert.throws(()=>validDevId(id));
  assert.throws(()=>checkedToolchain({}),/SDK\/ADB/);
  const required=requiredAndroidPackages();
  assert.match(required.buildTools,/^\d+\.\d+\.\d+$/); assert.match(required.ndk,/^\d+\.\d+\.\d+$/);
});
test('a busy Metro port fails without stopping or replacing its owner', async () => {
  const server=net.createServer(socket=>socket.end('original-owner'));
  await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
  try {
    await assert.rejects(assertFreePort(server.address().port),/unavailable/);
    const response=await new Promise((resolve,reject)=>{const socket=net.connect(server.address().port,'127.0.0.1');let text='';socket.on('data',data=>{text+=data;});socket.on('end',()=>resolve(text));socket.on('error',reject);});
    assert.equal(response,'original-owner');
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
test('unsupported startup arguments fail before starting Metro or touching process records', () => {
  const run=spawnSync(process.execPath,['scripts/start-mobile.mjs','--invalid'],{encoding:'utf8'});
  assert.equal(run.status,2); assert.match(run.stderr,/Usage:/); assert.doesNotMatch(run.stdout,/Starting project/);
});
