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
  const [search, setSearch] = useState('')
  const [departure, setDeparture] = useState('')
  const cruises = result.data?.filter(cruise => (availability === 'all' || cruise.sellable === (availability === 'available'))
    && (!search.trim() || [cruise.cruiseName, cruise.cruiseCode, cruise.shipName].some(value => value?.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))))
    && (!departure || new Date(cruise.departureDatetime).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) === departure))
  const saleLabels: Record<string, string> = { STOPPED: 'Đã tạm dừng nhận đặt chỗ', NOT_YET_OPEN: 'Chưa đến thời gian nhận đặt chỗ', DEPARTED: 'Chuyến đã khởi hành', SOLD_OUT: 'Đã hết chỗ', DRAFT: 'Chuyến chưa công bố', CANCELLED: 'Chuyến đã hủy', OPEN_FOR_SALE: 'Đang nhận đặt chỗ' }
  return <section className={inDrawer ? styles.saleDrawer : styles.register} aria-labelledby={headingId}>
      <div className={styles.registerHeading}>
        <div><h2 id={headingId}>Danh sách chuyến</h2>
          {!result.loading && !result.error && cruises && <p aria-live="polite">{cruises.length} chuyến</p>}</div>
      </div>
      <div className={styles.registerFilters} role="group" aria-label="Bộ lọc chuyến">
      <div className={styles.saleToolbar}>
        <Field htmlFor={`${filterId}-search`} label="Tìm chuyến hoặc tàu"><input id={`${filterId}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên chuyến, mã chuyến, tên tàu" /></Field>
        <Field htmlFor={`${filterId}-date`} label="Ngày khởi hành · giờ Việt Nam"><input id={`${filterId}-date`} type="date" value={departure} onChange={event => setDeparture(event.target.value)} /></Field>
        <Field htmlFor={filterId} label="Nhận đặt chỗ">
          <select id={filterId} value={availability} onChange={event => setAvailability(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="available">Có thể đặt chỗ</option>
            <option value="unavailable">Hiện không nhận đặt chỗ</option>
          </select>
        </Field>
        <Button tone="secondary" autoWidth onClick={result.retry}>Tải lại chuyến</Button>
        {(search || departure || availability !== 'all') && <Button tone="text" autoWidth onClick={() => { setSearch(''); setDeparture(''); setAvailability('all') }}>Xóa bộ lọc</Button>}
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
            ['Chỗ còn nhận đặt', cruise.remainingCapacity == null ? 'Chưa có dữ liệu' : cruise.remainingCapacity.toLocaleString('vi-VN')],
            ['Tiền tệ báo giá', cruise.saleCurrency ?? 'Chưa có dữ liệu'],
          ]} />
          <div className={styles.saleAction}>
            <Badge tone={cruise.sellable ? 'success' : 'warning'} label={cruise.sellable ? 'Có thể đặt chỗ' : saleLabels[cruise.saleState ?? ''] ?? 'Hiện không nhận đặt chỗ'} />
            {!cruise.sellable && cruise.stopReason && <p>{cruise.stopReason}</p>}
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
