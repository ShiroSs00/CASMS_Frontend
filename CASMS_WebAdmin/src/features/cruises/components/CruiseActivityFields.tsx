import { useState } from 'react'
import { Field } from '@/shared/ui'
import { journeyTime, SHIP_TIME_ZONE, validTimeZone, zonedInput } from '@/shared/lib/journey-time'
import type { ShipVenueOptions } from '@/domain/ship-venue'
import styles from './ManagerWorkspace.module.css'

export type ActivityArea = { id: string; name: string; deckId: string }
export type CruiseVenueOptions = ShipVenueOptions & {
  ship: ShipVenueOptions['ship'] & { modelId?: string | null }
  activityAreas?: ActivityArea[]
}
export type CruiseTimeRange = { departure: string; arrival: string }

export function ActivityAreaField({ options }: { options: CruiseVenueOptions }) {
  const areas = options.activityAreas ?? []
  const decks = new Map(options.decks.map(deck => [deck.id, deck]))
  const hint = !options.activityAreas ? 'Chưa tải được danh sách khu vực.'
    : !areas.length ? 'Tàu chưa có khu vực phù hợp cho hoạt động.' : undefined

  return <Field htmlFor="program-activity-area" label="Khu vực hoạt động *" hint={hint}>
    <select id="program-activity-area" name="areaId" required>
      <option value="">Chọn khu vực hoạt động</option>
      {areas.map(area => {
        const deck = decks.get(area.deckId)
        return <option key={area.id} value={area.id}>
          {area.name}{deck ? ` · Boong ${deck.number}` : ''}
        </option>
      })}
    </select>
  </Field>
}

export function ActivityMeetingPointField({ id, value }: { id: string; value?: string | null }) {
  return <Field htmlFor={id} label="Điểm tập trung">
    <input id={id} name="meetingPoint" defaultValue={value ?? ''} placeholder="Ví dụ Sảnh chính" maxLength={255} />
  </Field>
}

export function ActivityTimeFields({
  departure,
  arrival,
  title = 'Thời gian hoạt động',
  timezoneNote = 'Giờ Việt Nam',
  timeZone = SHIP_TIME_ZONE,
}: CruiseTimeRange & { title?: string; timezoneNote?: string; timeZone?: string }) {
  const effectiveZone = validTimeZone(timeZone) ? timeZone : SHIP_TIME_ZONE
  const validRange = Number.isFinite(Date.parse(departure)) && Number.isFinite(Date.parse(arrival))
  const firstDay = validRange ? zonedInput(departure, effectiveZone).slice(0, 10) : ''
  const lastDay = validRange ? zonedInput(arrival, effectiveZone).slice(0, 10) : ''
  const sameDay = Boolean(firstDay) && firstDay === lastDay
  const [startDay, setStartDay] = useState(firstDay)
  const [endDay, setEndDay] = useState(firstDay)
  const clampedStartDay = !firstDay ? startDay : (startDay < firstDay || startDay > lastDay ? firstDay : startDay)
  const clampedEndDay = !firstDay ? endDay : (endDay < clampedStartDay || endDay > lastDay ? clampedStartDay : endDay)

  return <>
    <h3 className={styles.activitySchedule}>{title}</h3>
    <p className={styles.activityTimeRange}>
      <strong>Trong lịch chuyến · {timezoneNote}</strong>
      {' '}{validRange ? `${journeyTime(departure, effectiveZone)} – ${journeyTime(arrival, effectiveZone)}` : 'Chưa có lịch chuyến'}
    </p>
    <div className={styles.activityTimePair}>
    {!sameDay ?
      <Field htmlFor="activity-start-day" label="Ngày bắt đầu *">
        <input id="activity-start-day" name="startDay" type="date" min={firstDay || undefined} max={lastDay || undefined}
          value={clampedStartDay} onChange={event => {
            const nextDay = event.target.value
            setStartDay(nextDay)
            if (nextDay > clampedEndDay) setEndDay(nextDay)
          }} required />
      </Field> : <input type="hidden" name="startDay" value={firstDay} />}
    <Field htmlFor="program-start" label="Giờ bắt đầu *"><input id="program-start" name="start" type="time" required /></Field>
    </div>
    <div className={styles.activityTimePair}>
    {!sameDay ?
      <Field htmlFor="activity-end-day" label="Ngày kết thúc *">
        <input id="activity-end-day" name="endDay" type="date" min={clampedStartDay || firstDay || undefined} max={lastDay || undefined}
          value={clampedEndDay} onChange={event => setEndDay(event.target.value)} required />
      </Field> : <input type="hidden" name="endDay" value={firstDay} />}
    <Field htmlFor="program-end" label="Giờ kết thúc *"><input id="program-end" name="end" type="time" required /></Field>
    </div>
  </>
}
