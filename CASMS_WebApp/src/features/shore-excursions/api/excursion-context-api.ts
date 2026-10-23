import { apiRequest } from '@/shared/api'
import { displayTime, toLocalTime, type ExcursionFormValues, type ShoreExcursion } from '../model/shore-excursion'

export type StopOption = { cruiseStopId: string; label: string; plannedArrival: string; plannedDeparture: string; allAboardTime?: string | null; arrivalMethod?: string | null; tenderTransferMinutes?: number | null }
export type SupplierOption = { supplierId: string; supplierName: string; status: string; verificationStatus: string }
async function plans(signal?: AbortSignal) {
  const items: { itineraryId: string; itineraryName: string }[] = []
  for (let page = 0, count = 1; page < count; page++) {
    const data = await apiRequest<{ content: { itineraryId: string; itineraryName: string }[]; totalPages: number }>('/itineraries', { query: { page, size: 100 }, signal })
    if (!data || !Array.isArray(data.content) || !Number.isSafeInteger(data.totalPages) || data.content.some(item => !item?.itineraryId || !item.itineraryName)) throw new Error('Danh sách lịch trình không đầy đủ.')
    items.push(...data.content); count = data.totalPages
  }
  return items
}
export const excursionContextApi = {
  async suppliers(signal?: AbortSignal) {
    const data = await apiRequest<SupplierOption[]>('/suppliers', { signal })
    if (!Array.isArray(data) || data.some(item => !item?.supplierId || !item.supplierName || typeof item.status !== 'string' || typeof item.verificationStatus !== 'string')) throw new Error('Danh sách nhà cung cấp không đầy đủ.')
    return data
  },
  async stops(signal?: AbortSignal): Promise<StopOption[]> {
    const [itineraries, ports] = await Promise.all([plans(signal), apiRequest<{ portId: string; portName: string }[]>('/ports/active', { signal })])
    if (!Array.isArray(ports)) throw new Error('Không đọc được tên cảng.')
    return (await Promise.all(itineraries.map(async itinerary => {
      const rows = await apiRequest<(Omit<StopOption, 'label'> & { portId: string; stopOrder: number })[]>(`/cruise-stops/by-itinerary/${encodeURIComponent(itinerary.itineraryId)}`, { signal })
      if (!Array.isArray(rows) || rows.some(item => !item?.cruiseStopId || !Number.isFinite(Date.parse(item.plannedArrival)) || !Number.isFinite(Date.parse(item.plannedDeparture)))) throw new Error('Thông tin điểm dừng chưa đầy đủ.')
      return rows.map(item => ({ ...item, label: `${itinerary.itineraryName} · Điểm ${item.stopOrder ?? 'chưa có thứ tự'} · ${ports.find(port => port.portId === item.portId)?.portName ?? 'Chưa tải được tên cảng'} · ${displayTime(item.plannedArrival)}` }))
    }))).flat()
  },
}

export function excursionWindow(stop: StopOption | undefined) {
  if (!stop) return null
  const earliestStart = Date.parse(stop.plannedArrival) + Math.max(0, stop.tenderTransferMinutes ?? 0) * 60000
  const returnDeadline = Date.parse(stop.allAboardTime || stop.plannedDeparture)
  return Number.isFinite(earliestStart) && Number.isFinite(returnDeadline) && returnDeadline > earliestStart ? { earliestStart, returnDeadline } : null
}

export function validateExcursionWindow(start: string, end: string, stop: StopOption | undefined): Partial<Record<keyof ExcursionFormValues, string>> {
  if (!stop) return { cruiseStopId: 'Chọn điểm dừng từ danh sách đã tải.' }
  const window = excursionWindow(stop)
  if (!window) return { cruiseStopId: 'Điểm dừng chưa có khung giờ tham quan hợp lệ. Cần cập nhật giờ lưu cảng và trung chuyển.' }
  const errors: Partial<Record<keyof ExcursionFormValues, string>> = {}
  if (Date.parse(start) < window.earliestStart || Date.parse(start) >= window.returnDeadline) errors.startTime = `Bắt đầu từ ${displayTime(new Date(window.earliestStart).toISOString())} và trước hạn trở về.`
  if (Date.parse(end) >= window.returnDeadline) errors.plannedReturnTime = `Phải trở về trước ${displayTime(new Date(window.returnDeadline).toISOString())}.`
  return errors
}

// Same source statuses and strict overlap boundaries as BE countScheduleConflicts.
export function scheduledExcursions(items: ShoreExcursion[], excludeId?: string) {
  return items.filter(item => item.shoreExcursionId !== excludeId && ['PLANNED', 'OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS'].includes(item.status))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
}

export function suggestExcursionTimes(stop: StopOption | undefined, occupied: ShoreExcursion[]) {
  const window = excursionWindow(stop)
  if (!window) return null
  const minute = 60000
  let begin = Math.ceil(window.earliestStart / minute) * minute
  const latest = (Math.ceil(window.returnDeadline / minute) - 1) * minute
  const times = (end: number) => ({ startTime: toLocalTime(new Date(begin).toISOString()).slice(0, 16), plannedReturnTime: toLocalTime(new Date(end).toISOString()).slice(0, 16) })
  for (const item of occupied) {
    const start = Date.parse(item.startTime), end = Date.parse(item.plannedReturnTime)
    if (end <= begin) continue
    const gapEnd = Math.min(latest, Math.floor(start / minute) * minute)
    if (gapEnd > begin) return times(gapEnd)
    begin = Math.max(begin, Math.ceil(end / minute) * minute)
  }
  return latest > begin ? times(latest) : null
}
