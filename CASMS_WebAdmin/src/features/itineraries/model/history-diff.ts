/** Compare recorded evidence without inferring operational state from it. */
export type HistoryDifference = { path: string[]; before: unknown; after: unknown; hadBefore: boolean; hasAfter: boolean }
function decoded(value: unknown): unknown {
  if (typeof value !== 'string') return value
  // JSON.parse can silently round recorded numbers. Keep these snapshots verbatim.
  const tokens = value.match(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? []
  if (tokens.some(token => !token.startsWith('"') &&
    (/[.eE]/.test(token) || !Number.isSafeInteger(Number(token))))) return value
  try { return JSON.parse(value) } catch { return value }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]))
  if (object(a) && object(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]))
  }
  return false
}
export function historyDifferences(before: unknown, after: unknown): HistoryDifference[] {
  const rows: HistoryDifference[] = []
  function visit(a: unknown, b: unknown, path: string[], hadBefore: boolean, hasAfter: boolean) {
    if (hadBefore === hasAfter && same(a, b)) return
    if ((object(a) || !hadBefore) && (object(b) || !hasAfter)) {
      const old = object(a) ? a : {}, next = object(b) ? b : {}
      const keys = new Set([...Object.keys(old), ...Object.keys(next)])
      if (keys.size) {
        for (const key of keys) visit(old[key], next[key], [...path, key], Object.hasOwn(old, key), Object.hasOwn(next, key))
        return
      }
    }
    rows.push({ path, before: a, after: b, hadBefore, hasAfter })
  }
  visit(decoded(before), decoded(after), [], before != null, after != null)
  return rows
}
const labels: Record<string, string> = {
  arrivalTime: 'Giờ đến', departureTime: 'Giờ rời cảng', allAboardTime: 'Hạn trở lại tàu',
  scheduledArrival: 'Giờ đến dự kiến', scheduledDeparture: 'Giờ rời dự kiến',
  actualArrival: 'Giờ đến thực tế', actualDeparture: 'Giờ rời thực tế',
  portName: 'Tên cảng', portId: 'Cảng tham chiếu', stopOrder: 'Thứ tự ghé cảng',
  status: 'Trạng thái ghi nhận', name: 'Tên', title: 'Tiêu đề', reason: 'Lý do',
  startDate: 'Ngày bắt đầu', endDate: 'Ngày kết thúc', startTime: 'Giờ bắt đầu', endTime: 'Giờ kết thúc',
  dayNumber: 'Ngày hành trình', description: 'Mô tả', notes: 'Ghi chú', timeZoneId: 'Múi giờ',
}
export function historyFieldLabel(path: string[]) {
  return path.length ? path.map(part => labels[part] ?? part).join(' / ') : 'Nội dung ghi nhận'
}
export function historyValue(value: unknown, present: boolean): string {
  if (!present) return 'Không có trong bản ghi'
  if (value === null || value === undefined) return 'Chưa có giá trị'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (typeof value === 'string') return value || 'Chuỗi trống'
  return JSON.stringify(value, null, 2) ?? String(value)
}
