import { timeNumber, type Content, type Source, type Stop, type TripInfo, type Violation } from './plan'

type Scope=Pick<TripInfo,'scope'|'regionIds'|'countryCodes'>
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
  try { return new Intl.DateTimeFormat('vi-VN', { timeZone: zone }).resolvedOptions().timeZone } catch { return null }
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
    return [{ code: 'CLIENT_STOP_TIME_OVERLAP', severity: 'ERROR' as const, entityType: 'STOP',
      clientKey: stop.clientKey, dayNumber: stop.arrivalDayNumber, field: 'plannedArrivalTime',
      fieldPath: 'stops[clientKey=' + stop.clientKey + '].plannedArrivalTime',
      message: 'Thời gian lần ghé ' + stop.stopOrder + ' tại ' + (stop.portName || 'cảng đã chọn') +
        ' chồng với lần ghé ' + conflicts.map(other => other.stopOrder + ' · ' + (other.portName || 'Cảng')).join(', ') + '. Các lần ghé này dùng cùng cơ sở giờ.' }]
  })
}

export function portScopeViolations(content: Pick<Content, 'stops'>, info: Scope, ports: readonly Source[]): Violation[] {
  return content.stops.flatMap(stop => {
    const port = ports.find(item => item.id === stop.portId)
    if (port && portMatchesScope(port, info)) return []
    const label = 'Lần ghé ' + stop.stopOrder + ' · ' + (stop.portName || port?.name || 'Cảng đã lưu')
    return [{ code: 'CLIENT_PORT_SCOPE', severity: 'ERROR' as const, entityType: 'STOP', clientKey: stop.clientKey,
      dayNumber: stop.arrivalDayNumber, field: 'portId', fieldPath: 'stops[clientKey=' + stop.clientKey + '].portId',
      message: label + (port?.countryCode ? ' không thuộc quốc gia hoặc miền đã chọn cho chuyến đi.' : ' chưa có đủ dữ liệu danh mục để xác nhận phạm vi. Kiểm tra lại cảng; dữ liệu đã lưu vẫn được giữ.') }]
  })
}

export function linkedTourViolations(stop: Stop, content: Content): Violation[] {
  if (!interval(stop)) return []
  const start = timeNumber(stop.arrivalDayNumber, stop.plannedArrivalTime)
  const limit = timeNumber(stop.allAboardDayNumber ?? stop.departureDayNumber, stop.allAboardTime ?? stop.plannedDepartureTime)
  return content.entries.filter(entry => entry.kind === 'SHORE_EXCURSION' && entry.stopClientKey === stop.clientKey &&
    (timeNumber(entry.startDayNumber, entry.plannedStartTime) < start || timeNumber(entry.endDayNumber, entry.plannedEndTime) > limit))
    .map(entry => ({ code: 'CLIENT_TOUR_WINDOW', severity: 'ERROR', entityType: 'ENTRY', clientKey: entry.clientKey,
      dayNumber: entry.startDayNumber, field: timeNumber(entry.startDayNumber, entry.plannedStartTime) < start ? 'plannedStartTime' : 'plannedEndTime',
      fieldPath: 'entries[clientKey=' + entry.clientKey + '].' + (timeNumber(entry.startDayNumber, entry.plannedStartTime) < start ? 'plannedStartTime' : 'plannedEndTime'),
      message: 'Tour tham quan trên bờ “' + entry.title + '” vượt giờ dự kiến đến hoặc hạn trở lại của lần ghé ' + stop.stopOrder + '.' }))
}

export function routeOrderViolations(content: Pick<Content, 'stops'>): Violation[] {
  const ordered=[...content.stops].sort((first,second)=>first.stopOrder-second.stopOrder)
  return ordered.flatMap((stop,index)=>{
    const previous=ordered[index-1],current=interval(stop)
    if(!previous||!current||!samePortClock(previous.timeZoneId,stop.timeZoneId))return []
    const before=interval(previous)
    if(!before||before[1]<=current[0]||overlappingStops(stop,[previous]).length)return []
    return [{code:'CLIENT_STOP_ORDER_TIME',severity:'ERROR' as const,entityType:'STOP',clientKey:stop.clientKey,
      dayNumber:stop.arrivalDayNumber,field:'plannedArrivalTime',fieldPath:'stops[clientKey='+stop.clientKey+'].plannedArrivalTime',
      message:'Lần ghé '+stop.stopOrder+' có giờ dự kiến đến trước khi lần ghé '+previous.stopOrder+' kết thúc. Kiểm tra lại thứ tự tuyến và giờ dự kiến.'}]
  })
}
