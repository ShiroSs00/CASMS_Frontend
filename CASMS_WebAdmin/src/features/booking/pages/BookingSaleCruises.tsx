import { useId, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, Empty, Field, PageHeader, RecordFacts } from '@/shared/ui'
import { realBookingApi } from '../api/real-booking-api'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { bookingWhen } from '../model/real-booking-view'
import styles from '../components/BookingAgent.module.css'

export function BookingSaleCruises() {
  return <RealBookingFrame><div className={styles.workspace}>
    <PageHeader title="Chuyến đang mở bán" breadcrumb=""
      actions={<ButtonLink to="/admin/bookings" tone="secondary">Về danh sách đặt chỗ</ButtonLink>} />
    <BookingSaleCatalogue />
  </div></RealBookingFrame>
}

export function BookingSaleCatalogue({ inDrawer = false }: { inDrawer?: boolean }) {
  const access = useSessionAccess()
  const headingId = useId()
  const filterId = useId()
  const result = useReadQuery('booking-sale-cruises:' + access.userId, realBookingApi.saleCruises)
  const [availability, setAvailability] = useState('all')
  const cruises = result.data?.filter(cruise => availability === 'all' || cruise.sellable === (availability === 'available'))
  return <section className={inDrawer ? styles.saleDrawer : styles.register} aria-labelledby={headingId}>
      <div className={styles.registerHeading}>
        <div><h2 id={headingId}>Danh sách chuyến</h2>
          {!result.loading && !result.error && cruises && <p aria-live="polite">{cruises.length} chuyến</p>}</div>
      </div>
      <div className={styles.registerFilters} role="group" aria-label="Bộ lọc chuyến">
      <div className={styles.saleToolbar}>
        <Field htmlFor={filterId} label="Nhận đặt chỗ">
          <select value={availability} onChange={event => setAvailability(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="available">Có thể đặt chỗ</option>
            <option value="unavailable">Chưa đủ điều kiện</option>
          </select>
        </Field>
        <Button tone="secondary" autoWidth onClick={result.retry}>Tải lại chuyến</Button>
      </div>
      </div>
      <div className={styles.registerResults}>
      <BookingReadState {...result} publicResource="chuyến đang mở bán" />
      {!result.loading && !result.error && cruises && (cruises.length ? <ul className={styles.saleRows} aria-label="Chuyến đang mở bán">
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
      </ul> : <Empty className={styles.registerEmpty} title={availability === 'all' ? 'Chưa có chuyến mở bán trong phạm vi xem' : 'Không có chuyến phù hợp bộ lọc'}>
        {availability === 'all' ? 'Tải lại danh sách khi cần kiểm tra tình trạng nhận đặt chỗ.' :
          <Button tone="secondary" onClick={() => setAvailability('all')}>Xóa bộ lọc</Button>}
      </Empty>)}
      </div>
    </section>
}
