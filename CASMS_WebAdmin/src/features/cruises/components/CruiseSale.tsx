import {requiresCruisePackages} from '../model/sale-selection'
import {usePlanQuery} from '../hooks/usePlanQuery'
import {planEvidence} from '../model/plan-evidence'
import {uniqueConditionCodes,canonicalConditionCode} from '../model/operations-issues'
import {externalAppUrl} from '@/shared/lib/external-app'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import {allowedDepartureSections,type DepartureSection} from '../model/preparation'
import {operationsConditionTarget} from '../model/operations-workflow'
import {ReadinessIssues} from './ReadinessIssues'
import {readinessMessage} from '../model/readiness-copy'
import styles from './ManagerWorkspace.module.css'
import {useCallback,useRef,useState} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {domainStatus} from '@/shared/i18n/business-copy'
import {Badge,Button,Field,Loading,Modal,Notice,Panel,RecordFacts} from '@/shared/ui'
import {cruiseApi} from '../api/cruise-api'
import {approvedPlanWindows} from '../model/approved-plan-windows'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
import {departureApi} from '../api/departure-api'
import {cruisePackageApi} from '@/domain/cruise-package'
import {decodeSaleReadiness} from '../model/departure-contract'
import {useReadinessClock} from '../hooks/useReadinessClock'
import {CRUISE_STATUSES,type CruiseRecord} from '../model/cruise-record'
import type {CruiseOpenSaleResponseDto} from '../api/dto'
import {StopSaleModal} from './StopSaleModal'
type SaleRecord={cruiseId:string;revision:number;status:string;saleScope:string|null;openedForSaleAt:string|null;saleEventIdentity?:string|null}
function decodeSaleRecord(value:SaleRecord,id:string):SaleRecord{
 if(!value||value.cruiseId!==id||!Number.isSafeInteger(value.revision)||value.revision<0||!CRUISE_STATUSES.includes(value.status as typeof CRUISE_STATUSES[number])||value.saleScope!=null&&!['WHOLE_CRUISE','CABIN_ONLY','SELECTED_PACKAGES'].includes(value.saleScope)||value.openedForSaleAt!=null&&(typeof value.openedForSaleAt!=='string'||!Number.isFinite(Date.parse(value.openedForSaleAt))))throw new ApiError('Chưa đọc được quyết định mở bán của đúng chuyến. Tải lại dữ liệu.',502)
 return{...value,openedForSaleAt:value.openedForSaleAt??null,saleScope:value.saleScope??null}
}
const scopeLabels={WHOLE_CRUISE:'Bán kèm tất cả gói tour đang hoạt động',CABIN_ONLY:'Không bán kèm gói tour',SELECTED_PACKAGES:'Chọn gói tour bán kèm'} as const
const scopeEffects={WHOLE_CRUISE:'Bật bán tất cả gói tour đang hoạt động đã gắn với chuyến.',CABIN_ONLY:'Chuyến mở bán các gói du thuyền đã chọn ở trên.',SELECTED_PACKAGES:'Tích chọn các gói tour muốn bán kèm chuyến.'} as const
type Scope='WHOLE_CRUISE'|'CABIN_ONLY'|'SELECTED_PACKAGES'
const offerAmount=(value:string|number)=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:4}).format(Number(value))
export function CruiseSale({cruise,onSection,onReview,onChanged}:{cruise:CruiseRecord;onSection?:(section:DepartureSection)=>void;onReview?:()=>void;onChanged?:()=>void}){
 const access=useSessionAccess(),[scope,setScope]=useState<Scope>('WHOLE_CRUISE'),[selected,setSelected]=useState<string[]>([]),[epoch,setEpoch]=useState(0),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[success,setSuccess]=useState(''),lock=useRef(false),operation=useRef<{key:string;id:string}|null>(null)
 const [stopSaleOpen, setStopSaleOpen] = useState(false), [stopSaleSuccess, setStopSaleSuccess] = useState('')
 const [selectedFares,setSelectedCruisePackages]=useState<string[]>([])
 const fares=useReadQuery(`sale-fare-offers:${access.userId}:${access.status}:${cruise.cruiseId}:${epoch}`,useCallback(signal=>cruisePackageApi.offers(cruise.cruiseId,signal),[cruise.cruiseId]))
 const offerSelection=[...selectedFares].sort().join(','),selection=scope==='SELECTED_PACKAGES'?[...selected].sort().join(','):undefined,key=JSON.stringify([cruise.cruiseId,scope,selection,offerSelection,epoch,cruise.revision])
 const sellability=useReadQuery(`scoped-sale-state:${cruise.cruiseId}:${epoch}`,useCallback(signal=>departureApi.publicSellability(cruise.cruiseId,signal),[cruise.cruiseId]))
 const plan=usePlanQuery(cruise.cruiseId,`${epoch}:${cruise.revision}`,access.has('CRUISE_READ'))
 const windows=approvedPlanWindows(plan.data)
 const unified=plan.data?.unifiedPackageReview===true
 const useLegacyPackages=Boolean(plan.data)&&!unified
 const packages=useReadQuery(`scoped-sale-packages:${cruise.cruiseId}:${useLegacyPackages}`,useCallback(signal=>useLegacyPackages?cruiseApi.listPackages(cruise.cruiseId,signal):Promise.resolve([]),[cruise.cruiseId,useLegacyPackages]))
 const approvedSelections=planEvidence(plan.data?.submittedSnapshot).packages
 const eligibleFares=fares.data?.filter(f=>!unified||approvedSelections.some(p=>p.valid&&p.offerId===f.offer.id&&p.priceId===f.currentApprovedPriceRevisionId))
 const query=useReadQuery(`scoped-sale:${access.userId}:${plan.data?.revision}:${key}`,useCallback(signal=>plan.data&&!plan.loading&&!plan.error&&(!unified||selectedFares.length>0)?apiRequest(`/cruise/${cruise.cruiseId}/sale-readiness`,{query:{saleScope:scope,selectedPackageIds:selection,selectedCruisePackageOfferIds:offerSelection},signal}).then(value=>decodeSaleReadiness(value,cruise.cruiseId)):Promise.resolve(null),[cruise.cruiseId,scope,selection,offerSelection,plan.data,plan.loading,plan.error,unified,selectedFares.length]))
 const saleRecord=useReadQuery(`sale-record:${cruise.cruiseId}:${epoch}:${cruise.revision}`,useCallback(signal=>apiRequest<SaleRecord>(`/cruise/${cruise.cruiseId}`,{signal}).then(value=>decodeSaleRecord(value,cruise.cruiseId)),[cruise.cruiseId]))
 const publicUrl=externalAppUrl(import.meta.env.VITE_BOOKING_APP_URL,'/cruises/'+encodeURIComponent(cruise.cruiseId))
 const activated=Boolean(saleRecord.data?.cruiseId===cruise.cruiseId&&saleRecord.data.openedForSaleAt&&Number.isFinite(Date.parse(saleRecord.data.openedForSaleAt))&&saleRecord.data.status==='PUBLISHED')
 const data=query.data,needsFares=requiresCruisePackages(plan.data?.unifiedPackageReview,scope,data?.cabinOnlySalePermitted),saleAction=needsFares?'Mở bán các gói đã chọn':'Mở bán vé cabin'
 const scopeEffect=needsFares?scopeEffects[scope]:'Chuyến chỉ mở bán vé cabin.'
 const now=useReadinessClock(data?.validUntil),expired=!data?.validUntil||Date.parse(data.validUntil)<=now,blocked=needsFares&&(fares.loading||Boolean(fares.error)||!selectedFares.length||selectedFares.some(id=>!eligibleFares?.some(f=>f.offer.id===id&&f.eligibility.eligible)))||!windows||plan.data?.readyStatus!=='READY'||plan.loading||Boolean(plan.error)||!data?.ready||data.blockers==null||!data.fingerprint||data.cruiseRevision==null||Boolean(data.blockers?.length)||expired||(scope==='SELECTED_PACKAGES'&&!selected.length)
 const simpleBlockers=data?.blockers?.filter(code=>!data.details?.some(issue=>issue.code===code||issue.targetId===cruise.cruiseId&&canonicalConditionCode(issue.code??'')===canonicalConditionCode(code)))??[]
 const saleKeys:Record<string,string>={OPEN_FOR_SALE:'OPEN',NOT_YET_OPEN:'NOT_OPEN',DRAFT:'NOT_OPEN',STOPPED:'STOPPED',SOLD_OUT:'SOLD_OUT',CANCELLED:'CANCELLED',DEPARTED:'DEPARTED'}
 async function open(){
  if(needsFares&&(fares.loading||fares.error||!selectedFares.length||selectedFares.some(id=>!eligibleFares?.some(f=>f.offer.id===id&&f.eligibility.eligible))))return
  if(!data||query.loading||query.error||packages.loading||packages.error||sellability.loading||sellability.error||saleRecord.loading||saleRecord.error||activated||blocked||lock.current||uncertain||!access.roles.includes('OPERATIONS_MANAGER')||!access.has('CRUISE_OPEN_SALE'))return
  lock.current=true;setBusy(true);setError('');setSuccess('')
  try{
   const operationKey=JSON.stringify([cruise.cruiseId,data.cruiseRevision,data.fingerprint,scope,selection,offerSelection])
   if(!operation.current||operation.current.key!==operationKey)operation.current={key:operationKey,id:crypto.randomUUID()}
   const eventIdentity=operation.current.id
   const saved=await apiRequest<CruiseOpenSaleResponseDto>(`/cruise/${cruise.cruiseId}/open-sale`,{method:'POST',body:{expectedRevision:data.cruiseRevision,saleScope:scope,packageIds:scope==='SELECTED_PACKAGES'?selected:[],cruisePackageOfferIds:needsFares?[...selectedFares].sort():[],fingerprint:data.fingerprint,eventIdentity}})
   const actual=await apiRequest<SaleRecord>(`/cruise/${cruise.cruiseId}`)
   if(needsFares){
    const actualCruisePackages=(await cruisePackageApi.offers(cruise.cruiseId)).filter(f=>f.offer.saleEnabled).map(f=>f.offer.id).sort()
    if(JSON.stringify(actualCruisePackages)!==JSON.stringify([...selectedFares].sort()))throw new ApiError('Chưa xác nhận đúng phạm vi gói du thuyền mở bán.',502)
   }
   if (
    saved.cruiseId !== cruise.cruiseId || saved.status !== 'PUBLISHED'
    || saved.saleEventIdentity !== eventIdentity || saved.saleScope !== scope
    || !Number.isSafeInteger(saved.revision) || saved.revision < 0
    || !saved.openedForSaleAt || !Number.isFinite(Date.parse(saved.openedForSaleAt))
    || actual.cruiseId !== saved.cruiseId || actual.revision !== saved.revision
    || actual.status !== saved.status || actual.saleScope !== scope
    || actual.saleEventIdentity !== eventIdentity
    || !actual.openedForSaleAt || Date.parse(actual.openedForSaleAt) !== Date.parse(saved.openedForSaleAt)
   ) throw new ApiError('Chưa đối chiếu được quyết định mở bán đã lưu.', 502)
   setSuccess(needsFares?'Đã ghi nhận quyết định mở bán và phạm vi gói du thuyền.':'Đã ghi nhận quyết định mở bán vé cabin.')
   setConfirm(false);setEpoch(n=>n+1);plan.retry();onChanged?.()
  }catch(reason){setError(reason instanceof ApiError&&!reason.code?reason.message:businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(mutationOutcomeUnknown(reason))setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 return <Panel title="Mở bán chuyến khởi hành">
  {stopSaleSuccess && <Notice title="Đã cập nhật" tone="success">{stopSaleSuccess}</Notice>}
  {cruise.stoppedAt && (
   <Notice title="Chuyến khởi hành đang tạm dừng mở bán" tone="warning">
    <p>Hệ thống WebBooking hiện đã tạm ngừng tiếp nhận đặt chỗ mới cho chuyến này.</p>
    {cruise.stopReason && <p>Lý do dừng bán: <strong>{cruise.stopReason}</strong></p>}
   </Notice>
  )}
  {saleRecord.data&&!saleRecord.loading&&!saleRecord.error&&<RecordFacts entries={[["Quyết định mở bán",activated?'Đã xác nhận':'Chưa ghi nhận quyết định mở bán'],["Thời điểm xác nhận",activated?journeyTime(saleRecord.data.openedForSaleAt!,SHIP_TIME_ZONE):'Chưa có thông tin']]}/>}
  {!activated&&plan.data&&!plan.loading&&!plan.error&&plan.data.readyStatus!=='READY'&&<Notice title="Chuyến khởi hành chưa được xác nhận sẵn sàng mở bán" tone="warning"><p>Để mở bán, chuyến khởi hành cần hoàn tất Bước 2 (Xác nhận sẵn sàng mở bán) sau khi kế hoạch và giá đã được Quản lý vận hành duyệt.</p>{onReview&&<Button tone="secondary" onClick={onReview}>Quay lại Bước 2: Xác nhận sẵn sàng mở bán</Button>}</Notice>}
  {!activated&&needsFares&&fares.loading&&<Loading label="Đang đối chiếu gói du thuyền…"/>}
  {!activated&&needsFares&&fares.error&&<Notice title="Chưa đọc được gói du thuyền" tone="error"><p>{fares.error.message}</p><Button onClick={fares.retry}>Tải lại gói du thuyền</Button></Notice>}
  {!activated&&needsFares&&!fares.loading&&!fares.error&&!plan.loading&&!plan.error&&plan.data&&<fieldset className={styles.salePackages}><legend>Gói du thuyền được mở bán</legend>
   {eligibleFares?.length===0&&<p>Chưa có gói du thuyền đủ điều kiện mở bán. Quản lý hoạt động và dịch vụ cần cấu hình gói và gửi giá để Quản lý vận hành xét duyệt.</p>}
   {eligibleFares?.map(f=><div key={f.offer.id}><label><input type="checkbox" checked={activated?f.offer.saleEnabled:selectedFares.includes(f.offer.id)} disabled={busy||uncertain||activated||!f.eligibility.eligible} onChange={e=>{operation.current=null;setSelectedCruisePackages(old=>e.target.checked?[...old,f.offer.id]:old.filter(id=>id!==f.offer.id));setConfirm(false)}}/>{f.template.version.name} — {f.offer.logicalCategory}{!f.eligibility.eligible?' — Chưa đủ điều kiện bán':''}</label>
    {(()=>{const price=f.prices.find(p=>p.id===f.currentApprovedPriceRevisionId);return <p>{price?`${offerAmount(price.amount)} USD/người · Giá phiên bản ${price.revisionNumber}`:'Chưa có giá đã duyệt hiện hành'}</p>})()}
    {f.eligibility.blockers.length>0&&<ul>{f.eligibility.blockers.map((blocker,index)=><li key={`${blocker.code}:${index}`}>{blocker.message}</li>)}</ul>}
   </div>)}
  </fieldset>}
  {sellability.data&&!sellability.loading&&!sellability.error&&<div className={styles.planStatuses}><Badge label={domainStatus('cruise.sale',saleKeys[sellability.data.publicSaleState??'']??'UNKNOWN')}/></div>}
  {plan.loading&&<Loading label="Đang đối chiếu kế hoạch đã duyệt…"/>}
  {plan.error&&<Notice title="Chưa đọc được kế hoạch đã duyệt" tone="error"><Button tone="secondary" onClick={plan.retry}>Tải lại kế hoạch</Button></Notice>}
  {!plan.loading&&!plan.error&&!windows&&<Notice title="Cần kế hoạch đã được phê duyệt còn hiệu lực">Thời gian nhận đặt chỗ chỉ được lấy sau khi Quản lý vận hành phê duyệt kế hoạch.{onReview&&<Button tone="text" onClick={onReview}>Xem xét duyệt kế hoạch</Button>}</Notice>}
  {plan.data&&!plan.loading&&!plan.error&&!activated&&<p>Trạng thái sẵn sàng của chuyến: {domainStatus('cruise.ready',plan.data.readyStatus)}. Phát hành lịch trình và xác nhận sẵn sàng không tự mở bán.</p>}
  {windows&&!plan.loading&&!plan.error&&<RecordFacts entries={[["Mở nhận đặt chỗ · Kế hoạch đã duyệt",journeyTime(windows.bookingOpensAt,SHIP_TIME_ZONE)],["Đóng nhận đặt chỗ · Giờ Việt Nam",journeyTime(windows.bookingClosesAt,SHIP_TIME_ZONE)]]}/>}
  {activated&&sellability.data?.publicDisplayEligible!==true&&windows&&<p className={styles.help}>{now<Date.parse(windows.bookingOpensAt)?'Đã xác nhận mở bán, đang chờ đến giờ nhận đặt chỗ theo kế hoạch.':now>=Date.parse(windows.bookingClosesAt)?'Đã hết thời gian nhận đặt chỗ theo kế hoạch.':'Đã ghi nhận quyết định mở bán nhưng hiện chưa đủ điều kiện hiển thị công khai. Đối chiếu các điều kiện bên dưới.'}</p>}
  {activated&&!sellability.loading&&!sellability.error&&sellability.data?.publicDisplayEligible===true&&publicUrl&&<p><a href={publicUrl} target="_blank" rel="noopener noreferrer">Xem chuyến khởi hành trên website khách hàng ↗</a></p>}
  {activated&&<ul>{fares.data?.filter(f=>f.offer.saleEnabled).map(f=><li key={f.offer.id}>{f.template.version.name} · {f.offer.logicalCategory}</li>)}</ul>}
  {sellability.data&&!sellability.loading&&!sellability.error&&<p>Nhận đặt chỗ: {sellability.data.sellable===true?'Đang nhận đặt chỗ':sellability.data.sellable===false?'Chưa nhận đặt chỗ':'Chưa xác định'}</p>}
  {activated&&plan.data&&!plan.loading&&!plan.error&&saleRecord.data?.saleScope&&<p><strong>Nội dung đang được bật bán:</strong> {unified?'Gói du thuyền đã chọn':saleRecord.data.saleScope==='CABIN_ONLY'?'Vé cabin · Không kèm tour tham quan':scopeLabels[saleRecord.data.saleScope as Scope]??'Chưa xác định'}</p>}
  {!activated&&plan.data&&!plan.loading&&!plan.error&&!unified&&<div className={styles.saleSelection}>
   <p><strong>Nội dung được bán:</strong> {scopeLabels[scope]}</p>
   <details><summary>Thay đổi nội dung được bán</summary>
    <Field htmlFor="sale-scope" label="Tour tham quan đi kèm"><select id="sale-scope" disabled={busy||uncertain} value={scope} onChange={e=>{operation.current=null;setSelectedCruisePackages([]);setScope(e.target.value as Scope);setConfirm(false)}}>{(Object.keys(scopeLabels) as Scope[]).map(key=><option key={key} value={key}>{scopeLabels[key]}</option>)}</select></Field>
    <p className={styles.help}>{scopeEffect}</p>
    {scope==='SELECTED_PACKAGES'&&Boolean(packages.data?.length)&&<fieldset className={styles.salePackages}><legend>Gói tour bán kèm chuyến</legend>{packages.data?.map(p=><label key={p.tourPackageId}><input type="checkbox" checked={selected.includes(p.tourPackageId)} disabled={busy} onChange={e=>{operation.current=null;setSelected(old=>e.target.checked?[...old,p.tourPackageId]:old.filter(id=>id!==p.tourPackageId));setConfirm(false)}}/>{p.packageName}</label>)}</fieldset>}
    {scope==='SELECTED_PACKAGES'&&!packages.loading&&!packages.error&&packages.data?.length===0&&
      <p>Chuyến chưa có gói tour được gắn. Chọn “Không bán kèm gói tour” nếu chỉ mở bán gói du thuyền.</p>}
   </details>
  </div>}
  {(query.loading||packages.loading||sellability.loading||saleRecord.loading)&&<Loading/>}
  {(query.error||packages.error||sellability.error||saleRecord.error)&&<Notice title="Không thể hoàn tất thao tác"><Button onClick={()=>{query.retry();packages.retry();sellability.retry();saleRecord.retry();plan.retry()}}>Tải lại dữ liệu</Button></Notice>}
  {data&&simpleBlockers.length>0&&<ul className={styles.conditionList}>{uniqueConditionCodes(simpleBlockers).map(code=>{
   const message=readinessMessage(code,businessErrorMessage(code,''))
   const target=operationsConditionTarget(code)
   const destination=target&&target!=='review'?allowedDepartureSections(access).find(([key])=>key===target):null
   return <li key={code}><span>{code==='CRUISE_ALREADY_DEPARTED'?`Ngày khởi hành ${journeyTime(cruise.departureDatetime,SHIP_TIME_ZONE)} đã qua. Cần một chuyến khởi hành có lịch mới để khách đặt trên website.`:message}</span>{target==='review'&&onReview?<Button tone="text" onClick={onReview}>Xem xét duyệt</Button>:destination&&onSection&&destination[0]!=='checks'?<Button tone="text" onClick={()=>onSection(destination[0])}>Mở {destination[1].toLocaleLowerCase('vi-VN')}</Button>:null}</li>
  })}</ul>}
  {data&&data.blockers==null&&<Notice title="Chưa có đầy đủ kết quả kiểm tra">Cần kiểm tra lại trước khi mở bán.</Notice>}
  {data&&!query.loading&&!query.error&&<ReadinessIssues items={data.details} cruiseId={cruise.cruiseId} shipId={cruise.shipId??null}/>}
  {data&&!query.loading&&!query.error&&expired&&<Notice title="Cần kiểm tra lại điều kiện mở bán">Kết quả kiểm tra đã hết hạn hoặc chưa có thời hạn hiệu lực.</Notice>}
  <div className={styles.sectionActions}><Button tone="secondary" disabled={busy||(!activated&&needsFares&&!selectedFares.length)||plan.loading||Boolean(plan.error)} onClick={()=>{setEpoch(n=>n+1);setConfirm(false)}}>Kiểm tra lại điều kiện mở bán</Button>
  {access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_OPEN_SALE')&&<Button disabled={busy||uncertain||blocked||activated||saleRecord.loading||packages.loading||sellability.loading||query.loading||Boolean(query.error||packages.error||sellability.error||saleRecord.error)} onClick={()=>setConfirm(true)}>{activated?'Đã xác nhận mở bán':saleAction}</Button>}
   {access.roles.includes('OPERATIONS_MANAGER')&&(access.has('CRUISE_STOP_SALE')||access.has('CRUISE_OPEN_SALE'))&&activated&&!cruise.stoppedAt&&<Button tone="danger" disabled={busy} onClick={()=>setStopSaleOpen(true)}>Tạm dừng mở bán</Button>}</div>
  {success&&<Notice title="Đã xác nhận mở bán" tone="success">{success}</Notice>}
  {error&&!confirm&&<Notice title="Chưa xác nhận được mở bán" tone="error">{error}</Notice>}{uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Đọc lại quyết định và trạng thái bán hiện tại trước khi thao tác tiếp.<Button disabled={busy} onClick={()=>{setConfirm(false);saleRecord.retry();sellability.retry();query.retry();fares.retry();packages.retry();plan.retry()}}>Đối chiếu trạng thái hiện tại</Button></Notice>}
  {confirm&&<Modal busy={busy} title={saleAction} onClose={()=>{if(!busy)setConfirm(false)}} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setConfirm(false)}>Quay lại</Button><Button disabled={busy||blocked||uncertain||activated||query.loading||Boolean(query.error||packages.error||sellability.error||saleRecord.error)} onClick={()=>void open()}>{busy?'Đang xác nhận…':saleAction}</Button></>}>
   <p>{needsFares?'Thao tác này mở bán đúng các gói bên dưới sau khi Backend kiểm tra lại điều kiện.':'Mở bán vé cabin theo chính sách giá đã được phê duyệt. Hệ thống kiểm tra lại điều kiện trước khi ghi nhận.'} Việc nhận Booking tiếp tục phụ thuộc chính sách giao dịch.</p><p><strong>{cruise.cruiseCode}</strong> · {unified?'Gói du thuyền đã chọn':scopeLabels[scope]}</p>{!unified&&<p>{scopeEffect}</p>}
   <ul>{fares.data?.filter(f=>selectedFares.includes(f.offer.id)).map(f=><li key={f.offer.id}>{f.template.version.name} · {f.offer.logicalCategory}{(()=>{const price=f.prices.find(p=>p.id===f.currentApprovedPriceRevisionId);return price?` · ${offerAmount(price.amount)} USD/người · Giá phiên bản ${price.revisionNumber}`:''})()}</li>)}</ul>
   {scope==='SELECTED_PACKAGES'&&<ul>{packages.data?.filter(p=>selected.includes(p.tourPackageId)).map(p=><li key={p.tourPackageId}>{p.packageName}</li>)}</ul>}
   {windows&&<p>Nhận đặt chỗ từ {journeyTime(windows.bookingOpensAt,SHIP_TIME_ZONE)} đến {journeyTime(windows.bookingClosesAt,SHIP_TIME_ZONE)} · Giờ Việt Nam.</p>}
   {error&&<Notice title="Chưa xác nhận được mở bán" tone="error">{error}</Notice>}
  </Modal>}
  <StopSaleModal
   isOpen={stopSaleOpen}
   cruise={cruise}
   onClose={()=>setStopSaleOpen(false)}
   onSuccess={()=>{
     setStopSaleOpen(false)
     setStopSaleSuccess('Đã tạm dừng mở bán chuyến khởi hành thành công.')
     setEpoch(n=>n+1)
     plan.retry()
     sellability.retry()
     saleRecord.retry()
     onChanged?.()
   }}
  />
 </Panel>
}
