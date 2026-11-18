import { SHIP_TIME_ZONE, wallTimeToInstant, zonedInput } from '@/shared/lib/journey-time'

export type DepartureWindow = { earliestDeparture?: string | null; latestDeparture?: string | null }
export type DepartureWindowInputs = { earliestDeparture: string; latestDeparture: string }

function inputValue(instant: string) {
  if (typeof instant !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(instant)) {
    throw new Error('Khung khởi hành từ máy chủ thiếu múi giờ.')
  }
  return zonedInput(instant, SHIP_TIME_ZONE).replace(/:00$/, '')
}

export function departureWindowInputs({ earliestDeparture, latestDeparture }: DepartureWindow): DepartureWindowInputs {
  if (earliestDeparture == null && latestDeparture == null) return { earliestDeparture: '', latestDeparture: '' }
  if (earliestDeparture == null || latestDeparture == null || Date.parse(earliestDeparture) > Date.parse(latestDeparture)) {
    throw new Error('Khung khởi hành từ máy chủ không hợp lệ.')
  }
  return { earliestDeparture: inputValue(earliestDeparture), latestDeparture: inputValue(latestDeparture) }
}

export function departureWindowInstants({ earliestDeparture, latestDeparture }: DepartureWindowInputs) {
  return {
    earliestDeparture: earliestDeparture ? wallTimeToInstant(earliestDeparture, SHIP_TIME_ZONE) : null,
    latestDeparture: latestDeparture ? wallTimeToInstant(latestDeparture, SHIP_TIME_ZONE) : null,
  }
}

export function departureWindowIncludes(window: DepartureWindow, departure: string) {
  if (!window.earliestDeparture || !window.latestDeparture) return true
  try {
    const instant = Date.parse(wallTimeToInstant(departure, SHIP_TIME_ZONE))
    return instant >= Date.parse(window.earliestDeparture) && instant <= Date.parse(window.latestDeparture)
  } catch {
    return false
  }
}

export function departureWindowLabel(window: DepartureWindow) {
  const { earliestDeparture, latestDeparture } = departureWindowInputs(window)
  if (!earliestDeparture || !latestDeparture) return 'Chưa thiết lập'
  const label = (value: string) => {
    const [date, clock] = value.split('T')
    return `${date.split('-').reverse().join('/')} ${clock}`
  }
  return `${label(earliestDeparture)} – ${label(latestDeparture)} (giờ Việt Nam)`
}
