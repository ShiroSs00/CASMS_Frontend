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
  return Object.hasOwn(cabinTypeLabels, value) ? cabinTypeLabels[value as keyof typeof cabinTypeLabels] : `Chưa xác định (${value})`
}
export function domainStatus(domain: string, status: string): string {
  const key = `${domain}.${status}`
  return Object.prototype.hasOwnProperty.call(reviewedCopy, key)
    ? reviewedCopy[key as BusinessCopyKey] : 'Chưa xác định'
}
