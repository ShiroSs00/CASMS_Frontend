export function portLocalDate(instant: string, zone: string) {
  const date = new Intl.DateTimeFormat('vi-VN', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(instant))
  const part = (type: Intl.DateTimeFormatPartTypes) => date.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function portRangeDates(start: string, end: string, zone: string, itineraryDate: string) {
  const first = portLocalDate(start, zone)
  const last = portLocalDate(end, zone)
  const crossesMidnight = first !== last
  return { showStartDate: crossesMidnight || first !== itineraryDate, showEndDate: crossesMidnight }
}
