export const serviceUsagePolicyLabels = { UNLIMITED: 'Không giới hạn', PER_DAY: 'Giới hạn theo ngày', PER_CRUISE: 'Giới hạn theo chuyến' }
export type ServiceUsagePolicy = keyof typeof serviceUsagePolicyLabels
export const servicePurchaseFlags = {
  canBuyPreCruise: 'Nhận yêu cầu trước chuyến',
  canBuyOnboard: 'Cho phép sử dụng qua kênh trên tàu',
  canSellIndependently: 'Cho phép bán lẻ',
}
export type CatalogKind = 'services' | 'products' | 'packages'
export type CatalogItem = { canBuyPreCruise?: boolean; canBuyOnboard?: boolean; canSellIndependently?: boolean; preCruiseUsagePolicy?: ServiceUsagePolicy | null; preCruiseUsageLimit?: number | null; usageTimeZone?: string | null; requiresSchedule?:boolean;categoryId?:string|null;categoryName?:string|null;unitCode?:string|null;applicabilityScope?:string|null; defaultRequiredStaff?: number | null; id: string; code: string; name: string; description: string | null; type: string; price: number | null; currency: string | null; capacity?: number | null; status: string; startDate?: string | null; endDate?: string | null }
export type ServiceRequest = { serviceName?: string | null; passengerName?: string | null; bookingReference?: string | null; cruiseName?: string | null; shipName?: string | null; scheduledStart?: string | null; scheduledEnd?: string | null; location?: string | null; unitCode?: string | null; usageMode?: 'LEGACY' | 'PRE_CRUISE' | 'ONBOARD' | null; usagePolicySnapshot?: ServiceUsagePolicy | null; usageLimitSnapshot?: number | null; usageTimeZoneSnapshot?: string | null; fareBenefitSnapshotId?:string|null;fulfillmentUnitCode?:string|null;fulfilledQuantity?:number|null;id: string; serviceId: string; passengerId: string; bookingId: string | null; bookingPassengerId: string | null; scheduleId?: string | null; unitPriceSnapshot?: number | null; currencySnapshot?: string | null; quantity: number; note: string | null; status: string; assignedUserId: string | null; requestTime: string; completedAt: string | null }
export type Benefits = { packageInfo: CatalogItem; services: { packageId: string; serviceId: string; benefitType: string }[]; activities: { packageId: string; activityId: string; benefitType: string }[]; excursions: { packageId: string; excursionId: string; benefitType: string }[]; entitlements?: { id: string; packageId: string; categoryId: string; benefitType: string; quantityLimit: number | null; unitCode: string | null; discountPercent: number | null; ownerScope: string | null }[] }
export const catalogConfig = {
  services: { label: 'Dịch vụ', route: '/admin/services' },
  products: { label: 'Mặt hàng bán lẻ', route: '/admin/products' },
  packages: { label: 'Gói dịch vụ', route: '/admin/service-packages' },
} satisfies Record<CatalogKind, { label: string; route: string }>
export const statusLabels: Record<string, string> = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', SUSPENDED: 'Tạm ngừng', CANCELLED: 'Đã hủy', REQUESTED: 'Đã yêu cầu', ACCEPTED: 'Đã tiếp nhận', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', REJECTED: 'Đã từ chối', DRAFT: 'Nháp', PUBLISHED: 'Đã công bố', DISCONTINUED: 'Ngừng cung cấp', OUT_OF_STOCK: 'Hết hàng', AVAILABLE: 'Còn cung cấp' }
export const benefitLabels: Record<string, string> = { INCLUDED: 'Đã bao gồm', OPTIONAL: 'Tùy chọn', LIMITED: 'Theo định mức', DISCOUNT: 'Giảm giá', NOT_INCLUDED: 'Không bao gồm' }
export const unitCodeLabels: Record<string, string> = {
  MEAL: 'bữa ăn', GLASS: 'ly', DRINK: 'đồ uống', SESSION: 'buổi', DAY: 'ngày', NIGHT: 'đêm',
  HOUR: 'giờ', ITEM: 'sản phẩm', USE: 'lượt', VISIT: 'lượt', TIME: 'lần', PERSON: 'khách',
  CABIN: 'phòng', PACKAGE: 'gói', SERVICE: 'dịch vụ', PHOTO: 'ảnh', GB: 'GB', MB: 'MB',
}
export function formatUnitCode(code?: string | null) {
  if (!code) return ''
  const key = code.trim().toUpperCase()
  return unitCodeLabels[key] ?? code
}
export const catalogTypeLabels: Record<string, string> = {
  DINING: 'Ẩm thực',
  BEVERAGE: 'Đồ uống',
  WELLNESS: 'Chăm sóc sức khỏe',
  SPA_WELLNESS: 'Spa & Sức khỏe',
  PHOTOGRAPHY: 'Chụp ảnh',
  CABIN_SERVICE: 'Dịch vụ phòng',
  LAUNDRY: 'Giặt ủi',
  MEDICAL_ASSISTANCE: 'Hỗ trợ y tế',
  TRANSPORTATION: 'Đưa đón & Di chuyển',
  INTERNET: 'Internet & Wi-Fi',
  ENTERTAINMENT: 'Giải trí',
  ENTERTAINMENT_ACTIVITY: 'Giải trí & Hoạt động',
  CHILDCARE_FAMILY: 'Gia đình & Trẻ em',
  RETAIL: 'Bán lẻ',
  SOUVENIR: 'Quà lưu niệm',
  EXCURSION: 'Tham quan trên bờ',
  SHORE_EXCURSION: 'Tour tham quan trên bờ',
  'SHORE EXCURSIONS': 'Tour tham quan trên bờ',
  BASIC: 'Cơ bản',
  STANDARD: 'Tiêu chuẩn',
  ADVANCED: 'Nâng cao',
  ADD_ON: 'Dịch vụ bổ sung',
  PLUS: 'Tiêu chuẩn nâng cao',
  PREMIUM: 'Cao cấp',
  PREMIUM_PLUS: 'Cao cấp đặc biệt',
  VIP: 'VIP',
}
export function formatCatalogType(type?: string | null) {
  if (!type) return 'Chưa phân loại'
  const key = type.trim().toUpperCase()
  return catalogTypeLabels[key] ?? type
}
import { journeyTime, SHIP_TIME_ZONE } from '@/shared/lib/journey-time'

export function catalogTime(value: string | null) { return value && Number.isFinite(Date.parse(value)) ? `${journeyTime(value, SHIP_TIME_ZONE)} (UTC+7)` : 'Chưa có thông tin' }
