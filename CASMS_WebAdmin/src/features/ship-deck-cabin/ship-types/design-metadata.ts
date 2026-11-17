import type { DesignManifest } from './api'
import { manufacturingFields } from './profile'

const requiredText = [
  ['name', 'Tên loại tàu'],
  ['shipManufacturerName', 'Nhà sản xuất'],
  ['engineType', 'Loại động cơ'],
] as const

export function manufacturingIssues(manifest: DesignManifest) {
  return manufacturingFields.filter(({ key }) => {
    if (manifest.shipTypeManufacturingIssues?.includes(key)) return true
    const value = manifest[key]
    if (key === 'buildYear') {
      return typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > new Date().getUTCFullYear()
    }
    if (typeof value !== 'string' || !value.trim() || value.includes('\0')) return true
    if (key === 'buildCountry') return !/^[A-Z]{2}$/.test(value.trim())
    return value.trim().length > (key === 'shipyard' ? 150 : 80)
  })
}

export function metadataIssues(manifest: DesignManifest) {
  const missing: string[] = requiredText.filter(([field]) => typeof manifest[field] !== 'string' || !manifest[field]?.trim())
    .map(([field, label]) => label + ' (' + field + ')')
  const dimensions = [
    [manifest.passengerCapacity, 'Sức chứa (passengerCapacity)'],
    [manifest.length, 'Chiều dài (length)'],
    [manifest.beam, 'Chiều rộng (beam)'],
  ] as const
  for (const [value, label] of dimensions) if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) missing.push(label)
  if (!Number.isInteger(manifest.deckCount) || (manifest.deckCount ?? 0) < 8 || (manifest.deckCount ?? 0) > 24) missing.push('Số boong hành khách (deckCount)')
  return missing.concat(manufacturingIssues(manifest).map(({ key, label }) => label + ' (' + key + ')'))
}
