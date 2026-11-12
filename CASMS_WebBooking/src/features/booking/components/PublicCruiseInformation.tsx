import { ApiError, useReadQuery } from '@/shared/api'
import { Button, Empty, Loading, Notice } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import { cruiseDurationLabel } from '../model/cruise-duration'
import { cruiseDetailSections } from '../model/live-booking-navigation'
import { publicContentFailure } from '../model/public-content-feedback'
import styles from './CruiseDetail.module.css'

export type PublicItineraryRead = ReturnType<typeof useReadQuery<Awaited<ReturnType<typeof liveCruiseCatalogApi.publicItinerary>>>>

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
  const duration = cruiseDurationLabel(data)

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
                      <p>Giờ địa phương · {port.portTimeZoneId}</p>
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
