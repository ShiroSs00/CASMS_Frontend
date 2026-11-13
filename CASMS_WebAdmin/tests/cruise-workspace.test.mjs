import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CruisePreparationOverview } from '../src/features/cruises/components/CruisePreparationOverview.tsx'
import { allowedDepartureSections } from '../src/features/cruises/model/preparation.ts'

const access = (role, permissions) => ({
  roles: [role],
  has: permission => permissions.includes(permission),
  canDo: permission => permissions.includes(permission),
})
const sections = (role, permissions) => allowedDepartureSections(access(role, permissions)).map(([key]) => key)

test('OPS with read access can reach transaction policy without entering the commercial editing workspace', () => {
  const permitted = sections('OPERATIONS_MANAGER', ['CRUISE_READ'])
  assert.ok(permitted.includes('transaction-policy'))
  assert.ok(permitted.includes('checks'))
  assert.ok(!permitted.includes('fare-packages'))
  assert.ok(!sections('OPERATIONS_MANAGER', []).includes('transaction-policy'))
})

test('CRM has preparation navigation without OPS lifecycle actions', () => {
  const permitted = sections('CRUISE_MANAGER', ['CRUISE_READ', 'CRUISE_UPDATE_DRAFT', 'CRUISE_PREPARATION_READ'])
  for (const key of ['schedule', 'program', 'fare-packages', 'preparation']) assert.ok(permitted.includes(key), key)
  for (const key of ['operation', 'departure-start', 'transaction-policy', 'checks', 'handoff']) assert.ok(!permitted.includes(key), key)
})

test('ASM can access packages without OPS sections', () => {
  const permitted = sections('ACTIVITY_SERVICE_MANAGER', ['TOUR_PACKAGE_MANAGE'])
  assert.ok(permitted.includes('fare-packages'))
  assert.ok(!permitted.includes('operation'))
  assert.ok(!permitted.includes('transaction-policy'))
})

test('CRM overview presents the revision request and source version without OPS actions', () => {
  const html = renderToStaticMarkup(createElement(CruisePreparationOverview, {
    detail: { cruise: { cruiseCode: 'CR-QA', status: 'DRAFT', sourceTripCode: 'TR-QA', sourceVersionNumber: 3, departureDatetime: '2026-12-12T03:00:00Z', returnDatetime: '2026-12-13T03:00:00Z' }, ship: { shipName: 'Tàu QA' } },
    plan: { planStatus: 'REVISION_REQUESTED', reason: 'Cần bổ sung chương trình' },
    loading: false,
    error: null,
    onRetry: () => {},
  }))
  assert.match(html, /TR-QA · Phiên bản 3/)
  assert.match(html, /Cần bổ sung chương trình/)
  assert.doesNotMatch(html, /Dừng bán|Quản lý mở bán|Vận hành và sự cố/)
})
