import { useState, type FormEvent } from 'react'

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
  const [draft, setDraft] = useState<CruiseStopDraft>({
    itineraryId, arrivalItineraryDayId: stop?.arrivalItineraryDayId ?? '', departureItineraryDayId: stop?.departureItineraryDayId ?? '',
    portId: stop?.portId ?? '', destinationId: stop?.destinationId ?? null, stopOrder: stop?.stopOrder ?? 1,
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
      const ok = await itineraryApi.checkStopPortAvailability(stop.cruiseStopId)
      setStopInfo(ok ? 'Backend xác nhận cảng khả dụng cho điểm dừng này.' : 'Backend báo cảng không khả dụng.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không kiểm tra được cảng.')
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (new Date(draft.plannedDeparture) <= new Date(draft.plannedArrival)) { setError('ETD phải sau ETA.'); return }
    setError(''); onSave(draft)
  }
  return <Panel title={stop ? `Stop ${String(stop.stopOrder).padStart(2, '0')} · ${stop.portName ?? 'Điểm dừng'}` : 'Thêm điểm dừng'}>
    <form className={styles.stopForm} onSubmit={submit}>
      <Field htmlFor="stop-port" label="Cảng"><select id="stop-port" required disabled={!editable || busy} value={draft.portId} onChange={(event) => update('portId', event.target.value)}><option value="">Chọn cảng</option>{stop && !ports.some((port) => port.portId === stop.portId) && <option value={stop.portId}>{stop.portName ?? stop.portId}</option>}{ports.map((port) => <option key={port.portId} value={port.portId}>{port.portName}</option>)}</select></Field>
      <Field htmlFor="stop-arrival" label="ETA"><input id="stop-arrival" type="datetime-local" required disabled={!editable || busy} value={draft.plannedArrival} onChange={(event) => update('plannedArrival', event.target.value)} /></Field>
      <Field htmlFor="stop-departure" label="ETD"><input id="stop-departure" type="datetime-local" required disabled={!editable || busy} value={draft.plannedDeparture} onChange={(event) => update('plannedDeparture', event.target.value)} /></Field>
      <p className={styles.muted}>Thời gian nhập theo {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      <Field htmlFor="stop-arrival-day" label="Ngày đến"><select id="stop-arrival-day" required disabled={!editable || busy} value={draft.arrivalItineraryDayId} onChange={(event) => update('arrivalItineraryDayId', event.target.value)}><option value="">Chọn ngày</option>{days.map((day) => <option key={day.itineraryDayId} value={day.itineraryDayId}>Ngày {day.dayNumber} · {day.date}</option>)}</select></Field>
      <Field htmlFor="stop-departure-day" label="Ngày rời"><select id="stop-departure-day" required disabled={!editable || busy} value={draft.departureItineraryDayId} onChange={(event) => update('departureItineraryDayId', event.target.value)}><option value="">Chọn ngày</option>{days.map((day) => <option key={day.itineraryDayId} value={day.itineraryDayId}>Ngày {day.dayNumber} · {day.date}</option>)}</select></Field>
      <Field htmlFor="stop-order" label="Thứ tự"><input id="stop-order" type="number" min={1} required disabled={!editable || busy} value={draft.stopOrder} onChange={(event) => update('stopOrder', Number(event.target.value))} /></Field>
      <Field htmlFor="stop-destination" label="Điểm đến"><select id="stop-destination" disabled={!editable || busy} value={draft.destinationId ?? ''} onChange={(event) => update('destinationId', event.target.value || null)}><option value="">Không chọn</option>{destinations.map((destination) => <option key={destination.destinationId} value={destination.destinationId}>{destination.destinationName}</option>)}</select></Field>
      <Field htmlFor="stop-call-type" label="Loại ghé"><select id="stop-call-type" disabled={!editable || busy} value={draft.callType} onChange={(event) => update('callType', event.target.value as CruiseStopDraft['callType'])}><option value="NORMAL">NORMAL</option><option value="LATE_NIGHT">LATE_NIGHT</option><option value="OVERNIGHT">OVERNIGHT</option></select></Field>
      <Field htmlFor="stop-arrival-method" label="Cách cập cảng"><select id="stop-arrival-method" disabled={!editable || busy} value={draft.arrivalMethod ?? 'BERTH'} onChange={(event) => update('arrivalMethod', event.target.value as CruiseStopDraft['arrivalMethod'])}><option value="BERTH">BERTH</option><option value="TENDER">TENDER</option></select></Field>
      {error && <Notice title="Kiểm tra thời gian" tone="error">{error}</Notice>}
      {stopInfo && <Notice title="Thông tin điểm dừng" tone="info">{stopInfo}</Notice>}
      {stop && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button type="button" tone="secondary" disabled={busy} onClick={() => void checkDuration()}>Thời lượng dừng</Button>
          <Button type="button" tone="secondary" disabled={busy} onClick={() => void checkAvailability()}>Khả dụng cảng</Button>
          <Button type="button" tone="secondary" disabled={busy} onClick={onValidate}>Validate stop</Button>
        </div>
      )}
      {editable && <Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : stop ? 'Cập nhật stop' : 'Thêm điểm dừng'}</Button>}
      {stop && editable && <Button type="button" tone="danger" disabled={busy} onClick={onRemove}>Xóa điểm dừng</Button>}
    </form>
  </Panel>
}
