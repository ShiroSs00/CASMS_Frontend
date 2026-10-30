import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { permissionPolicy } from '../helpers/permission-policy.mjs'

const jsx = (type, props, key) => ({ type, props, key })
const reviewedCopy = JSON.parse(readFileSync(new URL('../../src/shared/i18n/vi-business-map.json', import.meta.url), 'utf8'))
function load(path, imports = {}) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL('../../src/' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, URL, URLSearchParams, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('.module.css')) return { default: {} }
    if (id === '@/shared/i18n/business-copy') return { businessCopy: key => { assert.ok(key in reviewedCopy); return reviewedCopy[key] } }
    assert.ok(id in imports, id); return imports[id]
  } })
  return module.exports
}
const types = load('features/ship-deck-cabin/model/types.ts')
const model = load('features/ship-deck-cabin/model/ship-management.ts')
const workPolicy = load('shared/auth/work-policy.ts')
const ship = { id: 's1', code: 'SH-0001', name: 'Conquest', capacity: 610, totalDecks: 13, deckNumberLimit: 14, status: 'ACTIVE', commissionDate: '', lengthMeters: 290, beamMeters: 35 }

test('Ship Manager hides standalone deck and cabin menus while retaining permitted ship links', () => {
  const nav = load('shared/ui/admin-v3/admin-navigation.ts', {'@/shared/auth': {...permissionPolicy, ...workPolicy}})
  const access = { status: 'ready', permissions: ['SHIP_READ', 'DECK_READ', 'CABIN_READ', 'BLE_TELEMETRY_READ', 'SHIP_UPDATE'] }
  const groups = nav.roleNavigationGroups(['SHIP_MANAGER'], access)
  assert.deepEqual(Array.from(groups.slice(0,2), group => group.label), ['Tổng quan đội tàu', 'Tàu'])
  const cabinOnly = {status:'ready',permissions:['SHIP_READ','CABIN_READ']}
  assert.ok(!nav.roleNavigationItems(['SHIP_MANAGER'],cabinOnly).some(item=>item.to==='/admin/decks'))
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'],'/admin/decks','',cabinOnly),true)
  assert.ok(!nav.roleNavigationItems(['SHIP_MANAGER'],access).some(item=>item.to==='/admin/cabins'))
  assert.ok(groups.every(group => group.direct && group.items.length === 1))
  assert.equal(nav.staffRoleHome(['SHIP_MANAGER'], access), '/admin/fleet-dashboard')
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/ships/new', '', access), false)
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/ships/new', '', { ...access, permissions: [...access.permissions, 'SHIP_CREATE'] }), true)
  assert.equal(nav.canRoleOpenAdminPath(['SHIP_MANAGER'], '/admin/ships/s1/edit', '', access), true)
  assert.equal(nav.roleNavigationGroups(['SHIP_MANAGER'], { status: 'ready', permissions: [] }).length, 0)
  assert.ok(!nav.roleNavigationItems(['ADMIN'], { status: 'ready', permissions: ['SHIP_READ'] }).some(item => item.to === '/admin/fleet-dashboard'))
})

test('ship-scoped reads retrieve every page and reject a response belonging to another ship', async () => {
  const calls = []
  let wrongShip = false
  class ApiError extends Error {}
  const { shipDeckCabinApi: api } = load('features/ship-deck-cabin/api/ship-deck-cabin-api.ts', { '@/shared/api': { ApiError, apiRequest: async (path, options) => {
    calls.push({ path, options })
    const page = options.query.page
    const room = { cabinId: 'r' + page, shipId: wrongShip ? 's2' : 's1', deckId: 'd1', cabinNumber: page ? 'C01-002' : 'C01-001', cabinType: 'INTERIOR', capacity: 2, status: 'AVAILABLE', isAccessible: false }
    return { content: [room], number: page, totalPages: 2, totalElements: 2 }
  } } })
  const signal = new AbortController().signal
  assert.equal((await api.listShipCabins('s1', signal)).length, 2)
  assert.deepEqual(calls.map(call => call.path), ['/cabins/by-ship/s1', '/cabins/by-ship/s1'])
  assert.ok(calls.every(call => call.options.signal === signal))
  wrongShip = true
  await assert.rejects(api.listShipCabins('s1', signal), /không khớp/)
  assert.ok(!calls.some(call => ['/cabins', '/decks'].includes(call.path)))
})

