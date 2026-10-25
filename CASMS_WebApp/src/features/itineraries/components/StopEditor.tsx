import { useState, type FormEvent } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, FormErrorSummary, Notice } from '@/shared/ui'
import { SHIP_TIME_ZONE, validTimeZone, wallTimeToInstant, zonedInput, journeyTime } from '@/shared/lib/journey-time'
import type { CruiseStop, CruiseStopDraft, Destination, ItineraryDay, Port } from '../model/itinerary'
import type { ProgramExcursion } from '../api/program-api'
import { excursionIssue } from '../model/journey-review'
import styles from './Itineraries.module.css'

type StopForm = { portId: string; destinationId: string; plannedArrival: string; plannedDeparture: string; allAboardTime: string; callType: CruiseStopDraft['callType']; arrivalMethod: NonNullable<CruiseStopDraft['arrivalMethod']>; tenderTransferMinutes: number }
export function StopEditor({ itineraryId, stop, days, ports, destinations, stops, excursions, cruise, busy, editable, onSave, onRemove }: {
  itineraryId: string; stop: CruiseStop | null; days: ItineraryDay[]; ports: Port[]; destinations: Destination[]; stops: CruiseStop[]; excursions: ProgramExcursion[]; cruise?: { departureDatetime: string; returnDatetime: string }; busy: boolean; editable: boolean; onSave: (draft: CruiseStopDraft) => void; onRemove: () => void
}) {
  const access = useSessionAccess()
  const initialZone = ports.find(port => port.portId === stop?.portId)?.timeZoneId
  const initialTime = (value?: string | null) => value && validTimeZone(initialZone) ? zonedInput(value, initialZone) : ''
  const [draft, setDraft] = useState<StopForm>({ portId: stop?.portId ?? '', destinationId: stop?.destinationId ?? '', plannedArrival: initialTime(stop?.plannedArrival), plannedDeparture: initialTime(stop?.plannedDeparture), allAboardTime: initialTime(stop?.allAboardTime), callType: stop?.callType ?? 'NORMAL', arrivalMethod: stop?.arrivalMethod ?? 'BERTH', tenderTransferMinutes: stop?.tenderTransferMinutes ?? 0 })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const port = ports.find(item => item.portId === draft.portId), zone = port?.timeZoneId
  const linked = excursions.filter(item => item.cruiseStopId === stop?.cruiseStopId && item.status !== 'CANCELLED')
  const update = <K extends keyof StopForm>(key: K, value: StopForm[K]) => setDraft(current => ({ ...current, [key]: value }))
  function vietnamTime(value: string) {
    if (!value || !validTimeZone(zone)) return undefined
    try { return `Giờ Việt Nam: ${journeyTime(wallTimeToInstant(value, zone))}` } catch (error) { return error instanceof Error ? error.message : undefined }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !editable) return
    const invalid: Record<string,string> = {}
    if (!port || !validTimeZone(zone)) invalid.portId = 'Chọn cảng có múi giờ hợp lệ. Liên hệ người quản lý cảng để bổ sung cấu hình nếu còn thiếu.'
    const convert = (key: 'plannedArrival' | 'plannedDeparture' | 'allAboardTime') => {
      try { return wallTimeToInstant(draft[key], zone ?? '') } catch (error) { invalid[key] = error instanceof Error ? error.message : 'Ngày giờ không hợp lệ.'; return '' }
    }
    const arrival = convert('plannedArrival'), departure = convert('plannedDeparture')
    const aboard = draft.allAboardTime ? convert('allAboardTime') : stop?.allAboardTime ?? (departure ? new Date(Date.parse(departure) - 30 * 60000).toISOString() : '')
    const arrivalDay = arrival ? days.find(day => day.date === zonedInput(arrival, SHIP_TIME_ZONE).slice(0,10)) : undefined
    const departureDay = departure ? days.find(day => day.date === zonedInput(departure, SHIP_TIME_ZONE).slice(0,10)) : undefined
    if (arrival && !arrivalDay) invalid.plannedArrival = 'Chưa có ngày lịch trình tương ứng theo giờ Việt Nam. Thêm ngày trước khi lưu cảng.'
    if (departure && !departureDay) invalid.plannedDeparture = 'Chưa có ngày rời tương ứng theo giờ Việt Nam. Thêm ngày trước khi lưu cảng.'
    if (cruise && arrival && Date.parse(arrival) < Date.parse(cruise.departureDatetime)) invalid.plannedArrival = 'Giờ đến phải nằm trong thời gian chuyến đi.'
    if (cruise && departure && Date.parse(departure) > Date.parse(cruise.returnDatetime)) invalid.plannedDeparture = 'Giờ rời phải nằm trong thời gian chuyến đi.'
    if (arrival && departure && Date.parse(departure) <= Date.parse(arrival)) invalid.plannedDeparture = 'Giờ rời phải sau giờ đến.'
    if (arrivalDay && departureDay && days.some(day => day.dayNumber >= arrivalDay.dayNumber && day.dayNumber <= departureDay.dayNumber && day.dayType !== 'PORT_DAY')) invalid.plannedDeparture = 'Khoảng ghé cảng đi qua ngày trên biển. Chỉnh loại ngày trước khi lưu.'
    if (aboard && (Date.parse(aboard) <= Date.parse(arrival) || Date.parse(aboard) >= Date.parse(departure))) invalid.allAboardTime = 'Hạn trở lại phải sau giờ đến và trước giờ rời cảng.'
    if (!Number.isSafeInteger(draft.tenderTransferMinutes) || draft.tenderTransferMinutes < 0) invalid.tenderTransferMinutes = 'Thời gian trung chuyển phải là số phút không âm.'
    const order = stop?.stopOrder ?? Math.max(0,...stops.map(item => item.stopOrder)) + 1
    for (const other of stops.filter(item => item.cruiseStopId !== stop?.cruiseStopId && !['OMITTED','SUBSTITUTED'].includes(item.status))) {
      if (arrival && departure && (other.stopOrder < order ? Date.parse(arrival) < Date.parse(other.plannedDeparture) : Date.parse(departure) > Date.parse(other.plannedArrival))) invalid.plannedArrival = `Thời gian xung đột với lần ghé ${other.portName ?? 'cảng'} thứ ${other.stopOrder}.`
    }
    if (stop && draft.portId !== stop.portId && linked.length) invalid.portId = `Có ${linked.length} chuyến tham quan gắn với cảng này. Cần xử lý liên kết tham quan trước khi đổi cảng.`
    for (const excursion of linked) {
      const issue = excursionIssue(excursion, { plannedArrival: arrival, plannedDeparture: departure, allAboardTime: aboard, tenderTransferMinutes: draft.tenderTransferMinutes, status: stop?.status ?? 'PLANNED' })
      if (issue) invalid.allAboardTime = issue
    }
    setErrors(invalid)
    if (Object.keys(invalid).length || !arrivalDay || !departureDay) return
    onSave({ itineraryId, portId: draft.portId, destinationId: draft.destinationId || undefined, arrivalItineraryDayId: arrivalDay.itineraryDayId, departureItineraryDayId: departureDay.itineraryDayId, stopOrder: stop?.stopOrder ?? '', plannedArrival: arrival, plannedDeparture: departure, allAboardTime: aboard, callType: draft.callType, arrivalMethod: draft.arrivalMethod, tenderTransferMinutes: draft.tenderTransferMinutes })
  }
  return <form className={styles.editorForm} onSubmit={submit} noValidate>
    <FormErrorSummary errors={errors} />
    <fieldset disabled={!editable || busy} className={styles.drawerFields}>
      <Field htmlFor="stop-port" label="Cảng tàu ghé *" error={errors.portId}><select id="stop-port" required value={draft.portId} onChange={event => update('portId', event.target.value)}><option value="">Chọn cảng</option>{ports.map(item => <option key={item.portId} value={item.portId} disabled={item.status !== 'ACTIVE' && item.portId !== stop?.portId}>{item.portName} · {item.countryCode}</option>)}</select></Field>
      <Field htmlFor="stop-zone" label="Múi giờ địa phương cảng"><input id="stop-zone" readOnly value={zone || 'Chưa có cấu hình múi giờ'} /></Field>
      {draft.portId && !validTimeZone(zone) && <Notice title="Thiếu cấu hình cảng" tone="error">Không thể nhập hoặc quy đổi thời gian khi cảng chưa có múi giờ hợp lệ.</Notice>}
      <p className={styles.muted}>Nhập ngày và giờ tại cảng. Ngày trong lịch trình được liên kết theo giờ Việt Nam sau khi quy đổi. Khi đổi cảng, hãy kiểm tra lại toàn bộ giờ địa phương.</p>
      <div className={styles.editorFields}>
        <Field htmlFor="stop-arrival" label="Ngày và giờ đến *" hint={vietnamTime(draft.plannedArrival)} error={errors.plannedArrival}><input id="stop-arrival" type="datetime-local" step="1" value={draft.plannedArrival} onChange={event => update('plannedArrival', event.target.value)} /></Field>
        <Field htmlFor="stop-departure" label="Ngày và giờ rời *" hint={vietnamTime(draft.plannedDeparture)} error={errors.plannedDeparture}><input id="stop-departure" type="datetime-local" step="1" value={draft.plannedDeparture} onChange={event => update('plannedDeparture', event.target.value)} /></Field>
        <Field htmlFor="stop-aboard" label="Ngày và hạn khách trở lại tàu" hint={vietnamTime(draft.allAboardTime) ?? (stop ? 'Để trống sẽ giữ hạn đã lưu.' : 'Nếu bỏ trống, hạn là 30 phút trước giờ rời cảng.')} error={errors.allAboardTime}><input id="stop-aboard" type="datetime-local" step="1" value={draft.allAboardTime} onChange={event => update('allAboardTime', event.target.value)} /></Field>
        <Field htmlFor="stop-method" label="Phương thức tiếp cận"><select id="stop-method" value={draft.arrivalMethod} onChange={event => update('arrivalMethod', event.target.value as StopForm['arrivalMethod'])}><option value="BERTH">Cập cầu cảng</option><option value="TENDER">Trung chuyển bằng tàu nhỏ</option></select></Field>
        <Field htmlFor="stop-call" label="Hình thức ghé"><select id="stop-call" value={draft.callType} onChange={event => update('callType', event.target.value as StopForm['callType'])}><option value="NORMAL">Thông thường</option><option value="LATE_NIGHT">Đến khuya</option><option value="OVERNIGHT">Qua đêm</option></select></Field>
        <Field htmlFor="stop-transfer" label="Thời gian trung chuyển (phút)" error={errors.tenderTransferMinutes}><input id="stop-transfer" type="number" min="0" value={Number.isNaN(draft.tenderTransferMinutes) ? '' : draft.tenderTransferMinutes} onChange={event => update('tenderTransferMinutes', event.target.value === '' ? NaN : Number(event.target.value))} /></Field>
      </div>
      <Field htmlFor="stop-destination" label="Điểm đến liên quan" hint={stop?.destinationId ? 'Hệ thống hiện chỉ hỗ trợ thay liên kết, chưa hỗ trợ gỡ điểm đến đã lưu.' : undefined}><select id="stop-destination" value={draft.destinationId} onChange={event => update('destinationId', event.target.value)}>{!stop?.destinationId && <option value="">Không chọn</option>}{destinations.map(item => <option key={item.destinationId} value={item.destinationId}>{item.destinationName}</option>)}</select></Field>
    </fieldset>
    {linked.length > 0 && <Notice title={`${linked.length} chuyến tham quan liên quan`}>Thay đổi cảng hoặc thời gian sẽ được kiểm tra với lịch tham quan đã lưu.</Notice>}
    <div className={styles.editorActions}>{stop && editable && access.has('CRUISE_STOP_REMOVE_DRAFT') && <Button tone="danger" disabled={busy} onClick={onRemove}>Xóa lần ghé cảng</Button>}{editable && <Button type="submit" disabled={busy || !validTimeZone(zone)}>{busy ? 'Đang lưu…' : 'Lưu lần ghé cảng'}</Button>}</div>
  </form>
}
