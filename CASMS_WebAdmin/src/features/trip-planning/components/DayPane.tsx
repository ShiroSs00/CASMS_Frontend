import { useId } from 'react'
import { describeRouteDays, projectRoute } from '../model/route-order'
import { SourcePicker } from './SourcePicker'
import { Button, Field, Panel } from '@/shared/ui'
import { domesticRegionLabel, kindLabels, shortTime, timeNumber, type Source, type Content, type Day, type Entry, type Stop, type Violation } from '../model/plan'
import { violationTarget } from '../model/violation-target'
import styles from '../Planning.module.css'
import { stopRoleLabel } from '../model/day-labels'

type Props = {
  departurePorts?: { data: Source[]; loading: boolean; error: string; retry: () => void }
  departureWindow?: { earliest?: string | null; latest?: string | null }
  onDeparture?: (value: Partial<Pick<Day, 'departurePortId' | 'departurePortName' | 'plannedDepartureTime'>>) => void
  onDisembarkation?: (portId: string | null, times?: Partial<Pick<Stop, 'plannedArrivalTime' | 'plannedDepartureTime'>>) => void
  content: Content
  day: Day
  editable: boolean
  busy: boolean
  violation?: Violation | null
  violations?: Violation[]
  onType: (type: Day['dayType']) => void
  onTitle: (title: string) => void
  onStop: (stop?: Stop, allAboardOnly?: boolean) => void
  onEntry: (kind: Entry['kind'], entry?: Entry, stopClientKey?: string) => void
  onRemoveStop: (stop: Stop) => void
  onRemoveEntry: (entry: Entry) => void
}

