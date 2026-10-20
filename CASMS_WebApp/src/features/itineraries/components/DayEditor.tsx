import { useState, type FormEvent } from 'react'

import { Button, Field, Notice } from '@/shared/ui'

import { validateItineraryDay, type Itinerary, type ItineraryDay, type ItineraryDayDraft } from '../model/itinerary'
import styles from './Itineraries.module.css'

export function DayEditor({ itineraryId, itinerary, days, day, busy, onSave }: { itineraryId: string; itinerary: Itinerary; days: ItineraryDay[]; day: ItineraryDay | null; busy: boolean; onSave: (value: ItineraryDayDraft) => void }) {
  const [draft, setDraft] = useState<ItineraryDayDraft>({ itineraryId, dayNumber: day?.dayNumber ?? days.length + 1, date: day?.date ?? '', dayType: day?.dayType ?? 'PORT_DAY', shipTimeZoneId: day?.shipTimeZoneId ?? 'Asia/Ho_Chi_Minh', description: day?.description ?? '' })
  const [error, setError] = useState('')
  function submit(event: FormEvent) { event.preventDefault(); if (busy) return; const invalid = validateItineraryDay(draft, itinerary, days, day?.itineraryDayId); setError(invalid); if (!invalid) onSave(draft) }
  return <form onSubmit={submit}><div className={styles.formGrid}>
    <Field htmlFor="day-number" label="Số ngày"><input id="day-number" type="number" min={1} required value={draft.dayNumber} onChange={(event) => setDraft({ ...draft, dayNumber: Number(event.target.value) })} /></Field>
    <Field htmlFor="day-date" label="Ngày"><input id="day-date" type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></Field>
    <Field htmlFor="day-type" label="Loại ngày"><select id="day-type" value={draft.dayType} onChange={(event) => setDraft({ ...draft, dayType: event.target.value as ItineraryDayDraft['dayType'] })}><option value="PORT_DAY">Ngày cảng</option><option value="SEA_DAY">Ngày trên biển</option></select></Field>
    <Field htmlFor="day-timezone" label="Múi giờ tàu"><input id="day-timezone" maxLength={100} value={draft.shipTimeZoneId ?? ''} onChange={(event) => setDraft({ ...draft, shipTimeZoneId: event.target.value })} /></Field>
    <Field htmlFor="day-description" label="Mô tả"><textarea id="day-description" maxLength={500} value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
  </div>{error && <Notice title="Kiểm tra ngày hành trình" tone="error">{error}</Notice>}<div className={styles.actions}><Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu ngày'}</Button></div></form>
}
