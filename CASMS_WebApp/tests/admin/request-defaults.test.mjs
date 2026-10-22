import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(path, imports = {}) {
  const module = { exports: {} }
  const source = readFileSync(new URL('../../src/' + path, import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, { module, exports: module.exports, require(name) { assert.ok(name in imports, name); return imports[name] } })
  return module.exports
}
const plan = load('features/itineraries/model/itinerary.ts')
const cruise = { cruiseId: 'c', departureDatetime: '2026-11-01T08:00:00Z', returnDatetime: '2026-11-04T18:00:00Z' }
const draft = { cruiseId: 'c', itineraryName: '', startDate: '', endDate: '', itineraryType: '' }
test('new itinerary can use BE name, dates and type; edits still require valid populated values', () => {
  assert.equal(Object.keys(plan.validateItineraryDraft(draft, { cruises: [cruise], itineraries: [] })).length, 0)
  const editing = plan.validateItineraryDraft(draft, { cruises: [cruise], itineraries: [], editingId: 'i' })
  for (const key of ['itineraryName', 'startDate', 'endDate', 'itineraryType']) assert.ok(editing[key])
  assert.ok(plan.validateItineraryDraft({ ...draft, startDate: '2026-11-05' }, { cruises: [cruise], itineraries: [] }).startDate)
})
test('new day inherits sequence/date/timezone; explicit zero, invalid date and exhausted itinerary remain blocked', () => {
  const itinerary = { startDate: '2026-11-01', endDate: '2026-11-02' }
  const day = { itineraryId: 'i', dayNumber: '', date: '', dayType: 'PORT_DAY', shipTimeZoneId: '' }
  assert.equal(plan.validateItineraryDay(day, itinerary, []), '')
  assert.equal(day.dayNumber, '')
  assert.ok(plan.validateItineraryDay({ ...day, dayNumber: 0 }, itinerary, []))
  assert.ok(plan.validateItineraryDay({ ...day, date: '2026-02-30' }, itinerary, []))
  assert.ok(plan.validateItineraryDay(day, { ...itinerary, startDate: 'invalid' }, []))
  assert.ok(plan.validateItineraryDay(day, itinerary, [{ dayNumber: 1, date: '2026-11-01' }, { dayNumber: 2, date: '2026-11-02' }]))
})
test('cruise and activity allow generated codes but still require names and valid schedule/capacity', () => {
  const model = load('features/cruises/model/cruise-validation.ts')
  assert.equal(Object.keys(model.validateCruiseDraft({ cruiseCode: '', cruiseName: 'Trip', cruiseType: '', departureDatetime: '2026-11-01T08:00', returnDatetime: '2026-11-02T18:00', departurePortId: 'p', returnPortId: 'p' })).length, 0)
  const activity = load('features/activities/model/activity.ts')
  const values = { activityCode: '', activityName: 'Yoga', cruiseId: 'c', description: '', location: '', currencyCode: '', price: null, capacity: 1, startTime: '2026-11-02T08:00:00Z', endTime: '2026-11-02T09:00:00Z' }
  assert.equal(Object.keys(activity.validateActivity(values, [cruise])).length, 0)
  assert.ok(activity.validateActivity({ ...values, capacity: 0 }, [cruise]).capacity)
})
