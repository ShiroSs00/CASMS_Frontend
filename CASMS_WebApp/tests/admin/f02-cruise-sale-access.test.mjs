import { loadSource } from '../helpers/source-loader.mjs'
import assert from 'node:assert/strict'


import test from 'node:test'

import { permissionPolicy } from '../helpers/permission-policy.mjs'

const jsx = (type, props) => ({ type, props })
function load(file, imports = {}) { return loadSource(new URL('../../src/' + file, import.meta.url), { 'react/jsx-runtime': { jsx: jsx, jsxs: jsx, Fragment: 'Fragment' }, ...imports }, {}); }
const work = load('shared/auth/work-policy.ts')
const session = load('shared/auth/session-access.ts', {
  react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
  './permission-policy': permissionPolicy, './work-policy': work,
})
class ApiError extends Error { constructor(status) { super('Bạn không có quyền thực hiện thao tác này.'); this.status = status } }
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
}

test('F02 legacy grants never expose sale actions for single or combined roles while dedicated BE permissions are missing', () => {
  const { DepartureSaleReadiness } = load('features/cruises/components/DepartureData.tsx', {
          './DepartureCommand': { DepartureCommand: 'DepartureCommand' }, '../api/departure-management-api': {},
          './ReadinessIssues': {ReadinessIssues:'ReadinessIssues'},
          '../hooks/useReadinessClock': {useReadinessClock:()=>Date.now()},
          react: { useState:initial=>[initial,()=>{}],useRef:current=>({current}),useCallback: fn => fn },
          '@/shared/api': { ApiError, useReadQuery: () => ({ data: null, loading: false, error: null }) },
          '@/shared/auth': { useSessionAccess: session.useSessionAccess }, '@/shared/lib/journey-time': {},
          '@/shared/ui': { Panel: 'Panel', Button: 'Button', Notice: 'Notice' },
          '../api/departure-api': {}, '../api/cruise-api': {},
          '../model/departure-contract': { saleAssessment: () => 'UNKNOWN' },
          '../model/cruise-validation': {}, '../model/preparation': {},
        })
  for (const roles of [['CRUISE_MANAGER'], ['OPERATIONS_MANAGER'], ['SHIP_MANAGER'], ['ADMIN'], ['CRUISE_MANAGER', 'OPERATIONS_MANAGER'], ['SHIP_MANAGER', 'OPERATIONS_MANAGER'], ['ADMIN', 'CRUISE_MANAGER']]) {
    for (const permissions of [[], ['CRUISE_READ'], ['CRUISE_READ', 'CRUISE_PUBLISH'], ['CRUISE_READ', 'CRUISE_STATUS_CHANGE'], ['CRUISE_READ', 'CRUISE_PUBLISH', 'CRUISE_STATUS_CHANGE']]) {
      for (const status of ['ready', 'loading', 'error', 'anonymous']) {
        session.setSessionAccess({ userId: 'f02-test-user', roles, permissions, status, error: '' })
        const boundary = DepartureSaleReadiness({ cruise: { cruiseId: 'f02', revision: 2 } }); const tree=boundary.type(boundary.props)
        assert.ok(!nodes(tree).some(node => node.type === 'DepartureCommand'), roles.join('+') + ':' + status)
        assert.ok(!nodes(tree).some(node => node.props?.children === 'Xác nhận mở bán'))
        assert.ok(nodes(tree).some(node => node.props?.children === 'Kiểm tra lại điều kiện nhận đặt chỗ'))
      }
    }
  }
})

test('F02 API adapter exposes no sale mutation until the BE authorization contract is resolved', () => {
  const { departureManagementApi } = load('features/cruises/api/departure-management-api.ts', {
    '@/shared/api': { ApiError, apiRequest() { assert.fail('No sale request is authorized') } },
    '../model/departure-contract': {},
    './cruise-api':{}, './departure-api':{},
  })
  assert.equal(departureManagementApi.sale, undefined)
})

test('F02 backend permission snapshot follows dedicated local BE authorities without granting runtime access', () => {
  const manager = { status: 'ready', roles: ['CRUISE_MANAGER'], permissions: ['CRUISE_PUBLISH', 'CRUISE_STATUS_CHANGE'] }
  for (const [action, permission] of [['open-sale','CRUISE_OPEN_SALE'], ['stop-sale','CRUISE_STOP_SALE'], ['resume-sale','CRUISE_RESUME_SALE']]) {
    const requirement = permissionPolicy.apiPermissionRequirement('/cruise/f02/' + action, 'POST')
    assert.deepEqual(Array.from(requirement.permissions), [permission])
    assert.equal(permissionPolicy.hasPermissions(manager, requirement), false)
    assert.equal(work.actionInWorkScope(['OPERATIONS_MANAGER'],permission),true)
    assert.equal(work.actionInWorkScope(['CRUISE_MANAGER'],permission),false)
  }
})
