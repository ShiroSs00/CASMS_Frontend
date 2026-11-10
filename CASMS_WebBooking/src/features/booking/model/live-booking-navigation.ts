export function catalogReturn(value: string | null) {
  if (!value || !/^\/cruises(?:\?[^#\\]*)?$/.test(value)) return '/cruises'
  return value
}

export const cruiseDetailSections = {
  facts: 'cruise-facts',
  itinerary: 'cruise-extras',
  packages: 'cruise-packages',
} as const

export function cruiseDetailPath(cruiseId: string, from: string) {
  const search = new URLSearchParams({ from: catalogReturn(from) })
  return `/cruises/${encodeURIComponent(cruiseId)}?${search}`
}

export const bookingStepPaths = ['/booking/cabin-experience', '/booking/travellers', '/booking/review'] as const
export const bookingStagePaths = ['/booking/party', ...bookingStepPaths] as const
export type BookingStage = 1 | 2 | 3 | 4
export const bookingStageLabels = ['Người đi & phòng', 'Gói & cabin', 'Thông tin hành khách', 'Kiểm tra đặt chỗ'] as const
export const bookingPlanLabels = { STAGES: 'Thanh toán theo đợt', DEPOSIT: 'Đặt cọc & thanh toán phần còn lại', FULL: 'Thanh toán toàn bộ' }
