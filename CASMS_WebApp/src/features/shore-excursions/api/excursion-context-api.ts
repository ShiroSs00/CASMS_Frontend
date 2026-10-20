import { apiRequest } from '@/shared/api'

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
      return rows.map(item => ({ ...item, label: `${itinerary.itineraryName} · Điểm ${item.stopOrder ?? 'chưa có thứ tự'} · ${ports.find(port => port.portId === item.portId)?.portName ?? 'Chưa tải được tên cảng'}` }))
    }))).flat()
  },
}

export function validateExcursionWindow(start: string, end: string, stop: StopOption | undefined): string {
  if (!stop) return 'Chọn điểm dừng từ danh sách đã tải.'
  const begin = Date.parse(start), finish = Date.parse(end), arrival = Date.parse(stop.plannedArrival), limit = Date.parse(stop.allAboardTime || stop.plannedDeparture)
  if (![begin, finish, arrival, limit].every(Number.isFinite) || begin < arrival || finish > limit || finish <= begin) return 'Chuyến tham quan phải nằm trong thời gian lưu cảng và kết thúc trước giờ khách lên tàu.'
  if (stop.arrivalMethod === 'TENDER' && stop.tenderTransferMinutes != null && begin < arrival + stop.tenderTransferMinutes * 60000) return 'Cần dành đủ thời gian trung chuyển bằng tàu nhỏ trước khi tham quan.'
  return ''
}
