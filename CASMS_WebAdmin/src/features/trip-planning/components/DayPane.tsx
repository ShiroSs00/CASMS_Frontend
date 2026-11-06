import { SourcePicker } from './SourcePicker'
import { Button, Field, Panel } from '@/shared/ui'
import { SHIP_ZONE, domesticRegionLabel, kindLabels, shortTime, type Source, type Content, type Day, type Entry, type Stop, type Violation } from '../model/plan'
import { dayAgenda, type AgendaRow } from '../model/day-agenda'
import { violationTarget } from '../model/violation-target'
import styles from '../Planning.module.css'
import { scheduleDayLabel, scheduleDayTypeLabel, stopRoleLabel } from '../model/day-labels'

type Props = {
  departurePorts?: { data: Source[]; loading: boolean; error: string; retry: () => void }
  onDeparture?: (value: Partial<Pick<Day, 'departurePortId' | 'departurePortName' | 'plannedDepartureTime'>>) => void
  onDisembarkation?: (portId: string | null, plannedTime?: string | null) => void
  content: Content
  day: Day
  editable: boolean
  tab: 'route' | 'program'
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
  tab,
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
  const agenda = dayAgenda(content, day.dayNumber)

  const isFirstDay = day.dayNumber === 1
  const isLastDay = day.dayNumber === content.days.length
  const isSingleDayTrip = content.days.length === 1
  const disembarkationStop = content.stops.find(s => s.isDisembarkation)
  const canConfigurePort = day.dayType === 'PORT_DAY'
  const needsDeparture = isFirstDay && !day.departurePortId && !content.stops.some(s => s.isEmbarkation)
  const needsEnd = isLastDay && !disembarkationStop

  const dayRoleLabel = isSingleDayTrip
    ? 'Chuyến trong ngày'
    : isFirstDay
    ? 'Ngày khởi hành'
    : isLastDay
    ? 'Ngày kết thúc chuyến'
    : 'Ngày trong hành trình'

  function agendaRow(row: AgendaRow, stopTarget: boolean) {
    if (row.type === 'milestone')
      return (
        <article id={stopTarget ? `planning-${row.stop.clientKey}` : undefined} key={row.key} className={`${styles.agendaRow} ${styles.milestone}`}>
          <div className={styles.agendaTime}>{row.time ? shortTime(row.time) : row.label === 'Tiếp tục ghé cảng' ? 'Tiếp diễn' : 'Chưa có giờ'}</div>
          <div className={styles.agendaBody}>
            <h3>
              {row.label} · {row.stop.portName ?? 'Cảng'}
            </h3>
            <p className={styles.agendaMeta}>
              {row.label === 'Tiếp tục ghé cảng' ? `Cùng lần ghé từ Ngày ${row.stop.arrivalDayNumber}` : `Lần ghé ${row.stop.stopOrder}`}
            </p>
          </div>
          <Button tone="text" disabled={busy} onClick={() => onStop(row.stop)}>
            Xem lần ghé
          </Button>
        </article>
      )
    const entry = row.entry,
      continuation = entry.startDayNumber !== day.dayNumber
    return (
      <article id={`planning-${entry.clientKey}`} key={row.key} className={styles.agendaRow}>
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
      {tab === 'route' && (needsDeparture || needsEnd) && (
        <p className={styles.note}>
          <strong>{scheduleDayLabel(day.dayNumber, content.days.length)}</strong> ·{' '}
          {isSingleDayTrip
            ? 'Vui lòng xác định cảng khởi hành và cảng kết thúc (trả khách).'
            : isFirstDay
            ? 'Vui lòng chọn cảng khởi hành và giờ xuất phát.'
            : 'Vui lòng chọn cảng trả khách để hoàn tất chuyến.'}
        </p>
      )}

      {editable && tab === 'route' ? (
        <Panel title={scheduleDayLabel(day.dayNumber, content.days.length)}>
          {/* Thông tin vai trò và loại ngày */}
          <div className={styles.grid}>
            <Field htmlFor="planning-day-role" label="Vị trí trong chuyến">
              <input id="planning-day-role" readOnly value={dayRoleLabel} />
            </Field>

            <Field htmlFor="planning-day-type" label="Loại ngày hành trình" hint="Xác định tàu chạy liên tục trên biển hay có ghé cảng để hành khách tham quan." error={fieldError('planning-day-type')}>
              {isLastDay ? (
                <input id="planning-day-type" readOnly value="Cập cảng trả khách (Kết thúc chuyến)" />
              ) : (
                <>
                  <select
                    id="planning-day-type"
                    aria-invalid={Boolean(fieldError('planning-day-type'))}
                    value={day.dayType ?? ''}
                    disabled={busy}
                    onChange={e => onType(e.target.value as Day['dayType'])}
                  >
                    <option value="">-- Chọn loại ngày hành trình --</option>
                    <option value="SEA_DAY">Tàu chạy trên biển (Không ghé cảng)</option>
                    <option value="PORT_DAY">Tàu ghé cảng (Khách lên bờ tham quan)</option>
                  </select>
                  {day.dayType === 'SEA_DAY' && (
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#0369a1' }}>
                      🌊 Tàu chạy trên biển: Khách tham gia các hoạt động vui chơi, ẩm thực và giải trí trên tàu.
                    </div>
                  )}
                  {day.dayType === 'PORT_DAY' && (
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#0f766e' }}>
                      ⚓ Tàu ghé cảng: Tàu cập cảng để hành khách xuống bờ tham quan và trải nghiệm các tour du lịch.
                    </div>
                  )}
                </>
              )}
            </Field>

            <Field htmlFor="planning-day-title" label="Tên ngày (tùy chọn)" error={fieldError('planning-day-title')}>
              <input
                id="planning-day-title"
                placeholder="Nhập tên cho ngày này"
                aria-invalid={Boolean(fieldError('planning-day-title'))}
                value={day.title ?? ''}
                disabled={busy}
                maxLength={200}
                onChange={e => onTitle(e.target.value)}
              />
            </Field>
          </div>

          {/* TÁCH RIÊNG CẢNG KHỞI HÀNH (Ngày 1) */}
          {isFirstDay && (
            <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#0f2942', fontWeight: 600 }}>
                Cảng khởi hành (Điểm xuất phát)
              </h4>
              <div className={styles.grid}>
                <SourcePicker
                  resultLabel="cảng"
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
                  label="Giờ khởi hành dự kiến *"
                  hint="Giờ Việt Nam (HH:mm)."
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
            </div>
          )}

          {/* TÁCH RIÊNG CẢNG KẾT THÚC (Ngày cuối cùng) */}
          {isLastDay && (
            <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#0f2942', fontWeight: 600 }}>
                  Cảng kết thúc chuyến (Điểm trả khách)
                </h4>
                {content.days[0]?.departurePortId && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="compact"
                    disabled={busy}
                    onClick={() =>
                      onDisembarkation?.(
                        content.days[0].departurePortId ?? null,
                        disembarkationStop?.plannedDepartureTime ?? '18:00'
                      )
                    }
                  >
                    Dùng lại cảng khởi hành ({content.days[0].departurePortName})
                  </Button>
                )}
              </div>
              <div className={styles.grid}>
                <SourcePicker
                  resultLabel="cảng"
                  id="planning-disembarkation-port"
                  label="Cảng kết thúc chuyến (trả khách) *"
                  placeholder="Chọn cảng kết thúc"
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
                  onChange={id =>
                    onDisembarkation?.(
                      id || null,
                      disembarkationStop?.plannedDepartureTime ?? '18:00'
                    )
                  }
                />
                <Field
                  htmlFor="planning-disembarkation-time"
                  label="Giờ dự kiến hoàn tất trả khách *"
                  hint="Giờ Việt Nam (HH:mm)."
                  error={fieldError('planning-disembarkation-time')}
                >
                  <input
                    id="planning-disembarkation-time"
                    type="time"
                    step="60"
                    required
                    value={disembarkationStop?.plannedDepartureTime ?? disembarkationStop?.plannedArrivalTime ?? ''}
                    disabled={busy || !disembarkationStop?.portId}
                    onChange={event =>
                      onDisembarkation?.(disembarkationStop?.portId ?? null, event.target.value || null)
                    }
                  />
                </Field>
              </div>
            </div>
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
          <div>
            <dt>Tên ngày</dt>
            <dd id="planning-day-title" tabIndex={-1}>
              {day.title || 'Chưa đặt tên'}
            </dd>
            {fieldError('planning-day-title') && <p className={styles.error}>{fieldError('planning-day-title')}</p>}
          </div>
        </dl>
      )}

      {tab === 'route' ? (
        editable && !day.dayType ? null : (
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
                    : 'Bắt đầu bằng chọn hình thức ngày'}
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
                    Chọn hình thức ngày
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
                    </article>
                  )
                })}
              </div>
            )}
          </Panel>
        )
      ) : (
        <Panel title="Chương trình trong ngày">
          {editable && (
            <div className={styles.agendaToolbar}>
              <div className={styles.actions}>
                <Button disabled={busy} onClick={() => onEntry('ONBOARD_ACTIVITY')}>
                  Thêm hoạt động trên tàu
                </Button>
                <Button
                  tone="secondary"
                  disabled={busy || !stops.length}
                  aria-describedby={!stops.length ? 'planning-shore-reason' : undefined}
                  onClick={() => onEntry('SHORE_EXCURSION', undefined, stops.length === 1 ? stops[0].clientKey : undefined)}
                >
                  Thêm tour tham quan trên bờ
                </Button>
              </div>
              {!stops.length && (
                <p id="planning-shore-reason" className={styles.muted}>
                  Thêm điểm ghé cảng trong Tuyến tàu để lập tour tham quan trên bờ.
                </p>
              )}
            </div>
          )}
          {!agenda.some(group => group.rows.some(row => row.type === 'entry')) && <p className={styles.empty}>Chưa có hoạt động hoặc tour tham quan trong ngày này.</p>}
          <div className={styles.agenda}>
            {agenda
              .filter(group => group.rows.some(row => row.type === 'entry'))
              .map(group => (
                <section className={styles.agendaGroup} key={group.key}>
                  <div className={styles.clockHeading}>
                    <h3>{group.timeZoneId === SHIP_ZONE ? 'Chương trình · Giờ Việt Nam' : 'Tour tham quan · Giờ địa phương của cảng'}</h3>
                    <p>{group.timeZoneId === SHIP_ZONE ? 'Asia/Ho_Chi_Minh' : `${group.clocks.filter(clock => clock !== 'Tàu · Giờ Việt Nam').join(', ')} · ${group.timeZoneId ?? 'Chưa có múi giờ'}`}</p>
                  </div>
                  {group.rows.filter(row => row.type === 'entry').map(row => agendaRow(row, false))}
                </section>
              ))}
          </div>
          {agenda.some(group => group.rows.some(row => row.type === 'milestone')) && (
            <section className={styles.portMilestones} aria-label="Mốc ghé cảng trong ngày">
              <h3>Mốc ghé cảng trong ngày</h3>
              <div className={styles.agenda}>
                {agenda
                  .filter(group => group.rows.some(row => row.type === 'milestone'))
                  .map(group => {
                    const targetedStops = new Set<string>()
                    return (
                      <section className={styles.agendaGroup} key={group.key}>
                        <div className={styles.clockHeading}>
                          <h4>{group.clocks.filter(clock => clock !== 'Tàu · Giờ Việt Nam').join(', ') || 'Cảng ghé'}</h4>
                          <p>Giờ địa phương của cảng · {group.timeZoneId ?? 'Chưa có múi giờ'}</p>
                        </div>
                        {group.rows
                          .filter(row => row.type === 'milestone')
                          .map(row => {
                            const stopTarget = row.type === 'milestone' && !targetedStops.has(row.stop.clientKey)
                            if (row.type === 'milestone') targetedStops.add(row.stop.clientKey)
                            return agendaRow(row, stopTarget)
                          })}
                      </section>
                    )
                  })}
              </div>
            </section>
          )}
        </Panel>
      )}
    </div>
  )
}
