import assert from 'node:assert/strict'
import console from 'node:console'
import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL, URL } from 'node:url'
const playwright = process.env.CASMS_PLAYWRIGHT_MODULE
const { chromium } = await import(playwright ? pathToFileURL(playwright).href : 'playwright')
const evidence = process.argv[2] ?? 'docs/reports/phase-a-fe-evidence'
await mkdir(evidence, {recursive:true})
const vite = spawn(process.execPath, [resolve('CASMS_WebAdmin/node_modules/vite/bin/vite.js'), 'preview', '--port', '5184', '--strictPort'], {cwd:resolve('CASMS_WebAdmin'), stdio:'ignore', windowsHide:true})
process.on('exit',()=>vite.kill())
for (let i=0;i<40;i++) {
  if (await globalThis.fetch('http://127.0.0.1:5184').then(r=>r.ok).catch(()=>false)) break
  if (i===39) throw new Error('Local Vite failed to start')
  await delay(250)
}
const browser = await chromium.launch({executablePath:process.env.CASMS_BROWSER_EXECUTABLE, headless:true})
const shot = (page, name) => page.screenshot({path:evidence + '/' + name + '.png', fullPage:!name.includes('impact'), animations:'disabled'})
const cruiseId='11111111-1111-4111-8111-111111111111', id='22222222-2222-4222-8222-222222222222'
const ship={shipId:'ship',modelId:'ready',name:'Tàu kiểm thử OceVie',status:'IN_SERVICE',cabins:[]}
const sectionCodes=['TECHNICAL_NAUTICAL','HOTEL_CABIN','ENTERTAINMENT_SHORE','SAFETY_CREW']
const sectionRoles=['SHIP_MANAGER','CRUISE_MANAGER','CRUISE_MANAGER','OPERATIONS_MANAGER']
const approve='Xác nhận phương án tàu'
async function setup(width,height,scenario) {
  const page=await browser.newPage({viewport:{width,height}})
  const hr = scenario === 'hr-stale'
  const ops = scenario === 'ops-review'
  const usesArea = ['service', 'missing-pos', 'hr-stale'].includes(scenario)
  const actor = hr ? 'hr-user' : ops ? 'ops-user' : 'ship-user'
  const role = hr ? 'HR_MANAGER' : ops ? 'OPERATIONS_MANAGER' : 'SHIP_MANAGER'
  const actionLabel = hr ? 'Gửi phương án cho Quản lý lịch trình' : ops ? 'Duyệt phương án nhân sự' : approve
  await page.addInitScript(user => globalThis.sessionStorage.setItem('ocevie.admin.auth.session.v1',
    JSON.stringify({accessToken:'local-browser-fixture', expiresAt:Date.now()+900000,refreshAt:Date.now()+800000,user})),
    {id:actor,username:hr?'Quản lý nhân sự QA':'Quản lý tàu QA',roles:[role]})
  const errors=[]
  page.on('pageerror', error=>errors.push(error.message))
  const request={id,cruiseId,cruiseName:'Chuyến kiểm thử Phase A',cruiseCode:'QA-A-01',
    departure:'2026-12-12T03:00:00Z',returning:'2026-12-13T03:00:00Z',status:hr?'SENT_TO_HR':'PENDING_SHIP_REVIEW',shipPlanStale:hr,
    workflowVersion:'V2',asmProgramWorkflow:true,shipReviewWorkflow:true,revision:3,requirements:[],
    activeAreaIds:usesArea?['zone']:[],needs:usesArea?
      [{needId:'need',areaId:'zone',areaName:'Sảnh chính',positionCode:'ONBOARD_STAFF',requiredCount:2,assignedUserIds:[]}]:[],
    planResetImpact:{needsToReplaceOnSave:usesArea?3:0,assignmentsToClear:usesArea?5:0}}
  if (ops) request.status = 'PLANNER_CONFIRMED'
  const pair={areaId:'zone',terminalId:'eligible'}, blocked={areaId:'zone',terminalId:'configured'}
  let placed=false
  const calls=[]
  await page.route('**/api/**', async route=>{
    const url=new URL(route.request().url()).pathname
    const method=route.request().method()
    const ok=data=>route.fulfill({json:{success:true,data}})
    if(url.endsWith('/auth/me')) return ok({userId:actor,roles:[role],effectivePermissions:hr?['CRUISE_STAFF_READ','CRUISE_STAFF_ASSIGN']
      :ops?['CRUISE_READ','CRUISE_VALIDATE']:['CRUISE_PREPARATION_READ','CRUISE_PREPARATION_SUBMIT','CRUISE_READ']})
    if(url.endsWith('/staffing-requests/inbox')) return ok([request])
    if(url.endsWith('/staffing-requests/'+id)) return ok(request)
    const review=()=>({request,ship,areas:usesArea?
      [{areaId:'zone',name:'Sảnh chính',terminals:scenario==='missing-pos'?[]:[{terminalId:'eligible',name:'POS A2'}],
      eligibleTerminals:[{terminalId:'eligible',name:'POS A2'},{terminalId:'configured',name:'POS A1'}],staffIds:[]}]:[],
      terminalOptions:[],plannedServices:usesArea?
      [{serviceId:'svc',name:'Phục vụ bữa tối',eligibleAreaIds:['zone'],eligiblePlacements:scenario==='missing-pos'?[]:[pair],
        configuredPlacements:[pair,blocked],placements:placed?[pair]:[],
        placementBlocker:scenario==='missing-pos'?'ACTIVE_AREA_POS_SELECTION_REQUIRED':null,
        proposal:{deckName:'Boong 2',note:'Cần quầy phục vụ',status:'PENDING'}}]:[],
      positionOptions:['ONBOARD_STAFF'],activities:[],staff:[{userId:actor,username:'Quản lý tàu QA',role:'SHIP_MANAGER'}],
      canReturnToAsm:true,shipPlanReady:scenario==='unknown-readiness'?null:!usesArea||placed})
    if(url.endsWith('/review-details')) return ok(review())
    if(url.endsWith('/service-placements/svc')) {
      const body=route.request().postDataJSON()
      calls.push([method,body])
      if(calls.length===1) {
        request.revision=4
        return route.fulfill({status:409,json:{success:false,code:'STAFFING_REVISION_CONFLICT'}})
      }
      placed=true
      request.revision=5
      return ok(review())
    }
    if(url.endsWith('/SHIP_CHECKED')) {
      request.status='SHIP_REVIEWED'
      request.revision++
      return ok(request)
    }
    if (url.endsWith('/SHIP_RETURN_ASM')) {
      calls.push([method,route.request().postDataJSON()])
      request.status = 'PENDING_ASM'
      request.revision++
      return ok(request)
    }
    if(url.endsWith('/preparation')) return ok({cruiseId,cruiseRevision:11,canAssignCoordinator:false,
      coordinatorUserId:'crm',operatingBudgetVnd:'18000000',
      sections:sectionCodes.map((sectionCode,index)=>({
        sectionCode,sectionName:sectionCode,submitterRole:sectionRoles[index],ownerRole:sectionRoles[index],
        allowedActions:index===0?['SUBMIT']:[],status:'IN_PROGRESS',revision:2,dataReadiness:index===0?'READY':'INCOMPLETE',
        submissionStatus:'NOT_SUBMITTED',approvalStatus:'NOT_REVIEWED',submittedRevision:null,missingRequiredCheckCodes:[],
        checkItems:[{itemCode:'SHIP_CONFIG',required:true,ready:true}],submittedByUserId:null,
      }))})
    return ok([])
  })
  await page.goto('http://127.0.0.1:5184/admin/'+(hr?'staffing':'staffing-reviews')+'?requestId='+id)
  try {
    await page.getByRole('button',{name:actionLabel,exact:true}).waitFor({timeout:10000})
  } catch (error) {
    console.log('URL',page.url(),'BODY',(await page.locator('body').innerText()).slice(0,2300),'ERRORS',errors)
    throw error
  }
  if (!hr && !ops) await page.getByText('Chưa nộp hồ sơ',{exact:true}).waitFor()
  return {page,errors,calls,request}
}
try{
 for(const width of [1440,1366,768,390]) {
  const {page,errors}=await setup(width,900,'empty')
  assert.equal(await page.getByRole('button',{name:approve}).isEnabled(),true)
  await page.getByText('Không áp dụng',{exact:true}).waitFor()
  await page.getByRole('heading',{level:1,name:'Chuẩn bị phương án tàu'}).waitFor()
  await page.getByText('Không cần bố trí nhân sự',{exact:true}).waitFor()
  assert.equal(await page.getByText(/0\/0 nhân sự|Chưa định biên/).count(),0)
  assert.equal(await page.getByText('Tàu chưa có khu vực dịch vụ',{exact:true}).count(),0)
  assert.ok(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 1))
  await shot(page,'ship-no-service-'+width)
  if (width === 390) {
    const progress = page.locator('summary').filter({ hasText: 'Bước 2/5' })
    assert.equal(await page.getByRole('list',{name:'Tiến độ quy trình chuẩn bị nhân sự'}).count(),0)
    await progress.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('list',{name:'Tiến độ quy trình chuẩn bị nhân sự'}).waitFor()
    await page.keyboard.press('Enter')
  }
  assert.deepEqual(errors,[])
  if(width===1440) {
    await page.getByRole('button',{name:approve}).click()
    await page.getByRole('button',{name:approve}).waitFor({state:'hidden'})
  }
  await page.close()
 }
 const blockedPos = await setup(768,900,'missing-pos')
 assert.equal(await blockedPos.page.getByRole('button',{name:approve}).isDisabled(),true)
 assert.equal(await blockedPos.page.getByLabel('Khu vực và máy POS').isDisabled(),true)
 await blockedPos.page.getByText(/mở khu vực và chọn đúng máy POS đã cấu hình/).waitFor()
 await shot(blockedPos.page,'ship-missing-pos-768')
 assert.deepEqual(blockedPos.errors,[])
 await blockedPos.page.close()
 const unknown = await setup(1366,900,'unknown-readiness')
 assert.equal(await unknown.page.getByRole('button',{name:approve}).isDisabled(),true)
 await unknown.page.getByText('Chưa có nhu cầu hoặc ca để phân công',{exact:true}).waitFor()
 assert.equal(await unknown.page.getByText(/0\/0 nhân sự/).count(),0)
 assert.equal(await unknown.page.getByText('Tàu chưa có khu vực dịch vụ',{exact:true}).count(),0)
 await unknown.page.close()
 const opsReview = await setup(1366,900,'ops-review')
 await opsReview.page.getByRole('heading',{level:1,name:'Duyệt phương án nhân sự'}).waitFor()
 assert.equal(await opsReview.page.getByRole('button',{name:approve}).count(),0)
 await opsReview.page.close()
 const staleHr = await setup(1366,900,'hr-stale')
 await staleHr.page.getByText('Phương án tàu đã thay đổi',{exact:true}).waitFor()
 assert.equal(await staleHr.page.getByRole('button',{name:'Gửi phương án cho Quản lý lịch trình'}).isDisabled(),true)
 assert.equal(await staleHr.page.getByLabel('Chọn nhân viên').count(),0)
 assert.deepEqual(staleHr.errors,[])
 await staleHr.page.close()
 const {page,errors,calls}=await setup(1366,900,'service')
 const confirm=page.getByRole('button',{name:approve})
 const select=page.getByLabel('Khu vực và máy POS')
 assert.equal(await confirm.isDisabled(),true)
 assert.deepEqual(await select.locator('option').evaluateAll(items=>items.map(i=>i.value)),['','zone:eligible'])
 await select.selectOption('zone:eligible')
 await page.getByRole('button',{name:'Dùng phiên bản mới'}).waitFor()
 assert.equal(await confirm.isDisabled(),true)
 await page.getByRole('button',{name:'Dùng phiên bản mới'}).click()
 await select.selectOption('zone:eligible')
 await confirm.waitFor()
 await page.waitForFunction(()=>[...globalThis.document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Xác nhận phương án tàu'&&!b.disabled))
 assert.deepEqual(calls,[['PUT',{expectedRevision:3,areaId:'zone',terminalId:'eligible'}],['PUT',{expectedRevision:4,areaId:'zone',terminalId:'eligible'}]])
 const returnButton=page.getByRole('button',{name:'Trả Quản lý dịch vụ bổ sung chương trình'})
 await returnButton.click()
 await page.getByLabel('Lý do trả yêu cầu').fill('Kiểm tra phạm vi dịch vụ')
 await returnButton.click()
 const dialog=page.getByRole('dialog',{name:'Xác nhận thay đổi phương án nhân sự'})
 await dialog.getByText(/gỡ 5 phân công/).waitFor()
 assert.equal(await dialog.getByText(/3 nhu cầu/).count(),0)
 await shot(page,'ship-reset-impact-1366')
 await page.keyboard.press('Escape')
 await dialog.waitFor({state:'hidden'})
 assert.equal(await returnButton.evaluate(button=>button===globalThis.document.activeElement),true)
 assert.equal(calls.length,2)
 await returnButton.click()
 await dialog.getByRole('button',{name:'Quay lại'}).click()
 await dialog.waitFor({state:'hidden'})
 assert.equal(calls.length,2)
 await returnButton.click()
 await dialog.getByRole('button',{name:'Tiếp tục'}).click()
 await returnButton.waitFor({state:'hidden'})
 assert.deepEqual(calls[2],['POST',{expectedRevision:5,comment:'Kiểm tra phạm vi dịch vụ'}])
 assert.deepEqual(errors,[])
 console.log('Playwright Edge fixture: no SERVICE at 1440/1366/768/390, exact POS pair, stale revision reload, missing POS, stale HR plan, reset impact and Escape/focus PASS')
} finally {
 await browser.close()
 vite.kill()
}
