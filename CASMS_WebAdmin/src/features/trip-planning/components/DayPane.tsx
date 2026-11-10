import { SourcePicker } from './SourcePicker'
import { Button, Field, Panel } from '@/shared/ui'
import { domesticRegionLabel, kindLabels, shortTime, type Source, type Content, type Day, type Entry, type Stop, type Violation } from '../model/plan'
import { violationTarget } from '../model/violation-target'
import styles from '../Planning.module.css'
import { scheduleDayLabel, scheduleDayTypeLabel, stopRoleLabel } from '../model/day-labels'

type Props = {
  departurePorts?: { data: Source[]; loading: boolean; error: string; retry: () => void }
  onDeparture?: (value: Partial<Pick<Day, 'departurePortId' | 'departurePortName' | 'plannedDepartureTime'>>) => void
  onDisembarkation?: (portId: string | null, times?: Partial<Pick<Stop, 'plannedArrivalTime' | 'plannedDepartureTime'>>) => void
  content: Content
  day: Day
  editable: boolean
  busy: boolean
  violation?: Violation | null
  onType: (type: Day['dayType']) => void
  onTitle: (title: string) => void
  onStop: (stop?: Stop) => void
  onEntry: (kind: Entry['kind'], entry?: Entry, stopClientKey?: string) => void
  onRemoveStop: (stop: Stop) => void
  onRemoveEntry: (entry: Entry) => void
  onOrder: (key: string, target: string) => void
}

