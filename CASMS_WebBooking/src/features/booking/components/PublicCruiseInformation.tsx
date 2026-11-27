import { useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { Button, Empty, Loading, Notice } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import { cruiseDurationLabel } from '../model/cruise-duration'
import { experiencePhotos, portPhotoForName } from '../model/cruise-port-photos'
import { cruiseDetailSections } from '../model/live-booking-navigation'
import { publicContentFailure } from '../model/public-content-feedback'
import { portLocalDate, portRangeDates } from '../model/itinerary-time'
import styles from './CruiseDetail.module.css'

export type PublicItineraryRead = ReturnType<typeof useReadQuery<Awaited<ReturnType<typeof liveCruiseCatalogApi.publicItinerary>>>>

const regionNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['vi'], { type: 'region' })
  : null

function countryName(code?: string | null) {
  const clean = (code ?? '').trim().toUpperCase()
  if (!clean) return ''
  try {
    return regionNames?.of(clean) ?? clean
  } catch {
    return clean
  }
}

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

function dayHeadline(day: NonNullable<PublicItineraryRead['data']>['days'][number], departurePort?: string | null) {
  if (day.portCalls.length > 0) {
    const names = day.portCalls.map(p => p.portName || 'Chưa có tên cảng')
    return [...new Set(names)].join(' · ')
  }
  if (day.dayNumber === 1 && departurePort) return `Khởi hành · ${departurePort}`
  return 'Ngày trên biển'
}

