export const SHIP_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export function validTimeZone(zone: string | null | undefined): zone is string {
  if (!zone) return false
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(0); return true } catch { return false }
}

/** Format an instant as a wall clock, independent of the browser time zone. */
export function zonedInput(instant: string | number, zone: string): string {
  if (!validTimeZone(zone)) throw new Error('Cảng chưa được cấu hình múi giờ hợp lệ.')
  const date = new Date(instant)
  if (!Number.isFinite(date.getTime())) throw new Error('Thời gian không hợp lệ.')
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

/** Resolve IANA offsets on the actual date; reject DST gaps and folds instead of guessing. */
export function wallTimeToInstant(value: string, zone: string): string {
  if (!validTimeZone(zone)) throw new Error('Cảng chưa được cấu hình múi giờ hợp lệ.')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) throw new Error('Nhập đầy đủ ngày và giờ hợp lệ.')
  const wall = value.length === 16 ? `${value}:00` : value
  // UTC is only a numeric representation of the input components here, not its meaning.
  const components = wall.split(/[-T:]/).map(Number)
  const numeric = Date.UTC(components[0], components[1] - 1, components[2], components[3], components[4], components[5])
  if (new Date(numeric).toISOString().slice(0, 19) !== wall) throw new Error('Ngày hoặc giờ không hợp lệ.')
  const offsets = new Set<number>()
  for (const hours of [-48, -24, -12, 0, 12, 24, 48]) {
    const probe = numeric + hours * 3600000
    const local = zonedInput(probe, zone).split(/[-T:]/).map(Number)
    offsets.add(Date.UTC(local[0], local[1] - 1, local[2], local[3], local[4], local[5]) - probe)
  }
  const matches = [...offsets].map(offset => numeric - offset).filter(candidate => zonedInput(candidate, zone) === wall)
  if (matches.length === 0) throw new Error('Giờ này không tồn tại do chuyển giờ mùa hè tại cảng. Chọn giờ khác.')
  if (matches.length > 1) throw new Error('Giờ này xảy ra hai lần do chuyển giờ mùa hè tại cảng. Chọn giờ không bị trùng.')
  return new Date(matches[0]).toISOString()
}

export function journeyTime(instant: string, zone = SHIP_TIME_ZONE): string {
  if (!validTimeZone(zone) || !Number.isFinite(Date.parse(instant))) return 'Chưa có giờ hợp lệ'
  return new Intl.DateTimeFormat('vi-VN', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(instant))
}

export function addCalendarDays(date: string, count: number): string {
  return new Date(Date.parse(date) + count * 86400000).toISOString().slice(0, 10)
}
