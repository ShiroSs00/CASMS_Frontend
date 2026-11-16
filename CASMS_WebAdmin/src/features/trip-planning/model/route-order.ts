import type { Content } from './plan'

export function projectRoute({ days, stops }: Pick<Content, 'days' | 'stops'>) {
  const firstDay = days.find(day => day.dayNumber === 1)
  const positionRole = (stop: Content['stops'][number]) => stop.isDisembarkation ? 2 : stop.isEmbarkation ? 0 : 1
  const priorOrder = (a: Content['stops'][number], b: Content['stops'][number]) =>
    a.stopOrder - b.stopOrder || a.clientKey.localeCompare(b.clientKey)
  const clock = (time: string) => time.length === 5 ? time + ':00' : time
  const ordered = [...stops].sort((a, b) => positionRole(a) - positionRole(b) || priorOrder(a, b))
  // Leave missing-clock rows in their saved slots. Sort complete rows separately
  // so mixing timed and untimed rows cannot produce a non-transitive comparator.
  const timed = ordered.filter(stop => positionRole(stop) === 1 && stop.plannedArrivalTime)
    .sort((a, b) => a.arrivalDayNumber - b.arrivalDayNumber
      || clock(a.plannedArrivalTime!).localeCompare(clock(b.plannedArrivalTime!)) || priorOrder(a, b))
  let next = 0
  const canonical = ordered.map((stop, index) => ({
    ...(positionRole(stop) === 1 && stop.plannedArrivalTime ? timed[next++] : stop),
    stopOrder: index + 1,
  }))
  const departure = firstDay?.departurePortId && !canonical.some(stop => stop.isEmbarkation)
    ? [{ key: 'departure', name: firstDay.departurePortName || 'Cảng khởi hành', role: 'Cảng khởi hành' }]
    : []
  const rows = [...departure, ...canonical.map(stop => ({
    key: stop.clientKey, name: stop.portName || 'Cảng',
    role: stop.isDisembarkation ? 'Cảng kết thúc' : stop.isEmbarkation ? 'Cảng khởi hành' : 'Lần ghé',
  }))].map((row, index) => ({ ...row, position: index + 1 }))
  return { rows, stops: canonical }
}

export function describeRouteDays(content: Pick<Content, 'days' | 'stops'>, route = projectRoute(content)) {
  return content.days.map(day => {
    const first = day.dayNumber === 1
    const last = day.dayNumber === content.days.length
    const calls = route.stops.filter(stop => stop.arrivalDayNumber <= day.dayNumber && stop.departureDayNumber >= day.dayNumber)
    const departure = calls.find(stop => stop.isEmbarkation)
    const ending = calls.find(stop => stop.isDisembarkation)
    const visits = calls.filter(stop => !stop.isEmbarkation && !stop.isDisembarkation)
    const roles = first && last ? 'Chuyến trong ngày' : first ? 'Khởi hành' : last ? 'Kết thúc' : day.dayType === 'SEA_DAY' ? 'Trên biển' : day.dayType === 'PORT_DAY' ? 'Ghé cảng' : null
    const startingPort = first ? departure?.portName || day.departurePortName : null
    const endingPort = last ? ending?.portName : null
    const names = [...new Set([startingPort, ...visits.map(stop => stop.portName), endingPort].filter(Boolean))]
    const firstCall = last ? ending ?? visits[0] : visits[0]
    const time = first ? departure?.plannedDepartureTime || day.plannedDepartureTime : firstCall?.arrivalDayNumber === day.dayNumber ? firstCall.plannedArrivalTime : null
    const points = route.rows.flatMap(row => {
      if (row.key === 'departure') return first ? [{ ...row, clockLabel: 'Giờ khởi hành', clock: day.plannedDepartureTime }] : []
      const stop = calls.find(item => item.clientKey === row.key && item.arrivalDayNumber === day.dayNumber)
      return stop ? [{ ...row, clockLabel: stop.isEmbarkation ? 'Giờ khởi hành' : 'Giờ tàu cập cảng',
        clock: stop.isEmbarkation ? stop.plannedDepartureTime : stop.plannedArrivalTime }] : []
    })
    return {
      day,
      role: roles,
      place: names.join(' · ') || (first ? 'Chọn cảng khởi hành' : last ? 'Chọn cảng kết thúc' : day.dayType === 'PORT_DAY' ? 'Chưa có lần ghé' : day.dayType === 'SEA_DAY' ? 'Di chuyển trên biển' : 'Chưa lên lịch'),
      time,
      points,
    }
  })
}
