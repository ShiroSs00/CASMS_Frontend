import {Notice,RecordFacts} from '@/shared/ui'
import type {CruisePackageEntitlement} from './entitlement-contract'

/** Read-only facts embedded in the existing operational workspace, never a second fulfillment flow. */
export function OperationalCruisePackageEntitlement({entitlement}:{entitlement:CruisePackageEntitlement|null}) {
  if(!entitlement)return null
  return <section aria-label="Quyền lợi dùng cho lần phục vụ"><h3>Quyền lợi: {entitlement.benefitName}</h3>
    <RecordFacts entries={[
      ['Gói đã mua',entitlement.sourcePackageName],['Hiệu lực quyền lợi',entitlement.status==='ACTIVE'?'Còn hiệu lực':'Không còn hiệu lực'],
      ['Số lượng cấp',entitlement.usagePolicy==='UNLIMITED'?'Đã cấu hình không giới hạn':entitlement.grantedQuantity??'Chưa xác định'],
      ['Đã dùng',entitlement.usedQuantity??'Chưa xác định'],['Còn lại',entitlement.usagePolicy==='UNLIMITED'?'Không giới hạn số lượt':entitlement.remainingQuantity??'Chưa xác định'],
      ['Đơn vị',entitlement.usageUnit==='PARTICIPATION'?'Một hành khách hoàn thành một buổi':entitlement.serviceUnitCode??'Chưa có đơn vị hỗ trợ'],
    ]}/>
    {entitlement.blockers.length>0&&<Notice title="Điều kiện quyền lợi cần đối chiếu" tone="warning"><ul>{entitlement.blockers.map((b,i)=><li key={`${b.code}:${i}`}>{b.message}</li>)}</ul></Notice>}
    <p>Chỉ hoàn tất phục vụ thành công mới ghi nhận sử dụng. Không tiêu thụ lượt khi đăng ký, bị từ chối hoặc phục vụ thất bại.</p>
  </section>
}
