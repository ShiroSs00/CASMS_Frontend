import { useCallback } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { domainStatus } from '@/shared/i18n/business-copy'
import { useSessionAccess } from '@/shared/auth'
import { Button, Loading, Notice, Panel, RecordFacts } from '@/shared/ui'
import { decodePricingPolicy } from '../model/pricing-policy'
import {PricingReview} from './PricingReview'
import { PricingDraftFields } from './PricingDraftFields'

export function DeparturePricingPolicy({ cruiseId,onChanged,readOnly=false }: { cruiseId:string;onChanged?:()=>void;readOnly?:boolean }) {
  const access=useSessionAccess()
  const allowed=['CRUISE_READ','CRUISE_UPDATE_DRAFT','CRUISE_OPEN_SALE','BOOKING_READ'].some(permission=>access.has(permission))
  const query=useReadQuery(`pricing-policy:${access.userId}:${access.status}:${access.permissions.join(',')}:${cruiseId}:${allowed}`,useCallback(signal=>
    allowed ? apiRequest<unknown>(`/cruise/${encodeURIComponent(cruiseId)}/pricing-policy`,{signal}).then(value=>decodePricingPolicy(value,cruiseId)) : Promise.resolve(null),[allowed,cruiseId]))
  if(!allowed)return null
  const data=query.data
  const saved=()=>{query.retry();onChanged?.()}
  const amount=(value:number|null) => value==null ? 'Chưa thiết lập' : value>Number.MAX_SAFE_INTEGER/10000 ? 'Chưa thể hiển thị chính xác' : data?.currency ? new Intl.NumberFormat('vi-VN',{style:'currency',currency:data.currency,maximumFractionDigits:4}).format(value) : `${value} · Chưa xác định tiền tệ`
  const percent=(value:number|null) => value==null ? 'Chưa thiết lập' : new Intl.NumberFormat('vi-VN',{style:'percent',maximumFractionDigits:2}).format(value)
  const missing=query.error instanceof ApiError&&query.error.status===404&&query.error.code==='PRICING_POLICY_NOT_FOUND'
  return <Panel title="Chính sách giá" subtitle="Thông tin chính sách của lần khởi hành; không tự xác nhận điều kiện mở bán.">
    {query.loading&&<Loading label="Đang tải chính sách giá…"/>}
    {missing&&<Notice title="Chưa thiết lập chính sách giá">Chưa có chính sách giá cho lần khởi hành này.</Notice>}
    {query.error&&!missing&&<Notice title="Chưa đọc được chính sách giá" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Thử lại</Button></Notice>}
    {data&&<><RecordFacts entries={[
      ['Trạng thái',domainStatus('pricing.policy',data.status??'UNKNOWN')],
      ['Phiên bản',data.policyVersion??'Chưa xác định'],['Tiền tệ',data.currency??'Chưa xác định'],
      ['Phòng trong',amount(data.interiorBaseFare)],['Phòng hướng biển',amount(data.oceanViewBaseFare)],['Phòng ban công',amount(data.balconyBaseFare)],['Suite',amount(data.suiteBaseFare)],
      ['Phí cảng mỗi khách',amount(data.portFeePerPassenger)],['Thuế suất',percent(data.taxRate)],['Tỷ lệ đặt cọc',percent(data.depositPercentage)],
      ['Tất toán trước khởi hành',data.finalPaymentDueDays==null?'Chưa thiết lập':`${data.finalPaymentDueDays} ngày`],['Thanh toán đủ trước khởi hành',data.fullPaymentCutoffDays==null?'Chưa thiết lập':`${data.fullPaymentCutoffDays} ngày`],
    ]}/><p>Điều khoản hủy: {data.cancellationPolicy??'Chưa thiết lập'}</p></>}
    {!readOnly&&data&&<PricingReview policy={data} onSaved={saved}/>}
    {!readOnly&&data?.status!=='PENDING_APPROVAL'&&access.roles.includes('CRUISE_MANAGER')&&access.has('CRUISE_UPDATE_DRAFT')&&<PricingDraftFields cruiseId={cruiseId} policy={data??undefined} onSaved={saved}/>}
  </Panel>
}
