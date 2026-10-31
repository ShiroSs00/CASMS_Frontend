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
const actions={confirm:'preparation.section.CONFIRM_ACTION',return:'preparation.section.RETURN_ACTION'} as const
const sectionNames:Record<string,string>={TECHNICAL_NAUTICAL:'Kỹ thuật hàng hải và tàu',HOTEL_CABIN:'Buồng phòng',ENTERTAINMENT_SHORE:'Giải trí và tour tham quan trên bờ',SAFETY_CREW:'An toàn và thuyền viên'}
const owners:Record<string,string>={SHIP_MANAGER:'Quản lý tàu',CRUISE_MANAGER:'Quản lý lịch trình',OPERATIONS_MANAGER:'Quản lý vận hành'}
const checks:Record<string,string>={SHIP_ASSIGNED:'Tàu đã được gán',SHIP_STATUS_ACTIVE:'Tàu đang hoạt động',SHIP_CONFIG:'Cấu hình boong và cabin',CABIN_INVENTORY:'Kiểm kê buồng phòng',SHORE_EXCURSIONS:'Hoạt động trên tàu và tour tham quan trên bờ',ONBOARD_STAFF_ASSIGNED:'Phân công Onboard Staff'}
export function PreparationEvidence({cruiseId,onChanged,onSubmit,refreshKey=0}:{cruiseId:string;onChanged:()=>void;onSubmit?:()=>void;refreshKey?:number}){
 const access=useSessionAccess(),allowed=access.has('CRUISE_PREPARATION_READ')
 const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
 const [epoch,setEpoch]=useState(0),[selected,setSelected]=useState<{section:Section;action:keyof typeof actions}|null>(null)
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
 const notSubmitted=query.data?.sections.filter(section=>['NOT_STARTED','IN_PROGRESS','RETURNED'].includes(section.status))??[]
 const awaitingConfirmation=query.data?.sections.filter(section=>section.status==='SUBMITTED')??[]
 const confirmedCount=query.data?.sections.filter(section=>section.status==='CONFIRMED').length??0
 async function reconcile(){
  if(lock.current)return
  lock.current=true;setBusy(true)
  try{await preparationApi.get(cruiseId);setUnknown(false);setSelected(null);setEpoch(n=>n+1);onChanged()}
  catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''))}
  finally{lock.current=false;setBusy(false)}
 }
 if(!allowed)return null
 return <Panel title={businessCopy('preparation.dashboard.title')}>
  {query.data&&<PreparationCoordinator key={`${cruiseId}:${query.data.cruiseRevision}`} view={query.data} onChanged={changed}/>}
  {query.loading&&<Loading/>}{query.error&&<Notice title="Chưa đọc được hồ sơ chuẩn bị" tone="error"><p>{query.error instanceof ApiError&&query.error.code?businessErrorMessage(query.error.code,''):query.error.message}</p><Button onClick={query.retry}>Tải lại hồ sơ</Button></Notice>}
  {query.data&&!query.loading&&!query.error&&<Notice title={confirmedCount===query.data.sections.length?'Hồ sơ đã được Quản lý vận hành xác nhận':notSubmitted.length>0?'Chờ gửi hồ sơ chuyến khởi hành':'Chờ Quản lý vận hành kiểm tra hồ sơ'} tone={confirmedCount===query.data.sections.length?'success':'info'}>
   {notSubmitted.length>0&&<p>{notSubmitted.length} nhóm chưa gửi hoặc cần bổ sung trong hồ sơ chuyến khởi hành.</p>}
   {awaitingConfirmation.length>0&&<p>{awaitingConfirmation.length} nhóm đã gửi. Mở từng nhóm bên dưới để kiểm tra và xác nhận.</p>}
  </Notice>}
  {manager&&onSubmit&&pending.length>0&&<div className={styles.sectionActions}><Button tone="secondary" onClick={onSubmit}>Kiểm tra và gửi hồ sơ chuyến khởi hành</Button></div>}
  <div className={styles.evidenceList}>{query.data?.sections.map(section=>{
   const content=<>
   <p className={styles.sectionMeta}>{businessCopy('preparation.professionalOwner')}: {owners[section.ownerRole]??'Chưa xác định'} · Phiên bản {section.revision}</p>
   {section.checkItems.length===0&&<p>Quản lý vận hành đối chiếu nội dung hồ sơ đã nộp để xác nhận.</p>}
   {['NOT_STARTED','IN_PROGRESS'].includes(section.status)&&<p className={styles.help}>Nhóm này được gửi cùng hồ sơ chuyến khởi hành.</p>}
   <ul className={styles.evidenceChecks}>{section.checkItems.map(item=><li key={item.itemCode}>{checks[item.itemCode]??'Hạng mục cần đối chiếu'} · {item.ready?'Đạt':'Chưa đạt'}{item.itemCode!=='SHIP_STATUS_ACTIVE'&&item.evidence&&<p>{item.evidence}</p>}</li>)}</ul>

   {section.submittedAt&&<p>{businessCopy('preparation.submittedAt')}: {journeyTime(section.submittedAt,SHIP_TIME_ZONE)} · {businessCopy('preparation.shipTime')}</p>}
   {section.confirmedAt&&section.status==='CONFIRMED'&&<p>{businessCopy('preparation.confirmedAt')}: {journeyTime(section.confirmedAt,SHIP_TIME_ZONE)} · {section.confirmedByUsername??'Chưa xác định'}</p>}
   {section.evidence&&<p>{section.evidence}</p>}{section.returnReason&&<Notice title={businessCopy('preparation.section.RETURNED')}>{section.returnReason}</Notice>}
   <div className={styles.sectionActions}>
   {access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_PREPARATION_CONFIRM')&&['SUBMITTED','CONFIRMED'].includes(section.status)&&<>
    {section.status==='SUBMITTED'&&<Button disabled={busy||unknown||!can(section,'confirm')} onClick={()=>{setSelected({section,action:'confirm'});setText('');setError('')}}>{businessCopy(actions.confirm)}</Button>}
    {can(section,'return')&&<Button disabled={busy||unknown} onClick={()=>{setSelected({section,action:'return'});setText('');setError('')}}>{businessCopy(actions.return)}</Button>}
    {section.submittedByUserId===access.userId&&<p>Người nộp hồ sơ không thể tự xác nhận. Cần tài khoản quản lý vận hành khác kiểm tra.</p>}
    {section.checkItems.some(i=>i.required&&!i.ready)&&<p>Các hạng mục bắt buộc chưa đạt. Người phụ trách cần hoàn thiện hồ sơ trước khi xác nhận.</p>}
   </>}</div>
   </>
   const evaluated=section.checkItems.length>0
   const passed=evaluated&&section.checkItems.every(item=>!item.required||item.ready)
   return <details key={section.sectionCode} className={styles.disclosure} open={section.status==='RETURNED'}><summary><h3 className={styles.sectionHeading}>{sectionNames[section.sectionCode]??'Hồ sơ chuẩn bị'}</h3><span className={styles.sectionStatus}>{section.status!=='NOT_STARTED'&&<Badge label={domainStatus('preparation.section',section.status)}/>}<span>{evaluated?`${section.checkItems.filter(item=>item.ready).length}/${section.checkItems.length} kiểm tra dữ liệu đạt`:'Chưa có kết quả kiểm tra'}</span>{evaluated&&!passed&&<span>Cần bổ sung dữ liệu</span>}</span></summary><div className={styles.disclosureBody}>{content}</div></details>
  })}</div>
  {error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}
  {unknown&&<Notice title="Hệ thống chưa xác nhận được kết quả"><p>Đối chiếu lại 4 nhóm hồ sơ trước khi tiếp tục. Hạng mục đã gửi sẽ không bị gửi lặp.</p><Button disabled={busy} onClick={()=>void reconcile()}>Đối chiếu hồ sơ</Button></Notice>}
  {selected&&<Modal title={businessCopy(actions[selected.action])} onClose={()=>{if(!busy)setSelected(null)}} footer={<><Button disabled={busy} onClick={()=>setSelected(null)}>Hủy</Button><Button disabled={busy||unknown||(selected.action!=='confirm'&&!text.trim())} onClick={()=>void execute()}>{businessCopy(actions[selected.action])}</Button></>}><Field htmlFor="prep-evidence" label={selected.action==='return'?'Nội dung cần bổ sung':'Ghi chú xác nhận'}><textarea id="prep-evidence" value={text} onChange={e=>setText(e.target.value)} required={selected.action!=='confirm'}/></Field></Modal>}
 </Panel>
}
