import { SHIP_TIME_ZONE, wallTimeToInstant, zonedInput } from '@/shared/lib/journey-time'

export type DepartureWindow = { earliestDeparture?: string | null; latestDeparture?: string | null }
export type DepartureWindowInputs = { earliestDeparture: string; latestDeparture: string }

const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

export function parseDepartureMinute(value: string): number {
  const match = CLOCK_PATTERN.exec(value.trim())
  if (!match) {
    throw new Error('Khung khởi hành phải theo định dạng HH:mm.')
  }
  return Number(match[1]) * 60 + Number(match[2])
}

export function normalizeDepartureClock(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('Khung khởi hành từ máy chủ không hợp lệ.')
  }
  const trimmed = value.trim()
  const match = CLOCK_PATTERN.exec(trimmed)
  if (match) {
    return `${match[1]}:${match[2]}`
  }
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed) && Number.isFinite(Date.parse(trimmed))) {
    const clock = zonedInput(trimmed, SHIP_TIME_ZONE).split('T')[1]?.slice(0, 5)
    if (clock && CLOCK_PATTERN.test(clock)) return clock
  }
  throw new Error('Khung khởi hành từ máy chủ không hợp lệ.')
}

export function departureWindowInputs({ earliestDeparture, latestDeparture }: DepartureWindow): DepartureWindowInputs {
  if (earliestDeparture == null && latestDeparture == null) return { earliestDeparture: '', latestDeparture: '' }
  if (earliestDeparture == null || latestDeparture == null) {
    throw new Error('Khung khởi hành từ máy chủ không hợp lệ.')
  }
  const earliest = normalizeDepartureClock(earliestDeparture)
  const latest = normalizeDepartureClock(latestDeparture)
  if (parseDepartureMinute(earliest) > parseDepartureMinute(latest)) {
    throw new Error('Khung khởi hành từ máy chủ không hợp lệ.')
  }
  return { earliestDeparture: earliest, latestDeparture: latest }
}

export function departureWindowValues({ earliestDeparture, latestDeparture }: DepartureWindowInputs) {
  return {
    earliestDeparture: earliestDeparture ? normalizeDepartureClock(earliestDeparture) : null,
    latestDeparture: latestDeparture ? normalizeDepartureClock(latestDeparture) : null,
  }
}

export const departureWindowInstants = departureWindowValues

export function departureWindowIncludes(window: DepartureWindow, departure: string) {
  if (!window.earliestDeparture || !window.latestDeparture) return true
  try {
    const { earliestDeparture, latestDeparture } = departureWindowInputs(window)
    if (!earliestDeparture || !latestDeparture) return true
    const trimmed = departure.trim()
    const instant = /(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)
      ? trimmed
      : wallTimeToInstant(trimmed, SHIP_TIME_ZONE)
    const clock = zonedInput(instant, SHIP_TIME_ZONE).split('T')[1]?.slice(0, 5)
    if (!clock) return false
    const minute = parseDepartureMinute(clock)
    return minute >= parseDepartureMinute(earliestDeparture) && minute <= parseDepartureMinute(latestDeparture)
  } catch {
    return false
  }
}

export function departureWindowLabel(window: DepartureWindow) {
  const { earliestDeparture, latestDeparture } = departureWindowInputs(window)
  if (!earliestDeparture || !latestDeparture) return 'Chưa thiết lập'
  return `${earliestDeparture} – ${latestDeparture} (giờ Việt Nam)`
}
