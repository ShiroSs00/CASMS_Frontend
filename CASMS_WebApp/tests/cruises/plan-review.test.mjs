import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const module={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/features/cruises/model/plan-review.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports})
const {planReviewActions,planReviewStates}=module.exports
const access=(roles,permissions,userId='crm')=>({roles,userId,canDo:key=>permissions.includes(key)})
const all={allowedActions:['SUBMIT','WITHDRAW','APPROVE','REJECT','REQUEST_REVISION','SET_READY'],submittedBy:'other'}

test('CRM cannot gain approval or ready commands from server action hints',()=>{
 const crm=access(['CRUISE_MANAGER'],['CRUISE_UPDATE_DRAFT','ITINERARY_APPROVE','CRUISE_VALIDATE'])
 assert.deepEqual(Array.from(planReviewActions(all,crm)),['submit','withdraw'])
})
test('CRM without effective write permission receives no mutation controls',()=>{
 assert.equal(planReviewActions(all,access(['CRUISE_MANAGER'],[])).length,0)
})
test('a submitted plan exposes only server-authorized withdrawal to CRM',()=>{
 const crm=access(['CRUISE_MANAGER'],['CRUISE_UPDATE_DRAFT'])
 assert.deepEqual(Array.from(planReviewActions({...all,allowedActions:['WITHDRAW','APPROVE']},crm)),['withdraw'])
})
test('OPS approval still rejects self approval and separates readiness permission',()=>{
 const ops=access(['OPERATIONS_MANAGER'],['ITINERARY_APPROVE'],'sender')
 assert.deepEqual(Array.from(planReviewActions({...all,submittedBy:'sender'},ops)),['reject','request-revision'])
 assert.deepEqual(Array.from(planReviewActions(all,ops)),['approve','reject','request-revision'])
})
test('pending review has explicit OPS status and never claims sale is open',()=>{
 assert.match(planReviewStates.SUBMITTED.title,/Chờ OPS phê duyệt/)
 assert.match(planReviewStates.APPROVED.description,/trước khi xác nhận mở bán/)
 assert.match(planReviewStates.REVISION_REQUESTED.description,/gửi lại/)
})

const navigationModule={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/features/cruises/model/preparation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:navigationModule,exports:navigationModule.exports})
const {allowedDepartureSections}=navigationModule.exports
const navigationAccess=permissions=>({...access(['CRUISE_MANAGER'],permissions),has:key=>permissions.includes(key)})
test('CRM tab labels omit personnel and guests when those reads are forbidden',()=>{
 const tabs=allowedDepartureSections(navigationAccess(['CRUISE_READ','CRUISE_REGULATION_READ','ACTIVITY_READ']))
 assert.equal(tabs.find(([key])=>key==='resources')[1],'Tàu và quy định')
 assert.equal(tabs.find(([key])=>key==='sales')[1],'Cabin và sức chứa')
 assert.ok(!tabs.some(([key])=>key==='checks'))
})
test('CRM receives no resource tab without a permitted resource capability',()=>{
 const tabs=allowedDepartureSections(navigationAccess(['CRUISE_READ']))
 assert.ok(!tabs.some(([key])=>key==='resources'))
})
test('authorized personnel and guest readers retain their complete tab labels',()=>{
 const tabs=allowedDepartureSections(navigationAccess(['CRUISE_READ','CRUISE_STAFF_READ','CRUISE_MANIFEST_READ']))
 assert.equal(tabs.find(([key])=>key==='resources')[1],'Tàu và nhân sự')
 assert.equal(tabs.find(([key])=>key==='sales')[1],'Cabin và khách')
})
