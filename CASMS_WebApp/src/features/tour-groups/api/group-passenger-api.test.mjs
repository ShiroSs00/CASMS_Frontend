import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'

let server, api, shared, ui, tourUI
const id = '00000000-0000-4000-8000-000000000001', targetId = '00000000-0000-4000-8000-000000000002'
const row = { tourGroupPassengerId: id, tourGroupId: id, shoreExcursionId: id, passengerId: id, groupCode: 'Nhóm A', assignmentStatus: 'ASSIGNED', assignedAt: null, checkedInAt: null, returnedAt: null, createdAt: null }
const group = { tourGroupId: id, shoreExcursionId: id, excursionName: 'Tour', groupCode: 'Nhóm A', maximumCapacity: 10, assignedPassengers: 1, availableCapacity: 9, status: 'ASSEMBLING' }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', cacheDir: join(tmpdir(), `casms-ocv10-test-${process.pid}`), optimizeDeps: { noDiscovery: true, include: [] } })
  api = await server.ssrLoadModule('/src/features/tour-groups/api/group-passenger-api.ts')
  shared = await server.ssrLoadModule('/src/shared/api/index.ts')
  ui = await server.ssrLoadModule('/src/features/tour-groups/components/GroupPassengers.tsx')
  tourUI = await server.ssrLoadModule('/src/features/tour-groups/components/TourUI.tsx')
  shared.setApiAccessToken('isolated-frontend-test-token')
})
after(async () => { await server?.close() })

async function withResponses(responses, run) {
  const original = globalThis.fetch, calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(url, 'http://frontend.test'), ...options })
    const next = responses.shift()
    assert.ok(next, 'Unexpected request: ' + url)
    if (next instanceof Error) throw next
    return next
  }
  try { await run(calls); assert.equal(responses.length, 0, 'Unused responses') } finally { globalThis.fetch = original }
}

test('raw adapter sends exact controller paths, verbs, query parameters and request DTOs', async () => {
  await withResponses([json([row]), json(row), json(row, 201), json({ ...row, tourGroupId: targetId }), ...['CANCELLED', 'CHECKED_IN', 'COMPLETED'].map((assignmentStatus) => json({ ...row, assignmentStatus }))], async (calls) => {
    assert.equal((await api.groupPassengerApi.list(id)).length, 1)
    await api.groupPassengerApi.get(id)
    await api.groupPassengerApi.assign(id, id)
    await api.groupPassengerApi.move(id, targetId)
    for (const action of ['remove', 'departure', 'return']) await api.groupPassengerApi.action(id, action)
    assert.deepEqual(calls.map((call) => [call.method, call.url.pathname.replace('/api', '')]), [
      ['GET', '/tour-group-passengers'], ['GET', `/tour-group-passengers/${id}`], ['POST', '/tour-group-passengers'],
      ['PATCH', `/tour-group-passengers/${id}/move`], ...['remove', 'departure', 'return'].map((action) => ['PATCH', `/tour-group-passengers/${id}/${action}`]),
    ])
    assert.equal(calls[0].url.searchParams.get('groupId'), id)
    assert.deepEqual(JSON.parse(calls[2].body), { tourGroupId: id, passengerId: id })
    assert.deepEqual(JSON.parse(calls[3].body), { targetTourGroupId: targetId })
    for (const call of calls) assert.equal(new Headers(call.headers).get('Authorization'), 'Bearer isolated-frontend-test-token')
  })
})

test('HTTP 401/403/500, network and abort failures remain failures, never empty lists or successful writes', async () => {
  let unauthorized = 0
  const unsubscribe = shared.subscribeApiUnauthorized(() => { unauthorized++ })
  try {
    for (const status of [401, 403, 500]) await withResponses([new Response(null, { status })], async () => {
      await assert.rejects(api.groupPassengerApi.list(id), (error) => error instanceof shared.ApiError && error.status === status)
    })
    assert.equal(unauthorized, 1, '403 and 500 must not expire the session')
    await withResponses([new TypeError('offline')], async () => { await assert.rejects(api.groupPassengerApi.list(id), (error) => error instanceof shared.ApiError && error.status === 0) })
    const controller = new AbortController(); controller.abort()
    await assert.rejects(api.groupPassengerApi.list(id, controller.signal))
    for (const response of [json({ success: true, data: [row] }), json([{ ...row, tourGroupId: targetId }]), new Response(null, { status: 204 })]) await withResponses([response], async () => { await assert.rejects(api.groupPassengerApi.list(id)) })
    await withResponses([json({})], async () => { await assert.rejects(api.groupPassengerApi.assign(id, id)) })
    await withResponses([json(row)], async () => { await assert.rejects(api.groupPassengerApi.action(id, 'departure'), /không khớp/) })
    await withResponses([json(row)], async () => { await assert.rejects(api.groupPassengerApi.move(id, targetId), /không khớp/) })
  } finally { unsubscribe() }
})

