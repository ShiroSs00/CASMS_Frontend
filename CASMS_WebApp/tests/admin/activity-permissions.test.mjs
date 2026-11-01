import { explicitTestAccess } from '../helpers/reviewed-source-modules.mjs'
import { loadSource } from '../helpers/source-loader.mjs'
import assert from 'node:assert/strict'

import test from 'node:test'



function load(file,imports={}) { return loadSource(new URL('../../src/'+file,import.meta.url), { 'react/jsx-runtime': { jsx: (type, props, key) => ({type, props, key}), jsxs: (type, props, key) => ({type, props, key}), Fragment: 'Fragment' }, ...imports }, {}); }
const {actionInWorkScope}=load('shared/auth/work-policy.ts')
const {registrationAccess}=load('features/activities/model/activity-permissions.ts')
const nav=load('shared/ui/admin-v3/admin-navigation.ts')
const access=(permissions,roles=['ACTIVITY_SERVICE_MANAGER','ONBOARD_STAFF'])=>explicitTestAccess(roles,permissions)
const context={kind:'excursions',id:'excursion',cruiseId:'cruise',status:'OPEN',startTime:'2099-01-01T00:00:00Z',endTime:'2099-01-02T00:00:00Z'}

test('registration and participation rights match current BE shared endpoints for every role',()=>{
  for(const [role,permissions] of Object.entries(nav.backendRolePermissions)) for(const kind of ['activities','excursions']) {
    const result=registrationAccess(access(permissions,[role]),kind)
    assert.equal(result.read,access(permissions,[role]).canDo('ACTIVITY_ATTENDANCE')||access(permissions,[role]).canDo('ACTIVITY_REGISTRATION'),role)
    assert.equal(result.create,access(permissions,[role]).canDo(kind==='activities'?'ACTIVITY_REGISTRATION':'EXCURSION_BOOKING'),role)
    assert.equal(result.manage,permissions.includes('ACTIVITY_REGISTRATION')&&actionInWorkScope([role],'ACTIVITY_REGISTRATION'),role)
    assert.equal(result.attend,permissions.includes('ACTIVITY_ATTENDANCE')&&actionInWorkScope([role],'ACTIVITY_ATTENDANCE'),role)
  }
  const shoreOnly=registrationAccess(access(['EXCURSION_BOOKING','TOUR_GROUP_PASSENGER_ATTENDANCE']),'excursions')
  assert.equal(shoreOnly.create,true)
  assert.equal(shoreOnly.manage,false)
  assert.equal(shoreOnly.attend,false)
})

test('read-only reference roles do not request registration or participation APIs they cannot access',()=>{
  for(const role of ['ADMIN','CRUISE_MANAGER','OPERATIONS_MANAGER','SHIP_MANAGER','BOOKING_AGENT','CHECKIN_STAFF','FINANCE_OFFICER','CUSTOMER_SERVICE']) {
    const {RegistrationPanel}=load('features/activities/components/RegistrationPanel.tsx',{
      react:{useCallback:fn=>fn,useRef:initial=>({current:initial}),useState:initial=>[typeof initial==='function'?initial():initial,()=>{}]},
      '@/shared/auth':{useSessionAccess:()=>access(nav.backendRolePermissions[role],[role])},
      '@/shared/api':{useReadQuery:(_key,fn)=>{fn({});return {data:null}}},
      '@/shared/ui':{Panel:'Panel',Notice:'Notice'}, '@/domain/booking-context':{},
      '../api/activity-api':{activityApi:new Proxy({},{get(){assert.fail('Unauthorized API request for '+role)}})},
      '../model/activity':{},'../model/activity-actions':{},'../model/activity-permissions':{registrationAccess},'./ActivityUI':{},
    })
    assert.equal(RegistrationPanel({context}).props.children.props.title,'Chưa có quyền xem đăng ký')
  }
})

test('registration routes use attendance/registration authority, package-assignment read retains BOOKING_READ',()=>{
  for(const query of ['', '?excursionId=fixture']) {
    assert.equal(nav.canRoleOpenAdminPath(['ONBOARD_STAFF'],'/admin/activity-registrations',query,{status:'ready',permissions:['ACTIVITY_ATTENDANCE']}),true)
    assert.equal(nav.canRoleOpenAdminPath(['CRUISE_MANAGER'],'/admin/activity-registrations',query,{status:'ready',permissions:['ACTIVITY_READ','EXCURSION_READ']}),false)
  }
  assert.equal(nav.canRoleOpenAdminPath(['BOOKING_AGENT'],'/admin/package-assignments','',{status:'ready',permissions:['BOOKING_READ']}),true)
})
