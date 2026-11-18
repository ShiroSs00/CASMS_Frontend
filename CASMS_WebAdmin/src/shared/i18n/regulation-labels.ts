export type SharedRegulationType =
  | 'SAFETY'
  | 'CAPACITY'
  | 'SPEED'
  | 'WEATHER'
  | 'ENVIRONMENT'
  | 'HEALTH'

export type SharedRegulationScope = 'GLOBAL' | 'SHIP' | 'CRUISE'

export type SharedRegulationStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED'

export type SharedRegulationUnit =
  | 'KNOT'
  | 'KM'
  | 'METER'
  | 'PERCENT'
  | 'PERSON'
  | 'CELSIUS'
  | 'NONE'

export const regulationTypeLabels: Record<SharedRegulationType, string> = {
  SPEED: 'Tốc độ',
  CAPACITY: 'Sức chứa',
  SAFETY: 'An toàn',
  WEATHER: 'Thời tiết',
  ENVIRONMENT: 'Môi trường',
  HEALTH: 'Sức khỏe',
}

export const regulationScopeLabels: Record<SharedRegulationScope, string> = {
  GLOBAL: 'Toàn hệ thống',
  SHIP: 'Theo tàu',
  CRUISE: 'Theo chuyến khởi hành',
}

export const regulationStatusLabels: Record<SharedRegulationStatus, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đã kích hoạt',
  INACTIVE: 'Đã ngừng kích hoạt',
  EXPIRED: 'Hết hạn',
}

export const regulationUnitLabels: Record<SharedRegulationUnit, string> = {
  KNOT: 'hải lý/giờ',
  KM: 'km',
  METER: 'm',
  PERCENT: '%',
  PERSON: 'người',
  CELSIUS: '°C',
  NONE: 'Không có đơn vị',
}

export function formatRegulationValue(value?: string | null, unit?: string | null): string {
  const normalizedValue = value?.trim() ?? ''
  const unitLabel =
    unit && unit !== 'NONE'
      ? regulationUnitLabels[unit as SharedRegulationUnit] ?? 'Chưa xác định đơn vị'
      : ''
  return [normalizedValue, unitLabel].filter(Boolean).join(' ')
}

export function formatRegulationSourceLabel(sourceLabel: string): string {
  return sourceLabel
    .replace(/^GLOBAL(?=$|\s|\s*·)/, 'Toàn hệ thống')
    .replace(/^SHIP(?=$|\s|\s*·)/, 'Tàu')
    .replace(/^CRUISE(?=$|\s|\s*·)/, 'Chuyến khởi hành')
}

export function groupRegulationsBySource<T extends { source: SharedRegulationScope }>(items: readonly T[]) {
  return [
    {
      key: 'GLOBAL' as const,
      title: 'Quy định chung',
      roleLabel: 'Toàn hệ thống · Chỉ đọc',
      items: items.filter((item) => item.source === 'GLOBAL'),
    },
    {
      key: 'SHIP' as const,
      title: 'Kế thừa từ tàu',
      roleLabel: 'Từ hồ sơ tàu · Chỉ đọc',
      items: items.filter((item) => item.source === 'SHIP'),
    },
    {
      key: 'CRUISE' as const,
      title: 'Riêng cho chuyến',
      roleLabel: 'Gán trực tiếp cho chuyến',
      items: items.filter((item) => item.source === 'CRUISE'),
    },
  ]
}
