import { apiRequest } from '@/shared/api'
export type ServiceSlot = { id: string; serviceId: string; startsAt: string; endsAt: string; location: string; capacity: number; remainingCapacity: number; status: string }
export async function serviceSlots(serviceId: string, signal?: AbortSignal) {
  const rows = await apiRequest<ServiceSlot[]>(`/servicepackage/services/${encodeURIComponent(serviceId)}/schedules`, { signal })
  if (!Array.isArray(rows) || rows.some(row => !row.id || row.serviceId !== serviceId || !Number.isFinite(Date.parse(row.startsAt)) || !Number.isFinite(Date.parse(row.endsAt)) || !Number.isSafeInteger(row.remainingCapacity) || row.remainingCapacity < 0)) throw new Error('Không đọc được lịch dịch vụ.')
  return rows
}
