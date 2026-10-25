import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { permissionPolicy } from '../helpers/permission-policy.mjs'

const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/shared/ui/admin-v3/admin-navigation.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText, { module, exports: module.exports, URL, URLSearchParams, require(id) {
  assert.equal(id, '@/shared/auth')
  return permissionPolicy
} })
const nav = module.exports
const ready = permissions => ({ status: 'ready', permissions })

test('incoming fleet, import, model and BLE routes use verified session grants in menu and guard', () => {
  const routes = { 'fleet-dashboard': 'SHIP_READ', 'ship-import': 'SHIP_MODEL_CREATE', 'ship-models': 'SHIP_MODEL_READ', 'passenger-tracking': 'BLE_TELEMETRY_READ' }
  for (const [section, permission] of Object.entries(routes)) {
    const path = '/admin/' + section
    for (const role of ['ADMIN', 'SHIP_MANAGER', 'OPERATIONS_MANAGER']) {
      const access = ready([permission])
      assert.equal(nav.canRoleOpenAdminPath([role], path, '', access), true, role + path)
      assert.ok(nav.roleNavigationItems([role], access).some(item => item.to === path))
      assert.equal(nav.canRoleOpenAdminPath([role], path, '', ready([])), false)
      for (const status of ['loading', 'anonymous', 'error']) assert.equal(nav.canRoleOpenAdminPath([role], path, '', { status, permissions: [permission] }), false)
    }
  }
})

test('landing waits for permissions and new navigation does not conceal other granted tools', () => {
  assert.equal(nav.staffRoleHome(['SHIP_MANAGER']), null)
  assert.equal(nav.staffRoleHome(['SHIP_MANAGER'], ready(['SHIP_READ'])), '/admin/fleet-dashboard')
  assert.ok(nav.roleNavigationItems(['SHIP_MANAGER'], ready(['OPERATIONAL_ISSUE_READ'])).some(item => item.to === '/admin/issues'))
  assert.ok(nav.roleNavigationItems(['ADMIN'], ready(['SHIP_READ'])).some(item => item.to === '/admin/ships'))
  assert.equal(nav.canRoleOpenAdminPath(['PASSENGER'], '/admin/ship-models', '', ready(['SHIP_MODEL_READ'])), false)
})

test('deck and cabin discovery retains incoming read alternatives while edits still require read and update', () => {
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/decks', '', ready(['CABIN_READ'])), true)
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/ships/s1/edit', '', ready(['SHIP_UPDATE'])), false)
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/ships/s1/edit', '', ready(['SHIP_READ', 'SHIP_UPDATE'])), true)
})
