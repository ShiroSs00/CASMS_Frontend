import { ApiError, useReadQuery } from '@/shared/api'
import { Button, Empty, Loading, Notice } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import { cruiseDurationLabel } from '../model/cruise-duration'
import { cruiseDetailSections } from '../model/live-booking-navigation'
import { publicContentFailure } from '../model/public-content-feedback'
import { portLocalDate, portRangeDates } from '../model/itinerary-time'
import styles from './CruiseDetail.module.css'

export type PublicItineraryRead = ReturnType<typeof useReadQuery<Awaited<ReturnType<typeof liveCruiseCatalogApi.publicItinerary>>>>

function PortTime({ instant, zone, day, showDate }: { instant: string; zone: string; day?: string; showDate?: boolean }) {
  const date = portLocalDate(instant, zone)
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant))
  return <time dateTime={instant}>{time}{(showDate ?? date !== day) && ` (${date.split('-').reverse().join('/')})`}</time>
}

function PortTimeRange({ start, end, zone, day }: { start: string; end: string; zone: string; day: string }) {
  const { showStartDate, showEndDate } = portRangeDates(start, end, zone, day)
  return <span className={showStartDate ? undefined : styles.portClockRange}>
    <PortTime instant={start} zone={zone} showDate={showStartDate} />
    {showStartDate ? ' – ' : '–'}
    <PortTime instant={end} zone={zone} showDate={showEndDate} />
  </span>
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
        <p className={styles.timeNote}>Ngày theo giờ Việt Nam. Các mốc tại cảng hiển thị theo giờ địa phương.</p>
        <ol className={styles.timeline} aria-label="Các ngày hành trình">
          {data.days.map(day => <li className={styles.day} key={day.dayNumber}>
            <article className={styles.dayContent}>
              <header className={styles.dayHeader}>
                <h3>Ngày {day.dayNumber}</h3>
                <time dateTime={day.date}>{day.date.split('-').reverse().join('/')}</time>
              </header>
              {day.dayNumber === 1 && data.departurePortName && !day.portCalls.some(port => port.isEmbarkation) &&
                <div className={styles.port}>
                  <h4>Khởi hành từ {data.departurePortName}</h4>
                  <PortTime instant={data.departureDatetime} zone={day.shipTimeZoneId} day={day.date} />
                </div>}
              {day.portCalls.length === 0 && !(day.dayNumber === 1 && data.departurePortName) &&
                <p className={styles.noStops}>Không có lần ghé cảng trong ngày này.</p>}
              {day.portCalls.length > 0 &&
                <ol className={styles.ports} aria-label="Các mốc tại cảng">
                  {day.portCalls.map(port => <li className={styles.port} key={port.sequence}>
                    <div className={styles.portHeading}>
                      <h4>{port.portName || 'Chưa có tên cảng'}{port.countryCode ? ' · ' + port.countryCode : ''}</h4>
                    </div>
                    <dl className={styles.portTimes}>
                      {!port.isEmbarkation && <div><dt>Tàu dự kiến cập cảng</dt><dd><PortTime instant={port.arrival} zone={port.portTimeZoneId} day={day.date} /></dd></div>}
                      {port.isDisembarkation ? <div className={styles.disembarkationTime}><dt>Khách dự kiến xuống tàu</dt><dd>
                        {port.disembarkationStartsAt && port.disembarkationEndsAt
                          ? <PortTimeRange start={port.disembarkationStartsAt} end={port.disembarkationEndsAt} zone={port.portTimeZoneId} day={day.date} />
                          : 'Chưa có giờ xuống tàu'}
                      </dd></div> : <div><dt>{port.isEmbarkation ? 'Khởi hành dự kiến' : 'Tàu dự kiến rời cảng'}</dt><dd><PortTime instant={port.departure} zone={port.portTimeZoneId} day={day.date} /></dd></div>}
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