export function DayPane({
  departurePorts,
  onDeparture,
  onDisembarkation,
  content,
  day,
  editable,
  busy,
  violation,
  onType,
  onTitle,
  onStop,
  onEntry,
  onRemoveStop,
  onRemoveEntry,
  onOrder,
}: Props) {
  const target = violation ? violationTarget(violation) : null
  const fieldError = (id: string) => (target?.dayNumber === day.dayNumber && target?.fieldId === id ? violation?.message : undefined)
  const stops = content.stops.filter(s => s.arrivalDayNumber <= day.dayNumber && s.departureDayNumber >= day.dayNumber).sort((a, b) => a.stopOrder - b.stopOrder)
  const ordered = [...content.stops].sort((a, b) => a.stopOrder - b.stopOrder)
  const entries = content.entries.filter(entry => entry.startDayNumber <= day.dayNumber && entry.endDayNumber >= day.dayNumber)
  const savedEntries = entries.filter(entry => entry.kind !== 'SHORE_EXCURSION' || !stops.some(stop => stop.clientKey === entry.stopClientKey))

  const isFirstDay = day.dayNumber === 1
  const isLastDay = day.dayNumber === content.days.length
  const disembarkationStop = content.stops.find(s => s.isDisembarkation)
  const canConfigurePort = day.dayType === 'PORT_DAY'

  function agendaRow(entry: Entry) {
    const continuation = entry.startDayNumber !== day.dayNumber
    return (
      <article id={`planning-${entry.clientKey}`} key={entry.clientKey} className={styles.agendaRow}>
        <div className={styles.agendaTime}>
          {continuation ? 'Tiếp diễn' : shortTime(entry.plannedStartTime)}
          <span>{entry.endDayNumber === day.dayNumber ? `đến ${shortTime(entry.plannedEndTime)}` : `đến Ngày ${entry.endDayNumber} ${shortTime(entry.plannedEndTime)}`}</span>
        </div>
        <div className={styles.agendaBody}>
          <span className={styles.agendaKind}>
            {kindLabels[entry.kind]}
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
        </div>
        <div className={styles.actions}>
          <Button tone="text" disabled={busy} onClick={() => onEntry(entry.kind, entry)}>
            {editable && entry.kind !== 'SERVING_WINDOW' ? 'Chỉnh sửa' : 'Xem chi tiết'}
          </Button>
          {editable && entry.kind !== 'SERVING_WINDOW' && !continuation && (
            <Button tone="text" disabled={busy} onClick={() => onRemoveEntry(entry)}>
              Xóa mục
            </Button>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className={styles.dayPane}>
      {editable ? (
        <Panel title={scheduleDayLabel(day.dayNumber, content.days.length)}>
          <div className={styles.grid}>
            {(!isLastDay || !day.dayType || fieldError('planning-day-type')) && (
              <Field htmlFor="planning-day-type" label="Loại ngày" error={fieldError('planning-day-type')}>
                {isLastDay ? (
                  <input id="planning-day-type" readOnly aria-invalid="true" value="Ghé cảng trả khách" />
                ) : (
                  <select
                    id="planning-day-type"
                    aria-invalid={Boolean(fieldError('planning-day-type'))}
                    value={day.dayType ?? ''}
                    disabled={busy}
                    onChange={e => onType(e.target.value as Day['dayType'])}
                  >
                    <option value="">Chọn loại ngày</option>
                    <option value="SEA_DAY">Trên biển</option>
                    <option value="PORT_DAY">Ghé cảng</option>
                  </select>
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

          {isFirstDay && (
            <section className={styles.boundaryFields}>
              <h3>Khởi hành</h3>
              <div className={styles.grid}>
                <SourcePicker
                  id="planning-departure-port"
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
                      departurePortName: departurePorts?.data.find(port => port.id === id)?.label ?? null,
                    })
                  }
                />
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
              </div>
            </section>
          )}

          {isLastDay && (
            <section className={styles.boundaryFields}>
              <div className={styles.boundaryHeading}>
                <h3>Trả khách</h3>
                {content.days[0]?.departurePortId && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="compact"
                    disabled={busy}
                    onClick={() => onDisembarkation?.(content.days[0].departurePortId ?? null)}
                  >
                    Dùng lại cảng khởi hành ({content.days[0].departurePortName})
                  </Button>
                )}
              </div>
              <div className={styles.grid}>
                <SourcePicker
                  id="planning-disembarkation-port"
                  label="Cảng trả khách *"
                  placeholder="Chọn cảng trả khách"
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
                <Field htmlFor="planning-disembarkation-arrival" label="Giờ tàu đến (giờ địa phương của cảng) *">
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
                  label="Giờ hoàn tất trả khách (giờ địa phương của cảng) *"
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
            </section>
          )}
        </Panel>
      ) : (
        <dl className={styles.daySummary}>
          <div>
            <dt>{scheduleDayLabel(day.dayNumber, content.days.length)}</dt>
            <dd id="planning-day-type" tabIndex={-1}>
              {scheduleDayTypeLabel(day.dayNumber, content.days.length, day.dayType)}
            </dd>
            {isFirstDay && (
              <p>
                Cảng khởi hành: <strong>{day.departurePortName || 'Chưa chọn'}</strong> · Giờ khởi hành: {shortTime(day.plannedDepartureTime)}
              </p>
            )}
            {isLastDay && (
              <p>
                Cảng kết thúc: <strong>{disembarkationStop?.portName || 'Chưa chọn'}</strong>
                {disembarkationStop?.plannedDepartureTime
                  ? ` · Hoàn tất trả khách: ${shortTime(disembarkationStop.plannedDepartureTime)}`
                  : disembarkationStop?.plannedArrivalTime
                  ? ` · Giờ đến: ${shortTime(disembarkationStop.plannedArrivalTime)}`
                  : ''}
              </p>
            )}
            {fieldError('planning-day-type') && <p className={styles.error}>{fieldError('planning-day-type')}</p>}
          </div>
        </dl>
      )}

      {(!editable || day.dayType) && (
          <Panel title={day.dayType === 'SEA_DAY' ? 'Di chuyển trên biển' : 'Các điểm ghé cảng trong ngày'}>
            <div className={styles.sectionTitle}>
              <span className={styles.muted}>{canConfigurePort ? 'Giờ địa phương của từng cảng ghé' : 'Không xuống bờ trong ngày này'}</span>
              {editable && canConfigurePort && stops.length > 0 && (
                <Button disabled={busy} onClick={() => onStop()}>
                  Thêm điểm ghé cảng
                </Button>
              )}
            </div>
            {!stops.length ? (
              <div className={styles.empty}>
                <strong>
                  {!canConfigurePort && day.dayType === 'SEA_DAY'
                    ? 'Ngày di chuyển trên biển (không ghé cảng)'
                    : canConfigurePort
                    ? 'Chưa có điểm ghé cảng nào trong ngày này'
                    : 'Chưa chọn loại ngày'}
                </strong>
                {editable && canConfigurePort && (
                  <div style={{ marginTop: '12px' }}>
                    <Button disabled={busy} onClick={() => onStop()}>
                      Thêm điểm ghé cảng
                    </Button>
                  </div>
                )}
                {editable && !day.dayType && (
                  <Button tone="secondary" disabled={busy} onClick={() => document.getElementById('planning-day-type')?.focus()}>
                    Chọn loại ngày
                  </Button>
                )}
              </div>
            ) : (
              <div className={styles.cards}>
                {stops.map(stop => {
                  const index = ordered.findIndex(s => s.clientKey === stop.clientKey)
                  return (
                    <article
                      id={`planning-${stop.clientKey}`}
                      key={stop.clientKey}
                      className={styles.item}
                      draggable={editable && !busy}
                      onDragStart={e => e.dataTransfer.setData('text/plain', stop.clientKey)}
                      onDragOver={e => {
                        if (editable && !busy) e.preventDefault()
                      }}
                      onDrop={e => {
                        if (editable && !busy) {
                          e.preventDefault()
                          onOrder(e.dataTransfer.getData('text/plain'), stop.clientKey)
                        }
                      }}
                    >
                      <div className={styles.cardHead}>
                        <div>
                          <h3>
                            {stop.stopOrder}. {stop.portName ?? 'Cảng'}
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
                          {stop.arrivalDayNumber < day.dayNumber && <p className={styles.muted}>Tiếp diễn cùng lần ghé từ Ngày {stop.arrivalDayNumber}.</p>}
                        </div>
                        <div className={styles.actions}>
                          <Button tone="text" disabled={busy} onClick={() => onStop(stop)}>
                            {editable ? 'Chỉnh sửa' : 'Xem chi tiết'}
                          </Button>
                          {editable && (
                            <>
                              {ordered.length > 1 && (
                                <>
                                  <Button
                                    tone="text"
                                    aria-label={'Đưa lần ghé ' + stop.stopOrder + ' · ' + (stop.portName ?? 'Cảng') + ' lên trước'}
                                    disabled={busy || index <= 0}
                                    onClick={() => onOrder(stop.clientKey, ordered[index - 1].clientKey)}
                                  >
                                    Đưa lên trước
                                  </Button>
                                  <Button
                                    tone="text"
                                    aria-label={'Đưa lần ghé ' + stop.stopOrder + ' · ' + (stop.portName ?? 'Cảng') + ' xuống sau'}
                                    disabled={busy || index < 0 || index === ordered.length - 1}
                                    onClick={() => onOrder(stop.clientKey, ordered[index + 1].clientKey)}
                                  >
                                    Đưa xuống sau
                                  </Button>
                                </>
                              )}
                              <Button tone="text" disabled={busy} onClick={() => onRemoveStop(stop)}>
                                Xóa lần ghé
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {editable && (
                        <Button tone="secondary" disabled={busy} onClick={() => onEntry('SHORE_EXCURSION', undefined, stop.clientKey)}>
                          Thêm tour tham quan trên bờ
                        </Button>
                      )}
                      {entries.filter(entry => entry.kind === 'SHORE_EXCURSION' && entry.stopClientKey === stop.clientKey).map(agendaRow)}
                    </article>
                  )
                })}
              </div>
            )}
          </Panel>
      )}
      {savedEntries.length > 0 && (
        <Panel title="Nội dung đã lưu">
          {savedEntries.map(agendaRow)}
        </Panel>
      )}
    </div>
  )
}
