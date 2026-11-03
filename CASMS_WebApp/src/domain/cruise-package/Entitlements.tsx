import {useCallback} from 'react'
import {useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {Button,ButtonLink,Empty,Notice,Panel} from '@/shared/ui'
import {cruisePackageApi} from './api'
import {QueryState} from './Workspace'
import {inclusionLabels} from './labels'

const registrationLabels:Record<string,string>={PENDING:'Đang chờ xác nhận',CONFIRMED:'Đã xác nhận đăng ký',COMPLETED:'Đã hoàn tất đăng ký',CANCELLED:'Đã hủy',REQUESTED:'Đã gửi yêu cầu',ACCEPTED:'Đã tiếp nhận',IN_PROGRESS:'Đang phục vụ',REJECTED:'Đã từ chối'}
export function CruisePackageEntitlements({bookingId,passengers,grantId}:{bookingId:string;passengers:{bookingPassengerId:string;fullName:string}[];grantId?:string}) {
  const access=useSessionAccess()
  const query=useReadQuery(`fare-entitlements:${bookingId}`,useCallback(async signal=>{
    const rows=await cruisePackageApi.entitlements(bookingId,signal)
    if(rows.some(row=>!passengers.some(p=>p.bookingPassengerId===row.bookingPassengerId)))throw new Error('Quyền lợi không khớp hành khách trong đặt chỗ.')
    return rows
  },[bookingId,passengers]))
  const rows=query.data?.filter(row=>!grantId||row.grantId===grantId)
  return <Panel title="Quyền lợi gói du thuyền đã mua"><Button tone="secondary" onClick={query.retry}>Đối chiếu quyền lợi mới nhất</Button>
    <QueryState loading={query.loading} error={query.error}/>{rows?.length===0&&<Empty title="Chưa có quyền lợi đã mua cho lựa chọn này"/>}
    {rows?.map(row=><article key={row.grantId}><h3>{row.benefitName}</h3><p>{passengers.find(p=>p.bookingPassengerId===row.bookingPassengerId)?.fullName} · {row.sourcePackageName} · {inclusionLabels[row.inclusion]}</p>
      <p>{row.status==='ACTIVE'?'Quyền lợi từ xác nhận mua còn hiệu lực':'Chưa có quyền lợi còn hiệu lực'}{row.grantedAt&&` · Cấp lúc ${new Date(row.grantedAt).toLocaleString('vi-VN')}`}</p>
      {row.usagePolicy==='UNLIMITED'?<p>Được cấu hình không giới hạn. Số đơn vị đã sử dụng có ghi nhận: {row.usedQuantity??'Chưa xác định'}.</p>:row.grantedQuantity!=null?<p>Được cấp: {row.grantedQuantity} · Đã dùng: {row.usedQuantity??'Chưa xác định'} · Còn lại: {row.remainingQuantity??'Chưa xác định'}.</p>:<p>Không có quota được cấp để hiển thị.</p>}
      <p>Đơn vị: {row.usageUnit==='PARTICIPATION'?'Một hành khách hoàn thành một session':row.usageUnit==='SERVICE_UNIT'?`Số lượng phục vụ thực tế · ${row.serviceUnitCode??'Chưa có đơn vị nguồn'}`:'Chưa có đơn vị sử dụng hợp lệ'}.</p>
      <p>{row.requiresReservation===true?'Phải đăng ký hoặc gửi yêu cầu phục vụ trước khi dùng.':row.requiresReservation===false?'Cấu hình không yêu cầu đăng ký; cần đối chiếu luồng hỗ trợ.':'Chưa khai báo yêu cầu đăng ký.'}</p>
      {row.usageStartsAt&&row.usageEndsAt?<p>Khoảng sử dụng: {new Date(row.usageStartsAt).toLocaleString('vi-VN')} – {new Date(row.usageEndsAt).toLocaleString('vi-VN')} (giờ thiết bị).</p>:<p>Thời gian sử dụng theo lịch hoạt động/tour/dịch vụ thực tế; không có khoảng thời gian riêng được áp mặc định.</p>}
      {row.registrations.length>0?<ul>{row.registrations.map(r=><li key={r.operationId}>{r.operationType==='REGISTRATION'?'Đăng ký hoạt động/tour':'Yêu cầu dịch vụ'} · {registrationLabels[r.status]??'Trạng thái cần đối chiếu'} · Số lượng yêu cầu: {r.quantity}{r.operationType==='SERVICE_REQUEST'&&access.inWorkScope('service-requests')&&access.canDo('SERVICE_REQUEST_READ')&&<ButtonLink tone="secondary" to={`/admin/service-requests/${r.operationId}`}>Mở yêu cầu</ButtonLink>}</li>)}</ul>:<p>Chưa có đăng ký hoặc yêu cầu phục vụ gắn quyền lợi này.</p>}
      {row.blockers.length>0&&<Notice title="Chưa thể sử dụng quyền lợi" tone="warning"><ul>{row.blockers.map((b,i)=><li key={`${b.code}:${i}`}>{b.message}</li>)}</ul></Notice>}
      {row.canRegister&&<p>Quyền lợi đủ điều kiện cấu trúc để đăng ký. Backend kiểm tra lại lịch và chỗ phục vụ khi gửi đăng ký; chưa giữ chỗ hoặc tiêu thụ lượt.</p>}
    </article>)}
    <p>Đăng ký chưa đồng nghĩa đã sử dụng. Chỉ fulfillment thành công được ghi nhận; luồng này không xác minh tuổi hoặc sức khỏe từ mô tả.</p>
  </Panel>
}
