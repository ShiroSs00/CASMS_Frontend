import { useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, Empty, Field, PageHeader, RecordFacts } from '@/shared/ui'
import { realBookingApi } from '../api/real-booking-api'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { bookingWhen } from '../model/real-booking-view'
import styles from '../components/BookingAgent.module.css'

export function BookingSaleCruises() {
  const access = useSessionAccess()
  const result = useReadQuery('booking-sale-cruises:' + access.userId, realBookingApi.saleCruises)
  const [availability, setAvailability] = useState('all')
  const cruises = result.data?.filter(cruise => availability === 'all' || cruise.sellable === (availability === 'available'))
  return <RealBookingFrame><div className={styles.workspace}>
    <PageHeader title="Chuyến đang mở bán" breadcrumb="Đặt chỗ / Chuyến đang mở bán"
      actions={<ButtonLink to="/admin/bookings" tone="secondary">Về danh sách đặt chỗ</ButtonLink>} />
    <section aria-label="Bộ lọc chuyến">
      <div className={styles.saleToolbar}>
        <Field htmlFor="cruise-availability" label="Nhận đặt chỗ">
          <select value={availability} onChange={event => setAvailability(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="available">Có thể đặt chỗ</option>
            <option value="unavailable">Chưa đủ điều kiện</option>
          </select>
        </Field>
        <Button tone="secondary" onClick={result.retry}>Tải lại chuyến</Button>
      </div>
    </section>
    <section aria-labelledby="sale-results">
      <div className={styles.resultsHeading}>
        <h2 id="sale-results">Danh sách chuyến</h2>
        {cruises && <span aria-live="polite">{cruises.length} chuyến</span>}
      </div>
      <BookingReadState {...result} publicResource="chuyến đang mở bán" />
      {cruises && (cruises.length ? <ul className={styles.saleRows} aria-label="Chuyến đang mở bán">
        {cruises.map(cruise => <li key={cruise.cruiseId}>
          <div className={styles.saleIdentity}>
            <h3>{cruise.cruiseName}</h3>
            <p>{cruise.cruiseCode} · {cruise.shipName ?? 'Chưa có tên tàu'}</p>
          </div>
          <RecordFacts entries={[
            ['Khởi hành', bookingWhen(cruise.departureDatetime)],
            ['Kết thúc', bookingWhen(cruise.returnDatetime)],
          ]} />
          <div className={styles.saleAction}>
            <Badge tone={cruise.sellable ? 'success' : 'warning'} label={cruise.sellable ? 'Có thể đặt chỗ' : 'Chưa đủ điều kiện'} />
            {cruise.sellable && access.canDo('BOOKING_CREATE') && <ButtonLink tone="secondary" autoWidth
              to={'/admin/bookings/new?cruiseId=' + encodeURIComponent(cruise.cruiseId)}>Tạo đặt chỗ</ButtonLink>}
          </div>
        </li>)}
      </ul> : <Empty title={availability === 'all' ? 'Chưa có chuyến mở bán trong phạm vi xem' : 'Không có chuyến phù hợp bộ lọc'}>
        {availability === 'all' ? 'Tải lại danh sách khi cần kiểm tra tình trạng nhận đặt chỗ.' :
          <Button tone="secondary" onClick={() => setAvailability('all')}>Xóa bộ lọc</Button>}
      </Empty>)}
    </section>
  </div></RealBookingFrame>
}
