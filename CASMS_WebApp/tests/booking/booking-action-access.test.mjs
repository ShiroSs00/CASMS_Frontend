import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const module={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/features/booking/model/booking-permissions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports})
const {canManageBooking}=module.exports
const access=(permissions,status='ready')=>({has:p=>status==='ready'&&permissions.includes(p)})

test('confirmation requires BOOKING_CONFIRM, never passenger create or customer-service update',()=>{
  for(const permissions of [[],['BOOKING_CREATE'],['BOOKING_UPDATE'],['BOOKING_CREATE','BOOKING_UPDATE']]) assert.equal(canManageBooking('confirm','Draft',access(permissions)),false)
  assert.equal(canManageBooking('confirm','Draft',access(['BOOKING_CONFIRM'])),true)
  for(const status of ['Confirmed','Cancelled']) assert.equal(canManageBooking('confirm',status,access(['BOOKING_CONFIRM'])),false)
  for(const status of ['anonymous','loading','error']) assert.equal(canManageBooking('confirm','Draft',access(['BOOKING_CONFIRM'],status)),false)
})

test('cancel and cabin changes match their own BE authorities and canceled records deny every mutation',()=>{
  assert.equal(canManageBooking('cancel','Draft',access(['BOOKING_CANCEL'])),true)
  assert.equal(canManageBooking('cancel','Draft',access(['BOOKING_UPDATE'])),false)
  for(const p of ['BOOKING_UPDATE','BOOKING_CABIN_ASSIGN']) assert.equal(canManageBooking('cabin','Confirmed',access([p])),true)
  assert.equal(canManageBooking('cabin','Draft',access(['BOOKING_READ'])),false)
  for(const action of ['confirm','cancel','cabin']) assert.equal(canManageBooking(action,'Cancelled',access(['BOOKING_CONFIRM','BOOKING_CANCEL','BOOKING_UPDATE'])),false)
})
