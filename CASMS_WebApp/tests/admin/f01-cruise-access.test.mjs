import { loadSource } from '../helpers/source-loader.mjs'
import assert from 'node:assert/strict'


import test from 'node:test'

import { permissionPolicy } from '../helpers/permission-policy.mjs'

const jsx = (type, props) => ({ type, props })
function load(file, imports = {}) { return loadSource(new URL('../../src/' + file, import.meta.url), { 'react/jsx-runtime': { jsx: jsx, jsxs: jsx, Fragment: 'Fragment' }, ...imports }, {}); }
const work = load('shared/auth/work-policy.ts')
const policy = { ...permissionPolicy, ...work }
const nav = load('shared/ui/admin-v3/admin-navigation.ts', { '@/shared/auth': policy })
const session = load('shared/auth/session-access.ts', {
  react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
  './permission-policy': permissionPolicy, './work-policy': work,
})
// Relevant authorities verified against local BE RolePermissionInitializer; test fixtures only.
const managerPermissions = ['CRUISE_READ', 'CRUISE_CREATE', 'CRUISE_UPDATE_DRAFT', 'CRUISE_ASSIGN_SHIP', 'CRUISE_CHANGE_SHIP', 'CRUISE_UNASSIGN_SHIP', 'CRUISE_PUBLISH', 'CRUISE_STATUS_CHANGE']
function access(role, permissions, status = 'ready') {
  session.setSessionAccess({ status, userId: 'f01-test-user', roles: [role], permissions, error: '' })
  return session.useSessionAccess()
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
}
function guard(pathname, current, userId = current.userId) {
  return load('features/auth/guards.tsx', {
    react:{useState:value=>[value,()=>{}]},
    '@/shared/auth': { useSessionAccess: () => current },
    '@/shared/ui/admin-v3': { ...nav, AdminShell: 'AdminShell' },
    '@/shared/ui': { Loading: 'Loading', Notice: 'Notice', PageHeader: 'PageHeader', ButtonLink: 'ButtonLink' },
    'react-router': { Navigate: 'Navigate', Outlet: 'Outlet', useLocation: () => ({ pathname, search: '', hash: '' }) },
    './useAuth': { useAuth: () => ({ user: { id: userId, roles: ['ADMIN'] }, isStaff: true }) },
    './model/auth-types': {},
  }).AdminGuard()
}

test('F01 single CRUISE_MANAGER enters list/create/detail/edit using effective session permissions', () => {
  const current = access('CRUISE_MANAGER', managerPermissions)
  assert.equal(work.hasWorkScope(current.roles, 'cruises'), true)
  for (const path of ['/admin/cruises', '/admin/cruises/new', '/admin/cruises/f01', '/admin/cruises/f01/edit']) {
    assert.equal(nav.canRoleOpenAdminPath(current.roles, path, '', current), true, path)
    assert.equal(guard(path, current).type, 'Outlet', path)
  }
  assert.ok(nav.roleNavigationItems(current.roles, current).some(item => item.to === '/admin/cruises'))
  for (const permission of ['CRUISE_ASSIGN_SHIP', 'CRUISE_CHANGE_SHIP', 'CRUISE_UNASSIGN_SHIP']) {
    assert.equal(work.actionInWorkScope(current.roles, permission), true)
    assert.equal(current.canDo(permission), true)
    assert.equal(access('CRUISE_MANAGER', managerPermissions.filter(p => p !== permission)).canDo(permission), false)
  }
})

test('F01 publish/status grants cannot enable opening sales; API 403 has dedicated feedback', () => {
  const current = access('CRUISE_MANAGER', managerPermissions)
  class ApiError extends Error { constructor(status) { super('Bạn không có quyền thực hiện thao tác này.'); this.status = status } }
  const data = load('features/cruises/components/DepartureData.tsx', {
    './DepartureCommand': { DepartureCommand: 'DepartureCommand' },
    './ReadinessIssues': {ReadinessIssues:'ReadinessIssues'},
    '../hooks/useReadinessClock': {useReadinessClock:()=>Date.now()},
    '../api/departure-management-api': { departureManagementApi: {} },
    react: { useCallback: fn => fn },
    '@/shared/api': { ApiError, useReadQuery: () => ({ data: null, loading: false, error: null }) },
    '@/shared/auth': { useSessionAccess: () => current }, '@/shared/lib/journey-time': {},
    '@/shared/ui': { Panel: 'Panel', Button: 'Button', Notice: 'Notice' },
    '../api/departure-api': {}, '../api/cruise-api': {},
    '../model/departure-contract': { saleAssessment: () => 'UNKNOWN' },
    '../model/cruise-validation': {}, '../model/preparation': {},
  })
  const tree = data.DepartureSaleReadiness({ cruise: { cruiseId: 'f01', revision: 1 } })
  assert.ok(!nodes(tree).some(node => node.props?.label === 'Xác nhận mở bán'))
  const forbidden = data.ReadState({ loading: false, error: new ApiError(403), retry() {} })
  assert.equal(forbidden.props.title, 'Chưa có quyền xem')
})