export function PublicCruiseItinerary({ query }: { query: PublicItineraryRead }) {
  const { data, error, loading, retry } = query
  const pending = error instanceof ApiError && error.code === 'PUBLIC_ITINERARY_UNAVAILABLE'
  const duration = cruiseDurationLabel(data)
  const [activeDay, setActiveDay] = useState<number | 'overview'>('overview')

  function jumpToDay(dayNumber: number | 'overview') {
    setActiveDay(dayNumber)
    const target = document.getElementById(cruiseDetailSections.itinerary)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const visibleDays = data ? (activeDay === 'overview' ? data.days : data.days.filter(d => d.dayNumber === activeDay)) : []

  return <section id={cruiseDetailSections.itinerary} aria-labelledby="public-schedule-heading" className={styles.section}>
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.sectionEyebrow}>HÀNH TRÌNH CHI TIẾT</p>
        <h2 id="public-schedule-heading" tabIndex={-1}>Lịch trình theo ngày</h2>
      </div>
      {duration && <span className={styles.durationPill}>{duration}</span>}
    </div>
    <div className={styles.readResult} aria-live="polite" aria-busy={loading}>
      {loading && <Loading label="Đang tải lịch trình…" />}
      {error && <Notice title={pending ? 'Lịch trình chưa sẵn sàng' : 'Chưa tải được lịch trình'} tone={pending ? 'info' : 'warning'}>
        <p>{publicContentFailure(error)}</p>
        <Button tone="secondary" onClick={retry}>Tải lại lịch trình</Button>
      </Notice>}
      {data?.days.length === 0 && <Empty title="Chưa có lịch trình để hiển thị" />}
      {data && data.days.length > 0 && <>
        <p className={styles.timeNote}>Ngày theo giờ Việt Nam. Các mốc cập/rời cảng hiển thị theo giờ địa phương từng cảng.</p>
        {/* UX: Royal Caribbean-inspired horizontal Day Strip + full-width Vertical Connected Timeline */}
        <div className={styles.dayPillStrip} role="region" aria-label="Chọn nhanh ngày hành trình">
          <button
            type="button"
            className={`${styles.dayPill} ${activeDay === 'overview' ? styles.dayPillActive : ''}`}
            aria-pressed={activeDay === 'overview'}
            onClick={() => jumpToDay('overview')}
          >
            <span>Tất cả ({data.days.length} ngày)</span>
          </button>
          {data.days.map(day => (
            <button
              key={day.dayNumber}
              type="button"
              className={`${styles.dayPill} ${activeDay === day.dayNumber ? styles.dayPillActive : ''}`}
              aria-pressed={activeDay === day.dayNumber}
              onClick={() => jumpToDay(day.dayNumber)}
            >
              <strong>Ngày {day.dayNumber}</strong>
              <span>{dayHeadline(day, data.departurePortName)}</span>
            </button>
          ))}
        </div>

        <ol className={styles.rcTimeline} aria-label="Các ngày hành trình">
          {visibleDays.map(day => {
            const isSeaDay = day.portCalls.length === 0 && !(day.dayNumber === 1 && data.departurePortName)
            const isEmbark = day.dayNumber === 1 || day.portCalls.some(p => p.isEmbarkation)
            const isDisembark = day.portCalls.some(p => p.isDisembarkation)
            return <li
              id={`itinerary-day-${day.dayNumber}`}
              className={`${styles.rcDay} ${activeDay === day.dayNumber ? styles.rcDayActive : ''} ${isSeaDay ? styles.rcDaySea : ''}`}
              key={day.dayNumber}
            >
              <div className={styles.rcDayRail} aria-hidden="true">
                <span className={`${styles.rcDayNode} ${isEmbark || isDisembark ? styles.rcDayNodeAnchor : isSeaDay ? styles.rcDayNodeSea : ''}`}>
                  {day.dayNumber}
                </span>
              </div>
              <article className={styles.rcDayCard}>
                <header className={styles.dayHeader}>
                  <div className={styles.rcDayTitleGroup}>
                    <span className={styles.dayBadge}>Ngày {day.dayNumber}</span>
                    <h3>{dayHeadline(day, data.departurePortName)}</h3>
                  </div>
                  <time dateTime={day.date}>{day.date.split('-').reverse().join('/')}</time>
                </header>

                {day.dayNumber === 1 && data.departurePortName && !day.portCalls.some(port => port.isEmbarkation) &&
                  <div className={styles.port}>
                    <div className={styles.portHeading}>
                      <h4>Khởi hành từ {data.departurePortName}</h4>
                      <span className={styles.portRoleBadge}>Lên tàu</span>
                    </div>
                    <div className={styles.rcTimeChips}>
                      <span className={styles.rcTimeChip}>
                        <span>Khởi hành dự kiến</span>
                        <strong><PortTime instant={data.departureDatetime} zone={day.shipTimeZoneId} day={day.date} /></strong>
                      </span>
                    </div>
                  </div>}

                {isSeaDay && (
                  <div className={styles.rcSeaWithPhoto}>
                    <div className={styles.rcPortPhoto}>
                      <img src={experiencePhotos.seaDay} alt="Trải nghiệm trọn ngày trên biển" width="480" height="300" loading="lazy" />
                    </div>
                    <div className={styles.rcSeaBanner}>
                      <strong>Trải nghiệm trọn ngày trên biển</strong>
                      <p>Thư giãn tại boong hồ bơi vô cực, thưởng thức ẩm thực đa quốc gia và tận hưởng các hoạt động giải trí đặc sắc trên du thuyền (không ghé cảng trong ngày này).</p>
                    </div>
                  </div>
                )}

                {day.portCalls.length > 0 &&
                  <ol className={styles.ports} aria-label="Các mốc tại cảng">
                    {day.portCalls.map(port => {
                      const portPhoto = portPhotoForName(port.portName)
                      const roleLabel = port.isEmbarkation ? 'Khởi hành' : port.isDisembarkation ? 'Kết thúc' : 'Ghé cảng'
                      return <li className={`${styles.port} ${styles.rcPortWithPhoto}`} key={port.sequence}>
                        <div className={styles.rcPortPhoto}>
                          <img src={portPhoto.image} alt={port.portName || portPhoto.caption} width="640" height="400" loading="lazy" />
                          <span className={styles.rcPhotoOverlayBadge}>{roleLabel}</span>
                        </div>
                        <div className={styles.rcPortDetails}>
                          <div className={styles.portHeading}>
                            <h4>{port.portName || 'Chưa có tên cảng'}{port.countryCode ? ' · ' + countryName(port.countryCode) : ''}</h4>
                          </div>
                          <p className={styles.rcPortStory}>{portPhoto.story}</p>
                          <div className={styles.rcTimeChips}>
                            {!port.isEmbarkation && (
                              <span className={styles.rcTimeChip}>
                                <span>Cập cảng</span>
                                <strong><PortTime instant={port.arrival} zone={port.portTimeZoneId} day={day.date} /></strong>
                              </span>
                            )}
                            {port.isDisembarkation ? (
                              <span className={styles.rcTimeChip}>
                                <span>Xuống tàu dự kiến</span>
                                <strong>
                                  {port.disembarkationStartsAt && port.disembarkationEndsAt
                                    ? <PortTimeRange start={port.disembarkationStartsAt} end={port.disembarkationEndsAt} zone={port.portTimeZoneId} day={day.date} />
                                    : 'Theo hướng dẫn khi cập cảng'}
                                </strong>
                              </span>
                            ) : (
                              <span className={styles.rcTimeChip}>
                                <span>{port.isEmbarkation ? 'Khởi hành' : 'Rời cảng'}</span>
                                <strong><PortTime instant={port.departure} zone={port.portTimeZoneId} day={day.date} /></strong>
                              </span>
                            )}
                          </div>
                          {port.destinationVisits.length > 0 && (
                            <div className={styles.rcVisitsWrap}>
                              <span className={styles.rcVisitsLabel}>Điểm tham quan nổi bật:</span>
                              <ul className={styles.visits} aria-label="Điểm tham quan">
                                {port.destinationVisits.map(visit => <li key={visit.sequence}>{visit.destinationName || 'Chưa có tên điểm tham quan'}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      </li>
                    })}
                  </ol>}
              </article>
            </li>
          })}
        </ol>
      </>}
    </div>
  </section>
}
