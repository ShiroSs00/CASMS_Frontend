import {mainflowApi} from '../api/mainflow-api'
import { useCallback,useState } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { domainStatus } from '@/shared/i18n/business-copy'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, DataTable, Empty, Loading, Notice, Panel,TechnicalDetails,RecordFacts } from '@/shared/ui'
import { decodePricingPolicy } from '../model/pricing-policy'
import {PricingReview} from './PricingReview'
import {readPricingHistory} from '../api/pricing-review'
import {journeyTime} from '@/shared/lib/journey-time'
import { PricingDraftFields } from './PricingDraftFields'
import styles from './DeparturePricingPolicy.module.css'

export function DeparturePricingPolicy({ cruiseId,onChanged,readOnly=false,refreshKey=0,embedded=false,packageManaged=false }: { cruiseId:string;onChanged?:()=>void;readOnly?:boolean;refreshKey?:string|number;embedded?:boolean;packageManaged?:boolean }) {
  const access=useSessionAccess()
  const allowed=['CRUISE_READ','CRUISE_UPDATE_DRAFT','CRUISE_OPEN_SALE','BOOKING_READ'].some(permission=>access.has(permission))
  const query=useReadQuery(`pricing-policy:${access.userId}:${access.status}:${access.permissions.join(',')}:${cruiseId}:${allowed}:${refreshKey}`,useCallback(signal=>
    allowed ? apiRequest<unknown>(`/cruise/${encodeURIComponent(cruiseId)}/pricing-policy`,{signal}).then(value=>decodePricingPolicy(value,cruiseId)) : Promise.resolve(null),[allowed,cruiseId]))
  const policyOwner=!readOnly&&access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_PRICING_APPROVE')
  const plan=useReadQuery(`pricing-editability:${access.userId}:${cruiseId}:${refreshKey}:${policyOwner}:${query.data?.revision}`,useCallback(signal=>policyOwner?mainflowApi.get(cruiseId,signal):Promise.resolve(null),[policyOwner,cruiseId]))
  const editable=Boolean(policyOwner&&plan.data&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(plan.data.planStatus)&&!plan.loading&&!plan.error)
  const [success,setSuccess]=useState(''),[historyOpen,setHistoryOpen]=useState(false)
  const historyAllowed=(historyOpen||(policyOwner&&query.data?.status==='PENDING_APPROVAL'))&&access.has('CRUISE_READ')
  const history=useReadQuery(`policy-history:${access.userId}:${access.status}:${cruiseId}:${refreshKey}:${query.data?.revision}:${historyAllowed}`,useCallback(signal=>historyAllowed?readPricingHistory(cruiseId,signal):Promise.resolve(null),[cruiseId,historyAllowed]))
  const historyLabels:Record<string,string>={SAVE_DRAFT:'Lưu bản chính sách',SUBMIT:'Gửi bản chính sách để duyệt',APPROVE:'Phê duyệt bản chính sách',RETURN:'Yêu cầu chỉnh sửa bản chính sách',PLAN_RECALL:'Thu hồi theo kế hoạch'}
  if(!allowed)return null
  const data=query.data
  const reload=()=>{query.retry();history.retry();plan.retry();onChanged?.()}
  const saved=(message?:string)=>{setSuccess(message??'Đã lưu bản chính sách nháp. Chưa phê duyệt hoặc mở bán.');query.retry();history.retry();onChanged?.()}
  const amount=(value:number|null) => value==null ? 'Chưa thiết lập' : value>Number.MAX_SAFE_INTEGER/10000 ? 'Chưa thể hiển thị chính xác' : data?.currency ? new Intl.NumberFormat('vi-VN',{style:'currency',currency:data.currency,maximumFractionDigits:4}).format(value) : `${value} · Chưa xác định tiền tệ`
  const percent=(value:number|null) => value==null ? 'Chưa thiết lập' : new Intl.NumberFormat('vi-VN',{style:'percent',maximumFractionDigits:2}).format(value)
  const missing=query.error instanceof ApiError&&query.error.status===404&&query.error.code==='PRICING_POLICY_NOT_FOUND'
  const cancellationText=data?.cancellationPolicy?.trim()??''
  const statusLabels=data?.cruisePackagePricing?{DRAFT:'Điều kiện thương mại nháp',PENDING_APPROVAL:'Chờ duyệt thanh toán, hủy và phí',RETURNED:'Điều kiện thương mại cần chỉnh sửa',APPROVED:'Điều kiện thương mại đã được duyệt',ARCHIVED:'Đã lưu trữ'} as const:{DRAFT:'Chính sách thương mại nháp',PENDING_APPROVAL:'Chính sách thương mại chờ xét duyệt',RETURNED:'Chính sách thương mại cần chỉnh sửa',APPROVED:'Chính sách thương mại đã được duyệt',ARCHIVED:'Đã lưu trữ'} as const
  const statusTone=data?.status==='APPROVED'?'success':data?.status==='PENDING_APPROVAL'?'info':data?.status==='RETURNED'?'warning':'neutral'
  const canEdit=editable&&!query.loading&&!query.error&&Boolean(data)&&data?.status!=='PENDING_APPROVAL'
  const cabinFares=data?[
    ['Phòng trong',data.interiorBaseFare],['Phòng hướng biển',data.oceanViewBaseFare],
    ['Phòng ban công',data.balconyBaseFare],['Suite',data.suiteBaseFare],
  ] as const:[]
  return <Panel className={styles.policy}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <div className={styles.titleRow}>{!embedded&&<h2>{packageManaged||data?.cruisePackagePricing?'Chính sách giao dịch':'Chính sách thương mại'}</h2>}{data&&!query.loading&&!query.error&&<Badge label={data.status?statusLabels[data.status]:domainStatus('pricing.policy','UNKNOWN')} tone={statusTone}/>}</div>
        {data&&!query.loading&&!query.error&&<p className={styles.version}>Phiên bản: <span>{data.policyVersion??'Chưa xác định'}</span></p>}
      </div>
      {canEdit&&<div className={styles.headerActions}><PricingDraftFields key={cruiseId} cruiseId={cruiseId} policy={data??undefined} onSaved={saved}/></div>}
    </header>
    {!policyOwner&&access.roles.includes('CRUISE_MANAGER')&&<p>Quản lý vận hành quản lý chính sách thương mại. Bạn chỉ xem và sử dụng chính sách áp dụng cho chuyến.</p>}
    {success&&<Notice title="Đã ghi nhận kết quả" tone="success">{success}</Notice>}
    {query.loading&&<Loading label="Đang tải chính sách giá…"/>}
    {missing&&<Notice title="Chưa thiết lập chính sách giá">{packageManaged?'Chưa cấu hình điều khoản giao dịch cho chuyến này.':'Chưa có chính sách giá cho chuyến khởi hành này.'}</Notice>}
    {query.error&&!missing&&<Notice title="Chưa đọc được chính sách giá" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Thử lại</Button></Notice>}
    {policyOwner&&plan.error&&<Notice title="Chưa xác định được điều kiện chỉnh sửa chính sách"><Button tone="secondary" onClick={plan.retry}>Tải lại trạng thái kế hoạch</Button></Notice>}
    {policyOwner&&data?.status==='RETURNED'&&!query.loading&&!query.error&&<Notice title="Chính sách thương mại cần chỉnh sửa" tone="warning">
      {data.decisionReason&&<p>{data.decisionReason}</p>}
      <p>{editable?'Quản lý vận hành sửa, lưu bản nháp rồi gửi chính sách để xét duyệt riêng.':'Kế hoạch đang khóa chỉnh sửa. Cần yêu cầu bổ sung kế hoạch trước khi Quản lý vận hành sửa chính sách.'}</p>
    </Notice>}
    {data&&!query.loading&&!query.error&&<>
      <RecordFacts entries={[["Lần cập nhật bản chính sách",data.revision??'Chưa xác định'],["Gửi xét duyệt lúc",data.submittedAt?journeyTime(data.submittedAt):'Chưa có thông tin'],["Xét duyệt lúc",data.reviewedAt?journeyTime(data.reviewedAt):'Chưa có thông tin'],["Người phê duyệt",data.status==='APPROVED'?data.approvedByName??'Chưa có tên trong phản hồi':'Chưa có phê duyệt hiện hành']]}/>
      <div className={styles.groups}>{data.cruisePackagePricing&&<p>Giá Gói du thuyền được cấu hình, gửi và duyệt riêng trong mục Gói du thuyền. Phần này lưu điều khoản dùng khi giao dịch. Thuế và phí cảng để mở bán được duyệt riêng ở Điều kiện thương mại mở bán.</p>}
        <section className={styles.group}>
          {!data.cruisePackagePricing&&<><h3>Giá cabin <span className={styles.currency}>· {data.currency??'Chưa xác định tiền tệ'}</span></h3>
          <table className={styles.fares}>
            <caption className={styles.srOnly}>Giá cơ sở theo hạng cabin</caption>
            <thead><tr><th scope="col">Hạng cabin</th><th scope="col">Giá cơ sở</th></tr></thead>
            <tbody>{cabinFares.map(([label,value])=><tr key={label}><th scope="row">{label}</th><td>{amount(value)}</td></tr>)}</tbody>
          </table></>}
          <dl className={styles.portFee}><div><dt>Phí cảng mỗi khách</dt><dd>{amount(data.portFeePerPassenger)}</dd></div></dl>
        </section>
        <section className={styles.group}>
          <h3>Thuế và thanh toán</h3>
          <dl className={styles.terms}>
            <div><dt>Thuế suất</dt><dd>{percent(data.taxRate)}</dd></div>
            <div><dt>Tỷ lệ đặt cọc</dt><dd>{percent(data.depositPercentage)}</dd></div>
            <div><dt>Hạn trả phần còn lại</dt><dd>{data.finalPaymentDueDays==null?'Chưa thiết lập':`${data.finalPaymentDueDays} ngày trước khởi hành`}</dd></div>
            <div><dt>Đặt sát ngày phải trả đủ</dt><dd>{data.fullPaymentCutoffDays==null?'Chưa thiết lập':`Đặt trong vòng ${data.fullPaymentCutoffDays} ngày trước khởi hành`}</dd></div>
          </dl>
        </section>
      </div>
      <section className={styles.cancellation}>
        <h3>Chính sách hủy đặt chỗ</h3>
        <p>{cancellationText?data.cancellationPolicy:'Chưa thiết lập chính sách hủy đặt chỗ.'}</p>
      </section>
      {access.has('CRUISE_READ')&&<details open={historyOpen} onToggle={event=>setHistoryOpen(event.currentTarget.open)}><summary>Lịch sử bản chính sách thương mại</summary>
        {history.loading&&<Loading label="Đang tải lịch sử…"/>}{history.error&&<Notice title="Chưa tải được lịch sử" tone="error">{history.error.message}<Button onClick={history.retry}>Tải lại lịch sử</Button></Notice>}
        {!history.loading&&!history.error&&history.data&&(history.data.length?<DataTable label="Lịch sử bản chính sách thương mại" headers={['Thời điểm','Lần cập nhật','Thao tác','Lý do và đối chiếu']}>
          {history.data.map((event,index)=><tr key={`${event.policyId}:${event.revision}:${event.action}:${index}`}><td>{journeyTime(event.createdAt)}</td><td>{event.revision}</td><td>{historyLabels[event.action]??'Thao tác cần đối chiếu'}</td><td>{event.reason??'Không có lý do được ghi nhận'}<TechnicalDetails entries={[["Bản chính sách",event.policyId],["Tài khoản thực hiện",event.actorId],["Mã thao tác",event.action]]}/></td></tr>)}
        </DataTable>:<Empty title="Chưa có lịch sử bản chính sách"/>)}
      </details>}
      {!readOnly&&access.roles.includes('OPERATIONS_MANAGER')&&<div className={styles.review}><PricingReview policy={data} onSaved={saved} onReload={reload} maker={data.submittedBy===access.userId||Boolean(history.data?.some(event=>event.policyId===data.pricingPolicyId&&event.action==='SAVE_DRAFT'&&event.actorId===access.userId))} reviewEvidenceReady={!history.loading&&!history.error&&Boolean(history.data)}/></div>}
    </>}
    {editable&&missing&&!query.loading&&<PricingDraftFields key={cruiseId} cruiseId={cruiseId} onSaved={saved}/>}
  </Panel>
}



