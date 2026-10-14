import './helpers/register-source.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
const { Response } = globalThis
const { operationalIssuesApi } = await import('../src/features/operational-issues/api/operational-issues-api.ts')
const { operationalIssuesAdapter } = await import('../src/features/operational-issues/api/operational-issues-adapter.ts')
const { regulationAdapter } = await import('../src/features/regulations/api/regulation-adapter.ts')
const { apiRequest, ApiError, setApiAccessToken } = await import('../src/shared/api/client.ts')
const { DEFAULT_ISSUE_QUERY } = await import('../src/features/operational-issues/model/issue-query.ts')
const { selectIssuePage } = await import('../src/features/operational-issues/model/issue-list.ts')

function intercept(t, handler) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    const call = { path: String(url), ...options, body: options.body ? JSON.parse(options.body) : undefined }
    calls.push(call)
    const result = await handler(call)
    return result instanceof Response ? result : Response.json({ success: true, data: result })
  }
  t.after(() => { globalThis.fetch = original; setApiAccessToken(null) })
  return calls
}

const issueDto = {
  issueId: 'issue-1', issueCode: 'ISS-001', shipId: 'ship-1', cruiseId: 'cruise-1', cabinId: null,
  issueType: 'TECHNICAL', severity: 'HIGH', status: 'OPEN', description: 'Engine warning',
  reportedById: 'reporter-1', assignedToId: 'handler-1', resolvedById: null, verifiedById: null,
  resolution: null, reportedAt: '2026-10-14T08:00:00Z', resolvedAt: null, verifiedAt: null,
  createdAt: '2026-10-14T08:00:00Z', updatedAt: '2026-10-14T08:00:00Z',
}
const regulationDto = {
  regulationId: 'reg-1', regulationCode: 'REG-001', name: 'Safety', description: '',
  regulationType: 'SAFETY', scope: 'SHIP', value: '1', unit: 'NONE', status: 'ACTIVE',
  effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: null,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z',
}

test('six OIM actions use correct endpoints; actor IDs are never fabricated', async (t) => {
  const calls = intercept(t, () => issueDto)
  setApiAccessToken('test-token-not-a-secret')
  await operationalIssuesApi.assign('issue-1', 'handler-1')
  await operationalIssuesApi.start('issue-1')
  await operationalIssuesApi.recordResolution('issue-1', 'Fixed')
  await operationalIssuesApi.verifyResolution('issue-1')
  await operationalIssuesApi.close('issue-1')
  await operationalIssuesApi.reopen('issue-1')
  assert.deepEqual(calls.map(({ path, method }) => [path, method]), [
    ['/api/operational-issues/issue-1/assign', 'PATCH'],
    ['/api/operational-issues/issue-1/start', 'PATCH'],
    ['/api/operational-issues/issue-1/resolution', 'POST'],
    ['/api/operational-issues/issue-1/verify', 'PATCH'],
    ['/api/operational-issues/issue-1/close', 'PATCH'],
    ['/api/operational-issues/issue-1/reopen', 'PATCH'],
  ])
  assert.deepEqual(calls[0].body, { assignedToId: 'handler-1' })
  assert.deepEqual(calls[2].body, { resolution: 'Fixed' })
  assert.ok(calls.every((call) => call.headers.Authorization === 'Bearer test-token-not-a-secret'))
})

test('OIM loads real active handlers (including unassigned users) and all ship lookup pages', async (t) => {
  const calls = intercept(t, ({ path }) => {
    if (path === '/api/operational-issues') return Array.from({ length: 13 }, (_, i) => ({ ...issueDto, issueId: `issue-${i}` }))
    if (path === '/api/ship?page=0&size=100') return { content: [], totalPages: 2 }
    if (path === '/api/ship?page=1&size=100') return { content: [{ shipId: 'ship-1', shipCode: 'S1', shipName: 'Aurora' }], totalPages: 2 }
    if (path === '/api/identity/users?status=ACTIVE&assignableFor=OPERATIONAL_ISSUE') return [
      { id: 'handler-1', displayName: 'Huy', username: 'huy', status: 'ACTIVE' },
      { id: 'new-user', displayName: 'New handler', username: 'new', status: 'ACTIVE' },
    ]
    if (path === '/api/cruise/cruise-1') return { cruiseId: 'cruise-1', cruiseCode: 'C1', cruiseName: 'Day Cruise', shipId: 'ship-1' }
    throw Error(`Unexpected request: ${path}`)
  })
  const all = await operationalIssuesApi.list({ ...DEFAULT_ISSUE_QUERY, pageSize: Number.MAX_SAFE_INTEGER })
  assert.equal(all.items.length, 13)
  assert.equal(all.items[0].assignedTo.name, 'Huy')
  assert.equal(all.items[0].ship.name, 'S1 · Aurora')
  assert.equal(all.items[0].cruise.code, 'C1')
  assert.ok(all.handlers.some((item) => item.id === 'new-user'))
  const before = calls.length
  const last = selectIssuePage(all, { ...DEFAULT_ISSUE_QUERY, page: 99, pageSize: 5, search: 'Aurora', handlerId: 'handler-1' })
  assert.equal(last.page, 3)
  assert.equal(last.items.length, 3)
  assert.equal(last.total, 13)
  const empty = selectIssuePage(all, { ...DEFAULT_ISSUE_QUERY, page: 99, severity: 'LOW' })
  assert.equal(empty.page, 1)
  assert.equal(empty.total, 0)
  assert.equal(calls.length, before, 'client pagination must not issue HTTP requests')
})

