import {useReadQuery} from '@/shared/api'
import {mainflowApi} from '../api/mainflow-api'
import {CruisePlanReview} from '../components/CruisePlanReview'
import {DeparturePricingPolicy} from '../components/DeparturePricingPolicy'
import {CruisePrograms} from '../components/CruisePrograms'
import {domainStatus} from '@/shared/i18n/business-copy'
import {CruiseGuidance} from '../components/CruiseGuidance'
import { PreparationEvidence } from '../components/PreparationEvidence'
import {CruisePlanWorkspace} from '../components/CruisePlanWorkspace'
import {CruisePlanSubmission} from '../components/CruisePlanSubmission'
import {CruiseChangeTools} from '../components/CruiseChangeTools'
import { DepartureMilestones } from '../components/DepartureMilestones'
import {ReadinessIssues} from '../components/ReadinessIssues'
import { DeparturePackageManager } from '../components/DeparturePackageManager'
import { DepartureProgramSync } from '../components/DepartureProgramSync'
import { RecordFacts } from '@/shared/ui'
import { journeyTime } from '@/shared/lib/journey-time'
import { PermissionLink as Link } from '@/shared/ui'
import { DepartureScheduleRead, DepartureInventory, DepartureSaleReadiness, DepartureHandoff } from '../components/DepartureData'
import { CruiseOperations } from '../components/CruiseOperations'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'