test('business updates omit model-controlled room fields and stable deck identity', async () => {
  const calls = []
  const { shipDeckCabinApi: api } = load('features/ship-deck-cabin/api/ship-deck-cabin-api.ts', { '@/shared/api': { ApiError: class extends Error {}, apiRequest: async (path, options) => { calls.push({ path, options }); return { cabinId: 'r1', deckId: 'd1', shipId: 's1', cabinNumber: 'C01-001', cabinType: 'SUITE', capacity: 4, status: 'AVAILABLE', isAccessible: true, deckNumber: 14 } } } })
  await api.saveCabin({ id: 'r1', shipId: 's1', deckId: 'd1', number: 'C01-001', type: 'SUITE', capacity: 4, accessible: true, status: 'AVAILABLE', modelWidth: 5 }, 'r1')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.body)), { capacity: 4, isAccessible: true })
  await api.updateDeckOperations('d1', ' Sun ', 1.2)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].options.body)), { deckName: 'Sun', priceMultiplier: 1.2 })
})

test('deck ordinal 14 is valid for an imported ship with 13 decks; room filters compose', () => {
  const validation = load('features/ship-deck-cabin/model/validation.ts', { './types.ts': types })
  const deck = { id: 'd14', shipId: 's1', number: 14, name: 'Sun', priceMultiplier: 1 }
  assert.equal(Object.keys(validation.validateDeck(deck, { ships: [ship], decks: [deck], cabins: [] }, deck.id)).length, 0)
  const rooms = [{ id: 'r1', deckId: 'd14', number: 'C14-001', type: 'SUITE', status: 'AVAILABLE' }, { id: 'r2', deckId: 'd1', number: 'C01-002', type: 'INTERIOR', status: 'MAINTENANCE' }]
  const before = JSON.stringify(rooms)
  assert.equal(model.filterRooms(rooms, { search: ' c14 ', deck: 'd14', status: 'AVAILABLE', type: 'SUITE' }).length, 1)
  assert.equal(JSON.stringify(rooms), before)
  assert.equal(model.validateShipEdit({ ...ship, lengthMeters: null }, ship).dimensions.length > 0, true)
  assert.ok(model.validateShipEdit({ ...ship, commissionDate: '2099-01-01' }, ship).commissionDate)
})

function render(tree) {
  if (Array.isArray(tree)) return tree.flatMap(render)
  if (!tree || typeof tree !== 'object') return []
  if (typeof tree.type === 'function') return render(tree.type(tree.props))
  return [tree, ...render(tree.props?.children)]
}
test('standalone structure screens do not mount inventory before a valid ship is selected', () => {
  for (const query of [{}, {ship:'s1'}, {ship:'unknown'}, {ship:'s1',view:'cabins',deck:'d14'}, {ship:'s1',view:'decks'}]) {
    const selected = query.ship ?? ''
    const scopes = []
    const page = load('features/ship-deck-cabin/pages/ShipStructureListPage.tsx', {
      react: { useState: value => [value, () => {}], useCallback: fn => fn },
      'react-router': { Link: 'Link', useSearchParams: () => [new URLSearchParams(query), () => {}] },
      '@/shared/auth': { useSessionAccess: () => ({ has: () => true, canDo: () => true }) },
      '@/shared/ui': {...Object.fromEntries(['Button', 'Empty', 'Field', 'Loading', 'Notice', 'PageHeader', 'Panel'].map(key => [key, key])), PermissionLink: 'Link'},
      '@/shared/ui/admin-v3': { AdminShell: 'AdminShell' },
      '../api/ship-deck-cabin-api': { shipDeckCabinApi: {} },
      '../hooks/useFleetQuery': { useFleetQuery: scope => { scopes.push(scope); return { data: [ship], loading: false, error: '' } } },
      '../components/ShipInventory': { ShipInventory: 'Inventory' }, '../components/FleetDialogs': { FleetDialogs: 'Dialogs' },
      '../components/Common': { StatusBadge: 'StatusBadge' },
    })
    for (const Component of [page.ShipDeckListPage, page.ShipCabinListPage]) {
      const tree = render(jsx(Component, {}))
      const inventories = tree.filter(node => node.type === 'Inventory')
      assert.equal(inventories.length, selected === 's1' ? 1 : 0)
      if (inventories.length) assert.equal(inventories[0].props.ship.id, 's1')
      if (inventories.length && query.view) assert.equal(inventories[0].props.view,query.view)
      if (inventories.length && query.deck) assert.equal(inventories[0].props.initialDeck,query.deck)
      const choices = tree.filter(node => node.type === 'Link' && node.props['aria-label']?.startsWith('Xem boong và cabin của'))
      assert.equal(choices.length, selected === 's1' ? 0 : 1)
      if (choices.length) assert.match(choices[0].props['aria-label'], /Xem boong và cabin của/)
      const tabs = tree.filter(node=>node.type==='nav'&&node.props['aria-label']==='Cấu trúc tàu')
      assert.equal(tabs.length,selected==='s1'?1:0)
    }
    assert.ok(scopes.every(scope => scope === 'structure-ship-choices'))
  }
})
