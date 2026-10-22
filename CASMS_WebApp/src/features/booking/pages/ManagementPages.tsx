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
  const links = [['', 'Tổng quan'], ['/manage', 'Quản lý'], ['/travellers', 'Thông tin khách'], ['/experiences', 'Hoạt động & dịch vụ'], ['/payment', 'Hợp đồng & lịch thanh toán'], ['/change-request', 'Thay đổi / hủy']]
  return <CustomerReadAccess><RealBookingDetail showPassengerDetails={showPassengerDetails} customerIntro={<div className={styles.stack}><nav className={styles.actions} aria-label="Các mục đặt chỗ">{links.map(([suffix, label]) => <Link key={suffix} to={root + suffix} aria-current={location.pathname === root + suffix ? 'page' : undefined}>{label}</Link>)}</nav>{unavailable && <Notice title="Hướng dẫn cho chuyến đi" tone="warning">{unavailable}</Notice>}</div>} /></CustomerReadAccess>
}
export function MyBookingsPage(){return <CustomerReadAccess><RealBookingList/></CustomerReadAccess>}
export function BookingDetailPage(){return <CustomerDetail/>}
export function ManageBookingPage(){return <CustomerDetail/>}
export function TravellerDocumentsPage(){return <CustomerDetail showPassengerDetails unavailable="Liên hệ bộ phận đặt chỗ để cập nhật thông tin hành khách."/>}
export function OnlineCheckinPage(){return <CustomerDetail unavailable="Vui lòng làm thủ tục và xuất trình giấy tờ tại quầy đón khách ở cảng."/>}
export function ArrivalTimePage(){return <CustomerDetail unavailable="Kiểm tra giờ có mặt tại cảng trong hướng dẫn trước chuyến đi."/>}
export function BoardingPassPage(){return <CustomerDetail unavailable="Thẻ lên tàu được cấp sau khi hoàn tất thủ tục tại cảng."/>}
export function PaymentContractPage(){return <CustomerDetail unavailable="Thanh toán theo từng đợt và hoàn tất ký hợp đồng theo hướng dẫn bên dưới."/>}
export function ChangeRequestPage(){return <CustomerDetail unavailable="Liên hệ bộ phận đặt chỗ nếu bạn cần hỗ trợ thay đổi hành trình hoặc phòng."/>}
