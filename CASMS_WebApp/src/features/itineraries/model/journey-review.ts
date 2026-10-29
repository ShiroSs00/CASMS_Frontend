import { SHIP_TIME_ZONE, zonedInput, validTimeZone, wallTimeToInstant, addCalendarDays } from '@/shared/lib/journey-time'
import type { CruiseStop, ItineraryDay, Port } from './itinerary'
import type { ProgramActivity, ProgramExcursion } from '../api/program-api'

export function overlapsDay(start: string, end: string, day: ItineraryDay) {
  const lower = Date.parse(wallTimeToInstant(`${day.date}T00:00`, SHIP_TIME_ZONE))
  const upper = Date.parse(wallTimeToInstant(`${addCalendarDays(day.date, 1)}T00:00`, SHIP_TIME_ZONE))
  return Date.parse(start) < upper && Date.parse(end) > lower
}
export function stopsForDay(stops: CruiseStop[], day: ItineraryDay) {
  return stops.filter(stop => !['OMITTED', 'SUBSTITUTED'].includes(stop.status) && (stop.arrivalItineraryDayId === day.itineraryDayId || stop.departureItineraryDayId === day.itineraryDayId || overlapsDay(stop.plannedArrival, stop.plannedDeparture, day)))
}
export function excursionIssue(excursion: ProgramExcursion, stop: Pick<CruiseStop, 'plannedArrival' | 'plannedDeparture' | 'allAboardTime' | 'tenderTransferMinutes' | 'status'>): string | null {
  if (excursion.status === 'CANCELLED') return null
  if (['OMITTED', 'SUBSTITUTED'].includes(stop.status)) return `${excursion.excursionName}: lần ghé cảng đã bị bỏ hoặc thay thế.`
  const start = Date.parse(excursion.startTime), end = Date.parse(excursion.plannedReturnTime)
  const earliest = Date.parse(stop.plannedArrival) + (stop.tenderTransferMinutes ?? 0) * 60000
  const deadline = Date.parse(stop.allAboardTime || stop.plannedDeparture)
  return !Number.isFinite(start) || !Number.isFinite(end) || end <= start || start < earliest || end >= deadline ? `${excursion.excursionName}: lịch tham quan vượt khoảng ghé cảng hoặc hạn trở lại tàu.` : null
}
export type ReviewIssue = { key: string; message: string; dayId?: string; stopId?: string; activityId?: string }
export function reviewJourney(days: ItineraryDay[], stops: CruiseStop[], ports: Port[], activities: ProgramActivity[], excursions: ProgramExcursion[], minDays: number, maxDays: number): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  const add = (key: string, message: string, dayId?: string, stopId?: string) => issues.push({ key, message, dayId, stopId })
  if (days.length < minDays || days.length > maxDays) add('count', `Cần ${minDays}–${maxDays} ngày đã lưu cho nhóm thời lượng này.`)
  const orderedDays = [...days].sort((a,b) => a.dayNumber - b.dayNumber)
  for (const [index, day] of orderedDays.entries()) {
    const linked = stopsForDay(stops, day)
    if (day.dayNumber !== index + 1) add(`sequence-${day.itineraryDayId}`, 'Thứ tự ngày cần liên tục từ ngày 1.', day.itineraryDayId)
    if (!['SEA_DAY', 'PORT_DAY'].includes(day.dayType)) add(`type-${day.itineraryDayId}`, 'Ngày chưa được xác định loại.', day.itineraryDayId)
    if (day.dayType === 'PORT_DAY' && !linked.length) add(`port-${day.itineraryDayId}`, `Ngày ${day.dayNumber}: chưa có lần ghé cảng.`, day.itineraryDayId)
    if (index === maxDays - 1 && day.dayType !== 'PORT_DAY') add(`end-${day.itineraryDayId}`, 'Ngày kết thúc phải chọn cảng trả khách.', day.itineraryDayId)
    if (day.dayType === 'SEA_DAY' && linked.length) add(`sea-${day.itineraryDayId}`, `Ngày ${day.dayNumber}: ngày trên biển đang trùng lần ghé cảng.`, day.itineraryDayId)
    if (day.shipTimeZoneId !== SHIP_TIME_ZONE) add(`zone-${day.itineraryDayId}`, `Ngày ${day.dayNumber}: lưu lại ngày để áp dụng giờ Việt Nam.`, day.itineraryDayId)
  }
  const active = stops.filter(stop => !['OMITTED', 'SUBSTITUTED'].includes(stop.status))
  for (const stop of active) {
    const port = ports.find(item => item.portId === stop.portId)
    const arrival = days.find(day => day.itineraryDayId === stop.arrivalItineraryDayId), departure = days.find(day => day.itineraryDayId === stop.departureItineraryDayId)
    const name = port?.portName ?? stop.portName ?? 'Lần ghé cảng'
    if (!validTimeZone(port?.timeZoneId)) add(`tz-${stop.cruiseStopId}`, `${name}: thiếu múi giờ cảng hợp lệ.`, stop.arrivalItineraryDayId, stop.cruiseStopId)
    if (!arrival || !departure || arrival.dayNumber > departure.dayNumber) add(`days-${stop.cruiseStopId}`, `${name}: liên kết ngày đến/rời không hợp lệ.`, stop.arrivalItineraryDayId, stop.cruiseStopId)
    if (Date.parse(stop.plannedDeparture) <= Date.parse(stop.plannedArrival)) add(`time-${stop.cruiseStopId}`, `${name}: giờ rời phải sau giờ đến.`, stop.arrivalItineraryDayId, stop.cruiseStopId)
    if (arrival && departure && (zonedInput(stop.plannedArrival, SHIP_TIME_ZONE).slice(0,10) !== arrival.date || zonedInput(stop.plannedDeparture, SHIP_TIME_ZONE).slice(0,10) !== departure.date)) add(`date-${stop.cruiseStopId}`, `${name}: ngày liên kết chưa khớp ngày theo giờ Việt Nam.`, arrival.itineraryDayId, stop.cruiseStopId)
    if (!stop.allAboardTime || Date.parse(stop.allAboardTime) <= Date.parse(stop.plannedArrival) || Date.parse(stop.allAboardTime) >= Date.parse(stop.plannedDeparture)) add(`aboard-${stop.cruiseStopId}`, `${name}: hạn trở lại tàu phải sau khi đến và trước khi rời.`, stop.arrivalItineraryDayId, stop.cruiseStopId)
  }
  for (const excursion of excursions) {
    const stop = stops.find(item => item.cruiseStopId === excursion.cruiseStopId)
    if (!stop) continue
    const message = excursionIssue(excursion, stop)
    if (message) add(`excursion-${excursion.shoreExcursionId}`, message, stop.arrivalItineraryDayId, stop.cruiseStopId)
  }
  const ordered = [...active].sort((a,b) => a.stopOrder - b.stopOrder)
  for (let index = 1; index < ordered.length; index++) if (Date.parse(ordered[index].plannedArrival) < Date.parse(ordered[index-1].plannedDeparture)) add(`overlap-${ordered[index].cruiseStopId}`, 'Thứ tự các lần ghé cảng bị chồng hoặc đảo thời gian sau khi quy đổi.', ordered[index].arrivalItineraryDayId, ordered[index].cruiseStopId)
  for (const activity of activities.filter(item => item.status !== 'CANCELLED')) {
    if (!days.some(day => overlapsDay(activity.startTime, activity.endTime, day))) issues.push({ key: `activity-${activity.id}`, message: `${activity.name}: chưa có ngày tương ứng trong lịch trình.`, activityId: activity.id })
  }
  return issues
}