test('lookup failure keeps backend issue visible but never fabricates selectable handlers', async (t) => {
  intercept(t, ({ path }) => {
    if (path === '/api/operational-issues/issue-1') return issueDto
    return Response.json({ success: false, code: 'ACCESS_DENIED', error: 'Denied' }, { status: 403 })
  })
  const detail = await operationalIssuesApi.detail('issue-1')
  assert.equal(detail.issue.id, 'issue-1')
  assert.deepEqual(detail.handlers, [])
  assert.match(detail.sourceNotice, /ACCESS_DENIED/)
})

test('activation and assignment precheck use authoritative verdicts and correct host', async (t) => {
  const calls = intercept(t, () => ({
    context: 'ASSIGN_SHIP', severity: 'BLOCKING', canProceed: false,
    code: 'REGULATION_CONFLICT_BLOCKING', message: 'Conflict',
    comparedWith: [{ regulationId: 'reg-2', code: 'REG-002', scope: 'GLOBAL', value: '2', unit: 'NONE' }],
  }))
  const activation = await regulationAdapter.precheckStatus('reg-1', 'ACTIVE')
  assert.equal(activation.canProceed, false)
  const ship = await regulationAdapter.checkConflict('ship', 'ship-1', 'reg-1')
  const cruise = await regulationAdapter.checkConflict('cruise', 'cruise-1', 'reg-1')
  assert.equal(ship.severity, 'blocking')
  assert.equal(cruise.comparedWith[0].source, 'GLOBAL')
  assert.equal(calls[0].path, '/api/operational-regulations/reg-1/conflicts?context=ACTIVATE')
  assert.equal(calls[1].path, '/api/ships/ship-1/regulations/precheck')
  assert.equal(calls[2].path, '/api/cruises/cruise-1/regulations/precheck')
  assert.deepEqual(calls[2].body, { regulationId: 'reg-1' })
})

test('effective snapshot preserves backend source labels and removal capability even on last row', async (t) => {
  intercept(t, ({ path }) => {
    assert.equal(path, '/api/cruises/cruise-1/regulations/effective')
    const row = { regulation: regulationDto, source: 'CRUISE', sourceLabel: 'CRUISE · C1', canRemove: true, removeBlockedReason: null }
    return {
      host: { type: 'CRUISE', id: 'cruise-1', code: 'C1', name: 'Day Cruise' }, checkedAt: '2026-10-14T00:00:00Z',
      direct: [row], inherited: [{ ...row, source: 'SHIP', sourceLabel: 'SHIP · S1', canRemove: false, removeBlockedReason: 'Inherited' }],
    }
  })
  const snapshot = await regulationAdapter.getAssignments('cruise', 'cruise-1')
  assert.equal(snapshot.direct[0].capabilities.canRemove.allowed, true)
  assert.equal(snapshot.inherited[0].capabilities.canRemove.allowed, false)
  assert.equal(snapshot.inherited[0].sourceLabel, 'SHIP · S1')
  assert.equal(snapshot.checkedAt, '2026-10-14T00:00:00Z')
})

test('Regulation create/update/status/assign/remove retain backend methods and body', async (t) => {
  const calls = intercept(t, ({ method }) => method === 'DELETE'
    ? new Response(null, { status: 204 }) : regulationDto)
  const draft = { code: 'REG-001', name: 'Safety', description: '', type: 'SAFETY', scope: 'SHIP', value: '1', unit: 'NONE', effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: null }
  await regulationAdapter.create(draft)
  await regulationAdapter.update('reg-1', { name: 'Updated', version: 1 })
  await regulationAdapter.changeStatus('reg-1', 'INACTIVE')
  await regulationAdapter.assign('ship', 'ship-1', 'reg-1')
  await regulationAdapter.remove('ship', 'ship-1', 'reg-1')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].body.regulationType, 'SAFETY')
  assert.equal(calls[2].method, 'PUT')
  assert.equal(calls[2].body.name, 'Updated')
  assert.equal(calls[3].path, '/api/operational-regulations/reg-1/deactivate')
  assert.deepEqual(calls[4].body, { shipId: 'ship-1', regulationId: 'reg-1' })
  assert.equal(calls[5].method, 'DELETE')
})

for (const status of [401, 403, 404, 409, 422, 500]) {
  test(`HTTP ${status} preserves error code/details/trace and never falls back to demo`, async (t) => {
    intercept(t, () => Response.json({ success: false, error: 'Rejected', code: 'TEST_ERROR', details: { field: 'Invalid' }, traceId: 'trace-123' }, { status }))
    for (const run of [
      () => apiRequest('/test'),
      () => operationalIssuesAdapter.list(DEFAULT_ISSUE_QUERY),
      () => regulationAdapter.list({ search: '', type: 'ALL', scope: 'ALL', status: 'ALL', effectiveAt: '' }),
      () => regulationAdapter.create({ code: 'R', name: 'R', description: '', type: 'SAFETY', scope: 'SHIP', value: '1', unit: 'NONE', effectiveFrom: '2026-01-01', effectiveTo: null }),
    ]) {
      await assert.rejects(run, (error) => {
        assert.ok(error instanceof ApiError)
        assert.equal(error.status, status)
        assert.equal(error.code, 'TEST_ERROR')
        assert.deepEqual(error.details, { field: 'Invalid' })
        assert.match(error.message, /trace-123/)
        return true
      })
    }
  })
}

test('network errors never turn a live write into a demo success', async (t) => {
  intercept(t, () => { throw new TypeError('Network unavailable') })
  await assert.rejects(() => regulationAdapter.create({ code: 'R', name: 'R', description: '', type: 'SAFETY', scope: 'SHIP', value: '1', unit: 'NONE', effectiveFrom: '2026-01-01', effectiveTo: null }), (error) => error instanceof ApiError && error.status === 0)
})
