import { Notice } from '@/shared/ui'
import type { ShipAssignmentSafety } from '../model/ship-assignment'

const labels:Record<string,string>={
  CONFIRMED_BOOKINGS:'Đặt chỗ đã xác nhận',PASSENGER_COMMITMENTS:'Hành khách đã cam kết phục vụ',
  DRAFT_HOLDS:'Đặt chỗ đang giữ tạm',BOOKING_HISTORY:'Đặt chỗ lịch sử',CABIN_ASSIGNMENTS:'Bản ghi phân bổ cabin',
  ACTIVITY_SHIP_LOCATION:'Hoạt động gắn boong/phòng',ACTIVITY_LOCATION_UNRESOLVED:'Hoạt động cần làm rõ địa điểm',
  SERVICE_CONFIGURATION:'Lịch dịch vụ',PACKAGE_CONFIGURATION:'Gói thuộc hoặc liên kết chuyến',
  CRUISE_PACKAGE_ADDON_OFFERS:'Dịch vụ mua thêm của chuyến',
  FARE_PACKAGE_OFFERS:'Gói du thuyền của chuyến',FARE_PACKAGE_PRICE_REVISIONS:'Phiên bản giá gói du thuyền',FARE_PACKAGE_BENEFIT_BINDINGS:'Liên kết quyền lợi gói du thuyền',PURCHASED_FARE_SNAPSHOTS:'Bản ghi gói du thuyền đã mua',
  CABIN_PRICING_CONFIGURATION:'Bản cấu hình giá theo hạng phòng',CRUISE_PLAN_APPROVAL:'Kế hoạch đang khóa chỉnh sửa',
  PREPARATION_SUBMISSION:'Hồ sơ đang chờ xác nhận',PREPARATION_SIGNOFF:'Hồ sơ đã xác nhận',READINESS_FINGERPRINT:'Bản ghi xác nhận sẵn sàng',
}
const planLabels:Record<string,string>={DRAFT:'Đang soạn',WITHDRAWN:'Đã thu hồi',REVISION_REQUESTED:'Được yêu cầu sửa đổi',SUBMITTED:'Đang chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Đã bị từ chối'}

export function ShipAssignmentDependencies({safety}:{safety:ShipAssignmentSafety}) {
  const dependencies=safety.dependencies.filter(item=>item.count>0)
  const stateReasons=safety.blockers.filter(reason=>!dependencies.some(item=>item.reason===reason))
  return <Notice title="Dữ liệu cần bảo vệ khi đổi hoặc gỡ tàu" tone={safety.canProceed?'info':'warning'}>
    {dependencies.length?<ul>{dependencies.map(item=><li key={item.category}>
      <strong>{labels[item.category]??'Dữ liệu phụ thuộc'}: {item.count}</strong>
      <p>{item.reason}{item.clarificationRequired?' Cần làm rõ nghiệp vụ trước khi xử lý.':''}</p>
    </li>)}</ul>:<p>Chưa ghi nhận dữ liệu phụ thuộc trong lần kiểm tra này.</p>}
    {stateReasons.map(reason=><p key={reason}>{reason}</p>)}
    <p>Kế hoạch: {planLabels[safety.approvalImpact.planStatus]??'Chưa xác định'} · Hồ sơ đã xác nhận: {safety.approvalImpact.confirmedSignoffs} · Hồ sơ đang chờ xác nhận: {safety.approvalImpact.submittedSections}.</p>
    {safety.approvalImpact.readyRecorded&&<p>Đã có bản ghi xác nhận sẵn sàng; hiệu lực được hệ thống đối chiếu theo dữ liệu hiện hành.</p>}
    {safety.approvalImpact.fingerprintWillChange&&<p>{safety.approvalImpact.reason}</p>}
    <p>Xem trước chỉ phản ánh dữ liệu hiện tại. Hệ thống kiểm tra lại trước khi lưu.</p>
  </Notice>
}
