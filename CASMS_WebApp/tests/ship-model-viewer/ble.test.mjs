import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const module={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/features/ship-model-viewer/ble.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module,exports:module.exports,require:()=>({apiRequest:()=>{throw Error('No API request expected')}})})
const {validateAnchor,anchorUpdate,liveRegion}=module.exports
test('cruise selection uses the singular backend route and retains ship/status filters',async()=>{
  const calls=[],apiModule={exports:{}}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/features/ship-model-viewer/ble.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText,{module:apiModule,exports:apiModule.exports,require:()=>({apiRequest:async(path,options)=>{calls.push({path,options});return {content:[]}}})})
  const signal=new AbortController().signal
  assert.equal((await apiModule.exports.bleApi.cruises('ship-1',signal)).length,0)
  assert.equal(calls[0].path,'/cruise');assert.equal(calls[0].options.query.shipId,'ship-1');assert.equal(calls[0].options.query.status,'IN_PROGRESS');assert.equal(calls[0].options.signal,signal)
})
const draft={deviceName:'Receiver',deviceType:'BLE_RECEIVER',bleIdentifier:'TEST-ONLY',deckId:'d1',x:1,y:2,z:3,rotationX:0,rotationY:0,rotationZ:0,txPowerDbm:-59,pathLossExponent:2.2,modelUnitsPerMeter:1,modelNodeKey:'node'}
test('anchor payload preserves coordinates and calibration but cannot mutate device type on PATCH',()=>{assert.equal(Object.keys(validateAnchor(draft)).length,0);const patch=anchorUpdate(draft);assert.equal(patch.deviceType,undefined);assert.equal(patch.x,1);assert.equal(patch.txPowerDbm,-59);assert.ok(validateAnchor({...draft,x:NaN}).position);assert.ok(validateAnchor({...draft,modelUnitsPerMeter:0}).modelUnitsPerMeter);assert.ok(validateAnchor({...draft,bleIdentifier:''}).bleIdentifier)})
test('passenger visuals are receiver-centered range regions with no invented passenger XYZ',()=>{const now=Date.now(),passenger={identityId:'tag',fullName:'Unit Passenger',status:'LIVE',receiver:{position:{x:10,y:2,z:30}},proximity:{lastSeen:new Date(now-1000).toISOString(),distanceMeters:4,modelUnitsPerMeter:2}};const region=liveRegion(passenger,now);assert.equal(region.radius,8);assert.equal(region.position,passenger.receiver.position);assert.equal(liveRegion({...passenger,status:'OFFLINE'},now),null);assert.equal(liveRegion(passenger,now+6000),null);assert.equal(liveRegion({...passenger,proximity:{...passenger.proximity,distanceMeters:null}},now),null)})
