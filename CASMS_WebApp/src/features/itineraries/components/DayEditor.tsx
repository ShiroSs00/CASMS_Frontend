import { useState, type FormEvent } from 'react'
import { Button, Field, Notice } from '@/shared/ui'
import { SHIP_TIME_ZONE, addCalendarDays } from '@/shared/lib/journey-time'
import { validateItineraryDay, type Itinerary, type ItineraryDay, type ItineraryDayDraft } from '../model/itinerary'
import styles from './Itineraries.module.css'

export function DayEditor({ itineraryId, itinerary, days, day, busy, onSave, maxDays = 5 }: { itineraryId: string; itinerary: Itinerary; days: ItineraryDay[]; day: ItineraryDay | null; busy: boolean; onSave: (value: ItineraryDayDraft) => void; maxDays?: number }) {
  const number = day?.dayNumber ?? Math.max(0, ...days.map(item => item.dayNumber)) + 1
  const [draft, setDraft] = useState<ItineraryDayDraft>({ itineraryId, dayNumber: number, date: day?.date ?? addCalendarDays(itinerary.startDate, number - 1), dayType: day?.dayType ?? '', shipTimeZoneId: SHIP_TIME_ZONE, description: day?.description ?? '' })
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const invalid = !day && days.length >= maxDays ? `Nhóm thời lượng này chỉ cho phép tối đa ${maxDays} ngày.` : validateItineraryDay(draft, itinerary, days, day?.itineraryDayId)
    setError(invalid)
    if (!invalid) onSave(draft)
  }
  return <form className={styles.editorForm} onSubmit={submit} noValidate>
    <p>Ngày {number} · {draft.date}. Giờ trên tàu luôn theo Việt Nam.</p>
    <Field htmlFor="day-type" label="Loại ngày *" error={!draft.dayType && error ? error : undefined}>
      <select id="day-type" required disabled={busy} value={draft.dayType} onChange={event => setDraft({ ...draft, dayType: event.target.value as ItineraryDayDraft['dayType'] })}>
        <option value="">Chọn loại ngày</option><option value="PORT_DAY">Ngày ghé cảng</option><option value="SEA_DAY">Ngày trên biển</option>
      </select>
    </Field>
    {draft.dayType === 'PORT_DAY' && <p className={styles.muted}>Sau khi lưu ngày, bạn có thể thêm cảng ngay tại đây hoặc bổ sung sau. Ngày chưa có cảng sẽ được đánh dấu chưa hoàn thiện.</p>}
    <Field htmlFor="day-description" label="Giới thiệu chương trình ngày"><textarea id="day-description" disabled={busy} maxLength={500} value={draft.description ?? ''} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field>
    {error && <Notice title="Chưa thể lưu ngày" tone="error">{error}</Notice>}
    <div className={styles.editorActions}><Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu ngày'}</Button></div>
  </form>
}
