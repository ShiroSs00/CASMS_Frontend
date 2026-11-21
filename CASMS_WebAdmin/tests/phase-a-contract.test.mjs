import assert from 'node:assert/strict'
import test from 'node:test'
import { setApiAccessToken } from '../src/shared/api/index.ts'
import { setSessionAccess } from '../src/shared/auth/index.ts'
import {
  decodePreparation, operatingBudgetInput, preparationActionAllowed, preparationApi, preparationCodes,
} from '../src/features/cruises/api/preparation-api.ts'
import {
  effectiveActivityAreas, programModelBlocker, programServiceLabel,
} from '../src/features/cruises/model/program-options.ts'
import { staffingApi, staffingMissing } from '../src/features/cruises/staffing/staffing-api.ts'
import {
  placementKey, requiresReviewReload, resetImpactCopy, servicePlacementChoices, shipReviewReady,
} from '../src/features/cruises/staffing/ship-review.ts'

const snapshot = {
  id: 'req', cruiseId: 'cruise', revision: 9, workflowVersion: 'V2',
  planResetImpact: { needsToReplaceOnSave: 3, assignmentsToClear: 5 },
}
const review = {
  request: snapshot, shipPlanReady: true, areas: [],
  plannedServices: [],
}
const pair = { areaId: 'area', terminalId: 'pos-b' }

test('Ship can confirm with no SERVICE area only when V2 returns readiness explicitly', () => {
  assert.equal(shipReviewReady(review), true)
  for (const readiness of [false, null, undefined]) {
    assert.equal(shipReviewReady({ ...review, shipPlanReady: readiness }), false)
  }
  assert.equal(shipReviewReady({ ...review, request: { ...snapshot, workflowVersion: 'LEGACY' } }), true)
})

test('a configured area or a different terminal on the same area cannot be chosen', () => {
  const otherPair = { areaId: 'area', terminalId: 'pos-a' }
  const service = { eligibleAreaIds: ['area'], configuredPlacements: [otherPair, pair], eligiblePlacements: [pair] }
  assert.deepEqual(servicePlacementChoices(review, service), [pair])
  assert.notEqual(placementKey(pair), placementKey(otherPair))
  assert.deepEqual(servicePlacementChoices(review, { ...service, eligiblePlacements: undefined }), [])
})

test('reset warnings use server counts and reflect which rows are affected', () => {
  const save = resetImpactCopy(snapshot, 'save')
  assert.match(save, /3 nhu cầu/)
  assert.match(save, /5 phân công/)
  for (const action of ['SHIP_RETURN_ASM', 'CRM_RETURN_SHIP', 'HR_RETURN_SHIP']) {
    assert.doesNotMatch(resetImpactCopy(snapshot, action), /3 nhu cầu/)
    assert.match(resetImpactCopy(snapshot, action), /5 phân công/)
  }
  for (const action of ['OPS_RETURN_CRM', 'CRM_RETURN_HR']) assert.equal(resetImpactCopy(snapshot, action), '')
})

test('revision, review staleness and invalid POS require explicit reconciliation', () => {
  for (const error of ['STAFFING_REVISION_CONFLICT', 'STAFFING_SHIP_REVIEW_STALE',
    'STAFFING_SERVICE_POS_PERMISSION_REQUIRED', 'STAFFING_POS_PLACEMENT_OUT_OF_SCOPE']) {
    assert.equal(requiresReviewReload(error), true)
  }
  assert.equal(requiresReviewReload('STAFFING_CREW_SHORTAGE'), false)
})

test('ASM uses only server activity areas on the assigned ship and its effective model', () => {
  const options = {
    ship: { id: 'one', modelId: 'ready' },
    decks: [{ id: 'deck', shipId: 'one' }, { id: 'other', shipId: 'two' }],
    activityAreas: [{ id: 'a', deckId: 'deck' }, { id: 'b', deckId: 'other' }],
  }
  assert.deepEqual(effectiveActivityAreas(options), [options.activityAreas[0]])
  const noModel = { ...options, ship: { ...options.ship, modelId: null } }
  assert.deepEqual(effectiveActivityAreas(noModel), [])
  assert.match(programModelBlocker(noModel), /mô hình/)
  assert.match(programModelBlocker({ ...options, decks: [] }), /boong/)
  assert.match(programModelBlocker({ ...options, ship: { id: null } }), /gán tàu/)
  assert.match(programServiceLabel({ name: 'Dịch vụ', configuredOnShip: false }), /Đề xuất/)
  assert.match(programServiceLabel({ name: 'Dịch vụ', configuredOnShip: true }), /Đã gán trên boong/)
})

test('HR shortfall only counts staffing need assignments', () => {
  assert.equal(staffingMissing({ ...snapshot, needs: [{ requiredCount: 2, assignedUserIds: ['employee'] }] }), 1)
  assert.equal(staffingMissing({ ...snapshot, shipPlanStale: true,
    needs: [{ requiredCount: 2, assignedUserIds: [] }] }), 2)
})

