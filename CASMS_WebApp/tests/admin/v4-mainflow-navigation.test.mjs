import test from 'node:test'
import assert from 'node:assert/strict'
import {navigation as nav,authPolicy} from '../helpers/admin-navigation.mjs'
const session=(roles,permissions,status='ready')=>({roles,permissions,status})
test('OPS Plan queue requires its actor and both current grants; CRM cannot inherit the queue from grants',()=>{
 const path='/admin/cruise-plan-reviews',permissions=['CRUISE_READ','ITINERARY_APPROVE']
 assert.equal(nav.canRoleOpenAdminPath(['OPERATIONS_MANAGER'],path,'',session(['OPERATIONS_MANAGER'],permissions)),true)
 for(const missing of permissions)assert.equal(nav.canRoleOpenAdminPath(['OPERATIONS_MANAGER'],path,'',session(['OPERATIONS_MANAGER'],permissions.filter(p=>p!==missing))),false)
 assert.equal(nav.canRoleOpenAdminPath(['CRUISE_MANAGER'],path,'',session(['CRUISE_MANAGER'],permissions)),false)
 for(const status of ['loading','error','anonymous'])assert.equal(nav.canRoleOpenAdminPath(['OPERATIONS_MANAGER'],path,'',session(['OPERATIONS_MANAGER'],permissions,status)),false)
})
test('role alone never grants a landing; an effective CRM read opens the source catalog only',()=>{
 assert.equal(nav.staffRoleHome(['CRUISE_MANAGER']),null)
 assert.equal(nav.staffRoleHome(['CRUISE_MANAGER'],session(['CRUISE_MANAGER'],['TRIP_READ'])),'/admin/trips')
 assert.equal(nav.canRoleOpenAdminPath(['CRUISE_MANAGER'],'/admin/trips/new','',session(['CRUISE_MANAGER'],['TRIP_READ'])),false)
 assert.equal(nav.canRoleOpenAdminPath(['CRUISE_MANAGER'],'/admin/trips/new','',session(['CRUISE_MANAGER'],['TRIP_READ','TRIP_CREATE'])),true)
})
test('CRM scoped package composition uses UPDATE_DRAFT instead of a global catalog grant',()=>{
 const requirement=authPolicy.apiPermissionRequirement('/cruise-plans/c1/packages/p1/components','GET')
 assert.deepEqual(Array.from(requirement.anyOf[0].permissions),['CRUISE_UPDATE_DRAFT'])
 assert.equal(authPolicy.hasPermissions(session(['CRUISE_MANAGER'],['CRUISE_UPDATE_DRAFT']),requirement),true)
 assert.equal(authPolicy.hasPermissions(session(['OPERATIONS_MANAGER'],['CRUISE_UPDATE_DRAFT']),requirement),false)
 assert.equal(authPolicy.hasPermissions(session(['CRUISE_MANAGER'],['TOUR_PACKAGE_MANAGE']),requirement),false)
})
test('excursion commercial PATCH retains CRM role and scoped grant instead of global EXCURSION_UPDATE',()=>{
 const rule=authPolicy.apiPermissionRequirement('/cruise-plans/c1/excursions/e1/commercial','PATCH')
 assert.equal(authPolicy.hasPermissions(session(['CRUISE_MANAGER'],['CRUISE_UPDATE_DRAFT']),rule),true)
 assert.equal(authPolicy.hasPermissions(session(['OPERATIONS_MANAGER'],['CRUISE_UPDATE_DRAFT']),rule),false)
 assert.equal(authPolicy.hasPermissions(session(['CRUISE_MANAGER'],['EXCURSION_UPDATE']),rule),false)
})
test('work scopes preserve OPS Cruise cancellation and distinct CRM template-finalize copy',()=>{
 assert.equal(authPolicy.actionInWorkScope(['CRUISE_MANAGER'],'CRUISE_CANCEL'),false)
 assert.equal(authPolicy.actionInWorkScope(['OPERATIONS_MANAGER'],'CRUISE_CANCEL'),true)
 const crm=nav.adminWorkspaces.find(w=>w.id==='schedule')
 assert.ok(crm.steps.some(step=>step.includes('chốt lịch trình mẫu')))
 assert.ok(!crm.steps.some(step=>step.includes('gửi duyệt phiên bản')||step.includes('đã phát hành')))
})
