import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/features/itineraries/api/itinerary-api.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText

function loadApi(apiRequest) {
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require(id) {
      assert.equal(id, '@/shared/api')
      return { apiRequest }
    },
  })
  return module.exports.itineraryApi
}

test('createPort sends the PortCreateRequest fields and preserves the API response', async () => {
  const expectedBody = {
    portCode: 'VN-HPH', portName: 'Hai Phong', countryCode: 'VN', timeZoneId: 'Asia/Ho_Chi_Minh',
    latitude: 0, longitude: 106.6881, status: 'INACTIVE',
  }
  const response = { portId: 'created-port', ...expectedBody }
  const calls = []
  const api = loadApi(async (path, options) => {
    calls.push({ path, method: options.method, body: JSON.parse(JSON.stringify(options.body)) })
    return response
  })

  const actual = await api.createPort({ ...expectedBody, description: 'Not supported by PortCreateRequest' })

  assert.deepEqual(calls, [{ path: '/ports', method: 'POST', body: expectedBody }])
  assert.equal(actual, response)
})

test('createPort keeps required fields when optional coordinates are omitted', async () => {
  const draft = {
    portCode: 'VN-HPH', portName: 'Hai Phong', countryCode: 'VN', timeZoneId: 'Asia/Ho_Chi_Minh', status: 'ACTIVE',
  }
  let requestBody
  const api = loadApi(async (_path, options) => {
    requestBody = JSON.parse(JSON.stringify(options.body))
  })

  await api.createPort(draft)

  assert.deepEqual(requestBody, draft)
})
