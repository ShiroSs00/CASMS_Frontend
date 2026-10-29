import reviewedCopy from './vi-business-map.json'
/** Reviewed v4 domain keys; never infer display words from technical enum spelling. */
export type BusinessCopyKey = keyof typeof reviewedCopy
export const businessCopy = (key: BusinessCopyKey): string => reviewedCopy[key]
export function domainStatus(domain: string, status: string): string {
  const key = `${domain}.${status}`
  return Object.prototype.hasOwnProperty.call(reviewedCopy, key)
    ? reviewedCopy[key as BusinessCopyKey] : 'Chưa xác định'
}
