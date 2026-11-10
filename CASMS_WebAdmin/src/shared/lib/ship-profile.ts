export type ShipProfile = {
  manufacturerName?: string | null
  origin?: string | null
  productionYear?: number | null
  engineType?: string | null
}

export const shipProfileTextFields = [
  { key: 'manufacturerName', label: 'Đơn vị đóng tàu', maxLength: 150 },
  { key: 'origin', label: 'Xuất xứ', maxLength: 100 },
  { key: 'engineType', label: 'Loại động cơ', maxLength: 100 },
] as const

export const productionYearLabel = 'Năm đóng tàu'

export function validateShipProfile(profile: ShipProfile, current?: ShipProfile) {
  const errors: Record<string, string> = {}
  for (const { key, label, maxLength } of shipProfileTextFields) {
    if ((profile[key]?.trim().length ?? 0) > maxLength) errors[key] = `${label} tối đa ${maxLength} ký tự.`
  }
  const year = profile.productionYear
  if (year == null && current?.productionYear != null) {
    errors.productionYear = 'Năm đóng tàu đã lưu cần được thay bằng một năm hợp lệ.'
  } else if (year != null && (!Number.isInteger(year) || year < 1 || year > 9999)) {
    errors.productionYear = 'Năm đóng tàu phải là số nguyên từ 1 đến 9999.'
  }
  return errors
}

export function shipProfilePayload(profile: ShipProfile, editing = false) {
  const text = (value: string | null | undefined) => editing ? value?.trim() : value?.trim() || undefined
  return {
    manufacturerName: text(profile.manufacturerName),
    origin: text(profile.origin),
    productionYear: profile.productionYear ?? undefined,
    engineType: text(profile.engineType),
  }
}

export function shipProfileFacts(profile: ShipProfile, emptyLabel = 'Chưa cập nhật'): Array<[string, string | number]> {
  const [manufacturer, origin, engine] = shipProfileTextFields
  return [
    [manufacturer.label, profile.manufacturerName?.trim() || emptyLabel],
    [origin.label, profile.origin?.trim() || emptyLabel],
    [productionYearLabel, profile.productionYear ?? emptyLabel],
    [engine.label, profile.engineType?.trim() || emptyLabel],
  ]
}
