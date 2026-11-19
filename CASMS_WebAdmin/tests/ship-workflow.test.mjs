import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, setApiAccessToken } from '../src/shared/api/client.ts'
import { apiPermissionRequirement, hasPermissions } from '../src/shared/auth/permission-policy.ts'
import { setSessionAccess } from '../src/shared/auth/session-access.ts'
import { actionInWorkScope } from '../src/shared/auth/work-policy.ts'
import { canRoleOpenAdminPath, roleNavigationItems } from '../src/shared/ui/admin-v3/admin-navigation.ts'
import { shipTypesApi, shipError, storedAssetPath, unknownOutcome } from '../src/features/ship-deck-cabin/ship-types/api.ts'
import { metadataIssues } from '../src/features/ship-deck-cabin/ship-types/design-metadata.ts'
import { missingProfileLabels, profilePayload, validateProfile } from '../src/features/ship-deck-cabin/ship-types/profile.ts'
import { shipDeckCabinApi } from '../src/features/ship-deck-cabin/api/ship-deck-cabin-api.ts'
import { readShipListFilters, shipListParams } from '../src/features/ship-deck-cabin/model/ship-list-filters.ts'

const access = (role, permissions) => ({ status: 'ready', userId: role, roles: [role], permissions, error: '' })
const admin = access('ADMIN', ['SHIP_READ', 'SHIP_CREATE', 'SHIP_MODEL_CREATE', 'SHIP_MODEL_READ'])
const manager = access('SHIP_MANAGER', ['SHIP_READ', 'SHIP_MODEL_READ'])
const crm = access('CRUISE_MANAGER', ['SHIP_READ'])
const design = { modelKey: 'test-vessel', assetVersion: 'zip-pinned' }
const manifest = {
  modelId: design.modelKey, name: 'Test Vessel', shipManufacturerName: 'QA Shipyard',
  engineType: 'QA Engine', passengerCapacity: 12, deckCount: 8, length: 100, beam: 20,
  manufacturerShipCode: 'QA-HULL', shipyard: 'QA Yard', buildCountry: 'NL', buildYear: 2000,
  assets: { full: 'ship.glb' }, decks: [], cabins: [],
}

function authorized(state, method, path) {
  const rule = apiPermissionRequirement(path, method)
  assert.ok(rule, method + ' ' + path + ' must have a rule')
  return hasPermissions(state, rule)
}

test('archive endpoints require the Ship Manager role and ship archive permission', () => {
  assert.equal(actionInWorkScope(['SHIP_MANAGER'], 'SHIP_ARCHIVE'), true)
  assert.equal(actionInWorkScope(['ADMIN'], 'SHIP_ARCHIVE'), false)
  assert.equal(actionInWorkScope(['CRUISE_MANAGER'], 'SHIP_ARCHIVE'), false)
  for (const [method, endpoint] of [['GET', 'archive-eligibility'], ['POST', 'archive']]) {
    const path = '/ships/ship-id/' + endpoint
    assert.equal(authorized(manager, method, path), false)
    assert.equal(authorized(access('ADMIN', ['SHIP_ARCHIVE']), method, path), false)
    assert.equal(authorized(access('SHIP_MANAGER', ['SHIP_ARCHIVE']), method, path), true)
  }
  const filters = readShipListFilters(new URLSearchParams('archived=true&q=Zaandam'))
  assert.equal(filters.archived, true)
  assert.equal(shipListParams(filters, 2).toString(), 'q=Zaandam&archived=true&page=2')
  assert.equal(shipListParams(readShipListFilters(new URLSearchParams()), 0).has('archived'), false)
})

test('typed ship PATCH omits legacy origin and production year', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    calls.push([url, request])
    return Response.json({ success: true, data: { shipId: 'ship-id', shipTypeId: 'type-id', shipName: 'New name' } })
  })
  setSessionAccess(access('ADMIN', ['SHIP_READ', 'SHIP_UPDATE']))
  setApiAccessToken('qa-test-token')
  const current = { id: 'ship-id', shipTypeId: 'type-id', name: 'Old name' }
  await shipDeckCabinApi.saveShip({ name: 'New name', commissionDate: '2000-01-01', origin: 'CA', productionYear: 1999 }, current)
  assert.equal(calls[0][0], '/api/ships/ship-id')
  assert.deepEqual(JSON.parse(calls[0][1].body), { shipName: 'New name', commissionDate: '2000-01-01' })
})

test('ShipType and physical ship routes follow the real role split', () => {
  const canOpen = (actor, path) => canRoleOpenAdminPath(actor.roles, path, '', actor)
  assert.equal(canOpen(admin, '/admin/ship-types'), true)
  assert.equal(canOpen(admin, '/admin/ship-import'), true)
  assert.equal(canOpen(manager, '/admin/ship-import'), false)
  assert.equal(canOpen(manager, '/admin/ship-types/new'), false)
  assert.equal(canOpen(manager, '/admin/ship-types/id/edit'), false)
  assert.equal(canOpen(manager, '/admin/ship-types/id'), true)
  assert.equal(canOpen(manager, '/admin/ships/new'), true)
  assert.equal(canOpen(admin, '/admin/ships/new'), false)
  assert.equal(canOpen(crm, '/admin/ships/new'), false)
  assert.equal(authorized(manager, 'POST', '/ship-model-assets'), false)
  assert.equal(authorized(manager, 'POST', '/ship-types/from-stored'), false)
  assert.equal(authorized(manager, 'GET', '/ship-types'), true)
  assert.equal(authorized(manager, 'GET', '/ships/vessel/models/model/assets/ship.glb'), true)
  assert.equal(authorized(manager, 'GET', storedAssetPath(design, 'ship.glb')), false)
  assert.equal(authorized(admin, 'GET', storedAssetPath(design, 'ship.glb')), true)
})

