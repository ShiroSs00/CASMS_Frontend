import { itineraryDayRole, type ItineraryDayRole } from '@/domain/itinerary-day'
/** Boundary roles are distinct from SEA_DAY / PORT_DAY and update with trip length. */
export function dayBoundaryLabel(dayNumber: number, totalDays: number): string | null {
  if (dayNumber === 1 && totalDays === 1) return 'Khởi hành và kết thúc'
  if (dayNumber === 1) return 'Khởi hành'
  if (dayNumber === totalDays) return 'Kết thúc'
  return null
}

export function scheduleDayLabel(dayNumber: number, totalDays: number): string {
  const role = dayBoundaryLabel(dayNumber, totalDays)
  return `Ngày ${dayNumber}${role ? ` · ${role}` : ''}`
}

export function stopRoleLabel(embarkation: boolean, disembarkation: boolean): string {
  return embarkation && disembarkation ? 'Cảng khởi hành và kết thúc'
    : embarkation ? 'Cảng khởi hành' : disembarkation ? 'Cảng kết thúc' : 'Cảng ghé'
}

/** Departure may be at sea or in port; the final day must have a disembarkation port. */
export function normalizeBoundaryDays<T extends { dayNumber: number; dayType: 'SEA_DAY' | 'PORT_DAY' | null; dayRole?: ItineraryDayRole }>(days: T[]): T[] {
  return days.map(day => ({ ...day, dayRole: itineraryDayRole(day.dayNumber, days.length), ...(day.dayNumber === days.length ? { dayType: 'PORT_DAY' as const } : {}) }))
}

export function scheduleDayTypeLabel(dayNumber: number, totalDays: number, dayType: string | null): string {
  const boundary = dayBoundaryLabel(dayNumber, totalDays)
  const location = dayType === 'SEA_DAY' ? 'Trên biển' : dayType === 'PORT_DAY' ? dayNumber === totalDays ? 'Cảng trả khách' : 'Xuống bờ' : 'Chưa chọn trạng thái'
  return boundary ? `Ngày ${boundary.toLocaleLowerCase('vi')} · ${location}` : dayType === 'SEA_DAY' ? 'Ngày trên biển' : dayType === 'PORT_DAY' ? 'Ngày ghé cảng' : 'Chưa chọn loại ngày'
}
