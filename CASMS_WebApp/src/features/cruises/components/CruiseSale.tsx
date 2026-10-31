import {allowedDepartureSections,type DepartureSection} from '../model/preparation'
import {operationsConditionTarget} from '../model/operations-workflow'
import styles from './ManagerWorkspace.module.css'
import {useCallback,useRef,useState} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {domainStatus} from '@/shared/i18n/business-copy'
import {Badge,Button,Field,Loading,Modal,Notice,Panel,RecordFacts} from '@/shared/ui'
import {cruiseApi} from '../api/cruise-api'
import {mainflowApi} from '../api/mainflow-api'
import {approvedPlanWindows} from '../model/approved-plan-windows'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
import {departureApi} from '../api/departure-api'
import {decodeSaleReadiness} from '../model/departure-contract'
import {useReadinessClock} from '../hooks/useReadinessClock'
import type {CruiseRecord} from '../model/cruise-record'
type SaleRecord={cruiseId:string;revision:number;status:string;saleScope:string|null;openedForSaleAt:string|null}
const scopeLabels={WHOLE_CRUISE:'Cabin và toàn bộ gói dịch vụ đang hoạt động',CABIN_ONLY:'Chỉ cabin, không bán gói dịch vụ',SELECTED_PACKAGES:'Cabin và các gói dịch vụ được chọn'} as const
const scopeEffects={WHOLE_CRUISE:'Các gói dịch vụ đang hoạt động đã gắn với chuyến sẽ được bật bán.',CABIN_ONLY:'Tất cả gói dịch vụ đã gắn với chuyến sẽ bị tắt bán.',SELECTED_PACKAGES:'Chỉ những gói được chọn bên dưới được bật bán; các gói còn lại bị tắt bán.'} as const
type Scope='WHOLE_CRUISE'|'CABIN_ONLY'|'SELECTED_PACKAGES'
export function CruiseSale({cruise,onSection,onReview,onChanged}:{cruise:CruiseRecord;onSection?:(section:DepartureSection)=>void;onReview?:()=>void;onChanged?:()=>void}){
 const access=useSessionAccess(),[scope,setScope]=useState<Scope>('WHOLE_CRUISE'),[selected,setSelected]=useState<string[]>([]),[epoch,setEpoch]=useState(0),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[success,setSuccess]=useState(''),lock=useRef(false)
 const selection=scope==='SELECTED_PACKAGES'?[...selected].sort().join(','):undefined,key=JSON.stringify([cruise.cruiseId,scope,selection,epoch,cruise.revision])
 const query=useReadQuery(`scoped-sale:${key}`,useCallback(signal=>apiRequest(`/cruise/${cruise.cruiseId}/sale-readiness`,{query:{saleScope:scope,selectedPackageIds:selection},signal}).then(value=>decodeSaleReadiness(value,cruise.cruiseId)),[cruise.cruiseId,scope,selection]))
 const packages=useReadQuery(`scoped-sale-packages:${cruise.cruiseId}`,useCallback(signal=>cruiseApi.listPackages(cruise.cruiseId,signal),[cruise.cruiseId]))
 const sellability=useReadQuery(`scoped-sale-state:${cruise.cruiseId}:${epoch}`,useCallback(signal=>departureApi.publicSellability(cruise.cruiseId,signal),[cruise.cruiseId]))
 const plan=useReadQuery(`sale-approved-plan:${cruise.cruiseId}:${epoch}:${cruise.revision}`,useCallback(signal=>mainflowApi.get(cruise.cruiseId,signal),[cruise.cruiseId]))
 const windows=approvedPlanWindows(plan.data)
 const saleRecord=useReadQuery(`sale-record:${cruise.cruiseId}:${epoch}:${cruise.revision}`,useCallback(signal=>apiRequest<SaleRecord>(`/cruise/${cruise.cruiseId}`,{signal}),[cruise.cruiseId]))
 const activated=Boolean(saleRecord.data?.cruiseId===cruise.cruiseId&&saleRecord.data.openedForSaleAt&&Number.isFinite(Date.parse(saleRecord.data.openedForSaleAt))&&saleRecord.data.status==='PUBLISHED')
 const data=query.data,now=useReadinessClock(data?.validUntil),expired=!data?.validUntil||Date.parse(data.validUntil)<=now,blocked=!windows||plan.loading||Boolean(plan.error)||!data?.ready||data.blockers==null||!data.fingerprint||data.cruiseRevision==null||Boolean(data.blockers?.length)||expired||(scope==='SELECTED_PACKAGES'&&!selected.length)
 const saleKeys:Record<string,string>={OPEN_FOR_SALE:'OPEN',NOT_YET_OPEN:'NOT_OPEN',DRAFT:'NOT_OPEN',STOPPED:'STOPPED',SOLD_OUT:'SOLD_OUT'}
 async function open(){
  if(!data||query.loading||query.error||packages.loading||packages.error||sellability.loading||sellability.error||saleRecord.loading||saleRecord.error||activated||blocked||lock.current||uncertain||!access.roles.includes('OPERATIONS_MANAGER')||!access.has('CRUISE_OPEN_SALE'))return
  lock.current=true;setBusy(true);setError('');setSuccess('')
  try{
   const saved=await apiRequest<SaleRecord>(`/cruise/${cruise.cruiseId}/open-sale`,{method:'POST',body:{expectedRevision:data.cruiseRevision,saleScope:scope,packageIds:scope==='SELECTED_PACKAGES'?selected:[],fingerprint:data.fingerprint,eventIdentity:crypto.randomUUID()}})
   const actual=await apiRequest<SaleRecord>(`/cruise/${cruise.cruiseId}`)
   if(saved.cruiseId!==cruise.cruiseId||saved.status!=='PUBLISHED'||saved.saleScope!==scope||!saved.openedForSaleAt||actual.cruiseId!==saved.cruiseId||actual.revision!==saved.revision||actual.status!==saved.status||actual.saleScope!==scope||actual.openedForSaleAt!==saved.openedForSaleAt)throw new ApiError('',502)
   setSuccess('Đã ghi nhận mở bán. Thời gian nhận đặt chỗ áp dụng theo kế hoạch đã phê duyệt.')
   setConfirm(false);setEpoch(n=>n+1);onChanged?.()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 return <Panel title="Cho phép nhận đặt chỗ">
  {sellability.data&&!sellability.loading&&!sellability.error&&<div className={styles.planStatuses}><Badge label={domainStatus('cruise.sale',saleKeys[sellability.data.saleState??'']??'UNKNOWN')}/></div>}
  {plan.loading&&<Loading label="Đang đối chiếu kế hoạch đã duyệt…"/>}
  {plan.error&&<Notice title="Chưa đọc được kế hoạch đã duyệt" tone="error"><Button tone="secondary" onClick={plan.retry}>Tải lại kế hoạch</Button></Notice>}
  {!plan.loading&&!plan.error&&!windows&&<Notice title="Cần kế hoạch đã được phê duyệt còn hiệu lực">Thời gian nhận đặt chỗ chỉ được lấy sau khi Quản lý vận hành phê duyệt kế hoạch.{onReview&&<Button tone="text" onClick={onReview}>Xem xét duyệt kế hoạch</Button>}</Notice>}
  {windows&&!plan.loading&&!plan.error&&<RecordFacts entries={[["Mở nhận đặt chỗ · Kế hoạch đã duyệt",journeyTime(windows.bookingOpensAt,SHIP_TIME_ZONE)],["Đóng nhận đặt chỗ · Giờ Việt Nam",journeyTime(windows.bookingClosesAt,SHIP_TIME_ZONE)]]}/>}
  {activated&&sellability.data?.sellable!==true&&windows&&<p className={styles.help}>{now<Date.parse(windows.bookingOpensAt)?'Đã xác nhận mở bán, đang chờ đến giờ nhận đặt chỗ theo kế hoạch.':now>=Date.parse(windows.bookingClosesAt)?'Đã hết thời gian nhận đặt chỗ theo kế hoạch.':'Đã xác nhận mở bán nhưng hiện chưa nhận được đặt chỗ. Đối chiếu các điều kiện bên dưới.'}</p>}
  {activated&&saleRecord.data?.saleScope&&<p><strong>Nội dung đang được bật bán:</strong> {scopeLabels[saleRecord.data.saleScope as Scope]??'Chưa xác định'}</p>}
  {!activated&&<div className={styles.saleSelection}>
   <p><strong>Nội dung được bán:</strong> {scopeLabels[scope]}</p>
   <details><summary>Thay đổi nội dung được bán</summary>
    <Field htmlFor="sale-scope" label="Cho phép hành khách đặt"><select id="sale-scope" disabled={busy} value={scope} onChange={e=>{setScope(e.target.value as Scope);setConfirm(false)}}>{(Object.keys(scopeLabels) as Scope[]).map(key=><option key={key} value={key}>{scopeLabels[key]}</option>)}</select></Field>
    <p className={styles.help}>{scopeEffects[scope]}</p>
    {scope==='SELECTED_PACKAGES'&&<fieldset className={styles.salePackages}><legend>Gói dịch vụ được bật bán</legend>{packages.data?.map(p=><label key={p.tourPackageId}><input type="checkbox" checked={selected.includes(p.tourPackageId)} disabled={busy} onChange={e=>{setSelected(old=>e.target.checked?[...old,p.tourPackageId]:old.filter(id=>id!==p.tourPackageId));setConfirm(false)}}/>{p.packageName}</label>)}</fieldset>}
   </details>
  </div>}
  {(query.loading||packages.loading||sellability.loading||saleRecord.loading)&&<Loading/>}
  {(query.error||packages.error||sellability.error||saleRecord.error)&&<Notice title="Không thể hoàn tất thao tác"><Button onClick={()=>{query.retry();packages.retry();sellability.retry();saleRecord.retry();plan.retry()}}>Tải lại dữ liệu</Button></Notice>}
  {data&&data.blockers!=null&&data.blockers.length>0&&<ul className={styles.conditionList}>{[...new Map(data.blockers.map(code=>[businessErrorMessage(code,''),code])).entries()].map(([message,code])=>{
   const target=operationsConditionTarget(code)
   const destination=target&&target!=='review'?allowedDepartureSections(access).find(([key])=>key===target):null
   return <li key={message}><span>{code==='CRUISE_ALREADY_DEPARTED'?`Ngày khởi hành ${journeyTime(cruise.departureDatetime,SHIP_TIME_ZONE)} đã qua. Cần một chuyến khởi hành có lịch mới để khách đặt trên website.`:message}</span>{target==='review'&&onReview?<Button tone="text" onClick={onReview}>Xem xét duyệt</Button>:destination&&onSection&&destination[0]!=='checks'?<Button tone="text" onClick={()=>onSection(destination[0])}>Mở {destination[1].toLocaleLowerCase('vi-VN')}</Button>:null}</li>
  })}</ul>}
  {data&&data.blockers==null&&<Notice title="Chưa có đầy đủ kết quả kiểm tra">Cần kiểm tra lại trước khi mở bán.</Notice>}
  {data&&!query.loading&&!query.error&&expired&&<Notice title="Cần kiểm tra lại điều kiện mở bán">Kết quả kiểm tra đã hết hạn hoặc chưa có thời hạn hiệu lực.</Notice>}
  {scope==='SELECTED_PACKAGES'&&!packages.loading&&!packages.error&&packages.data?.length===0&&<p>Chưa có gói dịch vụ để chọn.</p>}
  <div className={styles.sectionActions}><Button tone="secondary" disabled={busy} onClick={()=>{setEpoch(n=>n+1);setConfirm(false)}}>Kiểm tra lại điều kiện nhận đặt chỗ</Button>
  {access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_OPEN_SALE')&&<Button disabled={busy||uncertain||blocked||activated||saleRecord.loading||packages.loading||sellability.loading||query.loading||Boolean(query.error||packages.error||sellability.error||saleRecord.error)} onClick={()=>setConfirm(true)}>{activated?'Đã xác nhận mở bán':'Xác nhận mở bán'}</Button>}</div>
  {success&&<Notice title="Đã xác nhận mở bán" tone="success">{success}</Notice>}
  {error&&!confirm&&<Notice title="Chưa xác nhận được mở bán" tone="error">{error}</Notice>}{uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}
  {confirm&&<Modal busy={busy} title="Xác nhận mở bán" onClose={()=>{if(!busy)setConfirm(false)}} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setConfirm(false)}>Quay lại</Button><Button disabled={busy||blocked||uncertain||activated||query.loading||Boolean(query.error||packages.error||sellability.error||saleRecord.error)} onClick={()=>void open()}>{busy?'Đang xác nhận…':'Xác nhận mở bán'}</Button></>}>
   <p><strong>{cruise.cruiseCode}</strong> · {scopeLabels[scope]}</p><p>{scopeEffects[scope]}</p>
   {scope==='SELECTED_PACKAGES'&&<ul>{packages.data?.filter(p=>selected.includes(p.tourPackageId)).map(p=><li key={p.tourPackageId}>{p.packageName}</li>)}</ul>}
   {windows&&<p>Nhận đặt chỗ từ {journeyTime(windows.bookingOpensAt,SHIP_TIME_ZONE)} đến {journeyTime(windows.bookingClosesAt,SHIP_TIME_ZONE)} · Giờ Việt Nam.</p>}
   {error&&<Notice title="Chưa xác nhận được mở bán" tone="error">{error}</Notice>}
  </Modal>}
 </Panel>
}
