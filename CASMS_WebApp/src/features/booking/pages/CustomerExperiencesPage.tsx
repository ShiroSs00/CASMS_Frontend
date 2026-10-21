import { useCallback } from 'react'
import { useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { ButtonLink, Loading, Notice, PageHeader } from '@/shared/ui'
import { realBookingApi } from '../api/real-booking-api'
import { CustomerActivities, CustomerExcursions, CustomerRegistrations, CustomerRequests, CustomerServices } from '../components/CustomerExperiences'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import styles from '../components/LiveBooking.module.css'

export function CustomerExperiencesPage() {
  const access = useSessionAccess(), { bookingId = '' } = useParams()
  if (access.status === 'loading') return <RealBookingFrame><Loading label="Đang kiểm tra phiên đăng nhập…" /></RealBookingFrame>
  if (!access.has('BOOKING_READ')) return <RealBookingFrame><Notice title="Chưa có quyền xem đặt chỗ" tone="warning">Cần phiên có quyền đọc Booking để mở hoạt động và dịch vụ gắn với đặt chỗ.</Notice><ButtonLink to="/my-bookings">Về đặt chỗ của tôi</ButtonLink></RealBookingFrame>
  return <Experiences key={access.userId + ':' + bookingId} bookingId={bookingId} />
}
function Experiences({ bookingId }: { bookingId: string }) {
  const access = useSessionAccess()
  const query = useReadQuery('customer-experience-booking:' + bookingId, useCallback(signal => realBookingApi.get(bookingId, signal), [bookingId]))
  const booking = query.data
  return <RealBookingFrame><div className={styles.stack}><ButtonLink tone="secondary" to={'/my-bookings/' + encodeURIComponent(bookingId)}>← Về chi tiết đặt chỗ</ButtonLink><PageHeader breadcrumb="ĐẶT CHỖ / TRẢI NGHIỆM" title="Hoạt động & dịch vụ" description="Đăng ký riêng theo tài khoản. Thông tin gói, yêu cầu dịch vụ, đăng ký tham gia và thanh toán là các trạng thái riêng." />
    <BookingReadState {...query} publicResource="đặt chỗ" />
    {booking && <><p>Đặt chỗ <strong>{booking.bookingReference}</strong> · {booking.cruiseName}</p>
      <Notice title="Hồ sơ hành khách và tài khoản" tone="info">Chỉ hồ sơ đã liên kết với tài khoản của bạn mới có thể đăng ký hoặc gửi yêu cầu. Nếu hệ thống báo không có quyền dù bạn xem được Booking, liên hệ hỗ trợ để kiểm tra liên kết hồ sơ; không chọn thay hồ sơ người khác.</Notice>
      {access.has('ACTIVITY_READ') ? <CustomerActivities booking={booking} /> : <Notice title="Chưa có quyền xem hoạt động" tone="warning">Phiên hiện tại chưa được cấp quyền đọc hoạt động trên chuyến đi.</Notice>}
      {access.has('ACTIVITY_REGISTRATION') && <CustomerRegistrations booking={booking} />}
      {access.has('SERVICE_READ') ? <CustomerServices booking={booking} /> : <Notice title="Chưa có quyền xem dịch vụ bổ sung" tone="warning">Dịch vụ chưa được mở cho tài khoản này. Quyền trong gói không tự cấp quyền đặt dịch vụ qua tài khoản.</Notice>}
      {(access.has('SERVICE_REQUEST_READ') || access.has('SERVICE_REQUEST_CREATE')) && <CustomerRequests booking={booking} />}
      {access.has('EXCURSION_READ') && access.has('ITINERARY_READ') && access.has('CRUISE_STOP_READ') ? <CustomerExcursions booking={booking} /> : <Notice title="Tour tham quan trên bờ" tone="warning">Phiên hiện tại chưa có đủ quyền xem tour cùng điểm dừng của chuyến. Các đăng ký tour đã có của tài khoản vẫn hiển thị trong Đăng ký của tôi khi có quyền xem. Liên hệ hỗ trợ để chọn tour đúng chuyến.</Notice>}
    </>}
  </div></RealBookingFrame>
}
