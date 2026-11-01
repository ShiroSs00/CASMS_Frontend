import { navigation } from '../helpers/admin-navigation.mjs'
import assert from 'node:assert/strict'


import test from 'node:test'



const nav = navigation
const ready = permissions => ({ status: 'ready', permissions })

test('incoming fleet, import, model and BLE routes use verified session grants in menu and guard', () => {
  const routes = { 'fleet-dashboard': 'SHIP_READ', 'ship-import': 'SHIP_MODEL_CREATE', 'ship-models': 'SHIP_MODEL_READ', 'passenger-tracking': 'BLE_TELEMETRY_READ' }
  for (const [section, permission] of Object.entries(routes)) {
    const path = '/admin/' + section
    for (const role of ['ADMIN', 'SHIP_MANAGER', 'OPERATIONS_MANAGER']) {
      const access = ready([permission,...(section==='ship-models'||section==='passenger-tracking'?['SHIP_READ']:section==='ship-import'?['SHIP_CREATE']:[])])
      const allowed=section==='fleet-dashboard'||section==='passenger-tracking'?role==='SHIP_MANAGER':role==='ADMIN'
      assert.equal(nav.canRoleOpenAdminPath([role], path, '', access), allowed, role + path)
      assert.equal(nav.roleNavigationItems([role], access).some(item => item.to === path),allowed)
      assert.equal(nav.canRoleOpenAdminPath([role], path, '', ready([])), false)
      for (const status of ['loading', 'anonymous', 'error']) assert.equal(nav.canRoleOpenAdminPath([role], path, '', { status, permissions: [permission] }), false)
    }
  }
})

test('landing waits for permissions and new navigation does not conceal other granted tools', () => {
  assert.equal(nav.staffRoleHome(['SHIP_MANAGER']), null)
  assert.equal(nav.staffRoleHome(['SHIP_MANAGER'], ready(['SHIP_READ'])), '/admin/fleet-dashboard')
  assert.equal(nav.roleNavigationItems(['SHIP_MANAGER'], ready(['OPERATIONAL_ISSUE_READ'])).some(item => item.to === '/admin/issues'),false)
  assert.equal(nav.roleNavigationItems(['ADMIN'], ready(['SHIP_READ'])).some(item => item.to === '/admin/ships'),false)
  assert.equal(nav.canRoleOpenAdminPath(['PASSENGER'], '/admin/ship-models', '', ready(['SHIP_MODEL_READ'])), false)
})

test('deck and cabin discovery retains incoming read alternatives while edits still require read and update', () => {
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/decks', '', ready(['CABIN_READ'])), true)
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/ships/s1/edit', '', ready(['SHIP_UPDATE'])), false)
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/ships/s1/edit', '', ready(['SHIP_READ', 'SHIP_UPDATE'])), true)
})
