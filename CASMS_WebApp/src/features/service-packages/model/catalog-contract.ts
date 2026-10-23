export type ComponentKind = 'services' | 'activities' | 'excursions'
export type PackageComponent = { entityId: string; packageId: string; benefitType: 'INCLUDED' | 'OPTIONAL' }

// Read endpoints return effective components, including rows owned by ancestor packages.
export function decodePackageComponents(value: unknown, kind: ComponentKind): PackageComponent[] {
  const field = kind === 'services' ? 'serviceId' : kind === 'activities' ? 'activityId' : 'excursionId'
  if (!Array.isArray(value)) throw new Error('Danh sách thành phần quyền lợi không hợp lệ.')
  const seen = new Set<string>()
  return value.map(value => {
    if (!value || typeof value !== 'object') throw new Error('Thành phần quyền lợi không hợp lệ.')
    const row = value as Record<string, unknown>
    if (typeof row.packageId !== 'string' || !row.packageId.trim() || typeof row[field] !== 'string' || !(row[field] as string).trim()
      || !['INCLUDED', 'OPTIONAL'].includes(String(row.benefitType)) || seen.has(row[field] as string)) throw new Error('Thành phần quyền lợi không hợp lệ.')
    seen.add(row[field] as string)
    return { entityId: row[field] as string, packageId: row.packageId, benefitType: row.benefitType as PackageComponent['benefitType'] }
  })
}

export function validateEntitlements(value: unknown): void {
  if (value == null) return
  if (!Array.isArray(value)) throw new Error('Quyền lợi theo nhóm dịch vụ không hợp lệ.')
  const categories = new Set<string>(), ids = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') throw new Error('Quyền lợi theo nhóm dịch vụ không hợp lệ.')
    const row = entry as Record<string, unknown>
    if (['id', 'packageId', 'categoryId'].some(key => typeof row[key] !== 'string' || !(row[key] as string).trim())
      || !['INCLUDED', 'LIMITED', 'DISCOUNT', 'NOT_INCLUDED'].includes(String(row.benefitType))
      || (row.quantityLimit != null && (!Number.isSafeInteger(row.quantityLimit) || (row.quantityLimit as number) < 0))
      || (row.discountPercent != null && (typeof row.discountPercent !== 'number' || !Number.isFinite(row.discountPercent) || row.discountPercent < 0 || row.discountPercent > 100))
      || (row.unitCode != null && typeof row.unitCode !== 'string')
      || (row.ownerScope != null && !['PASSENGER', 'CABIN', 'BOOKING', 'GROUP'].includes(String(row.ownerScope)))
      || ids.has(row.id as string) || categories.has(row.categoryId as string)) throw new Error('Quyền lợi theo nhóm dịch vụ không hợp lệ.')
    ids.add(row.id as string); categories.add(row.categoryId as string)
  }
}
