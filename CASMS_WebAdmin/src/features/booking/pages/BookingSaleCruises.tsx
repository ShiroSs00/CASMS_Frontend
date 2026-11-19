import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, DataTable, Empty, PageHeader } from '@/shared/ui'
import { realBookingApi } from '../api/real-booking-api'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { bookingWhen } from '../model/real-booking-view'
import styles from '../components/BookingAgent.module.css'

export function BookingSaleCruises() {
  const access = useSessionAccess()
  const result = useReadQuery('booking-sale-cruises:' + access.userId, realBookingApi.saleCruises)
  return <RealBookingFrame><div className={styles.workspace}>
    <PageHeader title="Chuyến đang mở bán" breadcrumb="Đặt chỗ / Chuyến đang mở bán" description="Các chuyến trong phạm vi hệ thống cho phép xem. Điều kiện nhận đặt chỗ được kiểm tra lại khi báo giá và tạo đặt chỗ." actions={<ButtonLink to="/admin/bookings" tone="secondary">Về danh sách đặt chỗ</ButtonLink>} />
    <div className={styles.resultsHeading}><h2>Danh sách chuyến</h2><Button tone="secondary" onClick={result.retry}>Tải lại chuyến</Button></div>
    <BookingReadState {...result} publicResource="chuyến đang mở bán" />
    {result.data && !result.loading && !result.error && (result.data.length ? <div className={styles.table}><DataTable label="Chuyến đang mở bán" headers={['Mã chuyến', 'Chuyến khởi hành', 'Tàu', 'Thời gian (giờ Việt Nam)', 'Nhận đặt chỗ', 'Thao tác']}>
      {result.data.map(cruise => <tr key={cruise.cruiseId}><td>{cruise.cruiseCode}</td><th scope="row">{cruise.cruiseName}</th><td>{cruise.shipName ?? 'Chưa cung cấp'}</td><td>{bookingWhen(cruise.departureDatetime)}<br />{bookingWhen(cruise.returnDatetime)}</td><td><Badge tone={cruise.sellable ? 'success' : 'warning'} label={cruise.sellable ? 'Có thể đặt chỗ' : 'Chưa đủ điều kiện'} /></td><td>{cruise.sellable && access.canDo('BOOKING_CREATE') ? <ButtonLink tone="secondary" autoWidth to={'/admin/bookings/new?cruiseId=' + encodeURIComponent(cruise.cruiseId)}>Tạo đặt chỗ</ButtonLink> : 'Chưa thể tạo đặt chỗ'}</td></tr>)}
    </DataTable></div> : <Empty title="Chưa có chuyến mở bán trong phạm vi xem">Tải lại sau khi chuyến được mở bán và phân công phù hợp. Kết quả này chưa xác định được tình trạng phân công của bạn.</Empty>)}
  </div></RealBookingFrame>
}
