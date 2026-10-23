import { apiRequest } from '@/shared/api'
export type ServiceSlot = { id: string; serviceId: string; startsAt: string; endsAt: string; location: string; capacity: number; remainingCapacity: number; status: string }
export async function serviceSlots(serviceId: string, signal?: AbortSignal) {
  const rows = await apiRequest<ServiceSlot[]>(`/servicepackage/services/${encodeURIComponent(serviceId)}/schedules`, { signal })
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || !row.id || row.serviceId !== serviceId || typeof row.location !== 'string'
    || !Number.isFinite(Date.parse(row.startsAt)) || !Number.isFinite(Date.parse(row.endsAt)) || Date.parse(row.endsAt) <= Date.parse(row.startsAt)
    || !Number.isSafeInteger(row.capacity) || row.capacity < 1 || !Number.isSafeInteger(row.remainingCapacity) || row.remainingCapacity < 0 || row.remainingCapacity > row.capacity
    || !['DRAFT', 'OPEN', 'FULL', 'CLOSED', 'CANCELLED'].includes(row.status)) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Không đọc được lịch dịch vụ.')
  return rows
}
