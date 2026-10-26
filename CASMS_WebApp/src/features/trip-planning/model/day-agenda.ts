import { SHIP_TIME_ZONE } from '@/shared/lib/journey-time'
import { timeNumber, type Content, type Entry, type Stop } from './plan'

export type AgendaRow =
  | { key: string; type: 'entry'; entry: Entry; dayNumber: number; time: string | null }
  | { key: string; type: 'milestone'; stop: Stop; label: string; dayNumber: number; time: string | null }
export type AgendaGroup = { key: string; timeZoneId: string | null; clocks: string[]; rows: AgendaRow[] }

/** Relative days have no calendar date, so clocks in different zones cannot be safely converted (DST). */
export function dayAgenda(content: Content, dayNumber: number): AgendaGroup[] {
  const groups = new Map<string, AgendaGroup>()
  function group(zone: string | null | undefined, clock: string, unknownKey: string) {
    const key = zone || `unknown-${unknownKey}`
    let result = groups.get(key)
    if (!result) {
      result = { key, timeZoneId: zone || null, clocks: [], rows: [] }
      groups.set(key, result)
    }
    if (!result.clocks.includes(clock)) result.clocks.push(clock)
    return result
  }
  for (const entry of content.entries) {
    if (entry.startDayNumber > dayNumber || entry.endDayNumber < dayNumber) continue
    const stop = content.stops.find(item => item.clientKey === entry.stopClientKey)
    const shore = entry.kind === 'SHORE_EXCURSION'
    const zone = shore ? stop?.timeZoneId || entry.timeZoneId : SHIP_TIME_ZONE
    group(zone, shore ? stop?.portName || 'Cảng' : 'Tàu · Giờ Việt Nam', stop?.clientKey || entry.clientKey).rows.push({
      key: entry.clientKey, type: 'entry', entry, dayNumber: entry.startDayNumber, time: entry.plannedStartTime,
    })
  }
  for (const stop of [...content.stops].sort((a, b) => a.stopOrder - b.stopOrder)) {
    if (stop.arrivalDayNumber > dayNumber || stop.departureDayNumber < dayNumber) continue
    const rows = group(stop.timeZoneId, stop.portName || 'Cảng', stop.clientKey).rows
    const add = (key: string, label: string, time: string | null) => rows.push({ key: `${stop.clientKey}-${key}`, type: 'milestone', stop, label, dayNumber, time })
    if (stop.arrivalDayNumber === dayNumber) add('arrival', 'Đến cảng', stop.plannedArrivalTime)
    else add('continuation', 'Tiếp tục ghé cảng', null)
    if (stop.allAboardDayNumber === dayNumber && stop.allAboardTime) add('aboard', 'Hạn trở lại tàu', stop.allAboardTime)
    if (stop.departureDayNumber === dayNumber) add('departure', 'Rời cảng', stop.plannedDepartureTime)
  }
  for (const item of groups.values()) {
    const rank=(row:AgendaRow)=>row.type==='entry'?1:row.label==='Đến cảng'||row.label==='Tiếp tục ghé cảng'?0:row.label==='Hạn trở lại tàu'?2:3
    item.rows.sort((a, b) => timeNumber(a.dayNumber, a.time) - timeNumber(b.dayNumber, b.time)||rank(a)-rank(b))
  }
  return [...groups.values()].sort((a, b) => Number(b.timeZoneId === SHIP_TIME_ZONE) - Number(a.timeZoneId === SHIP_TIME_ZONE))
}