const technical = {
  sectionCode: 'TECHNICAL_NAUTICAL', submitterRole: 'SHIP_MANAGER', ownerRole: 'SHIP_MANAGER',
  revision: 7, status: 'IN_PROGRESS', allowedActions: ['SUBMIT'], dataReadiness: 'READY',
  submissionStatus: 'NOT_SUBMITTED', approvalStatus: 'NOT_REVIEWED', submittedRevision: null,
  missingRequiredCheckCodes: [], checkItems: [], submittedByUserId: null,
}
const dashboard = (section) => ({
  cruiseId: 'cruise', cruiseRevision: 9, canAssignCoordinator: false,
  sections: preparationCodes.map(sectionCode => ({ ...section, sectionCode })),
})

test('technical data readiness remains independent of submission and approval', () => {
  const before = decodePreparation(dashboard(technical), 'cruise').sections[0]
  assert.equal(before.dataReadiness, 'READY')
  assert.equal(before.submissionStatus, 'NOT_SUBMITTED')
  assert.equal(before.approvalStatus, 'NOT_REVIEWED')
  assert.equal(before.submittedRevision, null)
  const submitted = { ...technical, status: 'SUBMITTED', submissionStatus: 'SUBMITTED',
    approvalStatus: 'PENDING', submittedRevision: 6 }
  assert.equal(decodePreparation(dashboard(submitted), 'cruise').sections[0].submittedRevision, 6)
  assert.throws(() => decodePreparation(dashboard({ ...submitted, submittedRevision: 8 }), 'cruise'),
    { code: 'PREPARATION_RESPONSE_INVALID' })
})

test('maker is blocked from acting as checker even when a response lists the action', () => {
  const section = { ...technical, submittedByUserId: 'maker', allowedActions: ['CONFIRM', 'RETURN', 'REJECT'] }
  for (const action of ['confirm', 'return', 'reject']) {
    assert.equal(preparationActionAllowed(section, action, 'maker'), false)
    assert.equal(preparationActionAllowed(section, action, 'checker'), true)
  }
  assert.equal(preparationActionAllowed(section, 'submit', 'checker'), false)
})

test('budget validation retains exact VND strings', () => {
  assert.equal(operatingBudgetInput(' 999.999.999.999.999.999 '), '999999999999999999')
  for (const invalid of ['0', '-1000', '1,5', '1e6', '001', '5.5', '1000000000000000000']) {
    assert.equal(operatingBudgetInput(invalid), null)
  }
})

test('budget must exist before POST and staffing reads the new schedule revision', async t => {
  const calls = []
  let hasOperatingBudget = false
  setApiAccessToken('qa-fixture')
  setSessionAccess({ status: 'ready', userId: 'crm', error: '',
    roles: ['CRUISE_MANAGER'], permissions: ['CRUISE_PREPARATION_SUBMIT'] })
  t.after(() => setApiAccessToken(null))
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const path = String(url).replace(/^.*\/api/, '')
    calls.push([init.method, path, init.body && JSON.parse(init.body)])
    if (path.endsWith('/operating-budget')) hasOperatingBudget = true
    const data = init.method === 'GET' ? { hasOperatingBudget, scheduleRevision: hasOperatingBudget ? 42 : 41, request: null } : snapshot
    return Response.json({ success: true, data })
  })
  await assert.rejects(staffingApi.send('cruise'), { code: 'PREPARATION_BUDGET_REQUIRED' })
  assert.equal(calls.length, 1)
  await preparationApi.saveOperatingBudget('cruise', 21, '9007199254740993')
  await staffingApi.send('cruise')
  assert.deepEqual(calls.slice(1), [
    ['PUT', '/cruise/cruise/preparation/operating-budget', { expectedRevision: 21, amountVnd: '9007199254740993' }],
    ['GET', '/cruises/cruise/staffing-requests', undefined],
    ['POST', '/cruises/cruise/staffing-requests', { scheduleRevision: 42, requirements: [] }],
  ])
})

test('placement write uses the explicit terminal and revision and forwards server conflicts once', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push([String(url), init.method, JSON.parse(init.body)])
    return Response.json({ success: false, code: 'STAFFING_REVISION_CONFLICT' }, { status: 409 })
  })
  await assert.rejects(staffingApi.placeService(snapshot, 'service', pair.areaId, pair.terminalId),
    { code: 'STAFFING_REVISION_CONFLICT' })
  assert.equal(calls.length, 1)
  assert.match(calls[0][0], /\/staffing-requests\/req\/service-placements\/service$/)
  assert.deepEqual(calls[0].slice(1), ['PUT', { expectedRevision: 9, ...pair }])
})
