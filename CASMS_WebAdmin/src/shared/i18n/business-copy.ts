import reviewedCopy from './vi-business-map.json'
/** Reviewed v4 domain keys; never infer display words from technical enum spelling. */
export type BusinessCopyKey = keyof typeof reviewedCopy
export const businessCopy = (key: BusinessCopyKey): string => reviewedCopy[key]
export const cabinTypeLabels = {
  INTERIOR: businessCopy('cabin.type.INTERIOR'),
  OCEAN_VIEW: businessCopy('cabin.type.OCEAN_VIEW'),
  BALCONY: businessCopy('cabin.type.BALCONY'),
  SUITE: businessCopy('cabin.type.SUITE'),
}
export function cabinTypeLabel(value: string): string {
  const trimmed = value.trim()
  if (Object.hasOwn(cabinTypeLabels, trimmed)) {
    return cabinTypeLabels[trimmed as keyof typeof cabinTypeLabels]
  }
  if (Object.values(cabinTypeLabels).includes(trimmed) || !/^[A-Z0-9_]+$/.test(trimmed)) {
    return trimmed
  }
  return `Chưa xác định (${trimmed})`
}
export function domainStatus(domain: string, status: string): string {
  const key = `${domain}.${status}`
  return Object.prototype.hasOwnProperty.call(reviewedCopy, key)
    ? reviewedCopy[key as BusinessCopyKey] : 'Chưa xác định'
}