export function DayPane({
  departurePorts,
  departureWindow,
  onDeparture,
  onDisembarkation,
  content,
  day,
  editable,
  busy,
  violation,
  violations = [],
  onType,
  onTitle,
  onStop,
  onEntry,
  onRemoveStop,
  onRemoveEntry,
}: Props) {
  const heading = useId()
  const target = violation ? violationTarget(violation) : null
  const fieldError = (id: string) => {
    if (target?.dayNumber === day.dayNumber && target.fieldId === id) return violation?.message
    const field = id === 'planning-disembarkation-arrival' ? 'plannedArrivalTime' : id === 'planning-disembarkation-time' ? 'plannedDepartureTime' : (id === 'planning-ending-port-info' || id === 'planning-disembarkation-port') ? 'portId' : null
    return violations.find(issue => {
      const location = violationTarget(issue, content)
      return location.dayNumber === day.dayNumber && location.fieldId === id
        || field && disembarkationStop && location.key === disembarkationStop.clientKey && issue.field === field
    })?.message
  }
  const stops = content.stops.filter(s => s.arrivalDayNumber <= day.dayNumber && s.departureDayNumber >= day.dayNumber).sort((a, b) => a.stopOrder - b.stopOrder)
  const route = projectRoute(content)
  const daySummary = describeRouteDays(content, route).find(summary => summary.day.key === day.key)
  const entries = content.entries.filter(entry => entry.startDayNumber <= day.dayNumber && entry.endDayNumber >= day.dayNumber)
    .toSorted((a, b) => a.startDayNumber - b.startDayNumber || a.plannedStartTime.localeCompare(b.plannedStartTime))

  const isFirstDay = day.dayNumber === 1
  const isLastDay = day.dayNumber === content.days.length
  const disembarkationStop = content.stops.find(s => s.isDisembarkation)
  const hasEndingTours = Boolean(disembarkationStop && content.entries.some(entry => entry.kind === 'SHORE_EXCURSION' && entry.stopClientKey === disembarkationStop.clientKey))
  const legacyDeparture = isFirstDay ? stops.find(stop => stop.isEmbarkation) : undefined
  const visits = stops.filter(stop => !stop.isEmbarkation && (!stop.isDisembarkation || !isLastDay))
  const canConfigurePort = day.dayType === 'PORT_DAY'
  const editEndingInline = editable && !hasEndingTours && (!disembarkationStop || disembarkationStop.callType === 'NORMAL')

  function agendaRow(entry: Entry) {
    const continuation = entry.startDayNumber !== day.dayNumber
    const port = entry.kind === 'SHORE_EXCURSION' ? content.stops.find(stop => stop.clientKey === entry.stopClientKey)?.portName : null
    const entryErrors = violations.filter(issue => issue.clientKey === entry.clientKey)
    return (
      <article id={`planning-${entry.clientKey}`} key={entry.clientKey} className={styles.agendaRow}>
        <div className={styles.agendaTime}>
          {continuation ? 'Tiếp diễn' : shortTime(entry.plannedStartTime)}
          <span>{entry.endDayNumber === day.dayNumber ? `đến ${shortTime(entry.plannedEndTime)}` : `đến Ngày ${entry.endDayNumber} ${shortTime(entry.plannedEndTime)}`}</span>
        </div>
        <div className={styles.agendaBody}>
          <span className={styles.agendaKind}>
            {kindLabels[entry.kind]}
            {port && ' · ' + port}
            {entry.kind === 'SHORE_EXCURSION' && entry.destinationName && ' · ' + entry.destinationName}
            {entry.kind === 'SERVING_WINDOW' ? ' · Dữ liệu lịch sử · Chỉ xem' : ''}
          </span>
          <h3>{entry.title || kindLabels[entry.kind]}</h3>
          {continuation && entry.kind !== 'SERVING_WINDOW' && (
            <p className={styles.agendaMeta}>Từ Ngày {entry.startDayNumber} {shortTime(entry.plannedStartTime)} · Chỉnh sửa áp dụng cho toàn bộ mục.</p>
          )}
          {(entry.meetingPoint || entry.locationText || entry.displayLocation) && (
            <p className={styles.agendaMeta}>
              {[entry.meetingPoint ? `Tập trung: ${entry.meetingPoint}` : null, (entry.locationText || entry.displayLocation)?.trim() !== entry.meetingPoint?.trim() ? entry.locationText || entry.displayLocation : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {(entry.deckId || entry.cabinId) && (
            <p className={styles.agendaMeta}>{entry.referenceShipName ? `Tàu tham chiếu: ${entry.referenceShipName}` : 'Vị trí tham chiếu theo hoạt động nguồn'}</p>
          )}
          {entry.categoryName && <p className={styles.agendaMeta}>{entry.categoryName}</p>}
          {entry.notes && <p>{entry.notes}</p>}
          {entryErrors.map((issue, idx) => (
            <p key={`${entry.clientKey}:${issue.code}:${idx}`} className={styles.error} role="alert">{issue.message}</p>
          ))}
        </div>
        <div className={styles.actions}>
          <Button tone="text" disabled={busy} onClick={() => onEntry(entry.kind, entry)}>
            {editable && entry.kind === 'SHORE_EXCURSION' ? 'Chỉnh sửa' : 'Xem chi tiết'}
          </Button>
          {editable && entry.kind === 'SHORE_EXCURSION' && !continuation && (
            <Button tone="text" disabled={busy} onClick={() => onRemoveEntry(entry)}>
              Xóa mục
            </Button>
          )}
        </div>
      </article>
    )
  }

  function shoreTours(stop: Stop) {
    const tours = entries.filter(entry => entry.kind === 'SHORE_EXCURSION' && entry.stopClientKey === stop.clientKey)
    const hasDeadline = Boolean(stop.allAboardDayNumber && stop.allAboardTime)
    const hasPlannedDestination = Boolean(stop.destinationId || stop.visits?.length)
    const withinDeparture = stop.allAboardDayNumber != null && Boolean(stop.allAboardTime) &&
      (!stop.plannedDepartureTime || timeNumber(stop.allAboardDayNumber, stop.allAboardTime) <= timeNumber(stop.departureDayNumber, stop.plannedDepartureTime))
    const canAddTour = stop.allAboardDayNumber != null && Boolean(stop.allAboardTime && stop.plannedArrivalTime) &&
      timeNumber(stop.allAboardDayNumber, stop.allAboardTime) > timeNumber(stop.arrivalDayNumber, stop.plannedArrivalTime) &&
      withinDeparture && hasPlannedDestination
    return <>
      {editable && (canAddTour
        ? <Button tone="secondary" size="compact" disabled={busy} onClick={() => onEntry('SHORE_EXCURSION', undefined, stop.clientKey)}>Thêm tour bờ</Button>
        : <p className={hasDeadline && !withinDeparture ? styles.error : styles.muted} role={hasDeadline && !withinDeparture ? 'alert' : undefined}>
            {hasDeadline && !withinDeparture
              ? 'Hạn trở lại tàu đang vượt quá giờ kết thúc / giờ rời cảng. Hãy chỉnh lại hạn trở lại tàu.'
              : !hasDeadline
                ? 'Đặt hạn trở lại tàu và thêm Điểm tham quan để thêm tour bờ.'
                : !hasPlannedDestination
                  ? 'Thêm ít nhất một Điểm tham quan trong lần ghé cảng để thêm tour bờ.'
                  : 'Cần đủ thời gian từ lúc tàu đến đến hạn trở lại để thêm tour bờ.'}
          </p>)}
      {tours.map(agendaRow)}
    </>
  }

  const archivedEntries = entries.filter(entry => entry.kind !== 'SHORE_EXCURSION' || !stops.some(stop => stop.clientKey === entry.stopClientKey))

  return (
    <section className={`${styles.dayPane} ${styles.dayWorkspace}`} aria-labelledby={heading}>
      <header className={styles.dayHeader}>
        <p>Ngày {day.dayNumber}</p>
        <h2 id={heading}>{day.title?.trim() && day.title.trim() !== `Ngày ${day.dayNumber}` ? day.title :
          isFirstDay && isLastDay ? 'Khởi hành và kết thúc' :
          isFirstDay ? legacyDeparture?.portName || day.departurePortName || 'Khởi hành' :
          isLastDay ? disembarkationStop?.portName || 'Cảng cuối' : daySummary?.place || `Lịch ngày ${day.dayNumber}`}</h2>
      </header>
      <div className={styles.dayContent}>
          {isFirstDay && (
            <section className={styles.boundaryFields}>
              <h3>Giờ và cảng khởi hành</h3>
              {(!editable || legacyDeparture) && <div className={styles.portSummary}>
                <strong>{legacyDeparture?.portName || day.departurePortName || 'Chưa chọn cảng'}</strong>
                <div><small>Khởi hành · giờ Việt Nam</small><b>{shortTime(legacyDeparture?.plannedDepartureTime || day.plannedDepartureTime)}</b></div>
              </div>}
              {legacyDeparture ? <Button tone="secondary" size="compact" disabled={busy} onClick={() => onStop(legacyDeparture)}>{editable ? 'Chỉnh cảng và giờ khởi hành' : 'Xem chi tiết cảng khởi hành'}</Button> : editable && (
                <div className={styles.boundaryEditor}>
                <SourcePicker
                  id="planning-departure-port"
                  portLayout
                  label="Cảng khởi hành *"
                  placeholder="Chọn cảng khởi hành"
                  emptyMessage="Chưa có cảng phù hợp phạm vi chuyến."
                  value={day.departurePortId ?? ''}
                  selectedLabel={day.departurePortName ?? undefined}
                  options={departurePorts?.data ?? []}
                  loading={departurePorts?.loading ?? false}
                  loadError={departurePorts?.error ?? ''}
                  retry={() => departurePorts?.retry()}
                  readOnly={busy}
                  onBlur={() => {}}
                  error={fieldError('planning-departure-port')}
                  onChange={id =>
                    onDeparture?.({
                      departurePortId: id || null,
                      departurePortName: departurePorts?.data.find(port => port.id === id)?.name ?? null,
                    })
                  }
                />
              <div className={styles.timeGrid}>
                {departureWindow?.earliest && departureWindow?.latest ? (
                  <div className={styles.portSummary}>
                    <div>
                      <small>Khung giờ khởi hành cho phép (giờ Việt Nam)</small>
                      <b>{shortTime(departureWindow.earliest)} – {shortTime(departureWindow.latest)}</b>
                    </div>
                    <small>Giờ khởi hành cụ thể sẽ được chọn trong khung này khi tạo tour.</small>
                  </div>
                ) : (
                  <Field
                    htmlFor="planning-departure-time"
                    label="Giờ khởi hành (giờ Việt Nam) *"
                    error={fieldError('planning-departure-time')}
                  >
                    <input
                      id="planning-departure-time"
                      type="time"
                      step="60"
                      required
                      value={day.plannedDepartureTime ?? ''}
                      disabled={busy}
                      onChange={event => onDeparture?.({ plannedDepartureTime: event.target.value || null })}
                    />
                  </Field>
                )}
              </div>
                </div>)}
            </section>
          )}

          {isLastDay && (
            <section className={styles.boundaryFields}>
              <h3>Cảng cuối và giờ tàu đến</h3>
              {!editEndingInline && <div className={styles.portSummary}>
                <strong>{disembarkationStop?.portName || 'Chưa chọn cảng'}</strong>
                <div><small>Tàu cập cảng</small><b>{shortTime(disembarkationStop?.plannedArrivalTime)}</b></div>
                <div><small>Kết thúc hành trình</small><b>{shortTime(disembarkationStop?.plannedDepartureTime)}</b></div>
              </div>}
              {editEndingInline && <div className={styles.boundaryEditor}>
                <SourcePicker
                  portLayout
                  id="planning-disembarkation-port"
                  label="Cảng cuối *"
                  placeholder="Chọn cảng cuối"
                  emptyMessage="Chưa có cảng phù hợp phạm vi chuyến."
                  value={disembarkationStop?.portId ?? ''}
                  selectedLabel={disembarkationStop?.portName ?? undefined}
                  options={departurePorts?.data ?? []}
                  loading={departurePorts?.loading ?? false}
                  loadError={departurePorts?.error ?? ''}
                  retry={() => departurePorts?.retry()}
                  readOnly={busy}
                  onBlur={() => {}}
                  error={fieldError('planning-ending-port-info')}
                  onChange={id => onDisembarkation?.(id || null)}
                />
              <div className={styles.timeGrid}>
                <Field htmlFor="planning-disembarkation-arrival" label="Giờ tàu dự kiến cập cảng *" error={fieldError('planning-disembarkation-arrival')}>
                  <input
                    id="planning-disembarkation-arrival"
                    type="time"
                    step="60"
                    required
                    value={disembarkationStop?.plannedArrivalTime ?? ''}
                    disabled={busy || !disembarkationStop?.portId}
                    onChange={event =>
                      onDisembarkation?.(disembarkationStop?.portId ?? null, { plannedArrivalTime: event.target.value || null })
                    }
                  />
                </Field>
                <Field
                  htmlFor="planning-disembarkation-time"
                  label="Giờ kết thúc hành trình *"
                  error={fieldError('planning-disembarkation-time')}
                >
                  <input
                    id="planning-disembarkation-time"
                    type="time"
                    step="60"
                    required
                    value={disembarkationStop?.plannedDepartureTime ?? ''}
                    disabled={busy || !disembarkationStop?.portId}
                    onChange={event =>
                      onDisembarkation?.(disembarkationStop?.portId ?? null, { plannedDepartureTime: event.target.value || null })
                    }
                  />
                </Field>
              </div>
              </div>}
              {disembarkationStop?.allAboardTime && (
                <p>Hạn hành khách trở lại tàu: Ngày {disembarkationStop.allAboardDayNumber} {shortTime(disembarkationStop.allAboardTime)}</p>
              )}
              {Boolean(disembarkationStop?.visits?.length) && (
                <p className={styles.muted}>
                  Điểm tham quan: {disembarkationStop!.visits!.map(visit => visit.destinationName?.trim() || 'Điểm đến đã lưu').join(', ')}
                </p>
              )}
              {disembarkationStop && violations.filter(issue => issue.clientKey === disembarkationStop.clientKey && issue.field === 'allAboardTime').map((issue, idx) => (
                <p key={`${disembarkationStop.clientKey}:allAboard:${idx}`} className={styles.error} role="alert">{issue.message}</p>
              ))}
              {disembarkationStop && (
                <div className={styles.actions}>
                  <Button
                    tone="secondary"
                    size="compact"
                    autoWidth
                    disabled={busy || (editEndingInline && (!disembarkationStop.plannedArrivalTime || !disembarkationStop.plannedDepartureTime))}
                    onClick={() => onStop(disembarkationStop, editEndingInline)}
                  >
                    {editEndingInline ? 'Hạn trở lại, cập bến & điểm tham quan' : editable ? 'Chỉnh cảng và giờ kết thúc' : 'Xem chi tiết cảng kết thúc'}
                  </Button>
                </div>
              )}
              {disembarkationStop && shoreTours(disembarkationStop)}
            </section>
          )}
          {editable && <section className={styles.boundaryFields} aria-label="Thông tin trong ngày">
          <h3>Nội dung trong ngày</h3>
          <div className={styles.grid}>
            {(!isLastDay || !day.dayType || fieldError('planning-day-type')) && (
              <Field htmlFor="planning-day-type" label="Tàu ghé cảng hay đi trên biển?" error={fieldError('planning-day-type')}>
                {isLastDay ? (
                  <input id="planning-day-type" readOnly aria-invalid={Boolean(fieldError('planning-day-type'))} value="Có cảng kết thúc" />
                ) : (
                  <select
                    id="planning-day-type"
                    aria-invalid={Boolean(fieldError('planning-day-type'))}
                    aria-describedby={isFirstDay ? 'planning-day-type-help' : undefined}
                    value={day.dayType ?? ''}
                    disabled={busy}
                    onChange={e => onType(e.target.value as Day['dayType'])}
                  >
                    <option value="">Chọn trên biển hoặc ghé cảng</option>
                    <option value="SEA_DAY">Trên biển</option>
                    <option value="PORT_DAY">Có ghé cảng</option>
                  </select>
                )}
                {!isLastDay && isFirstDay && (
                  <small id="planning-day-type-help" className={styles.muted}>
                    Sau khi rời cảng khởi hành, chọn &ldquo;Trên biển&rdquo; nếu tàu đi thẳng sang ngày sau hoặc &ldquo;Có ghé cảng&rdquo; nếu có ghé thêm cảng trung gian trong Ngày 1.
                  </small>
                )}
              </Field>
            )}

            <Field htmlFor="planning-day-title" label="Tên ngày (tùy chọn)" error={fieldError('planning-day-title')}>
              <input
                id="planning-day-title"
                aria-invalid={Boolean(fieldError('planning-day-title'))}
                value={day.title ?? ''}
                disabled={busy}
                maxLength={200}
                onChange={e => onTitle(e.target.value)}
              />
            </Field>
          </div>
          </section>}

      {((canConfigurePort && !isLastDay) || visits.length > 0) && (
          <Panel title={day.dayType === 'SEA_DAY' ? 'Di chuyển trên biển' : 'Các điểm ghé cảng trong ngày'}>
            <div className={styles.sectionTitle}>
              <span className={styles.muted}>{canConfigurePort ? 'Giờ địa phương của từng cảng ghé' : 'Không xuống bờ trong ngày này'}</span>
              {editable && canConfigurePort && !isLastDay && (
                <Button tone="secondary" size="compact" disabled={busy} onClick={() => onStop()}>
                  {isFirstDay ? 'Thêm cảng ghé trung gian' : 'Thêm cảng ghé'}
                </Button>
              )}
            </div>
            {!visits.length ? (
              <p className={styles.muted}>
                {isFirstDay
                  ? 'Chỉ thêm nếu sau khi rời cảng khởi hành, tàu có ghé thêm một cảng trung gian ngay trong Ngày 1.'
                  : 'Thêm cảng ghé để đặt giờ tàu đến và giờ rời cảng.'}
              </p>
            ) : (
              <div className={styles.cards}>
                {visits.map(stop => {
                  const position = route.rows.find(row => row.key === stop.clientKey)?.position
                  const stopErrors = violations.filter(issue => issue.clientKey === stop.clientKey)
                  return (
                    <article
                      id={`planning-${stop.clientKey}`}
                      key={stop.clientKey}
                      className={styles.item}
                    >
                      <div className={styles.cardHead}>
                        <div>
                          <h3>
                            {position}. {stop.portName ?? 'Cảng'}
                          </h3>
                          {(stop.isEmbarkation || stop.isDisembarkation) && (
                            <p>
                              <strong>{stopRoleLabel(stop.isEmbarkation, stop.isDisembarkation)}</strong>
                            </p>
                          )}
                          <p>
                            Dự kiến: Ngày {stop.arrivalDayNumber} {shortTime(stop.plannedArrivalTime)} → Ngày {stop.departureDayNumber} {shortTime(stop.plannedDepartureTime)}
                          </p>
                          <p className={styles.muted}>
                            {stop.timeZoneId ?? 'Múi giờ cảng cần đối chiếu'} · {stop.callType === 'OVERNIGHT' ? 'Qua đêm' : stop.callType === 'LATE_NIGHT' ? 'Ghé cảng ban đêm' : 'Thông thường'}
                            {stop.isEmbarkation ? ' · Hành khách lên tàu' : ''}
                            {stop.isDisembarkation ? ' · Hành khách kết thúc chuyến' : ''}
                          </p>
                          {stop.countryCode === 'VN' && <p className={styles.muted}>{domesticRegionLabel(stop.domesticRegion)}</p>}
                          {stop.allAboardTime && <p>Hạn hành khách trở lại tàu: Ngày {stop.allAboardDayNumber} {shortTime(stop.allAboardTime)}</p>}
                          {Boolean(stop.visits?.length) && (
                            <p className={styles.muted}>
                              Điểm tham quan: {stop.visits!.map(visit => visit.destinationName?.trim() || 'Điểm đến đã lưu').join(', ')}
                            </p>
                          )}
                          {stop.arrivalDayNumber < day.dayNumber && <p className={styles.muted}>Tiếp diễn cùng lần ghé từ Ngày {stop.arrivalDayNumber}.</p>}
                          {stopErrors.map((issue, idx) => (
                            <p key={`${stop.clientKey}:${issue.code}:${idx}`} className={styles.error} role="alert">{issue.message}</p>
                          ))}
                        </div>
                        <div className={styles.actions}>
                          <Button tone="text" disabled={busy} onClick={() => onStop(stop)}>
                            {editable ? 'Chỉnh sửa' : 'Xem chi tiết'}
                          </Button>
                          {editable && (
                            <>
                              <Button tone="text" disabled={busy} onClick={() => onRemoveStop(stop)}>
                                Xóa lần ghé
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {shoreTours(stop)}
                    </article>
                  )
                })}
              </div>
            )}
          </Panel>
      )}
      {day.dayType === 'SEA_DAY' && !visits.length && <p className={styles.muted}>Ngày này tàu di chuyển trên biển, không ghé cảng.</p>}
      {legacyDeparture && shoreTours(legacyDeparture)}
      {archivedEntries.length > 0 && <details className={styles.dayEdit}><summary>Nội dung từ lịch trình cũ</summary>{archivedEntries.map(agendaRow)}</details>}
      </div>
    </section>
  )
}
