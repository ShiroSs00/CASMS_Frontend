import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, imports = {}, globals = {}) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL('../../src/' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, URL, URLSearchParams, FormData, ...globals, require(id) { assert.ok(id in imports, id); return imports[id] } })
  return module.exports
}
const model = load('features/ship-model-import/model.ts')
test('ZIP validation follows server identity, version and size constraints', () => {
  const file = { name: 'Conquest.ZIP', size: 1000 }
  assert.equal(Object.keys(model.validateBundle('conquest', 'v10', file, false)).length, 0)
  for (const key of ['', '../conquest', 'Conquest', 'a'.repeat(81)]) assert.ok(model.validateBundle(key, 'v10', file, false).modelKey)
  for (const version of ['', '.', '..', 'v/10', 'a'.repeat(81)]) assert.ok(model.validateBundle('conquest', version, file, false).assetVersion)
  for (const rejected of [null, { name: 'ship.glb', size: 100 }, { name: 'ship.zip', size: 0 }, { name: 'ship.zip', size: 2 * 1024 ** 3 + 1 }]) assert.ok(model.validateBundle('conquest', 'v10', rejected, false).file)
  assert.equal(Object.keys(model.validateBundle('conquest', 'v10', null, true)).length, 0)
})
test('resume only accepts completed uploads and re-reads server completion', () => {
  assert.equal(model.restoreSession('{'), null)
  assert.equal(model.restoreSession(JSON.stringify(model.emptySession)), null)
  const session = { modelKey: 'conquest', assetVersion: 'v10', fileName: 'ship.zip', uploaded: true, registration: { shipId: 'ship', shipModelId: 'model', shipCreated: true }, job: { status: 'SUCCEEDED' } }
  const restored = model.restoreSession(JSON.stringify(session))
  assert.equal(restored.registration.shipId, 'ship')
  assert.equal(restored.job, null)
  assert.equal(model.restoreSession(JSON.stringify({ ...session, registration: { shipId: null } })), null)
})
test('import uses multipart upload and separate register/import endpoints', async () => {
  const calls = []
  const job = { jobId: 'job', shipId: 'ship', modelId: 'model', status: 'PARTIAL', totalObjects: 320, decksImported: 13, cabinsImported: 304, objectsSucceeded: 319, objectsFailed: 1, objectsSkipped: 0 }
  const { shipImportApi, decodeJob } = load('features/ship-model-import/api.ts', { '@/shared/api': {
    ApiError: class extends Error {},
    apiRequest: async (path, options) => { calls.push({ path, options }); return path === '/ship-model-assets' ? { modelKey: 'conquest', assetVersion: 'v10', fileCount: 18 } : path.endsWith('/register') ? { shipId: 'ship', shipModelId: 'model', shipCreated: true } : job },
  } })
  const session = { ...model.emptySession, modelKey: 'conquest', assetVersion: 'v10' }
  await shipImportApi.upload(session, new File(['ZIP'], 'ship.zip'))
  assert.ok(calls[0].options.body instanceof FormData)
  assert.equal(calls[0].options.body.get('bundle').name, 'ship.zip')
  assert.ok(calls[0].options.timeoutMs > 20_000)
  const registration = await shipImportApi.register(session)
  assert.equal(calls[1].path, '/ship-model-assets/conquest/v10/register')
  assert.equal((await shipImportApi.importStructure(registration)).status, 'PARTIAL')
  assert.equal(calls[2].path, '/ships/ship/models/model/imports')
  assert.throws(() => decodeJob({ ...job, objectsFailed: -1 }))
  assert.throws(() => decodeJob({ ...job, status: 'DONE' }))
  assert.notEqual(model.jobLabel('PARTIAL'), model.jobLabel('SUCCEEDED'))
})
test('dedicated admin import menu uses effective grants and does not add Ship Manager management', () => {
  const nav = load('shared/ui/admin-v3/admin-navigation.ts')
  const access = { status: 'ready', permissions: ['SHIP_MODEL_CREATE'] }
  assert.equal(nav.canRoleOpenAdminPath(['ADMIN'], '/admin/ship-import', '', access), true)
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/ship-import', '', access), false)
  assert.equal(nav.canRoleOpenAdminPath(['ADMIN'], '/admin/ship-import', '', { ...access, permissions: [] }), false)
  assert.ok(nav.roleNavigationItems(['ADMIN'], access).some(item => item.to === '/admin/ship-import'))
  const fleetAccess = { status: 'ready', permissions: ['SHIP_MODEL_CREATE', 'SHIP_READ', 'DECK_READ', 'CABIN_READ'] }
  assert.ok(!nav.roleNavigationGroups(['ADMIN'], fleetAccess).some(group => group.id === 'fleet'))
  assert.ok(nav.roleNavigationGroups(['SHIP_MANAGER'], fleetAccess).some(group => group.items.some(item => item.to === '/admin/ships')))
  assert.ok(nav.roleNavigationGroups(['ADMIN', 'SHIP_MANAGER'], fleetAccess).some(group => group.id === 'fleet'))
})

test('stored bundles are not labelled as verified before registration, including restored old sessions', () => {
  const session = { ...model.emptySession, fileName: 'Gói đã lưu trên hệ thống', uploaded: true }
  assert.equal(model.bundleLabel(session), 'Gói đã tải (chờ kiểm tra)')
  assert.equal(model.bundleLabel({ ...session, registration: { shipId: 'ship', shipModelId: 'model', shipCreated: true } }), 'Gói đã lưu trên hệ thống')
  assert.equal(model.bundleLabel({ ...session, fileName: 'conquest.zip' }), 'conquest.zip')
})

test('missing stored bundle gives Vietnamese recovery guidance and preserves unrelated API errors', async () => {
  class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code } }
  let failure = new ApiError('Model asset bundle is not uploaded to the database', 404, 'NOT_FOUND')
  const { shipImportApi } = load('features/ship-model-import/api.ts', { '@/shared/api': { ApiError, apiRequest: async () => { throw failure } } })
  const session = { ...model.emptySession, modelKey: 'conquest', assetVersion: 'v1' }
  await assert.rejects(shipImportApi.register(session), error => error instanceof ApiError && error.status === 404 && error.code === 'NOT_FOUND' && /conquest/.test(error.message) && /v1/.test(error.message) && /Chọn lại gói/.test(error.message) && !/Model asset bundle/.test(error.message))
  for (const unrelated of [new ApiError('Forbidden', 403), new ApiError('Ship not found', 404), new Error('Network failed')]) {
    failure = unrelated
    await assert.rejects(shipImportApi.register(session), error => error === unrelated)
  }
})
