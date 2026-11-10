export const serviceUsagePolicyLabels = { UNLIMITED: 'Không giới hạn', PER_DAY: 'Giới hạn theo ngày', PER_CRUISE: 'Giới hạn theo chuyến' }
export type ServiceUsagePolicy = keyof typeof serviceUsagePolicyLabels
export const servicePurchaseFlags = {
  canBuyPreCruise: 'Nhận yêu cầu trước chuyến',
  canBuyOnboard: 'Cho phép sử dụng qua kênh trên tàu',
  canSellIndependently: 'Cho phép bán lẻ',
}
export type CatalogKind = 'services' | 'products' | 'packages'
export type CatalogItem = { canBuyPreCruise?: boolean; canBuyOnboard?: boolean; canSellIndependently?: boolean; preCruiseUsagePolicy?: ServiceUsagePolicy | null; preCruiseUsageLimit?: number | null; usageTimeZone?: string | null; requiresSchedule?:boolean;categoryId?:string|null;categoryName?:string|null;unitCode?:string|null;applicabilityScope?:string|null; id: string; code: string; name: string; description: string | null; type: string; price: number | null; currency: string | null; capacity?: number | null; status: string; startDate?: string | null; endDate?: string | null }
export type ServiceRequest = { usageMode?: 'LEGACY' | 'PRE_CRUISE' | 'ONBOARD' | null; usagePolicySnapshot?: ServiceUsagePolicy | null; usageLimitSnapshot?: number | null; usageTimeZoneSnapshot?: string | null; fareBenefitSnapshotId?:string|null;fulfillmentUnitCode?:string|null;fulfilledQuantity?:number|null;id: string; serviceId: string; passengerId: string; bookingId: string | null; bookingPassengerId: string | null; scheduleId?: string | null; unitPriceSnapshot?: number | null; currencySnapshot?: string | null; quantity: number; note: string | null; status: string; assignedUserId: string | null; requestTime: string; completedAt: string | null }
export type Benefits = { packageInfo: CatalogItem; services: { packageId: string; serviceId: string; benefitType: string }[]; activities: { packageId: string; activityId: string; benefitType: string }[]; excursions: { packageId: string; excursionId: string; benefitType: string }[]; entitlements?: { id: string; packageId: string; categoryId: string; benefitType: string; quantityLimit: number | null; unitCode: string | null; discountPercent: number | null; ownerScope: string | null }[] }
export const catalogConfig = {
  services: { label: 'Dịch vụ', route: '/admin/services' },
  products: { label: 'Mặt hàng bán lẻ', route: '/admin/products' },
  packages: { label: 'Gói dịch vụ', route: '/admin/service-packages' },
} satisfies Record<CatalogKind, { label: string; route: string }>
export const statusLabels: Record<string, string> = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', SUSPENDED: 'Tạm ngừng', CANCELLED: 'Đã hủy', REQUESTED: 'Đã yêu cầu', ACCEPTED: 'Đã tiếp nhận', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', REJECTED: 'Đã từ chối', DRAFT: 'Nháp', PUBLISHED: 'Đã công bố', DISCONTINUED: 'Ngừng cung cấp', OUT_OF_STOCK: 'Hết hàng', AVAILABLE: 'Còn cung cấp' }
export const benefitLabels: Record<string, string> = { INCLUDED: 'Đã bao gồm', OPTIONAL: 'Tùy chọn', LIMITED: 'Theo định mức', DISCOUNT: 'Giảm giá', NOT_INCLUDED: 'Không bao gồm' }
export function catalogTime(value: string | null) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa có thông tin' }
