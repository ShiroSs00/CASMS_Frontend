import {usePlanQuery} from '../hooks/usePlanQuery'
import {planEvidence} from '../model/plan-evidence'
import {uniqueConditionCodes} from '../model/operations-issues'
import {FrozenPlanPackages,PlanPackageSelection} from './PlanPackageSelection'
import {allowedDepartureSections,type DepartureSection} from '../model/preparation'
import {operationsConditionTarget,planMakerReason} from '../model/operations-workflow'
import {PlanSnapshot} from './PlanSnapshot'
import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { ApiError, apiRequest } from '@/shared/api'
import { businessCopy, domainStatus } from '@/shared/i18n/business-copy'
import { Badge, Button, Field, Loading, Modal, Notice, Panel, RecordFacts } from '@/shared/ui'
import { mainflowApi, type MainflowAction, type PlanView } from '../api/mainflow-api'
import {preparationWallTime,preparationInstant} from '../model/preparation-time'
import {journeyTime,SHIP_TIME_ZONE,validTimeZone} from '@/shared/lib/journey-time'
import styles from './ManagerWorkspace.module.css'
import {planReviewActions,planReviewStates} from '../model/plan-review'
import {preparationApi} from '../api/preparation-api'
const actionKeys={submit:'cruise.plan.SUBMIT_ACTION',withdraw:'cruise.plan.WITHDRAW_ACTION',approve:'cruise.plan.APPROVE_ACTION',reject:'cruise.plan.REJECT_ACTION','request-revision':'cruise.plan.REQUEST_REVISION_ACTION',ready:'cruise.ready.SET_READY_ACTION'} as const
const safeError=(error:unknown)=>error instanceof ApiError&&error.code==='SELF_APPROVAL_FORBIDDEN'?'Bạn đã tham gia chuẩn bị hồ sơ hoặc điều khoản. Cần người xét duyệt khác.':businessErrorMessage(error instanceof ApiError?error.code:undefined,'')
export function CruisePlanReview({cruiseId,refreshKey=0,onChanged,onSection,onReview,onNextStep,itineraryMode,mode='all',embedded=false}:{cruiseId:string;refreshKey?:number|string;onChanged?:()=>void;onSection?:(section:DepartureSection)=>void;onReview?:()=>void;onNextStep?:()=>void;itineraryMode?:'FIXED'|'CUSTOM';embedded?:boolean;mode?:'all'|'prepare'|'submit'|'review'|'ready'|'summary'}){
 const access=useSessionAccess(),[epoch,setEpoch]=useState(0)
 const allowed=['CRUISE_MANAGER','OPERATIONS_MANAGER','SHIP_MANAGER'].some(role=>access.roles.includes(role))&&access.has('CRUISE_READ')
 const query=usePlanQuery(cruiseId,`${epoch}:${refreshKey}`,allowed)
 const [action,setAction]=useState<MainflowAction|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('')
 const [uncertain,setUncertain]=useState(false),lock=useRef(false)
 const [evidence,setEvidence]=useState('')
 const readDossier=allowed&&action==='submit'&&access.has('CRUISE_PREPARATION_READ')
 const dossier=useReadQuery(`submit-dossier:${access.userId}:${access.status}:${cruiseId}:${epoch}:${refreshKey}:${readDossier}`,useCallback(signal=>readDossier?preparationApi.get(cruiseId,signal):Promise.resolve(null),[readDossier,cruiseId]))
 const pendingSections=dossier.data?.sections.filter(section=>!['SUBMITTED','CONFIRMED'].includes(section.status))??[]
 const dossierAllowed=Boolean(dossier.data&&!dossier.loading&&!dossier.error&&dossier.data.coordinatorUserId===access.userId&&access.has('CRUISE_PREPARATION_SUBMIT')&&pendingSections.every(section=>section.allowedActions.includes('SUBMIT')))
 const dossierValid=dossierAllowed&&(pendingSections.length===0||Boolean(evidence.trim()))

 const crm=access.roles.includes('CRUISE_MANAGER')&&access.canDo('CRUISE_UPDATE_DRAFT'),ops=access.roles.includes('OPERATIONS_MANAGER')&&access.canDo('ITINERARY_APPROVE')
 const data=query.data
 const makerReason=data?planMakerReason(data,access.userId):null
 const evidenceMissing=Boolean(data?.unifiedPackageReview&&data.planStatus==='SUBMITTED'&&!planEvidence(data.submittedSnapshot).valid)
 const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
 const availableActions=data?planReviewActions(data,access).filter(action=>mode==='ready'?action==='ready':mode==='review'?['approve','reject','request-revision'].includes(action):true):[]
 const approvalNeedsReview=data?.planStatus==='APPROVED'&&(data.planBlockers.length>0||data.readyBlockers.includes('PLAN_APPROVAL_REQUIRED'))
 const readyToSubmit=Boolean(data&&availableActions.includes('submit')&&data.planBlockers.length===0)
 async function execute(){
  if(!data||!action||lock.current||uncertain||query.loading||query.error||!availableActions.includes(action)||action==='approve'&&evidenceMissing)return
  if(action==='ready'?!(access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_VALIDATE')):['submit','withdraw'].includes(action)?!crm:!ops)return
  if(action==='submit'&&!dossierValid)return
  lock.current=true;setBusy(true);setError('');setSuccess('')
  try{const actual=await mainflowApi.action(data,action,reason,action==='submit'&&dossier.data?{preparationEvidence:evidence.trim(),pendingPreparationCodes:pendingSections.map(section=>section.sectionCode),preparationRevisions:Object.fromEntries(dossier.data.sections.map(section=>[section.sectionCode,section.revision]))}:undefined);setAction(null);if(action==='submit')setEvidence('');setSuccess(action==='submit'?'Đã gửi hồ sơ chuyến khởi hành':action==='ready'?domainStatus('cruise.ready',actual.readyStatus):domainStatus('cruise.plan',actual.planStatus));setEpoch(n=>n+1);query.retry();onChanged?.()}
  catch(e){setError(safeError(e));if(e instanceof ApiError&&e.status===409){setAction(null);query.retry()}if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 if(!allowed)return null
 if(mode==='summary')return null
 if(mode==='prepare')return <Panel title={embedded?undefined:"Thời gian nhận đặt chỗ và hướng dẫn"}>
  {query.loading&&<Loading/>}{query.error&&<Notice title="Chưa tải được khung thời gian" tone="error">{safeError(query.error)}<Button tone="secondary" onClick={query.retry}>Thử lại</Button></Notice>}
  {data&&<PlanWindows key={`${cruiseId}:${data.windows.expectedRevision}`} data={data} onSaved={()=>{setEpoch(n=>n+1);query.retry()}} editable={crm&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.planStatus)}/>}
 </Panel>
 const supplement=Boolean(data&&['SUBMITTED','APPROVED'].includes(data.planStatus))
 const submitLabel=supplement?'Gửi bổ sung hồ sơ':'Gửi hồ sơ chuyến khởi hành'
 const actionLabel=(value:MainflowAction)=>value==='ready'?'Xác nhận sẵn sàng mở bán':value==='approve'?'Phê duyệt hồ sơ':value==='reject'?'Từ chối hồ sơ':value==='request-revision'?'Yêu cầu chỉnh sửa':businessCopy(actionKeys[value])
 const actionDialog=action&&<Modal busy={busy} title={action==='submit'?submitLabel:actionLabel(action)} onClose={()=>{if(!busy)setAction(null)}} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setAction(null)}>Quay lại</Button><Button disabled={busy||uncertain||query.loading||Boolean(query.error)||(action==='approve'&&evidenceMissing)||(action==='submit'&&!dossierValid)||(['reject','request-revision'].includes(action)&&!reason.trim())} onClick={()=>void execute()}>{busy?'Đang gửi…':action==='submit'?submitLabel:actionLabel(action)}</Button></>}>
   {action==='submit'&&<>
    <p><strong>{data?.cruiseCode}</strong> · {supplement?'Bổ sung các nhóm hồ sơ được trả lại hoặc chưa gửi.':data?.unifiedPackageReview?'Gửi kế hoạch, các gói và phiên bản giá đã chọn cùng thuế/phí để xét duyệt chung.':'Gửi kế hoạch và hồ sơ chuẩn bị cho Quản lý vận hành.'}</p>
    {dossier.loading&&<Loading label="Đang đối chiếu hồ sơ chuẩn bị…"/>}
    {dossier.error&&<Notice title="Chưa đọc được hồ sơ chuẩn bị" tone="error"><Button tone="secondary" onClick={dossier.retry}>Tải lại hồ sơ</Button></Notice>}
    {dossier.data&&!dossier.loading&&!dossier.error&&<>
     <ul>{dossier.data.sections.map(section=><li key={section.sectionCode}>{section.sectionName} · {section.status==='CONFIRMED'?'Đã xác nhận':section.status==='SUBMITTED'?'Đã gửi':section.status==='RETURNED'?'Cần bổ sung':'Gửi cùng hồ sơ'}{section.returnReason&&<p>{section.returnReason}</p>}</li>)}</ul>
     {!dossierAllowed&&<Notice title="Chưa thể gửi hồ sơ">Chỉ Quản lý lịch trình được phân công phụ trách hồ sơ và có quyền gửi mới thực hiện được thao tác này.</Notice>}
     {pendingSections.length>0&&<Field htmlFor="departure-dossier-evidence" label={supplement?'Nội dung bổ sung hồ sơ':'Nội dung và bằng chứng chuẩn bị'}><textarea id="departure-dossier-evidence" rows={5} value={evidence} onChange={event=>setEvidence(event.target.value)} required disabled={busy||uncertain}/></Field>}
    </>}
    <p>{data?.unifiedPackageReview?'Quản lý vận hành duyệt kế hoạch, giá các gói đã chọn và thuế/phí trong cùng hồ sơ.':'Quản lý vận hành xét duyệt kế hoạch và các điều kiện thương mại.'} Gửi hồ sơ chưa mở bán chuyến.</p>
   </>}
   {action==='ready'&&<p>Ghi nhận chuyến đã đạt các điều kiện để chuyển sang bước mở bán. Thao tác này cho phép tiếp tục sang Bước 3 để chính thức mở bán gói du thuyền.</p>}
   {action==='approve'&&<p>{data?.unifiedPackageReview?'Phê duyệt kế hoạch, các phiên bản giá gói đã chọn và thuế/phí trong bản hồ sơ này.':'Phê duyệt kế hoạch đã gửi.'} Thao tác này chưa xác nhận sẵn sàng hoặc mở bán.</p>}
   {action==='request-revision'&&data?.planStatus==='APPROVED'&&<p>Kế hoạch sẽ mở lại cho Quản lý lịch trình chỉnh sửa và gửi duyệt lại. Xác nhận sẵn sàng trước đó sẽ mất hiệu lực; quyết định giá đã lưu vẫn được giữ riêng.</p>}
   {error&&<Notice title="Chưa hoàn tất thao tác" tone="error">{error}</Notice>}
   {uncertain&&<Notice title="Chưa xác định kết quả">Đóng hộp thoại và tải lại dữ liệu để đối chiếu trước khi gửi tiếp.</Notice>}
   <p>{businessCopy('cruise.plan.revision')}: {data?.revision}</p>{['reject','request-revision'].includes(action)&&<Field htmlFor="plan-reason" label={businessCopy(action==='reject'?'cruise.plan.rejectReason':'cruise.plan.revisionFeedback')}><textarea id="plan-reason" value={reason} onChange={e=>setReason(e.target.value)} required/></Field>}
  </Modal>
 if(mode==='ready'){
  const isReady = data?.readyStatus === 'READY'
  const isPlanApproved = data?.planStatus === 'APPROVED' && !data?.readyBlockers.includes('PLAN_APPROVAL_REQUIRED')
  const hasPricingBlocker = Boolean(data?.readyBlockers.some(c => c.includes('PRICE') || c.includes('TERMS') || c.includes('COMMERCIAL') || c.includes('FARE')))
  const hasBookingWindowBlocker = Boolean(!data?.windows?.bookingOpensAt || !data?.windows?.bookingClosesAt || data?.readyBlockers.includes('BOOKING_WINDOW_REQUIRED'))
  const hasPortBlocker = Boolean(data?.readyBlockers.includes('PORTS_NOT_ACTIVE'))
  const hasShipBlocker = Boolean(data?.readyBlockers.some(c => ['NO_SHIP_ASSIGNED', 'SHIP_NOT_ACTIVE', 'SHIP_NOT_CONFIGURED', 'SHIP_SCHEDULE_CONFLICT'].includes(c)))
  const otherBlockers = data ? uniqueConditionCodes(data.readyBlockers.filter(c => !c.includes('PRICE') && !c.includes('TERMS') && !c.includes('COMMERCIAL') && !c.includes('FARE') && c !== 'PLAN_APPROVAL_REQUIRED' && c !== 'BOOKING_WINDOW_REQUIRED' && c !== 'PORTS_NOT_ACTIVE' && !['NO_SHIP_ASSIGNED', 'SHIP_NOT_ACTIVE', 'SHIP_NOT_CONFIGURED', 'SHIP_SCHEDULE_CONFLICT'].includes(c))) : []

  return <Panel title="Bước 2: Xác nhận sẵn sàng mở bán">
   {query.loading&&<Loading label="Đang kiểm tra điều kiện sẵn sàng…"/>}
   {query.error&&<Notice title="Chưa kiểm tra được điều kiện sẵn sàng" tone="error">{safeError(query.error)}</Notice>}
   {data&&<>
    <div className={styles.planStatuses}>
     <Badge label={isReady ? 'Đã sẵn sàng mở bán' : data.readyStatus === 'INVALIDATED' ? 'Cần xác nhận lại' : domainStatus('cruise.ready', data.readyStatus)} tone={isReady ? 'success' : data.readyStatus === 'INVALIDATED' ? 'warning' : 'neutral'}/>
    </div>
    {data.readyAt&&<p className={styles.sectionMeta}>Xác nhận lúc {journeyTime(data.readyAt,SHIP_TIME_ZONE)} · Giờ tàu (Việt Nam)</p>}

    {isReady ? (
     <Notice title="Chuyến khởi hành đã sẵn sàng mở bán" tone="success">
      <p>Kế hoạch khởi hành và chính sách giá đã được Quản lý vận hành xác nhận. Chuyến khởi hành đủ điều kiện để tiến hành mở bán vé.</p>
      {onNextStep && <div className={styles.planActions}><Button tone="primary" onClick={onNextStep}>Tiếp tục: Mở bán</Button></div>}
     </Notice>
    ) : (
     <>
      <p className={styles.sectionMeta}>Quản lý vận hành đối chiếu 3 điều kiện thương mại và kế hoạch trước khi xác nhận sẵn sàng mở bán vé:</p>

      <div className={styles.prepCardGrid} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', margin: '16px 0' }}>
       {/* Hạng mục 1: Kế hoạch khởi hành */}
       <div className={styles.prepCard}>
        <div className={styles.prepCardHeader}>
         <div>
          <span className={styles.prepCardTitle}>1. Kế hoạch khởi hành & Tuyến đi</span>
          <p className={styles.prepCardSubtitle}>Lịch trình chi tiết, điểm đón/trả và thời gian vận hành</p>
         </div>
         <Badge
          label={isPlanApproved ? 'Đã phê duyệt' : 'Chưa phê duyệt'}
          tone={isPlanApproved ? 'success' : 'warning'}
         />
        </div>
        <div className={styles.prepCardBody}>
         <p>{isPlanApproved ? '✓ Kế hoạch đã được Quản lý vận hành xét duyệt hợp lệ.' : 'Kế hoạch hành trình chưa được phê duyệt hoặc cần xét duyệt lại.'}</p>
         {!isPlanApproved && onReview && (
          <div style={{ marginTop: '8px' }}>
           <Button tone="secondary" onClick={onReview}>Xét duyệt kế hoạch tại Bước 1 →</Button>
          </div>
         )}
        </div>
       </div>

       {/* Hạng mục 2: Chính sách giá & Thương mại */}
       <div className={styles.prepCard}>
        <div className={styles.prepCardHeader}>
         <div>
          <span className={styles.prepCardTitle}>2. Chính sách giá & Sản phẩm thương mại</span>
          <p className={styles.prepCardSubtitle}>Giá vé theo hạng cabin, bảng giá gói du thuyền và biểu giá mở bán</p>
         </div>
         <Badge
          label={!hasPricingBlocker ? 'Đã phê duyệt' : 'Cần xét duyệt'}
          tone={!hasPricingBlocker ? 'success' : 'warning'}
         />
        </div>
        <div className={styles.prepCardBody}>
         <p>{!hasPricingBlocker ? '✓ Chính sách giá và các gói thương mại đã được duyệt đủ điều kiện mở bán.' : 'Chính sách giá gói du thuyền cần được Quản lý vận hành phê duyệt độc lập trước khi mở bán.'}</p>
         {hasPricingBlocker && onReview && (
          <div style={{ marginTop: '8px' }}>
           <Button tone="secondary" onClick={onReview}>Kiểm tra và duyệt chính sách giá →</Button>
          </div>
         )}
        </div>
       </div>

       {/* Hạng mục 3: Cấu hình mở bán & Cơ sở vật chất */}
       <div className={styles.prepCard}>
        <div className={styles.prepCardHeader}>
         <div>
          <span className={styles.prepCardTitle}>3. Cấu hình mở bán & Cơ sở vật chất</span>
          <p className={styles.prepCardSubtitle}>Khung thời gian nhận đặt chỗ, trạng thái tàu và cảng bến</p>
         </div>
         <Badge
          label={!hasBookingWindowBlocker && !hasPortBlocker && !hasShipBlocker ? 'Đạt điều kiện' : 'Cần hoàn thiện'}
          tone={!hasBookingWindowBlocker && !hasPortBlocker && !hasShipBlocker ? 'success' : 'warning'}
         />
        </div>
        <div className={styles.prepCardBody}>
         {data.windows?.bookingOpensAt && data.windows?.bookingClosesAt ? (
          <p>✓ Thời gian mở nhận đặt chỗ: {journeyTime(data.windows.bookingOpensAt, SHIP_TIME_ZONE)} đến {journeyTime(data.windows.bookingClosesAt, SHIP_TIME_ZONE)}.</p>
         ) : (
          <p>Chưa cấu hình đầy đủ thời gian mở/đóng nhận đặt vé.</p>
         )}
         {hasPortBlocker && <p className={styles.prepCheckItemFail}>✕ Cảng xuất bến hoặc cập bến chưa được kích hoạt.</p>}
         {hasShipBlocker && <p className={styles.prepCheckItemFail}>✕ Thông tin hoặc trạng thái tàu chưa sẵn sàng.</p>}
        </div>
       </div>
      </div>

      <Notice title="Quy trình nghiệp vụ theo phân kỳ vận hành" tone="neutral">
       <p>Bước 2 kiểm tra kế hoạch, chính sách giá, cửa sổ nhận đặt chỗ và các điều kiện của chuyến như tàu, cabin, cảng và lịch tàu.</p>
       <p>Việc phân công nhân sự trên tàu (Onboard Staff), hoàn thiện 4 nhóm hồ sơ kỹ thuật - dịch vụ và công bố buổi hướng dẫn an toàn sẽ được thực hiện tại <strong>Khâu chuẩn bị trước ngày xuất bến</strong> (khi tàu sắp chạy thực tế).</p>
      </Notice>

      {/* Các điều kiện khác nếu có */}
      {otherBlockers.length > 0 && (
       <Notice title="Điều kiện kỹ thuật khác cần đối chiếu" tone="warning">
        <ul className={styles.conditionList}>
         {otherBlockers.map(code => {
          const target = operationsConditionTarget(code)
          const destination = target && target !== 'review' ? allowedDepartureSections(access).find(([key]) => key === target) : null
          return (
           <li key={code}>
            <ProgramBlocker code={code} data={data} fixed={itineraryMode === 'FIXED'} />
            {target === 'review' && onReview ? <Button tone="text" onClick={onReview}>Xem xét duyệt</Button> : destination && onSection ? <Button tone="text" onClick={() => onSection(destination[0])}>Mở {destination[1].toLocaleLowerCase('vi-VN')}</Button> : null}
           </li>
          )
         })}
        </ul>
       </Notice>
      )}

      {data.readyBlockers.length === 0 && (
       <Notice title="Tất cả điều kiện mở bán đã hoàn tất" tone="success">
        <p>Kế hoạch và chính sách giá thương mại đã sẵn sàng. Bấm nút bên dưới để chính thức xác nhận sẵn sàng mở bán.</p>
       </Notice>
      )}

      <div className={styles.planActions}>
       <Button tone="secondary" disabled={busy || query.loading} onClick={() => query.retry()}>
        Kiểm tra lại điều kiện
       </Button>
       {availableActions.includes('ready') && (
        <Button
         tone="primary"
         disabled={busy || uncertain || query.loading || Boolean(query.error) || data.readyBlockers.length > 0}
         onClick={() => { setAction('ready'); setReason(''); }}
        >
         Xác nhận sẵn sàng mở bán
        </Button>
       )}
      </div>
     </>
    )}
   </>}
   {success&&<Notice title={success} tone="success">Đã ghi nhận xác nhận sẵn sàng.</Notice>}{error&&!action&&<Notice title="Chưa xác nhận được chuyến sẵn sàng" tone="error">{error}</Notice>}
   {uncertain&&!action&&<Notice title="Chưa xác định kết quả">Tải lại trang để đối chiếu trước khi thao tác tiếp.</Notice>}
   {actionDialog}
  </Panel>
 }
 const reviewActions=data&&availableActions.length>0&&<div className={styles.reviewDecision}>
  {availableActions.length>0&&<p>{manager?'Gửi hồ sơ chuyến khởi hành cho Quản lý vận hành.':'Quyết định hồ sơ'}</p>}
  <div className={styles.planActions}>{availableActions.map(a=><Button key={a} tone={a==='submit'||a==='approve'?'primary':a==='reject'?'danger':'secondary'} disabled={busy||uncertain||query.loading||Boolean(query.error)||(a==='submit'&&data.planBlockers.length>0)||(a==='approve'&&evidenceMissing)} onClick={()=>{setAction(a);setReason('');setSuccess('')}}>{a==='submit'?submitLabel:actionLabel(a)}</Button>)}</div>
 </div>
 return <Panel className={styles.reviewPanel}>
  <header className={styles.reviewHeader}><h2>{manager?'Gửi hồ sơ chuyến khởi hành':'Xét duyệt hồ sơ chuyến khởi hành'}</h2><Button tone="text" disabled={busy||query.loading} onClick={query.retry}>Tải lại kế hoạch</Button></header>
  {query.loading&&<Loading/>}{query.error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{safeError(query.error)}<Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
  {data&&<>
   <div className={styles.reviewSummary}>
    <Badge label={approvalNeedsReview?'Phê duyệt trước đó cần xét lại':planReviewStates[data.planStatus].title} tone={approvalNeedsReview?'warning':planReviewStates[data.planStatus].tone}/>
    <p>{approvalNeedsReview?'Nội dung kế hoạch đã thay đổi hoặc còn thiếu. Cần yêu cầu Quản lý lịch trình bổ sung trước khi phê duyệt lại.':readyToSubmit?'Kế hoạch đã đủ thông tin. Đối chiếu hồ sơ chuẩn bị trước khi gửi.':mode==='review'&&data.planStatus==='SUBMITTED'?'Đối chiếu bản kế hoạch đã gửi bên dưới trước khi quyết định.':planReviewStates[data.planStatus].description}</p>
    {data.submittedAt&&<p className={styles.sectionMeta}>Đã gửi lúc {journeyTime(data.submittedAt,SHIP_TIME_ZONE)} · Giờ Việt Nam{data.submittedByName?' · Người gửi: '+data.submittedByName:''}</p>}
    {data.reviewedAt&&<p className={styles.sectionMeta}>Phản hồi lúc {journeyTime(data.reviewedAt,SHIP_TIME_ZONE)} · Giờ Việt Nam</p>}
    {readyToSubmit&&<p className={styles.submitReady}>Đủ thông tin kế hoạch</p>}

   </div>
   {!manager&&mode!=='review'&&<Badge label={data.readyStatus==='INVALIDATED'?'Cần xác nhận lại':domainStatus('cruise.ready',data.readyStatus)}/>}
   {makerReason&&mode==='review'&&data.planStatus==='SUBMITTED'&&<Notice title="Cần người xét duyệt khác">{makerReason}</Notice>}
   {evidenceMissing&&<Notice title="Bằng chứng thương mại chưa đầy đủ" tone="error">Tải lại bản hồ sơ để đối chiếu gói, phiên bản giá và thuế/phí trước khi phê duyệt.</Notice>}
   {data.reason&&<Notice title={data.planStatus==='APPROVED'?'Ghi nhận phê duyệt':'Phản hồi từ Quản lý vận hành'} tone={data.planStatus==='REJECTED'?'error':data.planStatus==='APPROVED'?'info':'warning'}>{data.reason}</Notice>}
   {data.planBlockers.length>0&&<Notice title={businessCopy('cruise.plan.missingInputs')}><ul className={styles.conditionList}>{uniqueConditionCodes(data.planBlockers).map(code=>{const target=manager?code.startsWith('PRICING_')||code.endsWith('WINDOW_REQUIRED')?'overview':operationsConditionTarget(code):null;const destination=target&&target!=='review'?allowedDepartureSections(access).find(([key])=>key===target):null;return <li key={code}><ProgramBlocker code={code} data={data} fixed={itineraryMode==='FIXED'}/>{destination&&onSection&&<Button tone="text" onClick={()=>onSection(destination[0])}>Mở {destination[1].toLocaleLowerCase('vi-VN')}</Button>}</li>})}</ul></Notice>}

   {crm&&mode!=='submit'&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.planStatus)&&<PlanWindows key={`${cruiseId}:${data.windows.expectedRevision}`} data={data} onSaved={()=>{setEpoch(n=>n+1);query.retry()}} editable/>}
   {crm&&data.cruisePackagePricing&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.planStatus)&&<PlanPackageSelection cruiseId={cruiseId} onSaved={()=>{setEpoch(n=>n+1);query.retry();onChanged?.()}}/>}
   {data.unifiedPackageReview&&data.submittedSnapshot!=null&&<FrozenPlanPackages snapshot={data.submittedSnapshot}/>}
   {data.submittedSnapshot!=null&&<details className={styles.snapshotDisclosure} open={mode==='review'}><summary>Nội dung kế hoạch đã gửi</summary><PlanSnapshot snapshot={data.submittedSnapshot} includePricing={mode!=='review'&&mode!=='submit'}/></details>}
   {reviewActions}
  </>}
  {success&&<Notice title={manager?'Kết quả gửi hồ sơ':'Đã ghi nhận quyết định'} tone="success">{success}</Notice>} {error&&!action&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}
  {uncertain&&!action&&<Notice title="Hệ thống chưa xác nhận được kết quả"><Button onClick={()=>{setUncertain(false);setAction(null);setEpoch(n=>n+1);query.retry();onChanged?.()}}>Đối chiếu lại hồ sơ</Button></Notice>}
  {actionDialog}
 </Panel>
}
function PlanWindows({data,onSaved,editable=true}:{data:PlanView;onSaved:()=>void;editable?:boolean}){
 const [open,setOpen]=useState(false),[attempted,setAttempted]=useState(false),[touched,setTouched]=useState<Record<string,boolean>>({})
 const [windows,setWindows]=useState(data.windows),[error,setError]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const fields=[['bookingOpensAt','cruise.window.bookingOpen'],['bookingClosesAt','cruise.window.bookingClose'],['guidanceOpensAt','cruise.window.guidanceOpen'],['guidanceClosesAt','cruise.window.guidanceClose']] as const
 type WindowField=typeof fields[number][0]
 const departure=useReadQuery(`window-departure:${data.cruiseId}:${data.windows.expectedRevision}:${open}`,useCallback(async signal=>{
  if(!open)return null
  const cruise=await apiRequest<{cruiseId:string;departureDatetime:string}>(`/cruise/${encodeURIComponent(data.cruiseId)}`,{signal})
  if(cruise.cruiseId!==data.cruiseId||!Number.isFinite(Date.parse(cruise.departureDatetime)))throw new ApiError('Chưa xác định được giờ khởi hành.',502)
  return cruise.departureDatetime
 },[open,data.cruiseId]))
 const errors:Partial<Record<WindowField,string>>={}
 const departureAt=departure.data?Date.parse(departure.data):null
 const precise=(instant:string)=>new Intl.DateTimeFormat('vi-VN',{timeZone:SHIP_TIME_ZONE,dateStyle:'short',timeStyle:'medium'}).format(new Date(instant))
 for(const [key] of fields)if(!windows[key])errors[key]='Nhập đầy đủ ngày và giờ.'
 if(windows.bookingOpensAt&&windows.bookingClosesAt&&Date.parse(windows.bookingOpensAt)>=Date.parse(windows.bookingClosesAt))errors.bookingClosesAt='Đóng nhận đặt chỗ phải sau thời điểm mở nhận đặt chỗ.'
 if(departureAt!==null&&windows.bookingClosesAt&&Date.parse(windows.bookingClosesAt)>=departureAt)errors.bookingClosesAt='Đóng nhận đặt chỗ phải trước giờ khởi hành: '+precise(departure.data!)+'.'
 if(windows.guidanceOpensAt&&windows.guidanceClosesAt&&Date.parse(windows.guidanceOpensAt)>=Date.parse(windows.guidanceClosesAt))errors.guidanceClosesAt='Kết thúc hướng dẫn phải sau thời điểm bắt đầu hướng dẫn.'
 if(windows.bookingClosesAt&&windows.guidanceOpensAt&&Date.parse(windows.guidanceOpensAt)<Date.parse(windows.bookingClosesAt))errors.guidanceOpensAt='Buổi hướng dẫn phải bắt đầu sau khi đóng nhận đặt chỗ: '+precise(windows.bookingClosesAt)+'.'
 if(departureAt!==null&&windows.guidanceClosesAt&&Date.parse(windows.guidanceClosesAt)>departureAt)errors.guidanceClosesAt='Kết thúc hướng dẫn không được sau giờ khởi hành: '+precise(departure.data!)+'.'
 if(departureAt!==null&&windows.bookingOpensAt&&Date.parse(windows.bookingOpensAt)>=departureAt)errors.bookingOpensAt='Mở nhận đặt chỗ phải trước giờ khởi hành.'
 if(departureAt!==null&&windows.guidanceOpensAt&&Date.parse(windows.guidanceOpensAt)>=departureAt)errors.guidanceOpensAt='Bắt đầu hướng dẫn phải trước giờ khởi hành.'
 async function save(){
  if(lock.current||uncertain||departure.loading||departure.error||!departure.data)return
  setAttempted(true)
  const invalid=fields.find(([key])=>errors[key])
  if(invalid){document.getElementById(invalid[0])?.focus();return}
  lock.current=true;setBusy(true);setError('')
  try{await mainflowApi.windows(data,windows);setOpen(false);onSaved()}
  catch(e){setError(e instanceof ApiError&&e.code==='INVALID_WINDOWS'?'Khung thời gian chưa khớp giờ khởi hành hiện tại. Tải lại giờ khởi hành để đối chiếu rồi chỉnh các mốc trước khi lưu.':safeError(e));if(e instanceof ApiError&&e.code==='INVALID_WINDOWS')departure.retry();if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUncertain(true)}
  finally{lock.current=false;setBusy(false)}
 }
 return <>
  <p className={styles.sectionMeta}>Khung thời gian được thiết lập tự động theo giờ khởi hành (đóng nhận đặt chỗ trước 2–3 ngày để chuyển sang hướng dẫn trước chuyến; đóng cổng trước 2 giờ tàu chạy).</p>
  <RecordFacts entries={fields.map(([key,label])=>[businessCopy(label),data.windows[key]?journeyTime(data.windows[key]!,SHIP_TIME_ZONE):'Chưa thiết lập'] as const)}/>
  {editable&&<Button tone="secondary" disabled={busy||uncertain} onClick={()=>{setWindows(data.windows);setError('');setAttempted(false);setTouched({});setOpen(true)}}>Tùy chỉnh thời gian nhận đặt chỗ và hướng dẫn</Button>}
  {open&&<Modal wide busy={busy} title={businessCopy('cruise.window.title')} description="Tất cả ngày giờ bên dưới theo giờ Việt Nam." onClose={()=>setOpen(false)} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setOpen(false)} data-overlay-dismiss>Hủy</Button><Button type="submit" form="plan-windows-form" disabled={busy||uncertain||departure.loading||Boolean(departure.error)||!departure.data}>{busy?'Đang lưu…':businessCopy('cruise.window.save')}</Button></>}>
   {departure.loading&&<Loading label="Đang tải giờ khởi hành để đối chiếu…"/>}
   {departure.error&&<Notice title="Chưa tải được giờ khởi hành" tone="error"><Button tone="secondary" onClick={departure.retry}>Tải lại giờ khởi hành</Button></Notice>}
   {departure.data&&!departure.loading&&!departure.error&&<p><strong>Khởi hành: {precise(departure.data)} · Giờ Việt Nam</strong></p>}
   <form id="plan-windows-form" noValidate onSubmit={event=>{event.preventDefault();void save()}}>
    <fieldset className={styles.windowFields} disabled={busy||uncertain}><legend>Lịch nhận đặt chỗ và hướng dẫn</legend>{([['Nhận đặt chỗ',fields.slice(0,2)],['Buổi hướng dẫn trước chuyến',fields.slice(2)]] as const).map(([title,group])=><section className={styles.windowGroup} key={title}><h3>{title}</h3><div className={styles.fieldGrid}>{group.map(([key,label])=>{
     const fieldError=attempted||touched[key]?errors[key]:undefined
     const hint=key==='guidanceOpensAt'?'Sau khi đóng nhận đặt chỗ.':key==='guidanceClosesAt'?'Hoàn tất trước khi khởi hành.':undefined
     return <Field key={key} htmlFor={key} label={key==='guidanceOpensAt'?'Bắt đầu buổi hướng dẫn':key==='guidanceClosesAt'?'Kết thúc buổi hướng dẫn':businessCopy(label)} error={fieldError} hint={hint}><input id={key} type="datetime-local" required step={1} max={departure.data?preparationWallTime(departure.data):undefined} value={preparationWallTime(windows[key])} onBlur={()=>setTouched(current=>({...current,[key]:true}))} onChange={e=>{try{setWindows({...windows,[key]:preparationInstant(e.target.value)});setTouched(current=>({...current,[key]:true}));setError('')}catch{setError(businessCopy('program.time.invalid'))}}}/></Field>
    })}</div></section>)}</fieldset>
   </form>
   {error&&<Notice title="Chưa lưu được khung thời gian" tone="error">{error}</Notice>}
   {uncertain&&<Notice title={businessCopy('cruise.window.unconfirmed')}>{businessCopy('cruise.window.reloadBeforeRetry')}</Notice>}
  </Modal>}
 </>
}

