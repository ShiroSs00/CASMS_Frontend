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
