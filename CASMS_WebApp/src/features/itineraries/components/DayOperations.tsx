import { useCallback, useRef, useState, type FormEvent } from 'react'

import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Loading, Notice } from '@/shared/ui'

import { itineraryApi } from '../api/itinerary-api'
import type { ItineraryDay, ItineraryDayType } from '../model/itinerary'
import styles from './Itineraries.module.css'

export function DayOperations({ day, editable, onChanged }: { day: ItineraryDay; editable: boolean; onChanged: () => void }) {
  const access = useSessionAccess()
  const load = useCallback((signal: AbortSignal) => itineraryApi.getDay(day.itineraryDayId, signal), [day.itineraryDayId])
  const query = useReadQuery(`day:${day.itineraryDayId}`, load)
  const [kind, setKind] = useState<'type' | 'timezone'>('type')
  const [dayType, setDayType] = useState<ItineraryDayType>(day.dayType)
  const [timezone, setTimezone] = useState(day.shipTimeZoneId ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const selectedKind = access.has(kind === 'type' ? 'ITINERARY_DAY_TYPE_SET' : 'ITINERARY_DAY_TIMEZONE_SET') ? kind : access.has('ITINERARY_DAY_TYPE_SET') ? 'type' : 'timezone'
  const permission = selectedKind === 'type' ? 'ITINERARY_DAY_TYPE_SET' : 'ITINERARY_DAY_TIMEZONE_SET'
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !editable || !access.has(permission) || !query.data) return
    setError('')
    if (selectedKind === 'timezone') {
      try { new Intl.DateTimeFormat('vi-VN', { timeZone: timezone.trim() || 'invalid' }) } catch { setError('Nhập múi giờ IANA hợp lệ, ví dụ Asia/Ho_Chi_Minh.'); return }
    }
    if (!confirmed || kind !== selectedKind) { setKind(selectedKind); setConfirmed(true); return }
    lock.current = true; setBusy(true)
    try {
      if (selectedKind === 'type') await itineraryApi.setDayType(day.itineraryDayId, dayType)
      else await itineraryApi.setShipTimeZone(day.itineraryDayId, timezone.trim())
      setConfirmed(false); query.retry(); onChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được ngày.'); setConfirmed(false) }
    finally { lock.current = false; setBusy(false) }
  }
  return <details>
    <summary>Thông tin và cấu hình riêng cho ngày {day.dayNumber}</summary>
    {query.loading && <Loading label="Đang tải chi tiết ngày…" />}
    {query.error && <Notice title="Không tải được chi tiết ngày" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>}
    {query.data && <><p>Ngày {query.data.dayNumber} · {query.data.date} · {query.data.dayType === 'SEA_DAY' ? 'Trên biển' : 'Ghé cảng'} · {query.data.shipTimeZoneId || 'Chưa đặt múi giờ'}</p><p>{query.data.description || 'Chưa có ghi chú ngày.'}</p>
      {editable && access.has(permission) && <form onSubmit={submit} className={styles.stopForm}>
        <Field htmlFor={`day-operation-${day.itineraryDayId}`} label="Cấu hình"><select id={`day-operation-${day.itineraryDayId}`} value={selectedKind} disabled={busy} onChange={event => { setKind(event.target.value as typeof kind); setConfirmed(false); setError('') }}>{access.has('ITINERARY_DAY_TYPE_SET') && <option value="type">Loại ngày</option>}{access.has('ITINERARY_DAY_TIMEZONE_SET') && <option value="timezone">Múi giờ tàu</option>}</select></Field>
        {selectedKind === 'type' ? <Field htmlFor={`day-type-${day.itineraryDayId}`} label="Loại ngày"><select id={`day-type-${day.itineraryDayId}`} value={dayType} disabled={busy} onChange={event => { setDayType(event.target.value as ItineraryDayType); setConfirmed(false) }}><option value="SEA_DAY">Ngày trên biển</option><option value="PORT_DAY">Ngày ghé cảng</option></select></Field> : <Field htmlFor={`day-timezone-${day.itineraryDayId}`} label="Múi giờ tàu (IANA)"><input id={`day-timezone-${day.itineraryDayId}`} required value={timezone} disabled={busy} onChange={event => { setTimezone(event.target.value); setConfirmed(false) }} /></Field>}
        {error && <Notice title="Chưa thể cập nhật" tone="error">{error}</Notice>}
        {!access.has(permission) && <p>Chưa có quyền đổi cấu hình này.</p>}
        {confirmed && <Notice title="Xác nhận cấu hình ngày" tone="warning">{selectedKind === 'type' ? dayType === 'SEA_DAY' ? 'Chuyển sang ngày trên biển.' : 'Chuyển sang ngày ghé cảng.' : timezone}. Cần kiểm tra lại điểm dừng và giờ tàu sau thay đổi.</Notice>}
        {access.has(permission) && <Button type="submit" disabled={busy || !access.has(permission)}>{busy ? 'Đang lưu…' : confirmed ? 'Xác nhận thay đổi ngày' : 'Tiếp tục'}</Button>}
      </form>}
    </>}
  </details>
}
