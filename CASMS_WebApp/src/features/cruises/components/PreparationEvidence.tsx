import {useCallback,useRef,useState} from 'react'
import {ApiError,useReadQuery} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {useSessionAccess} from '@/shared/auth'
import {businessCopy,domainStatus} from '@/shared/i18n/business-copy'
import {Badge,Button,Field,Loading,Modal,Notice,Panel} from '@/shared/ui'
import {preparationApi,type PreparationSection as Section,type PreparationAction} from '../api/preparation-api'
import {PreparationCoordinator} from './PreparationCoordinator'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
import styles from './ManagerWorkspace.module.css'
const actions={submit:'preparation.section.SUBMIT_ACTION',confirm:'preparation.section.CONFIRM_ACTION',return:'preparation.section.RETURN_ACTION'} as const
const sectionNames:Record<string,string>={TECHNICAL_NAUTICAL:'Kỹ thuật hàng hải và tàu',HOTEL_CABIN:'Buồng phòng',ENTERTAINMENT_SHORE:'Giải trí và tour tham quan trên bờ',SAFETY_CREW:'An toàn và thuyền viên'}
const owners:Record<string,string>={SHIP_MANAGER:'Quản lý tàu',CRUISE_MANAGER:'Điều phối lịch trình',OPERATIONS_MANAGER:'Quản lý vận hành'}
const checks:Record<string,string>={SHIP_ASSIGNED:'Tàu đã được gán',SHIP_STATUS_ACTIVE:'Tàu đang hoạt động',SHIP_CONFIG:'Cấu hình boong và cabin',CABIN_INVENTORY:'Kiểm kê buồng phòng',SHORE_EXCURSIONS:'Hoạt động trên tàu và tour tham quan trên bờ',ONBOARD_STAFF_ASSIGNED:'Phân công Onboard Staff'}
export function PreparationEvidence({cruiseId,onChanged,refreshKey=0}:{cruiseId:string;onChanged:()=>void;refreshKey?:number}){
 const access=useSessionAccess(),allowed=access.has('CRUISE_PREPARATION_READ')
 const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
 const [epoch,setEpoch]=useState(0),[selected,setSelected]=useState<{section:Section;action:keyof typeof actions}|null>(null)
 const [dossierOpen,setDossierOpen]=useState(false),[success,setSuccess]=useState('')
 const [text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),lock=useRef(false)
 const query=useReadQuery(`prep-evidence:${access.userId}:${access.status}:${cruiseId}:${epoch}:${allowed}:${refreshKey}`,useCallback(signal=>allowed?preparationApi.get(cruiseId,signal):Promise.resolve(null),[cruiseId,allowed]))
 const changed=()=>{setEpoch(n=>n+1);onChanged()}
 const can=(section:Section,action:PreparationAction)=>section.allowedActions.includes(action.toUpperCase())&&(action==='submit'?query.data?.coordinatorUserId===access.userId&&access.roles.includes('CRUISE_MANAGER')&&access.has('CRUISE_PREPARATION_SUBMIT'):access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_PREPARATION_CONFIRM'))
 async function execute(){
  if(!selected||lock.current||unknown)return
  const {section,action}=selected
  if(!can(section,action))return
  lock.current=true;setBusy(true);setError('')
  try{
   await preparationApi.action(cruiseId,section,action,text)
   setSelected(null);setEpoch(n=>n+1);onChanged()
  }catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''));if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUnknown(true)}finally{lock.current=false;setBusy(false)}
 }
 const pending=query.data?.sections.filter(section=>!['SUBMITTED','CONFIRMED'].includes(section.status))??[]
 const canSubmitDossier=manager&&access.has('CRUISE_PREPARATION_SUBMIT')&&query.data?.coordinatorUserId===access.userId&&pending.length>0&&pending.every(section=>section.allowedActions.includes('SUBMIT'))
 async function submitDossier(){
  if(!canSubmitDossier||!access.userId||!text.trim()||lock.current||unknown)return
  lock.current=true;setBusy(true);setError('');setSuccess('')
  try{
   await preparationApi.submitDossier(cruiseId,text,access.userId)
   setDossierOpen(false);setText('');setSuccess('Đã nộp hồ sơ chuẩn bị. Cả 4 nhóm hồ sơ đã được gửi hoặc đã xác nhận.');changed()
  }catch(e){
   setError('Chưa nộp xong toàn bộ hồ sơ. '+businessErrorMessage(e instanceof ApiError?e.code:undefined,''))
   setUnknown(true);setEpoch(n=>n+1)
  }finally{lock.current=false;setBusy(false)}
 }
 async function reconcile(){
  if(lock.current)return
  lock.current=true;setBusy(true)
  try{await preparationApi.get(cruiseId);setUnknown(false);setDossierOpen(false);setSelected(null);setEpoch(n=>n+1);onChanged()}
  catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''))}
  finally{lock.current=false;setBusy(false)}
 }
 if(!allowed)return null
 return <Panel title={businessCopy('preparation.dashboard.title')}>
  {manager&&<p>Một hồ sơ chuẩn bị chung cho 4 nhóm hồ sơ.</p>}
  {query.data&&<PreparationCoordinator key={`${cruiseId}:${query.data.cruiseRevision}`} view={query.data} onChanged={changed}/>}
  {query.loading&&<Loading/>}{query.error&&<Notice title="Chưa đọc được hồ sơ chuẩn bị" tone="error"><p>{query.error instanceof ApiError&&query.error.code?businessErrorMessage(query.error.code,''):query.error.message}</p><Button onClick={query.retry}>Tải lại hồ sơ</Button></Notice>}
  {manager&&<div className={styles.sectionActions}><Button disabled={!canSubmitDossier||busy||unknown||query.loading||Boolean(query.error)} onClick={()=>{setDossierOpen(true);setError('');setSuccess('')}}>{query.data&&!pending.length?'Đã nộp hồ sơ chuẩn bị':'Nộp hồ sơ chuẩn bị'}</Button></div>}
  {manager&&query.data&&pending.length>0&&query.data.coordinatorUserId!==access.userId&&<p className={styles.help}>Chỉ đầu mối được phân công mới có thể nộp hồ sơ chung.</p>}
  {success&&<Notice title="Đã nộp hồ sơ" tone="success">{success}</Notice>}
  <div className={styles.evidenceList}>{query.data?.sections.map(section=>{
   const content=<>
   <p className={styles.sectionMeta}>{businessCopy('preparation.professionalOwner')}: {owners[section.ownerRole]??'Chưa xác định'} · Phiên bản {section.revision}</p>
   {section.checkItems.length===0&&<p>OPS đối chiếu nội dung hồ sơ đã nộp để xác nhận.</p>}
   <ul className={styles.evidenceChecks}>{section.checkItems.map(item=><li key={item.itemCode}>{checks[item.itemCode]??'Hạng mục cần đối chiếu'} · {item.ready?'Đạt':'Chưa đạt'}{item.itemCode!=='SHIP_STATUS_ACTIVE'&&item.evidence&&<p>{item.evidence}</p>}</li>)}</ul>

   {section.submittedAt&&<p>{businessCopy('preparation.submittedAt')}: {journeyTime(section.submittedAt,SHIP_TIME_ZONE)} · {businessCopy('preparation.shipTime')}</p>}
   {section.confirmedAt&&section.status==='CONFIRMED'&&<p>{businessCopy('preparation.confirmedAt')}: {journeyTime(section.confirmedAt,SHIP_TIME_ZONE)} · {section.confirmedByUsername??'Chưa xác định'}</p>}
   {section.evidence&&<p>{section.evidence}</p>}{section.returnReason&&<Notice title={businessCopy('preparation.section.RETURNED')}>{section.returnReason}</Notice>}
   <div className={styles.sectionActions}>{!manager&&can(section,'submit')&&<Button disabled={busy||unknown} onClick={()=>{setSelected({section,action:'submit'});setText(section.evidence??'');setError('')}}>{businessCopy(actions.submit)}</Button>}
   {access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_PREPARATION_CONFIRM')&&['SUBMITTED','CONFIRMED'].includes(section.status)&&<>
    {section.status==='SUBMITTED'&&<Button disabled={busy||unknown||!can(section,'confirm')} onClick={()=>{setSelected({section,action:'confirm'});setText('');setError('')}}>{businessCopy(actions.confirm)}</Button>}
    {can(section,'return')&&<Button disabled={busy||unknown} onClick={()=>{setSelected({section,action:'return'});setText('');setError('')}}>{businessCopy(actions.return)}</Button>}
    {section.submittedByUserId===access.userId&&<p>Người nộp hồ sơ không thể tự xác nhận. Cần tài khoản OPS khác kiểm tra.</p>}
    {section.checkItems.some(i=>i.required&&!i.ready)&&<p>Các hạng mục bắt buộc chưa đạt. Người phụ trách cần hoàn thiện hồ sơ trước khi xác nhận.</p>}
   </>}</div>
   </>
   const evaluated=section.checkItems.length>0
   const passed=evaluated&&section.checkItems.every(item=>!item.required||item.ready)
   return <details key={section.sectionCode} className={styles.disclosure} open={section.status==='RETURNED'}><summary><h3 className={styles.sectionHeading}>{sectionNames[section.sectionCode]??'Hồ sơ chuẩn bị'}</h3><span className={styles.sectionStatus}><Badge label={domainStatus('preparation.section',section.status)}/><span>{evaluated?`${section.checkItems.filter(item=>item.ready).length}/${section.checkItems.length} hạng mục đạt`:'Chưa có kết quả kiểm tra'}</span>{evaluated&&!passed&&<span>Cần bổ sung dữ liệu</span>}</span></summary><div className={styles.disclosureBody}>{content}</div></details>
  })}</div>
  {error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}
  {unknown&&<Notice title="Hệ thống chưa xác nhận được kết quả"><p>Đối chiếu lại 4 nhóm hồ sơ trước khi tiếp tục. Hạng mục đã gửi sẽ không bị gửi lặp.</p><Button disabled={busy} onClick={()=>void reconcile()}>Đối chiếu hồ sơ</Button></Notice>}
  {dossierOpen&&<Modal wide busy={busy} title="Nộp hồ sơ chuẩn bị khởi hành" description="Một nội dung tổng hợp dùng chung cho cả 4 nhóm hồ sơ. Các hạng mục đã nộp hoặc xác nhận được giữ nguyên." onClose={()=>setDossierOpen(false)} footer={<><Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={()=>setDossierOpen(false)}>Hủy</Button><Button disabled={busy||unknown||!canSubmitDossier||!text.trim()} onClick={()=>void submitDossier()}>{busy?'Đang nộp hồ sơ…':'Nộp hồ sơ chung'}</Button></>}>
   <ul>{query.data?.sections.map(section=><li key={section.sectionCode}>{sectionNames[section.sectionCode]} · {section.checkItems.length?`${section.checkItems.filter(item=>item.ready).length}/${section.checkItems.length} hạng mục đạt`:'Đối chiếu hồ sơ'} · {domainStatus('preparation.section',section.status)}</li>)}</ul>
   <Field htmlFor="prep-dossier" label="Nội dung và bằng chứng chuẩn bị chung"><textarea id="prep-dossier" rows={6} value={text} onChange={e=>setText(e.target.value)} disabled={busy||unknown} required/></Field>
   {error&&<Notice title="Chưa nộp xong hồ sơ" tone="error">{error}</Notice>}{unknown&&<Button disabled={busy} onClick={()=>void reconcile()}>Đối chiếu hồ sơ trước khi tiếp tục</Button>}
  </Modal>}
  {selected&&<Modal title={businessCopy(actions[selected.action])} onClose={()=>{if(!busy)setSelected(null)}} footer={<><Button disabled={busy} onClick={()=>setSelected(null)}>Hủy</Button><Button disabled={busy||unknown||(selected.action!=='confirm'&&!text.trim())} onClick={()=>void execute()}>{businessCopy(actions[selected.action])}</Button></>}><Field htmlFor="prep-evidence" label={selected.action==='return'?'Nội dung cần bổ sung':selected.action==='submit'?'Bằng chứng chuẩn bị':'Ghi chú xác nhận'}><textarea id="prep-evidence" value={text} onChange={e=>setText(e.target.value)} required={selected.action!=='confirm'}/></Field></Modal>}
 </Panel>
}