test('F01 read-only manager and ship manager cannot enter mutation routes or perform assignment', () => {
  for (const role of ['CRUISE_MANAGER', 'SHIP_MANAGER']) {
    const current = access(role, ['CRUISE_READ'])
    assert.equal(nav.canRoleOpenAdminPath(current.roles, '/admin/cruises/f01', '', current), true)
    assert.equal(guard('/admin/cruises/f01', current).type, 'Outlet')
    for (const path of ['/admin/cruises/new', '/admin/cruises/f01/edit']) {
      assert.equal(nav.canRoleOpenAdminPath(current.roles, path, '', current), false)
      assert.ok(!nodes(guard(path, current)).some(node => node.type === 'Outlet'))
    }
    for (const permission of managerPermissions.filter(p => p !== 'CRUISE_READ')) assert.equal(current.canDo(permission), false)
  }
  const ship = access('SHIP_MANAGER', managerPermissions)
  for (const permission of managerPermissions.filter(p => p !== 'CRUISE_READ')) assert.equal(ship.canDo(permission), false)
  assert.equal(nav.canRoleOpenAdminPath(ship.roles, '/admin/cruises/new', '', ship), false)
  assert.equal(nav.canRoleOpenAdminPath(ship.roles, '/admin/cruises/f01/edit', '', ship), false)
  assert.equal(nav.canRoleOpenAdminPath(ship.roles, '/admin/cruises', '', ship), false)
  assert.ok(!nav.roleNavigationItems(ship.roles, ship).some(item => item.to === '/admin/cruises'))
})

test('F01 guard blocks revoked, unresolved and foreign-session access; denial has a separate 403 message', () => {
  for (const role of ['CRUISE_MANAGER', 'SHIP_MANAGER']) {
    for (const status of ['ready', 'loading', 'anonymous', 'error']) {
      const current = access(role, status === 'ready' ? [] : managerPermissions, status)
      for (const path of ['/admin/cruises/new', '/admin/cruises/f01']) {
        assert.equal(nav.canRoleOpenAdminPath([role], path, '', current), false)
        const result = guard(path, current)
        assert.ok(!nodes(result).some(node => node.type === 'Outlet'))
        if (status === 'ready') assert.ok(nodes(result).some(node => node.props?.breadcrumb === 'OCEVIE / 403' && node.props.title === 'Bạn không có quyền truy cập'))
      }
    }
  }
  const current = access('CRUISE_MANAGER', managerPermissions)
  assert.ok(!nodes(guard('/admin/cruises/new', current, 'another-user')).some(node => node.type === 'Outlet'))
  // Session roles override a stale login snapshot, even if its role would allow the route.
  assert.equal(nav.canRoleOpenAdminPath(['CRUISE_MANAGER'], '/admin/cruises/new', '', access('SHIP_MANAGER', managerPermissions)), false)
})

test('F01 ship assignment handler never calls mutations for a read-only role', async () => {
  for (const role of ['CRUISE_MANAGER', 'SHIP_MANAGER']) {
    const current = access(role, ['CRUISE_READ'])
    const { ShipAssignmentDialog } = load('features/cruises/components/ShipAssignmentDialog.tsx', {
      '@/shared/lib/mutation-outcome':load('shared/lib/mutation-outcome.ts',{'@/shared/api':{ApiError:Error}}),
      '@/shared/auth': { useSessionAccess: () => current }, '@/shared/api': { ApiError: Error },
      react: { useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }), useState: value => [value, () => {}] },
      '@/shared/ui': { Badge: 'Badge', Button: 'Button', Loading: 'Loading', Modal: 'Modal', Notice: 'Notice' },
      '../api/cruise-api': { cruiseApi: { unassignShip() { assert.fail('Forbidden mutation') } } },
    })
    const dialog = ShipAssignmentDialog({ detail: { cruise: { cruiseId: 'f01' } }, mode: 'unassign', onClose() {}, onChanged() { assert.fail('False success') } })
    const button = nodes(dialog.props.footer).find(node => node.props?.tone === 'danger')
    assert.equal(button.props.disabled, true)
    await button.props.onClick()
  }
})