test('eligibility and capacity checks stop at false/zero/errors; validation uses query params', async () => {
  await withResponses([json({ eligible: false })], async () => { await assert.rejects(api.checkPassengerAssignment(group, id), /đăng ký đã xác nhận/) })
  await withResponses([json({ eligible: true }), json({ availableCapacity: 0 })], async () => { await assert.rejects(api.checkPassengerAssignment(group, id), /hết chỗ/) })
  await withResponses([new Response(null, { status: 403 })], async () => { await assert.rejects(api.checkPassengerAssignment(group, id), (error) => error.status === 403) })
  await withResponses([json({ eligible: true }), json({ availableCapacity: 9 }), json({ message: 'Passenger assignment is valid' })], async (calls) => {
    await api.checkPassengerAssignment(group, id)
    assert.equal(calls[0].url.searchParams.get('passengerId'), id)
    assert.equal(calls[0].url.searchParams.get('excursionId'), id)
    assert.equal(calls[1].url.pathname, `/api/tour-group-passengers/groups/${id}/available-capacity`)
    assert.equal(calls[2].method, 'POST')
    assert.equal(calls[2].url.searchParams.get('groupId'), id)
    assert.equal(calls[2].url.searchParams.get('passengerId'), id)
    assert.equal(calls[2].body, undefined)
  })
})

test('move rechecks source, target context, registration and capacity before the mutation; returns new assignment', async () => {
  const target = { ...group, tourGroupId: targetId }, moved = { ...row, tourGroupPassengerId: targetId, tourGroupId: targetId }
  await withResponses([json(row), json(group), json(target), json({ eligible: true }), json({ availableCapacity: 9 }), json({ message: 'valid' }), json(moved)], async (calls) => {
    assert.equal((await api.performPassengerAction(id, id, 'move', targetId)).tourGroupPassengerId, targetId)
    assert.equal(calls.at(-1).method, 'PATCH')
    assert.deepEqual(JSON.parse(calls.at(-1).body), { targetTourGroupId: targetId })
  })
  for (const patch of [{ shoreExcursionId: targetId }, { availableCapacity: 0 }, { status: 'DEPARTED' }]) await withResponses([json(row), json(group), json({ ...target, ...patch })], async () => { await assert.rejects(api.performPassengerAction(id, id, 'move', targetId)) })
  await withResponses([json({ ...row, assignmentStatus: 'CHECKED_IN' }), json(group)], async () => { await assert.rejects(api.performPassengerAction(id, id, 'move', targetId)) })
  await withResponses([json({ ...row, tourGroupId: targetId }), json(group)], async () => { await assert.rejects(api.performPassengerAction(id, id, 'remove', '')) })
})

test('departure/return recheck fresh state and rejected mutations remain errors', async () => {
  await withResponses([json(row), json({ ...group, status: 'DEPARTED' })], async () => { await assert.rejects(api.performPassengerAction(id, id, 'departure', '')) })
  await withResponses([json(row), json(group), json({ ...row, assignmentStatus: 'CHECKED_IN' })], async () => { assert.equal((await api.performPassengerAction(id, id, 'departure', '')).assignmentStatus, 'CHECKED_IN') })
  await withResponses([json({ ...row, assignmentStatus: 'CHECKED_IN' }), json({ ...group, status: 'DEPARTED' }), json({ ...row, assignmentStatus: 'COMPLETED' })], async () => { assert.equal((await api.performPassengerAction(id, id, 'return', '')).assignmentStatus, 'COMPLETED') })
  await withResponses([json(row), json(group), json({ error: 'Only ASSIGNED records can be cancelled' }, 409)], async () => { await assert.rejects(api.performPassengerAction(id, id, 'remove', ''), (error) => error.status === 409) })
})

test('existing envelope client still rejects raw DTOs and accepts its documented envelope', async () => {
  await withResponses([json([])], async () => { await assert.rejects(shared.apiRequest('/tour-groups')) })
  await withResponses([json({ success: true, data: [] })], async () => { assert.deepEqual(await shared.apiRequest('/tour-groups'), []) })
})

test('isolated roster render preserves context, escapes raw text and exposes only eligible controls', () => {
  const render = (status, assignmentStatus, busy = false) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ui.PassengerRoster, { group: { ...group, status }, rows: [{ ...row, groupCode: '<script>unsafe</script>', assignmentStatus }], busy, onAction() {} })))
  const assembling = render('ASSEMBLING', 'ASSIGNED')
  for (const label of ['Chuyển nhóm', 'Gỡ phân công', 'Điểm danh khởi hành']) assert.ok(assembling.includes(label))
  assert.ok(!assembling.includes('Điểm danh trở về'))
  assert.ok(assembling.includes(`href="/admin/tour-groups/${id}"`))
  assert.ok(assembling.includes('&lt;script&gt;unsafe&lt;/script&gt;'))
  assert.ok(!assembling.includes('<script>'))
  assert.ok(render('ASSEMBLING', 'ASSIGNED', true).includes('disabled=""'))
  assert.ok(render('DEPARTED', 'CHECKED_IN').includes('Điểm danh trở về'))
  for (const status of ['COMPLETED', 'CANCELLED']) assert.ok(render('RETURNED', status).includes('Không có thao tác phù hợp.'))
  const empty = renderToStaticMarkup(createElement(ui.PassengerRoster, { group, rows: [], busy: false, onAction() {} }))
  assert.ok(empty.includes('Chưa có phân công hành khách trong nhóm'))
  const loading = renderToStaticMarkup(createElement(ui.GroupPassengers, { group, onChanged() {} }))
  assert.ok(loading.includes('Đang tải phân công hành khách…'))
  assert.ok(!loading.includes('Chưa có phân công hành khách trong nhóm'))
  for (const status of [401, 403, 500]) {
    const error = renderToStaticMarkup(createElement(tourUI.TourError, { error: new shared.ApiError('Internal server error', status), onRetry() {} }))
    assert.ok(error.includes(`HTTP ${status}`))
    assert.ok(error.includes('Thử lại'))
    assert.ok(!error.includes('Chưa có phân công hành khách'))
  }
})
