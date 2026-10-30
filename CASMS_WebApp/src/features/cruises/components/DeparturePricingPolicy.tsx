import {mainflowApi} from '../api/mainflow-api'
import { useCallback } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { domainStatus } from '@/shared/i18n/business-copy'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Loading, Notice, Panel } from '@/shared/ui'
import { decodePricingPolicy } from '../model/pricing-policy'
import {PricingReview} from './PricingReview'
import { PricingDraftFields } from './PricingDraftFields'
import styles from './DeparturePricingPolicy.module.css'

export function DeparturePricingPolicy({ cruiseId,onChanged,readOnly=false,refreshKey=0 }: { cruiseId:string;onChanged?:()=>void;readOnly?:boolean;refreshKey?:string|number }) {
  const access=useSessionAccess()
  const allowed=['CRUISE_READ','CRUISE_UPDATE_DRAFT','CRUISE_OPEN_SALE','BOOKING_READ'].some(permission=>access.has(permission))
  const query=useReadQuery(`pricing-policy:${access.userId}:${access.status}:${access.permissions.join(',')}:${cruiseId}:${allowed}:${refreshKey}`,useCallback(signal=>
    allowed ? apiRequest<unknown>(`/cruise/${encodeURIComponent(cruiseId)}/pricing-policy`,{signal}).then(value=>decodePricingPolicy(value,cruiseId)) : Promise.resolve(null),[allowed,cruiseId]))
  const crmEditor=!readOnly&&access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_UPDATE_DRAFT')
  const plan=useReadQuery(`pricing-editability:${access.userId}:${cruiseId}:${refreshKey}:${crmEditor}:${query.data?.revision}`,useCallback(signal=>crmEditor?mainflowApi.get(cruiseId,signal):Promise.resolve(null),[crmEditor,cruiseId]))
  const editable=Boolean(crmEditor&&plan.data&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(plan.data.planStatus)&&!plan.loading&&!plan.error)
  if(!allowed)return null
  const data=query.data
  const saved=()=>{query.retry();onChanged?.()}
  const amount=(value:number|null) => value==null ? 'Chưa thiết lập' : value>Number.MAX_SAFE_INTEGER/10000 ? 'Chưa thể hiển thị chính xác' : data?.currency ? new Intl.NumberFormat('vi-VN',{style:'currency',currency:data.currency,maximumFractionDigits:4}).format(value) : `${value} · Chưa xác định tiền tệ`
  const percent=(value:number|null) => value==null ? 'Chưa thiết lập' : new Intl.NumberFormat('vi-VN',{style:'percent',maximumFractionDigits:2}).format(value)
  const missing=query.error instanceof ApiError&&query.error.status===404&&query.error.code==='PRICING_POLICY_NOT_FOUND'
  const cancellationText=data?.cancellationPolicy?.trim()??''
  const statusLabels={DRAFT:'Bản nháp',PENDING_APPROVAL:'Chờ OPS duyệt giá',RETURNED:'Cần chỉnh sửa',APPROVED:'Giá đã được duyệt',ARCHIVED:'Đã lưu trữ'} as const
  const statusTone=data?.status==='APPROVED'?'success':data?.status==='PENDING_APPROVAL'?'info':data?.status==='RETURNED'?'warning':'neutral'
  const canEdit=editable&&!query.loading&&!query.error&&Boolean(data)&&data?.status!=='PENDING_APPROVAL'
  const cabinFares=data?[
    ['Phòng trong',data.interiorBaseFare],['Phòng hướng biển',data.oceanViewBaseFare],
    ['Phòng ban công',data.balconyBaseFare],['Suite',data.suiteBaseFare],
  ] as const:[]
  return <Panel className={styles.policy}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <div className={styles.titleRow}><h2>Chính sách giá</h2>{data&&!query.loading&&!query.error&&<Badge label={data.status?statusLabels[data.status]:domainStatus('pricing.policy','UNKNOWN')} tone={statusTone}/>}</div>
        {data&&!query.loading&&!query.error&&<p className={styles.version}>Phiên bản: <span>{data.policyVersion??'Chưa xác định'}</span></p>}
      </div>
      {canEdit&&<div className={styles.headerActions}><PricingDraftFields key={cruiseId} cruiseId={cruiseId} policy={data??undefined} onSaved={saved}/></div>}
    </header>
    {query.loading&&<Loading label="Đang tải chính sách giá…"/>}
    {missing&&<Notice title="Chưa thiết lập chính sách giá">Chưa có chính sách giá cho lần khởi hành này.</Notice>}
    {query.error&&!missing&&<Notice title="Chưa đọc được chính sách giá" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Thử lại</Button></Notice>}
    {crmEditor&&plan.error&&<Notice title="Chưa xác định được quyền chỉnh sửa giá"><Button tone="secondary" onClick={plan.retry}>Tải lại trạng thái kế hoạch</Button></Notice>}
    {crmEditor&&data?.status==='RETURNED'&&!query.loading&&!query.error&&<Notice title="OPS yêu cầu chỉnh sửa chính sách giá" tone="warning">
      {data.decisionReason&&<p>{data.decisionReason}</p>}
      <p>{editable?'Sửa và lưu giá tại đây, sau đó gửi lại kế hoạch ở bước “Kiểm tra và gửi OPS”.':'Kế hoạch đang khóa chỉnh sửa. OPS cần chọn “Yêu cầu bổ sung” tại bước xét duyệt kế hoạch để CRM cập nhật giá.'}</p>
    </Notice>}
    {data&&!query.loading&&!query.error&&<>
      <div className={styles.groups}>
        <section className={styles.group}>
          <h3>Giá cabin <span className={styles.currency}>· {data.currency??'Chưa xác định tiền tệ'}</span></h3>
          <table className={styles.fares}>
            <caption className={styles.srOnly}>Giá cơ sở theo hạng cabin</caption>
            <thead><tr><th scope="col">Hạng cabin</th><th scope="col">Giá cơ sở</th></tr></thead>
            <tbody>{cabinFares.map(([label,value])=><tr key={label}><th scope="row">{label}</th><td>{amount(value)}</td></tr>)}</tbody>
          </table>
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
      {!readOnly&&access.roles.includes('OPERATIONS_MANAGER')&&<div className={styles.review}><PricingReview policy={data} onSaved={saved}/></div>}
    </>}
    {editable&&missing&&!query.loading&&<PricingDraftFields key={cruiseId} cruiseId={cruiseId} onSaved={saved}/>}
  </Panel>
}