import { Badge, Button, ButtonLink, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'

import { CruiseFrame, CruiseStatusBadge } from '../components/CruiseUI'
import { ShipAssignmentDialog, type AssignmentMode } from '../components/ShipAssignmentDialog'
import { cruiseApi } from '../api/cruise-api'
import styles from '../components/Cruises.module.css'
import { useCruiseDetail } from '../hooks/useCruiseDetail'
import { type ReadinessCheck } from '../model/cruise-view'
import { CruiseChecks } from '../components/CruiseChecks'
import { DepartureTabs, PreparationOverview, ProgramDestinations } from '../components/DeparturePreparation'
import { operationsSectionStage, allowedDepartureSections, preparationSection, preparationIssueSection, cruiseListReturn, type DepartureSection } from '../model/preparation'
import preparationStyles from '../components/DeparturePreparation.module.css'

const lifecyclePermissions = { publish: 'CRUISE_PUBLISH', start: 'CRUISE_START', complete: 'CRUISE_COMPLETE', cancel: 'CRUISE_CANCEL' } as const

function formatDateTime(value: string) {
  return journeyTime(value)
}

function checkTone(state: ReadinessCheck['state']) {
  if (state === 'PASS') return 'success' as const
  if (state === 'BLOCKED') return 'error' as const
  return 'warning' as const
}

export function CruiseDetailPage() {
  const access = useSessionAccess()
  const operations=access.roles.includes('OPERATIONS_MANAGER')
  const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
  const sectionLabel=(key:DepartureSection)=>allowedDepartureSections(access).find(([section])=>section===key)?.[1]
  const { cruiseId } = useParams()
  const { state, refresh } = useCruiseDetail(cruiseId)
  const [params,setParams]=useSearchParams(),[checkEpoch,setCheckEpoch]=useState(0)
  const canReadCrmPlan=manager&&access.has('CRUISE_READ')
  const crmPlan=useReadQuery(`crm-plan-controls:${cruiseId}:${checkEpoch}:${canReadCrmPlan}`,useCallback(signal=>canReadCrmPlan&&cruiseId?mainflowApi.get(cruiseId,signal):Promise.resolve(null),[canReadCrmPlan,cruiseId]))
  const crmCanEdit=Boolean(crmPlan.data&&!crmPlan.loading&&!crmPlan.error&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(crmPlan.data.planStatus))
  const requestedSection=preparationSection(params.get('section'))
  const section=allowedDepartureSections(access).some(([key])=>key===requestedSection)?requestedSection:'overview'
  const reviewStep=(manager||operations)&&params.get('step')==='review'
  const operationsChecks=operations&&!reviewStep&&operationsSectionStage(section)===3
  const operationsStep=reviewStep?2:operationsChecks?3:1
  const canViewChecks=allowedDepartureSections(access).some(([key])=>key==='checks')
  const previousView=useRef({section,reviewStep})
  useEffect(()=>{
    const before=previousView.current
    if(before.section!==section||before.reviewStep!==reviewStep){
      const target=before.reviewStep!==reviewStep?document.getElementById('departure-steps'):window.matchMedia('(max-width:900px)').matches?document.getElementById('departure-tab-'+section)?.closest('[role=tablist]'):document.getElementById('departure-content')
      target?.scrollIntoView({block:'start'})
      previousView.current={section,reviewStep}
    }
  },[section,reviewStep])
  useEffect(()=>{
    if(access.status==='ready'&&params.has('section')&&params.get('section')!==section){
      const query=new URLSearchParams(params);query.set('section',section);setParams(query,{replace:true})
    }
  },[access.status,params,section,setParams])
  const goSection=(next:DepartureSection)=>{const query=new URLSearchParams(params);query.delete('step');query.set('section',allowedDepartureSections(access).some(([key])=>key===next)?next:'overview');setParams(query)}
  const goPreparationStep=(step:2|3)=>{const query=new URLSearchParams(params);query.set('section','overview');if(step===3)query.set('step','review');else query.delete('step');setParams(query)}
  const goOperationsStep=(step:1|2|3)=>{const query=new URLSearchParams(params);query.set('section',step===3?(allowedDepartureSections(access).some(([key])=>key==='preparation')?'preparation':'checks'):'overview');if(step===2)query.set('step','review');else query.delete('step');setParams(query)}
  const reload=()=>{setCheckEpoch(value=>value+1);return refresh()}
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode | null>(null)
  const [lifecycleAction, setLifecycleAction] = useState<'publish' | 'start' | 'complete' | 'cancel' | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [lifecycleError, setLifecycleError] = useState('')
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [lifecycleSuccess, setLifecycleSuccess] = useState('')
  const mutationLock = useRef(false)

  async function confirmLifecycle() {
    if(lifecycleAction==='publish'&&state.data?.cruise.sourceVersionId)return
    if (lifecycleAction==='cancel'&&state.data?.cruise.status==='DRAFT')return
    if (!cruiseId || !lifecycleAction || mutationLock.current || !access.canDo(lifecyclePermissions[lifecycleAction])) return
    mutationLock.current = true
    setLifecycleSuccess('')
    setLifecycleBusy(true)
    setLifecycleError('')
    try {
      if (lifecycleAction === 'publish') {
        const readiness = await cruiseApi.readiness(cruiseId)
        if (!readiness.ready) throw new Error(readiness.issues?.join(' · ') || 'Chuyến đi chưa đủ điều kiện công bố.')
      }
      if (lifecycleAction === 'cancel') await cruiseApi.cancel(cruiseId, cancelReason.trim())
      else await cruiseApi[lifecycleAction](cruiseId)
      setLifecycleAction(null)
      setCancelReason('')
      await reload()
      setLifecycleSuccess(lifecycleAction==='publish'?'Lần khởi hành đã công bố. Thao tác này chưa xác nhận mở bán.':'Đã cập nhật trạng thái lần khởi hành.')
    } catch (error) {
      setLifecycleError(error instanceof Error ? error.message : 'Không cập nhật được trạng thái chuyến đi.')
    } finally {
      mutationLock.current = false
      setLifecycleBusy(false)
    }
  }

  return <CruiseFrame>
    <div className={preparationStyles.workspace}>
      {lifecycleSuccess && <Notice title="Đã cập nhật" tone="success">{lifecycleSuccess}</Notice>}
      {state.status === 'loading' && !state.data && <Loading label="Đang tải chi tiết chuyến đi…" />}
      {state.status === 'error' && <Notice title="Không tải được chuyến đi" tone="error"><p>{state.error}</p><Button onClick={()=>void reload()}>Thử lại</Button></Notice>}
      {state.data && (() => {
        const detail = state.data
        const cruise = detail.cruise
        const assignmentReason = detail.ship
          ? detail.assignmentCapabilities.change.reason ?? detail.assignmentCapabilities.unassign.reason
          : detail.assignmentCapabilities.assign.reason
        return <>
          {detail.supplementaryLoading && <Loading label="Đang tải thông tin liên quan đến chuyến…" />}
          {Object.entries(detail.supplementaryErrors ?? {}).map(([key, message]) => <Notice key={key} title={`Chưa tải được ${{ ship: 'tàu', departurePort: 'cảng đi', returnPort: 'cảng về', readiness: 'điều kiện sẵn sàng', capacity: 'sức chứa', issues: 'sự cố', regulations: 'quy định', itinerary: 'lịch trình' }[key] ?? 'thông tin liên quan'}`} tone="error"><p>{message}</p><Button onClick={()=>void reload()}>Thử lại</Button></Notice>)}
          <PageHeader breadcrumb="VẬN HÀNH / LẦN KHỞI HÀNH" title={`${cruise.cruiseCode} · ${cruise.cruiseName}`} description={`${formatDateTime(cruise.departureDatetime)} → ${formatDateTime(cruise.returnDatetime)} · ${detail.ship?.shipName ?? (cruise.shipId ? 'Chưa tải được thông tin tàu' : 'Chưa phân công')}`} actions={!reviewStep&&(!manager||crmCanEdit)&&cruise.status === 'DRAFT' && access.canDo('CRUISE_UPDATE_DRAFT') && <ButtonLink to={`/admin/cruises/${cruise.cruiseId}/edit`} tone="secondary">Chỉnh sửa lần khởi hành</ButtonLink>} />
          <div className={preparationStyles.objectToolbar}>{manager&&<span>Trạng thái lần khởi hành:</span>}<CruiseStatusBadge status={cruise.status}/><Link to={cruiseListReturn(params.get('returnTo'))}>Danh sách lần khởi hành</Link><Button tone="text" disabled={state.status==='loading'||lifecycleBusy} onClick={()=>void reload()}>Tải lại</Button></div>
          {(cruise.sourceVersionId||manager||operations)&&<div id="departure-steps" className={preparationStyles.stepNavigation}><DepartureMilestones sourceConfigured={Boolean(cruise.sourceVersionId)} operationsStep={operations?operationsStep:undefined} onOperationsStepChange={operations?goOperationsStep:undefined} receivingBookings={detail.itinerary?.status==='OPEN_FOR_SALE'} activeStep={manager?(reviewStep?3:2):undefined} onStepChange={manager?goPreparationStep:undefined}/></div>}
          {!reviewStep&&section!=='changes'&&<DepartureTabs operationsStage={operations?(operationsChecks?3:1):undefined} section={section} onChange={goSection}/>}
          {operations&&access.has('CRUISE_READ')&&<div className={preparationStyles.compactActions}><Button tone="text" onClick={()=>goSection(section==='changes'?'overview':'changes')}>{section==='changes'?'Quay lại kế hoạch':'Thay đổi lịch và theo dõi xử lý'}</Button></div>}
          <div id="departure-content">
          {reviewStep?(operations?<section className={preparationStyles.content} aria-label="Bước 2 · Xét duyệt kế hoạch và giá"><h2>Bước 2 · Xét duyệt kế hoạch và giá</h2><DeparturePricingPolicy cruiseId={cruise.cruiseId} refreshKey={`${checkEpoch}:${cruise.revision}`} onChanged={()=>void reload()}/><CruisePlanReview itineraryMode={cruise.itineraryMode} cruiseId={cruise.cruiseId} refreshKey={`${checkEpoch}:${cruise.revision}`} onChanged={()=>void reload()} mode="review"/><Button tone="secondary" onClick={()=>goOperationsStep(3)}>Tiếp tục: Kiểm tra và mở bán</Button></section>:<CruisePlanSubmission detail={detail} refreshKey={`${checkEpoch}:${cruise.revision}`} onChanged={()=>void reload()} onPrepare={()=>goPreparationStep(2)} onSection={goSection}/>):<>
            <section id={"departure-panel-overview"} role={"tabpanel"} aria-labelledby={"departure-tab-overview"} hidden={section!=='overview'} className={preparationStyles.content}>
              <Panel title="Thông tin lần khởi hành"><RecordFacts entries={[
                ['Khởi hành',formatDateTime(cruise.departureDatetime)],['Kết thúc',formatDateTime(cruise.returnDatetime)],['Cảng đi',detail.departurePort.portName],['Cảng về',detail.returnPort.portName],
              ]}/><details><summary>Thông tin tuyến và cấu trúc lịch</summary><RecordFacts entries={[
                ['Mã lần khởi hành',cruise.cruiseCode],['Phạm vi',domainStatus('source.scope',cruise.plannedScope??'UNKNOWN')],['Thời lượng chuyến',domainStatus('cruise.duration',cruise.cruiseType)],['Loại tuyến',domainStatus('route.type',detail.itinerary?.itineraryType??'UNKNOWN')],['Cấu trúc lịch',domainStatus('cruise.itinerary',cruise.itineraryMode??'UNKNOWN')],
              ]}/></details></Panel>
              <CruisePlanWorkspace cruiseId={cruise.cruiseId} refreshKey={`${checkEpoch}:${cruise.revision}`} onChanged={()=>void reload()} onSection={goSection} sections={allowedDepartureSections(access).map(([key])=>key)} onReview={()=>goPreparationStep(3)}/>{!cruise.sourceVersionId&&<PreparationOverview detail={detail} loading={state.status==='loading'} onSection={goSection}/>}
              {operations&&section==='overview'&&<Button onClick={()=>goOperationsStep(2)}>Tiếp tục: Xét duyệt kế hoạch và giá</Button>}


            </section>
            <section id={"departure-panel-schedule"} role={"tabpanel"} aria-labelledby={"departure-tab-schedule"} hidden={section!=='schedule'} className={preparationStyles.content}><div className={preparationStyles.sectionIntro}><h2>Lịch thực tế</h2></div>{section==='schedule'&&access.has('CRUISE_READ')&&<DepartureScheduleRead cruise={cruise}/>}
</section>
            <section id={"departure-panel-resources"} role={"tabpanel"} aria-labelledby={"departure-tab-resources"} hidden={section!=='resources'} className={preparationStyles.content}><div className={preparationStyles.sectionIntro}><h2>{sectionLabel('resources')}</h2></div>
              {access.can({mode:'ANY',permissions:['SHIP_READ','CRUISE_ASSIGN_SHIP','CRUISE_CHANGE_SHIP','CRUISE_UNASSIGN_SHIP']}) && <Panel title="Tàu được phân công" subtitle={detail.ship ? `${({ACTIVE:'Đang hoạt động',MAINTENANCE:'Đang bảo trì',INACTIVE:'Ngừng hoạt động'} as Record<string,string>)[detail.ship.status]??'Chưa xác định'} · ${detail.ship.totalCapacity} khách` : cruise.shipId?'Chưa tải được thông tin tàu đã phân công':'Lần khởi hành chưa được phân công tàu'}>
                {detail.ship&&<p className={preparationStyles.shipIdentity}>{detail.ship.shipName}</p>}


                {detail.ship&&access.has('SHIP_READ')&&<p><Link to={`/admin/ships/${encodeURIComponent(detail.ship.shipId)}`}>Xem hồ sơ tàu được phân công</Link></p>}
                {!detail.ship && (access.canDo('CRUISE_ASSIGN_SHIP') ? <Button disabled={!detail.assignmentCapabilities.assign.allowed || !access.canDo('CRUISE_ASSIGN_SHIP')} onClick={() => setAssignmentMode('assign')}>Phân công tàu</Button> : null)}
                {detail.ship && <div className={preparationStyles.actionGroup}>{access.canDo('CRUISE_CHANGE_SHIP') && <Button disabled={!detail.assignmentCapabilities.change.allowed || !access.canDo('CRUISE_CHANGE_SHIP')} onClick={() => setAssignmentMode('change')}>Đổi tàu</Button>}{access.canDo('CRUISE_UNASSIGN_SHIP') && <Button tone="danger" disabled={!detail.assignmentCapabilities.unassign.allowed || !access.canDo('CRUISE_UNASSIGN_SHIP')} onClick={() => setAssignmentMode('unassign')}>Gỡ tàu</Button>}</div>}
                {assignmentReason && <p className={styles.muted}>{assignmentReason}</p>}
              </Panel>}

              {access.canDo('CRUISE_STAFF_READ')&&<CruiseOperations key={cruise.cruiseId+':staff'} cruiseId={cruise.cruiseId} view="staff" onChanged={()=>void reload()}/>}
              {access.canDo('CRUISE_REGULATION_READ') && <Panel title={`Quy định vận hành${detail.supplementaryLoading || detail.supplementaryErrors?.regulations ? '' : ` · ${detail.regulations.length}`}`}>
            <p>Danh sách này hỗ trợ đối chiếu hồ sơ an toàn; không xác nhận giấy phép cảng hay thay thế việc kiểm tra điều kiện của thuyền viên.</p>
            {detail.regulations.length ? <ul className={styles.compactList}>{detail.regulations.map((regulation) => <li key={regulation.regulationId}><strong>{regulation.code} · {regulation.name}</strong><span>{regulation.source} · {regulation.status}</span></li>)}</ul> : !detail.supplementaryLoading && !detail.supplementaryErrors?.regulations && <Empty title="Chưa có quy định áp dụng" />}
            <ButtonLink to={`/admin/cruises/${cruise.cruiseId}/regulations`}>Quản lý quy định</ButtonLink>
          </Panel>}

            </section>
            <section id={"departure-panel-program"} role={"tabpanel"} aria-labelledby={"departure-tab-program"} hidden={section!=='program'} className={preparationStyles.content}><div className={preparationStyles.sectionIntro}><h2>Chương trình và dịch vụ</h2>{!operations&&<p>Quản lý hoạt động, tour và khung phục vụ của lần khởi hành.</p>}</div>
              {section==='program'&&<CruisePrograms cruiseId={cruise.cruiseId} itineraryMode={cruise.itineraryMode} onChanged={()=>void reload()}/>}{!manager&&!operations&&<details className={preparationStyles.secondarySection}><summary>Gói áp dụng cho lần khởi hành</summary><div className={preparationStyles.secondaryBody}>{section==='program'&&<DeparturePackageManager cruiseId={cruise.cruiseId} onChanged={()=>void reload()}/>}</div></details>}{!manager&&!operations&&<ProgramDestinations detail={detail}/>}{!manager&&!operations&&<details className={preparationStyles.secondarySection}><summary>Đồng bộ chương trình từ nguồn</summary><div className={preparationStyles.secondaryBody}>{section==='program'&&<DepartureProgramSync cruise={cruise} onChanged={()=>void reload()}/>}</div></details>}</section>
            {section==='preparation'&&<section id="departure-panel-preparation" role="tabpanel" aria-labelledby="departure-tab-preparation"><PreparationEvidence cruiseId={cruise.cruiseId} refreshKey={cruise.revision??0} onChanged={()=>void reload()}/></section>}
            {section==='changes'&&access.roles.includes('OPERATIONS_MANAGER')&&<section id="departure-panel-changes" role="tabpanel" aria-labelledby="departure-tab-changes"><CruiseChangeTools cruise={cruise} onChanged={()=>void reload()}/></section>}
            {!manager&&<section id={"departure-panel-sales"} role={"tabpanel"} aria-labelledby={"departure-tab-sales"} hidden={section!=='sales'} className={preparationStyles.content}><div className={preparationStyles.sectionIntro}><h2>{sectionLabel('sales')}</h2><p>{access.canDo('CRUISE_MANIFEST_READ')?'Theo dõi cabin, sức chứa và danh sách hành khách của lần khởi hành.':'Theo dõi tồn cabin và sức chứa của lần khởi hành.'}</p></div>
              {section==='sales'&&<><DepartureInventory cruise={cruise}/></>}
              {access.canDo('CRUISE_VALIDATE') && <Panel title="Sức chứa hành khách"><div className={styles.capacityValue}>{detail.capacity.activePassengerCount ?? '—'} / {detail.capacity.shipTotalCapacity ?? '—'}</div><p>Còn {detail.capacity.remainingPassengerHeadroom ?? '—'} chỗ theo sức chứa tàu.</p><p className={styles.muted}>Không đồng nghĩa cabin hoặc hạng cabin còn khả dụng.</p></Panel>}


              {access.canDo('CRUISE_MANIFEST_READ')&&<CruiseOperations key={cruise.cruiseId+':guests'} cruiseId={cruise.cruiseId} view="guests"/>}
              {access.can({mode:'ANY',permissions:['CHECKIN_READ','CHECKIN_CREATE','CHECKIN_UPDATE']})&&<details><summary>Đón khách và hướng dẫn an toàn</summary><CruiseOperations cruiseId={cruise.cruiseId} view="guidance"/></details>}
            </section>}
            {operations&&section==='guidance'&&<section id="departure-panel-guidance" role="tabpanel" aria-labelledby="departure-tab-guidance"><CruiseGuidance cruiseId={cruise.cruiseId} onChanged={()=>void reload()}/></section>}
            {operations&&section==='handoff'&&access.has('CRUISE_MANIFEST_READ')&&<section id="departure-panel-handoff" role="tabpanel" aria-labelledby="departure-tab-handoff"><DepartureHandoff cruise={cruise} onGuests={()=>goSection('sales')}/></section>}
            {canViewChecks&&<section id={"departure-panel-checks"} role={"tabpanel"} aria-labelledby="departure-tab-checks" hidden={section!=='checks'} className={preparationStyles.content}>{operations&&section==='checks'&&<CruisePlanReview itineraryMode={cruise.itineraryMode} cruiseId={cruise.cruiseId} refreshKey={`${checkEpoch}:${cruise.revision}`} onChanged={()=>void reload()} mode="ready" onSection={goSection} onReview={()=>goOperationsStep(2)}/>}{section==='checks'&&access.has('CRUISE_READ')&&<DepartureSaleReadiness key={cruise.cruiseId+':'+checkEpoch} cruise={cruise} onSection={goSection} onReview={operations?()=>goOperationsStep(2):undefined} onChanged={()=>void reload()}/>}{!operations&&section==='checks'&&access.canDo('CRUISE_VALIDATE')&&<ReadinessIssues items={detail.readiness.details} cruiseId={cruise.cruiseId} shipId={cruise.shipId}/>}
              {!operations&&(state.status==='loading'?<Loading label="Đang cập nhật điều kiện vận hành…"/>:<>{access.canDo('CRUISE_VALIDATE') && <><CruiseChecks key={cruise.cruiseId+':'+checkEpoch} cruiseId={cruise.cruiseId} /><Panel title="Điều kiện sẵn sàng vận hành" ><>{detail.readiness.evaluatedAt&&<p>Kiểm tra lúc {formatDateTime(detail.readiness.evaluatedAt)}{detail.readiness.cruiseRevision!=null?` · Revision ${detail.readiness.cruiseRevision}`:""}</p>}{detail.readiness.stale&&<Notice title="Kết quả cần kiểm tra lại" tone="warning">Dữ liệu lần khởi hành đã thay đổi sau thời điểm đánh giá. Tải lại để lấy kết quả mới.</Notice>}</><ul className={styles.compactList}>{detail.readiness.checks.map((check) => <li key={check.key}><span><Badge label={check.state === 'PASS' ? 'Đạt' : check.state === 'BLOCKED' ? 'Chưa đạt' : 'Chưa xác định'} tone={checkTone(check.state)} /> <strong>{check.label}</strong></span><span>{check.reason}</span>{check.state!=='PASS'&&<Button tone="text" onClick={()=>goSection(allowedDepartureSections(access).some(([key])=>key===preparationIssueSection(check))?preparationIssueSection(check):'checks')}>Đi xử lý</Button>}</li>)}</ul>{detail.readiness.issues?.map((issue) => <Notice key={issue} title="Cần kiểm tra" tone="warning">{issue}</Notice>)}</Panel></>}
</>)}
              {((cruise.status==='DRAFT'&&!cruise.sourceVersionId&&access.canDo('CRUISE_PUBLISH'))||(cruise.status==='PUBLISHED'&&access.canDo('CRUISE_START'))||(cruise.status==='IN_PROGRESS'&&access.canDo('CRUISE_COMPLETE'))||(!['COMPLETED','CANCELLED'].includes(cruise.status)&&access.canDo('CRUISE_CANCEL'))) && <Panel title="Vận hành chuyến" >
                <div className={styles.lifecycleActions}>
                  {cruise.status === 'DRAFT' && !cruise.sourceVersionId && (access.canDo('CRUISE_PUBLISH') ? <Button disabled={lifecycleBusy || !access.canDo('CRUISE_PUBLISH') || state.status !== 'ready' || detail.readiness.state !== 'READY'} onClick={() => setLifecycleAction('publish')}>Phát hành lần khởi hành</Button> : null)}
                  {cruise.status === 'PUBLISHED' && (access.canDo('CRUISE_START') ? <Button disabled={lifecycleBusy || !access.canDo('CRUISE_START') || detail.ship?.status !== 'ACTIVE'} onClick={() => setLifecycleAction('start')}>Bắt đầu vận hành</Button> : null)}
                  {cruise.status === 'IN_PROGRESS' && (access.canDo('CRUISE_COMPLETE') ? <Button disabled={lifecycleBusy || !access.canDo('CRUISE_COMPLETE')} onClick={() => setLifecycleAction('complete')}>Kết thúc lần khởi hành</Button> : null)}
                  {!['DRAFT', 'COMPLETED', 'CANCELLED'].includes(cruise.status) && (access.canDo('CRUISE_CANCEL') ? <Button tone="danger" disabled={lifecycleBusy || !access.canDo('CRUISE_CANCEL')} onClick={() => setLifecycleAction('cancel')}>Hủy lần khởi hành</Button> : null)}
                  {['COMPLETED', 'CANCELLED'].includes(cruise.status) && <p className={styles.muted}>Chuyến đi đã kết thúc hoặc đã hủy, không còn thao tác chuyển trạng thái.</p>}
                </div>
              </Panel>}

              {access.canDo('OPERATIONAL_ISSUE_READ') && <Panel title={detail.supplementaryLoading || detail.supplementaryErrors?.issues ? 'Sự cố liên quan' : `Sự cố liên quan · ${detail.issues.filter((issue) => issue.status === 'OPEN' || issue.status === 'IN_PROGRESS').length} đang mở`}>
            {detail.issues.length ? <ul className={styles.compactList}>{detail.issues.map((issue) => <li key={issue.issueId}><span><Badge label={issue.severity} tone={issue.severity === 'CRITICAL' ? 'error' : 'warning'} /> <strong>{issue.issueCode}</strong></span><span>{issue.description} · {issue.status}</span></li>)}</ul> : !detail.supplementaryLoading && !detail.supplementaryErrors?.issues && <Empty title="Không có sự cố liên quan" />}
            <Link className={styles.inlineLink} to={`/admin/issues?cruise=${cruise.cruiseId}`}>Xem danh sách sự cố →</Link>
          </Panel>}

            </section>}
          </>}
          </div>
          {manager&&!reviewStep&&<div className={preparationStyles.reviewFooter}><Button onClick={()=>goPreparationStep(3)}>Kiểm tra và gửi OPS</Button></div>}
          {assignmentMode && access.canDo(assignmentMode === 'assign' ? 'CRUISE_ASSIGN_SHIP' : assignmentMode === 'change' ? 'CRUISE_CHANGE_SHIP' : 'CRUISE_UNASSIGN_SHIP') && <ShipAssignmentDialog detail={detail} mode={assignmentMode} onClose={() => setAssignmentMode(null)} onChanged={() => { void reload(); setLifecycleSuccess('Đã cập nhật phân công tàu.') }} />}
          {lifecycleAction && access.canDo(lifecyclePermissions[lifecycleAction]) && <Modal busy={lifecycleBusy} title='Xác nhận chuyển trạng thái' onClose={() => { if (!lifecycleBusy) setLifecycleAction(null) }} footer={<div className={styles.dialogActions}>
<Button tone="secondary" disabled={lifecycleBusy} onClick={() => setLifecycleAction(null)} data-overlay-dismiss>Quay lại</Button>
<Button tone={lifecycleAction === 'cancel' ? 'danger' : 'primary'} disabled={lifecycleBusy || (lifecycleAction === 'cancel' && !cancelReason.trim())} onClick={() => void confirmLifecycle()}>{lifecycleBusy ? 'Đang xử lý…' : {publish:'Phát hành lần khởi hành',start:'Bắt đầu vận hành',complete:'Kết thúc lần khởi hành',cancel:'Hủy lần khởi hành'}[lifecycleAction]}</Button>
</div>}>
            <p>{cruise.cruiseCode} · {({publish:'Phát hành lần khởi hành',start:'Bắt đầu vận hành',complete:'Kết thúc lần khởi hành',cancel:'Hủy lần khởi hành'}[lifecycleAction])}</p>
            {lifecycleAction === 'cancel' && <Field htmlFor="cancel-reason" label="Lý do hủy"><textarea id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} /></Field>}
            {lifecycleError && <Notice title="Không thể cập nhật" tone="error"><p>{lifecycleError}</p></Notice>}

          </Modal>}
        </>
      })()}
    </div>
  </CruiseFrame>
}
