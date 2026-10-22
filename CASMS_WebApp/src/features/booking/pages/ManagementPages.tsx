import type { ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { ButtonLink, Loading, Notice } from '@/shared/ui'
import { RealBookingFrame } from '../components/RealBookingUI'
import styles from '../components/LiveBooking.module.css'
import { RealBookingList, RealBookingDetail } from './RealBookingPages'

function CustomerReadAccess({ children }: { children: ReactNode }) {
  const access = useSessionAccess()
  if (access.status === 'loading') return <RealBookingFrame><Loading label="Đang kiểm tra quyền xem đặt chỗ…" /></RealBookingFrame>
  if (!access.has('BOOKING_READ')) return <RealBookingFrame><Notice title="Chưa thể xem đặt chỗ của tài khoản" tone="warning"><p>Phiên hiện tại chưa có quyền đọc danh sách và chi tiết đặt chỗ. Bạn có thể tra cứu bằng mã cùng thông tin người đại diện.</p><ButtonLink to="/booking/lookup">Tra cứu bằng mã đặt chỗ</ButtonLink></Notice></RealBookingFrame>
  return children
}
function CustomerDetail({ unavailable, showPassengerDetails = false }: { unavailable?: string; showPassengerDetails?: boolean }) {
  const { bookingId = '' } = useParams(), location = useLocation()
  const root = '/my-bookings/' + encodeURIComponent(bookingId)
  const links = [['', 'Tổng quan'], ['/manage', 'Quản lý'], ['/travellers', 'Thông tin khách'], ['/experiences', 'Hoạt động & dịch vụ'], ['/payment', 'Hợp đồng & lịch thanh toán'], ['/check-in', 'Check-in'], ['/arrival-time', 'Giờ đến cảng'], ['/boarding-pass', 'Thẻ lên tàu'], ['/change-request', 'Thay đổi / hủy']]
  return <CustomerReadAccess><RealBookingDetail showPassengerDetails={showPassengerDetails} customerIntro={<div className={styles.stack}><nav className={styles.actions} aria-label="Các mục đặt chỗ">{links.map(([suffix, label]) => <Link key={suffix} to={root + suffix} aria-current={location.pathname === root + suffix ? 'page' : undefined}>{label}</Link>)}</nav>{unavailable && <Notice title="Chưa hỗ trợ thao tác trực tuyến" tone="warning">{unavailable}</Notice>}</div>} /></CustomerReadAccess>
}
export function MyBookingsPage(){return <CustomerReadAccess><RealBookingList/></CustomerReadAccess>}
export function BookingDetailPage(){return <CustomerDetail/>}
export function ManageBookingPage(){return <CustomerDetail/>}
export function TravellerDocumentsPage(){return <CustomerDetail showPassengerDetails unavailable="Chưa có dịch vụ cập nhật hồ sơ hoặc tải giấy tờ cho đặt chỗ. Thông tin hành khách đã ghi nhận được hiển thị bên dưới."/>}
export function OnlineCheckinPage(){return <CustomerDetail unavailable="Chưa có dịch vụ check-in trực tuyến. Đặt chỗ hoặc hợp đồng đã xác nhận chưa đồng nghĩa đã check-in."/>}
export function ArrivalTimePage(){return <CustomerDetail unavailable="Chưa có dịch vụ xem hoặc giữ khung giờ đến cảng. Thời gian hành trình bên dưới không phải giờ đến cảng được xác nhận."/>}
export function BoardingPassPage(){return <CustomerDetail unavailable="Chưa có dịch vụ cấp thẻ lên tàu. Không phát hành mã QR hoặc thẻ từ trạng thái đặt chỗ."/>}
export function PaymentContractPage(){return <CustomerDetail unavailable="Chưa có dịch vụ thu tiền, đối soát giao dịch hoặc ký hợp đồng trực tuyến. Hướng dẫn và lịch yêu cầu thanh toán bên dưới lấy từ đặt chỗ đã lưu."/>}
export function ChangeRequestPage(){return <CustomerDetail unavailable="Chưa có dịch vụ gửi yêu cầu thay đổi để phê duyệt. Các thao tác hủy hoặc đổi phòng chỉ khả dụng khi phiên hiện tại được cấp quyền tương ứng."/>}
