import type { DesignManifest } from './api'

const requiredText = [
  ['name', 'Tên loại tàu'],
  ['shipManufacturerName', 'Nhà sản xuất'],
  ['engineType', 'Loại động cơ'],
] as const

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
  return missing
}
