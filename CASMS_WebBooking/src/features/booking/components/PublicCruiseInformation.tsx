import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, Empty, Loading, Notice } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import { publicSaleLabels } from '../api/public-sale-contract'
import { catalogReturn, cruiseDetailSections } from '../model/live-booking-navigation'
import { publicContentFailure } from '../model/public-content-feedback'
import styles from './CruiseDetail.module.css'

type PublicSaleRead = ReturnType<typeof useReadQuery<Awaited<ReturnType<typeof liveCruiseCatalogApi.publicSaleState>>>>
type PublicItineraryRead = ReturnType<typeof useReadQuery<Awaited<ReturnType<typeof liveCruiseCatalogApi.publicItinerary>>>>

export function PublicCruiseBookingEntry({ cruiseId }: { cruiseId: string }) {
  const [params] = useSearchParams()
  const query = useReadQuery('public-booking-state:' + cruiseId,
    useCallback(signal => liveCruiseCatalogApi.saleState(cruiseId, signal), [cruiseId]))

  return <div className={styles.bookingEntry} aria-live="polite">
    {query.loading && <p>Đang kiểm tra khả năng đặt chỗ…</p>}
    {query.error && <Notice title="Chưa thể kiểm tra khả năng đặt chỗ" tone="warning">
      <p>{publicContentFailure(query.error)}</p>
      <Button tone="secondary" onClick={query.retry}>Kiểm tra lại</Button>
    </Notice>}
    {query.data && (query.data.sellable && query.data.transactionReady
      ? <ButtonLink to={'/booking/party?' + new URLSearchParams({ cruiseId, from: catalogReturn(params.get('from')) })}>Bắt đầu đặt chỗ</ButtonLink>
      : <p>Chưa thể đặt chỗ cho chuyến này.</p>)}
  </div>
}

export function PublicCruiseSaleState({ query }: { query: PublicSaleRead }) {
  return <div className={styles.saleStatus} aria-live="polite">
    {query.loading && <p>Đang tải trạng thái mở bán…</p>}
    {query.error && <>
      <p>{publicContentFailure(query.error)}</p>
      <Button tone="secondary" onClick={query.retry}>Tải lại trạng thái</Button>
    </>}
    {query.data && <Badge
      label={publicSaleLabels[query.data.publicSaleState] ?? 'Chưa xác định trạng thái mở bán'}
      tone={query.data.publicSaleState === 'OPEN_FOR_SALE' ? 'success' : 'neutral'}
    />}
  </div>
}

function PortTime({ instant, zone }: { instant: string; zone: string }) {
  const date = new Intl.DateTimeFormat('vi-VN', {
    timeZone: zone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(instant))
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant))
  return <time dateTime={instant}>{time} · {date}</time>
}

export function PublicCruiseItinerary({ query }: { query: PublicItineraryRead }) {
  const { data, error, loading, retry } = query
  const pending = error instanceof ApiError && error.code === 'PUBLIC_ITINERARY_UNAVAILABLE'
  const duration = [
    data?.durationDays != null ? data.durationDays + ' ngày' : null,
    data?.durationNights != null ? data.durationNights + ' đêm' : null,
  ].filter(Boolean).join(' · ')

  return <section id={cruiseDetailSections.itinerary} aria-labelledby="public-schedule-heading" className={styles.section}>
    <div className={styles.sectionHeading}>
      <h2 id="public-schedule-heading" tabIndex={-1}>Lịch trình theo ngày</h2>
      {duration && <p>{duration}</p>}
    </div>
    <div className={styles.readResult} aria-live="polite" aria-busy={loading}>
      {loading && <Loading label="Đang tải lịch trình…" />}
      {error && <Notice title={pending ? 'Lịch trình chưa sẵn sàng' : 'Chưa tải được lịch trình'} tone={pending ? 'info' : 'warning'}>
        <p>{publicContentFailure(error)}</p>
        <Button tone="secondary" onClick={retry}>Tải lại lịch trình</Button>
      </Notice>}
      {data?.days.length === 0 && <Empty title="Chưa có lịch trình để hiển thị" />}
      {data && data.days.length > 0 && <>
        <p className={styles.timeNote}>Ngày theo giờ tàu (Việt Nam). Giờ đến và rời theo giờ địa phương từng cảng.</p>
        <ol className={styles.timeline} aria-label="Các ngày hành trình">
          {data.days.map(day => <li className={styles.day} key={day.dayNumber}>
            <article className={styles.dayContent}>
              <header className={styles.dayHeader}>
                <h3>Ngày {day.dayNumber}</h3>
                <time dateTime={day.date}>{day.date.split('-').reverse().join('/')}</time>
              </header>
              {day.portCalls.length === 0
                ? <p className={styles.noStops}>Không có lần ghé cảng trong ngày này.</p>
                : <ol className={styles.ports} aria-label="Các lần ghé cảng">
                  {day.portCalls.map(port => <li className={styles.port} key={port.sequence}>
                    <div className={styles.portHeading}>
                      <h4>{port.portName || 'Chưa có tên cảng'}{port.countryCode ? ' · ' + port.countryCode : ''}</h4>
                      <p>Giờ địa phương</p>
                    </div>
                    <dl className={styles.portTimes}>
                      <div><dt>Dự kiến đến</dt><dd><PortTime instant={port.arrival} zone={port.portTimeZoneId} /></dd></div>
                      <div><dt>Dự kiến rời</dt><dd><PortTime instant={port.departure} zone={port.portTimeZoneId} /></dd></div>
                    </dl>
                    {port.destinationVisits.length > 0 && <ul className={styles.visits} aria-label="Điểm tham quan">
                      {port.destinationVisits.map(visit => <li key={visit.sequence}>{visit.destinationName || 'Chưa có tên điểm tham quan'}</li>)}
                    </ul>}
                  </li>)}
                </ol>}
            </article>
          </li>)}
        </ol>
      </>}
    </div>
  </section>
}
