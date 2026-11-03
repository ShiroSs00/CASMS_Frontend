export type ItineraryDayRole = 'DEPARTURE' | 'REGULAR' | 'ARRIVAL' | 'DEPARTURE_AND_ARRIVAL'

export function itineraryDayRole(number: number, total: number): ItineraryDayRole {
  if (total === 1) return 'DEPARTURE_AND_ARRIVAL'
  return number === 1 ? 'DEPARTURE' : number === total ? 'ARRIVAL' : 'REGULAR'
}

export const itineraryDayRoleLabels: Record<ItineraryDayRole, string> = {
  DEPARTURE: 'Ngày khởi hành', REGULAR: 'Ngày trong hành trình', ARRIVAL: 'Ngày kết thúc', DEPARTURE_AND_ARRIVAL: 'Ngày khởi hành và kết thúc',
}
