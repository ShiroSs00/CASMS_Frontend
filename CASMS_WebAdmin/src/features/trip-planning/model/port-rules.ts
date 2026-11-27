import { SHIP_ZONE, shortTime, timeNumber, type Content, type Day, type Source, type Stop, type TripInfo, type Violation } from './plan'

type Scope = Pick<TripInfo, 'scope' | 'regionIds' | 'countryCodes'>
type Geography = Pick<Source, 'countryCode' | 'domesticRegion'>

/** Only use geographic codes returned by the API; never derive them from names. */
export function portMatchesScope(port: Geography, info: Scope): boolean {
  const country = port.countryCode?.trim().toUpperCase()
  if (info.scope === 'DOMESTIC') return country === 'VN' && Boolean(port.domesticRegion && info.regionIds.includes(port.domesticRegion))
  if (info.scope === 'INTERNATIONAL') return Boolean(country && info.countryCodes.some(code => code.toUpperCase() === country))
  return false
}

function clock(zone?: string): string | null {
  if (!zone) return null
  try {
    const canonical = new Intl.DateTimeFormat('vi-VN', { timeZone: zone }).resolvedOptions().timeZone
    // These port clocks both use UTC+08 throughout the year. A source schedule has
    // day numbers, not a departure date: do not guess DST offsets for other zones.
    if (['Asia/Kuala_Lumpur', 'Asia/Kuching', 'Asia/Singapore', 'Singapore'].includes(canonical)) return 'PORT_CLOCK_UTC_PLUS_08'
    return canonical
  } catch { return null }
}
export function samePortClock(first?: string, second?: string): boolean {
  const zone = clock(first)
  return zone !== null && zone === clock(second)
}
function interval(stop: Stop): [number, number] | null {
  if (!stop.plannedArrivalTime || !stop.plannedDepartureTime) return null
  const start = timeNumber(stop.arrivalDayNumber, stop.plannedArrivalTime)
  const end = timeNumber(stop.departureDayNumber, stop.plannedDepartureTime)
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? [start, end] : null
}

export function overlappingStops(stop: Stop, stops: readonly Stop[]): Stop[] {
  const current = interval(stop)
  if (!current) return []
  return stops.filter(other => {
    if (other.clientKey === stop.clientKey || !samePortClock(stop.timeZoneId, other.timeZoneId)) return false
    const candidate = interval(other)
    return candidate !== null && current[0] < candidate[1] && candidate[0] < current[1]
  })
}

/** Client feedback only. Different port clocks require an agreed comparison contract. */
export function stopTimingViolations(content: Content): Violation[] {
  return content.stops.flatMap(stop => {
    const conflicts = overlappingStops(stop, content.stops)
    if (!conflicts.length) return []
    return [{
      code: 'CLIENT_STOP_TIME_OVERLAP', severity: 'ERROR' as const, entityType: 'STOP',
      clientKey: stop.clientKey, dayNumber: stop.arrivalDayNumber, field: 'plannedArrivalTime',
      fieldPath: 'stops[clientKey=' + stop.clientKey + '].plannedArrivalTime',
      message: 'Thời gian lần ghé ' + stop.stopOrder + ' tại ' + (stop.portName || 'cảng đã chọn') +
        ' chồng với lần ghé ' + conflicts.map(other => other.stopOrder + ' · ' + (other.portName || 'Cảng')).join(', ') + '. Các lần ghé này dùng cùng cơ sở giờ.'
    }]
  })
}

export function portScopeViolations(content: Pick<Content, 'stops'>, info: Scope, ports: readonly Source[]): Violation[] {
  return content.stops.flatMap(stop => {
    const port = ports.find(item => item.id === stop.portId)
    if (port && portMatchesScope(port, info)) return []
    const label = 'Lần ghé ' + stop.stopOrder + ' · ' + (stop.portName || port?.name || 'Cảng đã lưu')
    return [{
      code: 'CLIENT_PORT_SCOPE', severity: 'ERROR' as const, entityType: 'STOP', clientKey: stop.clientKey,
      dayNumber: stop.arrivalDayNumber, field: 'portId', fieldPath: 'stops[clientKey=' + stop.clientKey + '].portId',
      message: label + (port?.countryCode ? ' không thuộc quốc gia hoặc miền đã chọn cho chuyến đi.' : ' chưa có đủ dữ liệu danh mục để xác nhận phạm vi. Kiểm tra lại cảng; dữ liệu đã lưu vẫn được giữ.')
    }]
  })
}