test('Ship Manager can find the scoped ship list in the sidebar with read permission', () => {
  assert.ok(roleNavigationItems(manager.roles, manager).some(item => item.to === '/admin/ships' && item.label === 'Danh sách tàu'))
  const noRead = access('SHIP_MANAGER', [])
  assert.equal(roleNavigationItems(noRead.roles, noRead).some(item => item.to === '/admin/ships'), false)
})

test('staged workflow sends one multipart upload, then a pinned GET and a minimal confirm body', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push([url, init])
    const isUpload = calls.length === 1
    const data = isUpload ? { ...design, fileCount: 5, expandedBytes: 123 } : calls.length === 2 ? manifest : { shipTypeId: 'created' }
    return Response.json({ success: true, data })
  })
  setSessionAccess(admin)
  setApiAccessToken('qa-test-token')
  const file = new File(['zip test'], 'test.zip', { type: 'application/zip' })
  const stored = await shipTypesApi.upload(design.modelKey, file)
  assert.deepEqual(stored, design)
  await shipTypesApi.preview(stored)
  await shipTypesApi.create({ ...stored, fileCount: 8, expandedBytes: 51 })
  assert.equal(calls[0][0], '/api/ship-model-assets')
  assert.equal(calls[0][1].body.get('modelKey'), design.modelKey)
  assert.equal(calls[0][1].body.get('bundle').name, file.name)
  assert.match(calls[1][0], /preview\?assetVersion=zip-pinned$/)
  assert.equal(calls[2][0], '/api/ship-types/from-stored')
  assert.deepEqual(JSON.parse(calls[2][1].body), design)
})

test('provisioning uses ACTIVE catalogue and never POSTs a new key when just checking the result', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push([url, init])
    return Response.json({ success: true, data: { shipId: 'aurora-1', shipName: 'Aurora 01' } })
  })
  setSessionAccess(manager)
  setApiAccessToken('qa-test-token')
  const attempt = { typeId: 'type-id', key: 'd86eb12b-2e3a-43d4-b164-4f859fc09a60', payload: { shipName: 'Aurora 01', profile: null } }
  await shipTypesApi.list(0, '', 'ACTIVE')
  const created = await shipTypesApi.provision(attempt)
  const readBack = await shipTypesApi.result(attempt)
  await shipTypesApi.provision(attempt)
  assert.equal(created.shipName, 'Aurora 01')
  assert.equal(created.shipId, readBack.shipId)
  assert.match(calls[0][0], /status=ACTIVE/)
  assert.equal(calls[1][0], '/api/ship-types/type-id/ships')
  assert.deepEqual(JSON.parse(calls[1][1].body), attempt.payload)
  assert.equal(calls[2][1].method, 'GET')
  assert.match(calls[2][0], new RegExp('/provisioning/' + attempt.key + '$'))
  assert.equal(calls[1][1].headers['Idempotency-Key'], attempt.key)
  assert.equal(calls[3][1].headers['Idempotency-Key'], attempt.key)
})

test('validates draft profiles, manifest metadata and error recovery decisions', () => {
  assert.deepEqual(validateProfile({}), {})
  assert.ok(validateProfile({ imoNumber: '123' }).imoNumber)
  assert.ok(validateProfile({ registrationCountry: 'VN' }).registrationNumber)
  assert.deepEqual(profilePayload({ imoNumber: 'IMO 1234567', registrationCountry: 'vn', registrationNumber: 'r1',
    manufacturerShipCode: 'CLIENT', shipyard: 'Client yard', buildCountry: 'US', buildYear: '2020' }),
  { imoNumber: '1234567', registrationCountry: 'VN', registrationNumber: 'R1' })
  assert.deepEqual(metadataIssues(manifest), [])
  assert.match(metadataIssues({ ...manifest, shipManufacturerName: '' }).join(' '), /shipManufacturerName/)
  assert.match(metadataIssues({ ...manifest, engineType: '' }).join(' '), /engineType/)
  assert.match(metadataIssues({ ...manifest, shipTypeManufacturingIssues: ['buildCountry'] }).join(' '), /buildCountry/)
  assert.match(metadataIssues({ ...manifest, manufacturerShipCode: 25, buildYear: '2000' }).join(' '), /manufacturerShipCode.*buildYear/)
  assert.throws(() => storedAssetPath(design, '../wrong.glb'))
  assert.deepEqual(missingProfileLabels({ missingGroups: ['certification', 'warranty'] }),
    ['Đăng kiểm và hồ sơ chứng nhận', 'Hồ sơ bảo hành'])
  for (const status of [400, 403, 409, 410, 422]) {
    const error = new ApiError('Đã từ chối', status)
    assert.equal(unknownOutcome(error), false)
    assert.ok(shipError(error))
  }
  assert.equal(unknownOutcome(new ApiError('Timeout', 0)), true)
  assert.equal(unknownOutcome(new ApiError('Gateway timeout', 504)), true)
})