function ProgramBlocker({code,data,fixed}:{code:string;data:PlanView;fixed:boolean}){
 const issues=data.programIssues?.filter(issue=>issue.code===code)??[]
 const timeIssue=['ACTIVITY_OUTSIDE_CRUISE','EXCURSION_OUTSIDE_PORT_CALL','SERVICE_OUTSIDE_WINDOW'].includes(code)
 return <div className={styles.conditionBody}><p>{businessErrorMessage(code,'')}</p>
  {issues.length>0&&<ul className={styles.issueDetails}>{issues.map(issue=>{
   const showTime=(instant:string|null)=>instant&&validTimeZone(issue.timeZoneId)?new Intl.DateTimeFormat('vi-VN',{timeZone:issue.timeZoneId,dateStyle:'short',timeStyle:'medium'}).format(new Date(instant)):'Chưa đủ thời gian hoặc múi giờ'
   return <li key={issue.itemId}><strong>{issue.name}</strong>{timeIssue&&<>
    <p>Đang cấu hình: {showTime(issue.startsAt)} → {showTime(issue.endsAt)}</p>
    <p>{issue.kind==='SERVICE'?'Khoảng thời gian cho phép của lịch dịch vụ':issue.kind==='ACTIVITY'?'Thời gian chuyến':'Khoảng thời gian cho phép của lần ghé cảng'}: {showTime(issue.earliestStart)} → {showTime(issue.latestEnd)}</p>
    <p>{issue.kind==='SERVICE'?'Múi giờ lịch dịch vụ':issue.kind==='ACTIVITY'?'Giờ tàu (Việt Nam)':'Giờ địa phương của cảng'}</p>
   </>}</li>
  })}</ul>}
  {timeIssue&&fixed&&<p className={styles.issueHint}>{code==='ACTIVITY_OUTSIDE_CRUISE'?'Lịch trình cố định: mở Chương trình và dịch vụ, chọn “Sửa giờ không hợp lệ” cho hoạt động này. Giờ hợp lệ vẫn khóa chỉnh sửa.':'Lịch trình cố định: giờ tour đang khóa chỉnh sửa. Cần đối chiếu lịch trình nguồn để xử lý lỗi thời gian.'}</p>}
 </div>
}

