const serviceUnitLabels: Record<string, string> = {
  SESSION: 'buổi / lượt',
  HOUR: 'giờ',
  DAY: 'ngày',
  TRIP: 'chuyến',
  ITEM: 'món / lượt',
  GLASS: 'ly',
  BOTTLE: 'chai',
  PERSON: 'khách',
  CABIN: 'phòng',
  GB: 'GB',
  PER_DAY: 'ngày',
  PER_PERSON: 'khách',
  PER_CABIN: 'phòng',
  USE: 'lượt sử dụng',
  TIME: 'lượt',
}

export function formatServiceUnitCode(code: string | null | undefined): string {
  if (!code) return ''
  const upper = code.trim().toUpperCase()
  return serviceUnitLabels[upper] ?? code
}

/** Display the configured unit; never turn service quantities into participation counts. */
export function benefitQuantity(quantity: number, benefit: { usageUnit: string | null; serviceUnitCode: string | null }) {
  const unit = benefit.usageUnit === 'PARTICIPATION'
    ? 'lượt tham gia'
    : benefit.usageUnit === 'SERVICE_UNIT'
      ? formatServiceUnitCode(benefit.serviceUnitCode)
      : null
  return unit ? `${quantity} ${unit}` : `${quantity} (chưa có đơn vị được hỗ trợ)`
}
