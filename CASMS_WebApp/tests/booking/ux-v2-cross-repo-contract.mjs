// Run after UxServiceContractTest. Consumes an actual BE-serialized test response,
// not an independently handwritten FE fixture. No live booking/payment mutation.
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import console from 'node:console'
import assert from 'node:assert/strict'
import { sourceLoader } from '../helpers/source-loader.mjs'

const generated=JSON.parse(readFileSync(new URL('../../../../CASMS_Backend/target/ux-v2-service-contract.json',import.meta.url),'utf8'))
const api=sourceLoader()('features/booking/api/customer-extras-api.ts')
const service=api.decodeCustomerService(generated.service)
const schedule=api.decodeCustomerServiceSchedule(generated.schedule)
assert.equal(service.requiresSchedule,true)
assert.equal(service.unitCode,'SESSION')
assert.equal(service.applicabilityScope,'PASSENGER')
assert.equal(service.price,12.3456)
assert.equal(service.currency,'USD')
assert.equal(schedule.serviceId,service.id)
assert.equal(schedule.remainingCapacity,2)
assert.ok(schedule.cruiseId)
assert.ok(Date.parse(schedule.endsAt)>Date.parse(schedule.startsAt))
console.log('PASS: actual Backend serialized ServiceView/ServiceScheduleView decoded by production Frontend client; USD, precision, unit, scope, schedule identity and capacity match.')