export function linkedTourViolations(stop: Stop, content: Content): Violation[] {
  if (!interval(stop)) return []
  const start = timeNumber(stop.arrivalDayNumber, stop.plannedArrivalTime)
  const departure = timeNumber(stop.departureDayNumber, stop.plannedDepartureTime)
  const limit = stop.allAboardDayNumber != null && stop.allAboardTime
    ? Math.min(departure, timeNumber(stop.allAboardDayNumber, stop.allAboardTime))
    : departure
  return content.entries.filter(entry => entry.kind === 'SHORE_EXCURSION' && entry.stopClientKey === stop.clientKey &&
    (timeNumber(entry.startDayNumber, entry.plannedStartTime) < start || timeNumber(entry.endDayNumber, entry.plannedEndTime) > limit))
    .map(entry => ({
      code: 'CLIENT_TOUR_WINDOW', severity: 'ERROR', entityType: 'ENTRY', clientKey: entry.clientKey,
      dayNumber: entry.startDayNumber, field: timeNumber(entry.startDayNumber, entry.plannedStartTime) < start ? 'plannedStartTime' : 'plannedEndTime',
      fieldPath: 'entries[clientKey=' + entry.clientKey + '].' + (timeNumber(entry.startDayNumber, entry.plannedStartTime) < start ? 'plannedStartTime' : 'plannedEndTime'),
      message: 'Tour tham quan trên bờ “' + entry.title + '” vượt giờ dự kiến đến hoặc hạn trở lại của lần ghé ' + stop.stopOrder + '.'
    }))
}

