import {useCallback,useRef,useState} from 'react'
import {ApiError,useReadQuery} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {useSessionAccess} from '@/shared/auth'
import {businessCopy,domainStatus} from '@/shared/i18n/business-copy'
import {Badge,Button,Field,Loading,Modal,Notice,Panel} from '@/shared/ui'
import {preparationApi,type PreparationSection as Section,type PreparationAction} from '../api/preparation-api'
import {PreparationCoordinator} from './PreparationCoordinator'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
const actions={submit:'preparation.section.SUBMIT_ACTION',confirm:'preparation.section.CONFIRM_ACTION',return:'preparation.section.RETURN_ACTION'} as const
const sectionNames:Record<string,string>={TECHNICAL_NAUTICAL:'Kỹ thuật hàng hải và tàu',HOTEL_CABIN:'Khách sạn và buồng phòng',FOOD_BEVERAGE:'Ẩm thực và dịch vụ',ENTERTAINMENT_SHORE:'Giải trí và tour tham quan trên bờ',SAFETY_CREW:'An toàn và thuyền viên'}
const owners:Record<string,string>={SHIP_MANAGER:'Quản lý tàu',CRUISE_MANAGER:'Điều phối lịch trình',OPERATIONS_MANAGER:'Điều phối vận hành'}
const checks:Record<string,string>={SHIP_ASSIGNED:'Tàu đã được gán',SHIP_STATUS_ACTIVE:'Tàu đang hoạt động',SHIP_CONFIG:'Cấu hình boong và cabin',CABIN_INVENTORY:'Kiểm kê buồng phòng',SERVING_WINDOWS:'Khung giờ phục vụ',SHORE_EXCURSIONS:'Hoạt động trên tàu và tour tham quan trên bờ',CAPTAIN_ASSIGNED:'Phân công thuyền trưởng'} 
export function PreparationEvidence({cruiseId,onChanged,refreshKey=0}:{cruiseId:string;onChanged:()=>void;refreshKey?:number}){
 const access=useSessionAccess(),allowed=access.has('CRUISE_PREPARATION_READ')
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
 if(!allowed)return null
 return <Panel title={businessCopy('preparation.dashboard.title')}>
  <p>{businessCopy('preparation.dashboard.responsibility')}</p>
  {query.data&&<PreparationCoordinator key={`${cruiseId}:${query.data.cruiseRevision}`} view={query.data} onChanged={changed}/>}
  {query.loading&&<Loading/>}{query.error&&<Notice title="Không thể hoàn tất thao tác" tone="error"><Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
  {query.data?.sections.map(section=><section key={section.sectionCode}>
   <h3>{sectionNames[section.sectionCode]??'Hồ sơ chuẩn bị'}</h3><Badge label={domainStatus('preparation.section',section.status)}/><p>{businessCopy('preparation.professionalOwner')}: {owners[section.ownerRole]??'Chưa xác định'} · Phiên bản {section.revision}</p>
   <ul>{section.checkItems.map(item=><li key={item.itemCode}>{checks[item.itemCode]??'Hạng mục cần đối chiếu'} · {item.ready?'Đạt':'Chưa đạt'}{item.itemCode!=='SHIP_STATUS_ACTIVE'&&item.evidence&&<p>{item.evidence}</p>}</li>)}</ul>
   <p>{businessCopy('preparation.systemSource')}</p>
   {section.submittedAt&&<p>{businessCopy('preparation.submittedAt')}: {journeyTime(section.submittedAt,SHIP_TIME_ZONE)} · {businessCopy('preparation.shipTime')}</p>}
   {section.confirmedAt&&section.status==='CONFIRMED'&&<p>{businessCopy('preparation.confirmedAt')}: {journeyTime(section.confirmedAt,SHIP_TIME_ZONE)} · {section.confirmedByUsername??'Chưa xác định'}</p>}
   {section.evidence&&<p>{section.evidence}</p>}{section.returnReason&&<Notice title={businessCopy('preparation.section.RETURNED')}>{section.returnReason}</Notice>}
   {can(section,'submit')&&<Button disabled={busy||unknown} onClick={()=>{setSelected({section,action:'submit'});setText(section.evidence??'');setError('')}}>{businessCopy(actions.submit)}</Button>}
   {access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_PREPARATION_CONFIRM')&&['SUBMITTED','CONFIRMED'].includes(section.status)&&<>
    {section.status==='SUBMITTED'&&<Button disabled={busy||unknown||!can(section,'confirm')} onClick={()=>{setSelected({section,action:'confirm'});setText('');setError('')}}>{businessCopy(actions.confirm)}</Button>}
    {can(section,'return')&&<Button disabled={busy||unknown} onClick={()=>{setSelected({section,action:'return'});setText('');setError('')}}>{businessCopy(actions.return)}</Button>}
    {section.submittedByUserId===access.userId&&<p>Người nộp hồ sơ không thể tự xác nhận. Cần tài khoản OPS khác kiểm tra.</p>}
    {section.checkItems.some(i=>i.required&&!i.ready)&&<p>Các hạng mục bắt buộc chưa đạt. Người phụ trách cần hoàn thiện hồ sơ trước khi xác nhận.</p>}
   </>}
  </section>)}
  {error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}
  {unknown&&<Notice title="Hệ thống chưa xác nhận được kết quả"><Button onClick={()=>{setSelected(null);setUnknown(false);setEpoch(n=>n+1)}}>Tải lại dữ liệu</Button></Notice>}
  {selected&&<Modal title={businessCopy(actions[selected.action])} onClose={()=>{if(!busy)setSelected(null)}} footer={<><Button disabled={busy} onClick={()=>setSelected(null)}>Hủy</Button><Button disabled={busy||unknown||(selected.action!=='confirm'&&!text.trim())} onClick={()=>void execute()}>{businessCopy(actions[selected.action])}</Button></>}><Field htmlFor="prep-evidence" label={selected.action==='return'?'Nội dung cần bổ sung':selected.action==='submit'?'Bằng chứng chuẩn bị':'Ghi chú xác nhận'}><textarea id="prep-evidence" value={text} onChange={e=>setText(e.target.value)} required={selected.action!=='confirm'}/></Field></Modal>}
 </Panel>
}
