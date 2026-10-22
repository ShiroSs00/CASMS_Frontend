import { useState, type FormEvent } from 'react'
import { useSessionAccess } from '@/shared/auth'

import { Button, Field, Notice, Panel } from '@/shared/ui'

import type { CruiseStop, CruiseStopDraft, Destination, ItineraryDay, Port } from '../model/itinerary'
import { itineraryApi } from '../api/itinerary-api'
import styles from './Itineraries.module.css'

function localDateTime(value: string) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function StopEditor({ itineraryId, stop, days, ports, destinations, busy, editable, onSave, onValidate, onRemove }: {
  itineraryId: string
  stop: CruiseStop | null
  days: ItineraryDay[]
  ports: Port[]
  destinations: Destination[]
  busy: boolean
  editable: boolean
  onSave: (draft: CruiseStopDraft) => void
  onValidate: () => void
  onRemove: () => void
}) {
  const access = useSessionAccess()
  const [draft, setDraft] = useState<CruiseStopDraft>({
    itineraryId, arrivalItineraryDayId: stop?.arrivalItineraryDayId ?? '', departureItineraryDayId: stop?.departureItineraryDayId ?? '',
    portId: stop?.portId ?? '', destinationId: stop?.destinationId ?? null, stopOrder: stop?.stopOrder ?? '',
    plannedArrival: localDateTime(stop?.plannedArrival ?? ''), plannedDeparture: localDateTime(stop?.plannedDeparture ?? ''),
    callType: stop?.callType ?? 'NORMAL', arrivalMethod: stop?.arrivalMethod ?? 'BERTH',
  })
  const [error, setError] = useState('')
  const [stopInfo, setStopInfo] = useState('')
  function update<K extends keyof CruiseStopDraft>(key: K, value: CruiseStopDraft[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  async function checkDuration() {
    if (!stop) return
    setError(''); setStopInfo('')
    try {
      const mins = await itineraryApi.getStopDuration(stop.cruiseStopId)
      setStopInfo(`Thời lượng dừng dự kiến: ${mins} phút (${Math.floor(mins / 60)}h ${mins % 60}m).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tính được thời lượng.')
    }
  }
  async function checkAvailability() {
    if (!stop) return
    setError(''); setStopInfo('')
    try {
      await itineraryApi.checkStopPortAvailability(stop.cruiseStopId)
      setStopInfo('Chức năng đánh giá khả dụng cảng chưa được triển khai đầy đủ. Cần xác nhận với bộ phận điều phối cảng.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không kiểm tra được cảng.')
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!editable || busy || !access.has(stop ? 'CRUISE_STOP_UPDATE' : 'CRUISE_STOP_ADD')) return
    if ((stop || draft.stopOrder !== '') && (typeof draft.stopOrder !== 'number' || !Number.isSafeInteger(draft.stopOrder) || draft.stopOrder < 1)) { setError('Thứ tự điểm dừng phải là số nguyên dương.'); return }
    if (!days.some(day => day.itineraryDayId === draft.arrivalItineraryDayId) || !days.some(day => day.itineraryDayId === draft.departureItineraryDayId) || !ports.some(port => port.portId === draft.portId)) { setError('Chọn ngày và cảng từ danh sách đã tải.'); return }
    if (!Number.isFinite(Date.parse(draft.plannedArrival)) || !Number.isFinite(Date.parse(draft.plannedDeparture))) { setError('Nhập thời gian đến và rời cảng hợp lệ.'); return }
    if (new Date(draft.plannedDeparture) <= new Date(draft.plannedArrival)) { setError('ETD phải sau ETA.'); return }
    setError(''); onSave(draft)
  }
  return <Panel title={stop ? `Stop ${String(stop.stopOrder).padStart(2, '0')} · ${stop.portName ?? 'Điểm dừng'}` : 'Thêm điểm dừng'}>
    {stop && !editable && <dl><dt>Cảng</dt><dd>{stop.portName ?? 'Chưa có tên cảng'}</dd><dt>Đến dự kiến</dt><dd>{new Date(stop.plannedArrival).toLocaleString('vi-VN')}</dd><dt>Rời dự kiến</dt><dd>{new Date(stop.plannedDeparture).toLocaleString('vi-VN')}</dd><dt>Ngày đến / rời</dt><dd>{days.find(day => day.itineraryDayId === stop.arrivalItineraryDayId)?.dayNumber ?? '—'} / {days.find(day => day.itineraryDayId === stop.departureItineraryDayId)?.dayNumber ?? '—'}</dd><dt>Điểm đến</dt><dd>{destinations.find(item => item.destinationId === stop.destinationId)?.destinationName ?? 'Chưa chọn'}</dd><dt>Loại ghé / cập cảng</dt><dd>{stop.callType} · {stop.arrivalMethod}</dd></dl>}
    <form className={styles.stopForm} onSubmit={submit}>
      {editable && <>
      <Field htmlFor="stop-port" label="Cảng"><select id="stop-port" required disabled={!editable || busy} value={draft.portId} onChange={(event) => update('portId', event.target.value)}><option value="">Chọn cảng</option>{stop && !ports.some((port) => port.portId === stop.portId) && <option value={stop.portId}>{stop.portName ?? 'Cảng đã chọn · Chưa tải được tên'}</option>}{ports.map((port) => <option key={port.portId} value={port.portId}>{port.portName}</option>)}</select></Field>
      <Field htmlFor="stop-arrival" label="ETA"><input id="stop-arrival" type="datetime-local" required disabled={!editable || busy} value={draft.plannedArrival} onChange={(event) => update('plannedArrival', event.target.value)} /></Field>
      <Field htmlFor="stop-departure" label="ETD"><input id="stop-departure" type="datetime-local" required disabled={!editable || busy} value={draft.plannedDeparture} onChange={(event) => update('plannedDeparture', event.target.value)} /></Field>
      <p className={styles.muted}>Thời gian nhập theo {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      {ports.find(port => port.portId === draft.portId) && <p className={styles.muted}>Múi giờ cảng: {ports.find(port => port.portId === draft.portId)?.timeZoneId}. Giờ nhập ở trên được chuyển thành thời điểm thống nhất khi lưu.</p>}
      <Field htmlFor="stop-arrival-day" label="Ngày đến"><select id="stop-arrival-day" required disabled={!editable || busy} value={draft.arrivalItineraryDayId} onChange={(event) => update('arrivalItineraryDayId', event.target.value)}><option value="">Chọn ngày</option>{days.map((day) => <option key={day.itineraryDayId} value={day.itineraryDayId}>Ngày {day.dayNumber} · {day.date}</option>)}</select></Field>
      <Field htmlFor="stop-departure-day" label="Ngày rời"><select id="stop-departure-day" required disabled={!editable || busy} value={draft.departureItineraryDayId} onChange={(event) => update('departureItineraryDayId', event.target.value)}><option value="">Chọn ngày</option>{days.map((day) => <option key={day.itineraryDayId} value={day.itineraryDayId}>Ngày {day.dayNumber} · {day.date}</option>)}</select></Field>
      <Field htmlFor="stop-order" label="Thứ tự" hint={stop ? undefined : 'Để trống để hệ thống tự đánh số.'}><input id="stop-order" type="number" min={1} required={Boolean(stop)} disabled={!editable || busy} value={draft.stopOrder} onChange={(event) => update('stopOrder', event.target.value === '' ? '' : Number(event.target.value))} /></Field>
      <Field htmlFor="stop-destination" label="Điểm đến"><select id="stop-destination" disabled={!editable || busy} value={draft.destinationId ?? ''} onChange={(event) => update('destinationId', event.target.value || null)}><option value="">Không chọn</option>{destinations.map((destination) => <option key={destination.destinationId} value={destination.destinationId}>{destination.destinationName}</option>)}</select></Field>
      <Field htmlFor="stop-call-type" label="Loại ghé"><select id="stop-call-type" disabled={!editable || busy} value={draft.callType} onChange={(event) => update('callType', event.target.value as CruiseStopDraft['callType'])}><option value="NORMAL">Thông thường</option><option value="LATE_NIGHT">Đến khuya</option><option value="OVERNIGHT">Qua đêm</option></select></Field>
      <Field htmlFor="stop-arrival-method" label="Cách cập cảng"><select id="stop-arrival-method" disabled={!editable || busy} value={draft.arrivalMethod ?? 'BERTH'} onChange={(event) => update('arrivalMethod', event.target.value as CruiseStopDraft['arrivalMethod'])}><option value="BERTH">Cập cầu cảng</option><option value="TENDER">Trung chuyển bằng tàu nhỏ</option></select></Field>
      </>}
      {error && <Notice title="Kiểm tra thời gian" tone="error">{error}</Notice>}
      {stopInfo && <Notice title="Thông tin điểm dừng" tone="neutral">{stopInfo}</Notice>}
      {stop && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {access.has('CRUISE_STOP_READ') && <Button type="button" tone="secondary" disabled={busy || !access.has('CRUISE_STOP_READ')} onClick={() => void checkDuration()}>Thời lượng dừng</Button>}
          {access.has('CRUISE_STOP_READ') && <Button type="button" tone="secondary" disabled={busy || !access.has('CRUISE_STOP_READ')} onClick={() => void checkAvailability()}>Tra cứu khả dụng cảng</Button>}
          {access.has('CRUISE_STOP_VALIDATE') && <Button type="button" tone="secondary" disabled={busy || !access.has('CRUISE_STOP_VALIDATE')} onClick={onValidate}>Kiểm tra điểm dừng</Button>}
        </div>
      )}
      {editable && <Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : stop ? 'Cập nhật điểm dừng' : 'Thêm điểm dừng'}</Button>}
      {stop && editable && (access.has('CRUISE_STOP_REMOVE_DRAFT') ? <Button type="button" tone="danger" disabled={busy || !access.has('CRUISE_STOP_REMOVE_DRAFT')} onClick={onRemove}>Xóa điểm dừng</Button> : null)}
    </form>
  </Panel>
}
