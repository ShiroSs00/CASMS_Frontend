import { useCallback } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import { publicSaleLabels } from '../api/public-sale-contract'
import { publicContentFailure } from '../model/public-content-feedback'
import styles from './Booking.module.css'


export function PublicCruiseSaleState({ cruiseId }: { cruiseId: string }) {
  const query = useReadQuery('public-display-state:' + cruiseId,
    useCallback(signal => liveCruiseCatalogApi.publicSaleState(cruiseId, signal), [cruiseId]))
  return <div aria-live="polite">
    {query.loading && <p role="status">Đang cập nhật trạng thái mở bán…</p>}
    {query.error && <><p role="status">{publicContentFailure(query.error)}</p><Button tone="secondary" onClick={query.retry}>Tải lại trạng thái</Button></>}
    {!query.loading && !query.error && query.data && <>
      <p><strong>{publicSaleLabels[query.data.publicSaleState] ?? 'Hiện chưa đủ điều kiện hiển thị'}</strong></p>
      {query.data.openedForSaleAt && <p>Ghi nhận mở bán lúc {formatTime(query.data.openedForSaleAt, 'Asia/Ho_Chi_Minh')} · Giờ Việt Nam</p>}
    </>}
  </div>
}

function formatTime(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(new Date(instant))
}

export function PublicCruiseItinerary({ cruiseId }: { cruiseId: string }) {
  const query = useReadQuery('public-actual-itinerary:' + cruiseId,
    useCallback(signal => liveCruiseCatalogApi.publicItinerary(cruiseId, signal), [cruiseId]))
  return <section className={styles.liveInfoPanel} aria-labelledby="public-schedule-heading">
    <h2 id="public-schedule-heading">Lịch trình thực tế</h2>
    {query.loading && <p role="status">Đang tải lịch trình…</p>}
    {query.error && <><p role="status">{publicContentFailure(query.error)}</p><Button tone="secondary" onClick={query.retry}>Tải lại lịch trình</Button></>}
    {!query.loading && !query.error && query.data && <>
      <p>Thời lượng: {query.data.durationDays == null ? 'Chưa có số ngày' : query.data.durationDays + ' ngày'} · {query.data.durationNights == null ? 'Chưa có số đêm' : query.data.durationNights + ' đêm'}</p>
      {query.data.days.length === 0 && <p>Chưa có ngày lịch trình được cung cấp.</p>}
      {query.data.days.map(day => <article key={day.dayNumber}>
        <h3>Ngày {day.dayNumber} · {day.date.split('-').reverse().join('/')}</h3>
        <p>Giờ tàu: {day.shipTimeZoneId}</p>
        {day.portCalls.length === 0 && <p>Không có lần ghé cảng trong ngày này.</p>}
        {day.portCalls.map(port => <div key={port.sequence}>
          <h4>{port.sequence}. {port.portName ?? 'Chưa có tên cảng'}{port.countryCode ? ' · ' + port.countryCode : ''}</h4>
          <p>Dự kiến đến: {formatTime(port.arrival, port.portTimeZoneId)}</p>
          <p>Dự kiến rời: {formatTime(port.departure, port.portTimeZoneId)}</p>
          <p>Giờ địa phương của cảng · {port.portTimeZoneId}</p>
          {port.destinationVisits.length > 0 && <ol>{port.destinationVisits.map(visit => <li key={visit.sequence}>{visit.destinationName ?? 'Chưa có tên điểm tham quan'}</li>)}</ol>}
        </div>)}
      </article>)}
    </>}
  </section>
}
