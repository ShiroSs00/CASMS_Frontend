import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'

const enabled=Boolean(process.env.CASMS_PLAYWRIGHT_MODULE),base=process.env.CASMS_TEST_URL||'http://127.0.0.1:5173'
assert.equal(new URL(base).hostname,'127.0.0.1')
const root=fileURLToPath(new URL('../../',import.meta.url)),url=base+'/qa/booking-web-qa.html'
async function sandbox(live=false){
 const {chromium}=createRequire(import.meta.url)(process.env.CASMS_PLAYWRIGHT_MODULE)
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}}),page=await context.newPage(),calls=[],errors=[]
 const state={status:502,network:false}
 page.on('pageerror',error=>errors.push(error.message))
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url())
  if(u.protocol==='file:')return route.continue()
  if(u.origin!==base)return route.abort()
  if(!u.pathname.startsWith('/api/'))return route.continue()
  calls.push({method:req.method(),path:u.pathname+u.search,headers:await req.allHeaders()})
  assert.equal(req.method(),'GET');assert.equal(req.headers().authorization,undefined);assert.equal(req.headers().cookie,undefined)
  if(live)return route.continue()
  if(state.network)return route.abort('failed')
  const privateRead=!['/api/cruise','/api/servicepackage/packages'].includes(u.pathname)
  const status=state.status===200&&privateRead?403:state.status
  return route.fulfill({status,headers:{'X-Trace-Id':'12345678-1234-1234-1234-123456789abc'},json:{success:status<400,code:status>=400?'FIXTURE_DENIED':undefined,message:'PRIVATE_MESSAGE_MUST_NOT_EXPORT',data:{email:'PII_MUST_NOT_EXPORT@example.test',accessToken:'TOKEN_MUST_NOT_EXPORT'}}})
 })
 async function finish(){try{assert.deepEqual(errors,[])}finally{await browser.close()}}
 return {page,context,state,calls,finish}
}
test('QA screen uses exact58 endpoint matrix, separates34/21/3 personas and41/17 coverage, performs no request on load',{skip:!enabled},async()=>{
 const s=await sandbox(),p=s.page
 try{await p.goto(url);await p.getByText('58/58 endpoint · Bộ lọc không thay đổi phạm vi nguồn',{exact:true}).waitFor();assert.equal(s.calls.length,0)
  assert.equal(await p.locator('#endpoint-list tr').count(),58)
  for(const [value,count]of [['REQUIRED_CUSTOMER',34],['REQUIRED_SUPPORTING',21],['REQUIRED_STAFF_BOOKING',3]]){await p.locator('#category').selectOption(value);assert.equal(await p.locator('#endpoint-list tr').count(),count)}
  await p.locator('#category').selectOption('all');await p.locator('#coverage').selectOption('wired');assert.equal(await p.locator('#endpoint-list tr').count(),41);await p.locator('#coverage').selectOption('blocked');assert.equal(await p.locator('#endpoint-list tr').count(),17)
  await p.locator('#coverage').selectOption('all');await p.locator('#search').fill('GET /booking/lookup');assert.equal(await p.locator('#endpoint-list tr').count(),1);assert.equal(s.calls.length,0)
 }finally{await s.finish()}
})
test('QA manual checklist, export and reset are independent of verified API status and contain no payload or credentials',{skip:!enabled},async()=>{
 const s=await sandbox(),p=s.page
 try{await p.goto(url);assert.equal(await p.locator('.scenario').count(),20);await p.locator('#result-UI01').selectOption('PASS');await p.locator('#scenario-filter').selectOption('SANDBOX');assert.equal(await p.locator('.scenario').count(),6);await p.locator('#scenario-filter').selectOption('all');assert.equal(await p.locator('#result-UI01').inputValue(),'PASS')
  const downloadEvent=p.waitForEvent('download');await p.getByRole('button',{name:'Tải JSON kết quả',exact:true}).click();const download=await downloadEvent;const result=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(result.manualResults.find(item=>item.id==='UI01').status,'PASS');assert.equal(result.anonymousGetResults.length,0);assert.equal(result.sourceSnapshot.liveVerifiedFromSourceMatrix,0);assert.match(result.manualResults[0].evidenceType,/HUMAN_RECORDED/)
  await p.locator('#reset').click();assert.equal(await p.locator('#result-UI01').inputValue(),'NOT_TESTED');assert.equal(s.calls.length,0)
 }finally{await s.finish()}
})
test('QA probe sends only eight anonymous GETs, blocks repeat clicks and separates runtime errors from authentication denial',{skip:!enabled},async()=>{
 const s=await sandbox(),p=s.page
 try{await p.goto(url);await p.locator('#probe').dblclick({force:true});await p.getByText('Đã hoàn tất 8 GET ẩn danh. Không kiểm chứng phiên đăng nhập, DTO đầy đủ hoặc mutation.',{exact:true}).waitFor();assert.equal(s.calls.length,8);assert.equal(s.calls.some(item=>item.path.includes('lookup')),false)
  let result=JSON.parse(await p.locator('#json-preview').textContent());assert.equal(result.anonymousGetResults.every(item=>item.httpStatus===502&&item.outcome==='RUNTIME_BLOCKED'),true);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_MESSAGE|PII_MUST|TOKEN_MUST/)
  s.state.status=200;await p.locator('#probe').click();await p.getByText('Đã hoàn tất 8 GET ẩn danh. Không kiểm chứng phiên đăng nhập, DTO đầy đủ hoặc mutation.',{exact:true}).waitFor();result=JSON.parse(await p.locator('#json-preview').textContent());assert.equal(result.anonymousGetResults.filter(item=>item.outcome==='HTTP_OK_DTO_NOT_VERIFIED').length,2);assert.equal(result.anonymousGetResults.filter(item=>item.outcome==='EXPECTED_ANONYMOUS_DENIAL_ONLY').length,6)
  s.state.network=true;await p.locator('#probe').click();await p.getByText('Đã hoàn tất 8 GET ẩn danh. Không kiểm chứng phiên đăng nhập, DTO đầy đủ hoặc mutation.',{exact:true}).waitFor();result=JSON.parse(await p.locator('#json-preview').textContent());assert.equal(result.anonymousGetResults.every(item=>item.outcome==='NETWORK_OR_CORS_ERROR'),true)
 }finally{await s.finish()}
})
test('QA offline HTML is self-contained, disables live probes and still permits inspection/checklist export',{skip:!enabled},async()=>{
 const s=await sandbox(),p=s.page
 try{await p.goto(new URL('qa/booking-web-qa.html',new URL('../../',import.meta.url)).href);await p.getByRole('heading',{name:'Booking Web · Màn hình kiểm thử',exact:true}).waitFor();assert.equal(await p.locator('#probe').isDisabled(),true);assert.equal(await p.locator('#endpoint-list tr').count(),58);await p.locator('#result-UI01').selectOption('BLOCKED');assert.equal(JSON.parse(await p.locator('#json-preview').textContent()).manualResults[0].status,'BLOCKED');assert.equal(s.calls.length,0)}finally{await s.finish()}
})
test('QA desktop1280/1440/1920 has no page overflow and named controls; capture screenshots',{skip:!enabled},async()=>{
 const s=await sandbox(),p=s.page
 try{await p.goto(url);for(const width of [1280,1440,1920]){await p.setViewportSize({width,height:1000});assert.equal(await p.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth),true);assert.equal(await p.getByLabel('Tìm endpoint / màn hình / permission',{exact:true}).count(),1);await p.locator('nav').getByRole('link',{name:'58 endpoint',exact:true}).focus();assert.equal(await p.evaluate(()=>globalThis.getComputedStyle(globalThis.document.activeElement).outlineStyle),'solid');await mkdir(path.join(root,'qa/screenshots'),{recursive:true});await p.screenshot({path:path.join(root,'qa/screenshots','booking-qa-'+width+'.png'),fullPage:true});await p.screenshot({path:path.join(root,'qa/screenshots','booking-qa-'+width+'-overview.png'),fullPage:false})}}finally{await s.finish()}
})
test('QA real anonymous read-only probe records current local runtime without claiming Booking success',{skip:!enabled||process.env.CASMS_QA_LIVE_READS!=='1'},async()=>{
 const s=await sandbox(true),p=s.page
 try{await p.goto(url);await p.locator('#probe').click();await p.getByText('Đã hoàn tất 8 GET ẩn danh. Không kiểm chứng phiên đăng nhập, DTO đầy đủ hoặc mutation.',{exact:true}).waitFor({timeout:80000});const report=JSON.parse(await p.locator('#json-preview').textContent());assert.equal(report.anonymousGetResults.length,8);report.testKind='ACTUAL_ANONYMOUS_READ_ONLY_HTTP';await writeFile(path.join(root,'qa/booking-qa-results.json'),JSON.stringify(report,null,2));assert.equal(s.calls.length,8)}finally{await s.finish()}
})