const clockMinutes = (value?: string | null): number | null => {
  if (!value) return null
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

export function callTypeTimingViolations(stops: readonly Stop[]): Violation[] {
  const violations: Violation[] = []
  for (const stop of stops) {
    if (stop.isDisembarkation || !stop.plannedArrivalTime || !stop.plannedDepartureTime) continue
    const arrMin = clockMinutes(stop.plannedArrivalTime)
    const depMin = clockMinutes(stop.plannedDepartureTime)
    if (arrMin == null || depMin == null) continue
    if (timeNumber(stop.departureDayNumber, stop.plannedDepartureTime) <= timeNumber(stop.arrivalDayNumber, stop.plannedArrivalTime)) continue
    const daySpan = stop.departureDayNumber - stop.arrivalDayNumber
    const push = (field: 'plannedArrivalTime' | 'plannedDepartureTime' | 'callType', message: string) => {
      violations.push({
        code: 'CLIENT_CALL_TYPE_TIMING',
        severity: 'ERROR',
        entityType: 'STOP',
        clientKey: stop.clientKey,
        dayNumber: field === 'plannedDepartureTime' ? stop.departureDayNumber : stop.arrivalDayNumber,
        field,
        fieldPath: 'stops[clientKey=' + stop.clientKey + '].' + field,
        message,
      })
    }

    if (stop.callType === 'NORMAL') {
      if (daySpan > 0) {
        push('plannedDepartureTime', 'Kiểu Thông thường yêu cầu tàu đến và rời trong cùng một ngày. Nếu neo sang ngày hôm sau, hãy chọn kiểu Qua đêm.')
      } else if (arrMin < 5 * 60) {
        push('plannedArrivalTime', 'Kiểu Thông thường áp dụng cập cảng từ 05:00 trở đi. Cập cảng rạng sáng (00:00 – 04:59), hãy đổi sang kiểu Ban đêm.')
      } else if (depMin > 21 * 60) {
        push('plannedDepartureTime', 'Kiểu Thông thường chỉ áp dụng rời cảng muộn nhất 21:00 cùng ngày. Rời sau 21:00, hãy đổi sang kiểu Ban đêm.')
      }
    } else if (stop.callType === 'LATE_NIGHT') {
      if (daySpan > 1) {
        push('plannedDepartureTime', 'Kiểu Ban đêm không kéo dài nhiều ngày. Hãy đổi sang kiểu Qua đêm.')
      } else if (daySpan === 1) {
        if (depMin > 3 * 60) {
          push('plannedDepartureTime', 'Rời cảng sau 03:00 ngày hôm sau (Ngày ' + stop.departureDayNumber + ' ' + shortTime(stop.plannedDepartureTime) + ') thuộc kiểu Qua đêm. Hãy đổi kiểu ghé sang Qua đêm hoặc đặt giờ rời trong khoảng 00:00 – 03:00.')
        } else if (arrMin < 18 * 60) {
          push('plannedArrivalTime', 'Kiểu Ban đêm vắt qua nửa đêm yêu cầu tàu cập từ 18:00 trở đi. Nếu tàu ở lại cả ngày lẫn đêm sang hôm sau, hãy chọn kiểu Qua đêm.')
        }
      } else {
        const earlyMorningCall = arrMin < 5 * 60 && depMin <= 6 * 60
        if (depMin < 21 * 60 && !earlyMorningCall) {
          push('plannedDepartureTime', 'Kiểu Ban đêm trong cùng ngày yêu cầu rời cảng từ 21:00 trở đi (hoặc cập rạng sáng trước 05:00). Khung 05:00 – 21:00 hãy chọn kiểu Thông thường.')
        }
      }
    } else if (stop.callType === 'OVERNIGHT') {
      if (daySpan < 1) {
        push('plannedDepartureTime', 'Kiểu Qua đêm yêu cầu ngày tàu rời phải sau ngày tàu đến (ví dụ: Ngày ' + stop.arrivalDayNumber + ' → Ngày ' + (stop.arrivalDayNumber + 1) + '). Đến và rời trong cùng ngày hãy chọn Thông thường hoặc Ban đêm.')
      } else if (daySpan === 1 && depMin <= 3 * 60) {
        push('plannedDepartureTime', 'Tàu rời rạng sáng 00:00 – 03:00 phù hợp kiểu Ban đêm. Kiểu Qua đêm áp dụng khi tàu neo đến sau 03:00 sáng hôm sau.')
      }
    }
  }
  return violations
}

export function callsAfterTerminal(stops: readonly Stop[]): Violation[] {
  const terminal = stops.find(stop => stop.isDisembarkation)
  if (!terminal?.plannedArrivalTime) return []
  const arrival = timeNumber(terminal.arrivalDayNumber, terminal.plannedArrivalTime)
  const conflicting = stops.filter(stop => !stop.isDisembarkation && stop.plannedDepartureTime &&
    samePortClock(stop.timeZoneId, terminal.timeZoneId) &&
    timeNumber(stop.departureDayNumber, stop.plannedDepartureTime) >= arrival)
  if (!conflicting.length) return []
  const latestConflict = conflicting.toSorted((a, b) =>
    timeNumber(b.departureDayNumber, b.plannedDepartureTime) - timeNumber(a.departureDayNumber, a.plannedDepartureTime),
  )[0]
  return [
    {
      code: 'CLIENT_TERMINAL_ARRIVAL_CONFLICT',
      severity: 'ERROR',
      entityType: 'STOP',
      clientKey: terminal.clientKey,
      dayNumber: terminal.arrivalDayNumber,
      field: 'plannedArrivalTime',
      fieldPath: 'stops[clientKey=' + terminal.clientKey + '].plannedArrivalTime',
      message: 'Giờ tàu cập cảng cuối (Ngày ' + terminal.arrivalDayNumber + ' ' + shortTime(terminal.plannedArrivalTime) + ') phải sau giờ rời ' + (latestConflict.portName || 'cảng ghé trước') + ' (Ngày ' + latestConflict.departureDayNumber + ' ' + shortTime(latestConflict.plannedDepartureTime) + ').',
    },
    ...conflicting.map(stop => ({
      code: 'CLIENT_CALL_AFTER_TERMINAL',
      severity: 'ERROR' as const,
      entityType: 'STOP' as const,
      clientKey: stop.clientKey,
      dayNumber: stop.departureDayNumber,
      field: 'plannedDepartureTime',
      fieldPath: 'stops[clientKey=' + stop.clientKey + '].plannedDepartureTime',
      message: 'Lần ghé rời cảng lúc Ngày ' + stop.departureDayNumber + ' ' + shortTime(stop.plannedDepartureTime) + ' — phải kết thúc trước khi tàu cập cảng cuối ' + (terminal.portName || '') + ' (Ngày ' + terminal.arrivalDayNumber + ' ' + shortTime(terminal.plannedArrivalTime) + ').',
    })),
  ]
}

export function consecutiveSamePortViolations(content: Pick<Content, 'stops'>): Violation[] {
  const ordered = [...content.stops].sort((first, second) => first.stopOrder - second.stopOrder)
  return ordered.flatMap((stop, index) => {
    const previous = ordered[index - 1]
    if (!previous || !stop.portId || previous.portId !== stop.portId) return []
    return [{
      code: 'CONSECUTIVE_SAME_PORT',
      severity: 'ERROR' as const,
      entityType: 'STOP',
      clientKey: stop.clientKey,
      dayNumber: stop.arrivalDayNumber,
      field: 'portId',
      fieldPath: 'stops[clientKey=' + stop.clientKey + '].portId',
      message: 'Hai lượt ghé liên tiếp không được trùng cảng (' + (stop.portName || 'cảng đã chọn') + '). Hãy chọn cảng khác ở giữa.',
    }]
  })
}

export function departureTimingViolations(content: Pick<Content, 'days' | 'stops'>, fallbackDepartureTime?: string | null): Violation[] {
  const firstDay = content.days.find(day => day.dayNumber === 1)
  const effectiveDepTime = firstDay?.plannedDepartureTime || fallbackDepartureTime || null
  if (!firstDay?.departurePortId || !effectiveDepTime) return []
  if (content.stops.some(stop => stop.isEmbarkation)) return []
  const day1Zone = firstDay.shipTimeZoneId ?? SHIP_ZONE
  const dep1 = timeNumber(1, effectiveDepTime)
  const ordered = [...content.stops].sort((first, second) => first.stopOrder - second.stopOrder)
  const conflict = ordered.find(stop =>
    stop.plannedArrivalTime &&
    samePortClock(day1Zone, stop.timeZoneId) &&
    timeNumber(stop.arrivalDayNumber, stop.plannedArrivalTime) <= dep1,
  )
  if (!conflict || !conflict.plannedArrivalTime) return []
  const arr = timeNumber(conflict.arrivalDayNumber, conflict.plannedArrivalTime)
  return [{
    code: arr < dep1 ? 'INVALID_DEPARTURE_STOP_SEQUENCE' : 'NON_POSITIVE_TRANSIT_TIME',
    severity: 'ERROR',
    entityType: 'DAY',
    dayNumber: 1,
    field: 'plannedDepartureTime',
    fieldPath: 'days[1].plannedDepartureTime',
    message: arr < dep1
      ? 'Giờ khởi hành sớm nhất Ngày 1 (' + shortTime(effectiveDepTime) + ') đang muộn hơn giờ đến ' + (conflict.portName || 'cảng kế tiếp') + ' (Ngày ' + conflict.arrivalDayNumber + ' ' + shortTime(conflict.plannedArrivalTime) + ').'
      : 'Giờ khởi hành sớm nhất Ngày 1 (' + shortTime(effectiveDepTime) + ') phải sớm hơn giờ đến ' + (conflict.portName || 'cảng kế tiếp') + ' để có thời gian di chuyển.',
  }]
}

export function routeOrderViolations(
  content: Pick<Content, 'stops'> & {
    days?: readonly Pick<Day, 'dayNumber' | 'departurePortId' | 'departurePortName' | 'plannedDepartureTime' | 'shipTimeZoneId'>[]
  },
  fallbackDepartureTime?: string | null,
): Violation[] {
  const ordered = [...content.stops].sort((first, second) => first.stopOrder - second.stopOrder)
  const violations: Violation[] = []
  const firstDay = content.days?.find(day => day.dayNumber === 1)
  const effectiveDepTime = firstDay?.plannedDepartureTime || fallbackDepartureTime || null
  if (firstDay?.departurePortId && effectiveDepTime && !ordered.some(stop => stop.isEmbarkation)) {
    const day1Zone = firstDay.shipTimeZoneId ?? SHIP_ZONE
    const dep1 = timeNumber(1, effectiveDepTime)
    for (const stop of ordered) {
      if (!stop.plannedArrivalTime || !samePortClock(day1Zone, stop.timeZoneId)) continue
      const arr = timeNumber(stop.arrivalDayNumber, stop.plannedArrivalTime)
      if (arr < dep1) {
        violations.push({
          code: 'CLIENT_STOP_ORDER_TIME',
          severity: 'ERROR',
          entityType: 'STOP',
          clientKey: stop.clientKey,
          dayNumber: stop.arrivalDayNumber,
          field: 'plannedArrivalTime',
          fieldPath: 'stops[clientKey=' + stop.clientKey + '].plannedArrivalTime',
          message: 'Lần ghé ' + stop.stopOrder + ' tại ' + (stop.portName || 'cảng đã chọn') + ' (Ngày ' + stop.arrivalDayNumber + ' ' + shortTime(stop.plannedArrivalTime) + ') phải đến sau giờ khởi hành Ngày 1 (' + shortTime(effectiveDepTime) + ').',
        })
      } else if (arr === dep1) {
        violations.push({
          code: 'CLIENT_STOP_ORDER_TIME',
          severity: 'ERROR',
          entityType: 'STOP',
          clientKey: stop.clientKey,
          dayNumber: stop.arrivalDayNumber,
          field: 'plannedArrivalTime',
          fieldPath: 'stops[clientKey=' + stop.clientKey + '].plannedArrivalTime',
          message: 'Lần ghé ' + stop.stopOrder + ' tại ' + (stop.portName || 'cảng đã chọn') + ' cần chừa thời gian di chuyển sau giờ khởi hành Ngày 1 (' + shortTime(effectiveDepTime) + ').',
        })
      }
    }
  }
  return [
    ...violations,
    ...ordered.flatMap((stop, index) => {
      const previous = ordered[index - 1], current = interval(stop)
      if (!previous || !current || !samePortClock(previous.timeZoneId, stop.timeZoneId)) return []
      const before = interval(previous)
      if (!before || overlappingStops(stop, [previous]).length) return []
      if (before[1] === current[0] && previous.portId !== stop.portId) return [{
        code: 'CLIENT_STOP_ORDER_TIME', severity: 'ERROR' as const, entityType: 'STOP', clientKey: stop.clientKey,
        dayNumber: stop.arrivalDayNumber, field: 'plannedArrivalTime', fieldPath: 'stops[clientKey=' + stop.clientKey + '].plannedArrivalTime',
        message: 'Lần ghé ' + stop.stopOrder + ' tại ' + (stop.portName || 'cảng đã chọn') + ' phải đến sau giờ rời lần ghé ' + previous.stopOrder + ' tại ' + (previous.portName || 'cảng trước') + '. Hai cảng khác nhau cần có thời gian di chuyển.'
      }]
      if (before[1] <= current[0]) return []
      return [{
        code: 'CLIENT_STOP_ORDER_TIME', severity: 'ERROR' as const, entityType: 'STOP', clientKey: stop.clientKey,
        dayNumber: stop.arrivalDayNumber, field: 'plannedArrivalTime', fieldPath: 'stops[clientKey=' + stop.clientKey + '].plannedArrivalTime',
        message: 'Lần ghé ' + stop.stopOrder + ' có giờ dự kiến đến trước khi lần ghé ' + previous.stopOrder + ' kết thúc. Kiểm tra lại thứ tự tuyến và giờ dự kiến.'
      }]
    }),
  ]
}
