import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { pricingCapabilities } from '../src/features/cruises/model/pricing-access.ts'
import { apiPermissionRequirement, hasPermissions } from '../src/shared/auth/permission-policy.ts'
import { setSessionAccess } from '../src/shared/auth/session-access.ts'
import { PricingReview } from '../src/features/cruises/components/PricingReview.tsx'
const access=(roles,permissions)=>({status:'ready',roles,permissions,userId:'user',error:'',has:p=>permissions.includes(p)})
const crm=access(['CRUISE_MANAGER'],['CRUISE_UPDATE_DRAFT']),ops=access(['OPERATIONS_MANAGER'],['CRUISE_PRICING_APPROVE'])
test('pricing maker and reviewer require both Backend role and effective permission',()=>{
 assert.deepEqual(pricingCapabilities(crm),{draft:true,review:false})
 assert.deepEqual(pricingCapabilities(ops),{draft:false,review:true})
 for(const value of [access(['CRUISE_MANAGER'],[]),access(['OPERATIONS_MANAGER'],[]),access(['ADMIN'],['CRUISE_UPDATE_DRAFT','CRUISE_PRICING_APPROVE'])])assert.deepEqual(pricingCapabilities(value),{draft:false,review:false})
})
for(const root of ['/cruise/id/pricing-policy','/cruises/id/pricing-policy','/cruise-plans/id/pricing-policy']){
 test(`draft request ${root} permits CRM and denies OPS`,()=>{const rule=apiPermissionRequirement(root,'PUT');assert.ok(rule);assert.equal(hasPermissions(crm,rule),true);assert.equal(hasPermissions(ops,rule),false)})
}
for(const root of ['/cruise/id/pricing-policy','/cruises/id/pricing-policy']){
 test(`submit and approval permissions remain separate at ${root}`,()=>{const submit=apiPermissionRequirement(root+'/submit','POST'),review=apiPermissionRequirement(root+'/approve','POST');assert.ok(submit);assert.ok(review);assert.equal(hasPermissions(crm,submit),true);assert.equal(hasPermissions(ops,submit),false);assert.equal(hasPermissions(ops,review),true);assert.equal(hasPermissions(crm,review),false)})
}
function reviewHtml(value,status,maker=false){setSessionAccess(value);return renderToStaticMarkup(createElement(PricingReview,{policy:{cruiseId:'id',pricingPolicyId:'policy',revision:1,status,policyVersion:'test'},onSaved(){},onReload(){},maker,reviewEvidenceReady:true}))}
test('CRM draft UI offers submit; OPS draft UI does not',()=>{assert.match(reviewHtml(crm,'DRAFT'),/<button[^>]*>Gửi giá cabin/);assert.doesNotMatch(reviewHtml(ops,'DRAFT'),/<button[^>]*>Gửi giá cabin/)})
test('only OPS pending UI offers review and maker stays disabled',()=>{assert.match(reviewHtml(ops,'PENDING_APPROVAL'),/<button[^>]*>Phê duyệt giá cabin/);assert.doesNotMatch(reviewHtml(crm,'PENDING_APPROVAL'),/<button[^>]*>Phê duyệt giá cabin/);assert.match(reviewHtml(ops,'PENDING_APPROVAL',true),/<button[^>]*disabled[^>]*>Phê duyệt giá cabin/)})
import { samePricingPolicy } from '../src/features/cruises/model/pricing-policy.ts'
test('pricing readback tolerates database timestamp precision without accepting financial or identity drift',()=>{
 const saved={pricingPolicyId:'policy',cruiseId:'cruise',revision:2,status:'PENDING_APPROVAL',submittedBy:'crm',snapshotHash:'hash',currency:'USD',interiorBaseFare:300,submittedAt:'2026-11-10T14:52:45.944591100Z'}
 assert.equal(samePricingPolicy(saved,{...saved,submittedAt:'2026-11-10T14:52:45.944591Z'}),true)
 assert.equal(samePricingPolicy({...saved,submittedAt:'2026-11-10T14:52:45.999999900Z'},{...saved,submittedAt:'2026-11-10T14:52:46Z'}),true)
 for(const patch of [{pricingPolicyId:'other'},{cruiseId:'other'},{revision:3},{status:'APPROVED'},{submittedBy:'other'},{snapshotHash:'other'},{currency:'VND'},{interiorBaseFare:301},{submittedAt:'2026-11-10T14:52:46Z'}])assert.equal(samePricingPolicy(saved,{...saved,...patch}),false)
})
import { requiresCruisePackages } from '../src/features/cruises/model/sale-selection.ts'
test('only explicit Backend legacy CABIN_ONLY permission can omit fare offers',()=>{
 assert.equal(requiresCruisePackages(false,'CABIN_ONLY',true),false)
 for(const [unified,scope,allowed] of [[true,'CABIN_ONLY',true],[undefined,'CABIN_ONLY',true],[false,'CABIN_ONLY',undefined],[false,'CABIN_ONLY',null],[false,'CABIN_ONLY',false],[false,'WHOLE_CRUISE',true],[false,'SELECTED_PACKAGES',true]])assert.equal(requiresCruisePackages(unified,scope,allowed),true)
})
