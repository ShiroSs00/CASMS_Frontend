import type { BookingPersonDraft } from '../api/real-booking-api'

export const personGroup = (person: BookingPersonDraft) => person.cabinGroupKey?.trim() || (person.cabinId ? 'CABIN:' + person.cabinId : 'BOOKING_GROUP')
export function groupPassengers(passengers: BookingPersonDraft[]) {
  const groups = new Map<string, number[]>()
  passengers.forEach((person, index) => {
    const key = personGroup(person)
    groups.set(key, [...(groups.get(key) ?? []), index])
  })
  return [...groups].map(([key, members], index) => ({ key, members, label: `Phòng ${index + 1}` }))
}
export function moveToGroup(passengers: BookingPersonDraft[], index: number, key: string) {
  return passengers.map((person, i) => i === index ? { ...person, cabinGroupKey: key, cabinId: '' } : person)
}
export function removePartyPerson(passengers: BookingPersonDraft[], ids: string[], index: number) {
  if (passengers.length <= 1) return { passengers, ids }
  return { passengers: passengers.filter((_, i) => i !== index), ids: ids.filter((_, i) => i !== index) }
}
