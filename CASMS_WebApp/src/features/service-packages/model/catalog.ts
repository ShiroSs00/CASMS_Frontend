export type CatalogKind = 'services' | 'products' | 'packages'
export type CatalogItem = { id: string; code: string; name: string; description: string | null; type: string; price: number | null; currency: string | null; capacity?: number | null; status: string; startDate?: string | null; endDate?: string | null }
export type ServiceRequest = { id: string; serviceId: string; passengerId: string; bookingId: string | null; bookingPassengerId: string | null; quantity: number; note: string | null; status: string; assignedUserId: string | null; requestTime: string; completedAt: string | null }
export type Benefits = { packageInfo: CatalogItem; services: { packageId: string; serviceId: string; benefitType: string }[]; activities: { packageId: string; activityId: string; benefitType: string }[]; excursions: { packageId: string; excursionId: string; benefitType: string }[]; entitlements?: { id: string; packageId: string; categoryId: string; benefitType: string; quantityLimit: number | null; unitCode: string | null; discountPercent: number | null; ownerScope: string | null }[] }
export const catalogConfig = {
  services: { label: 'Dịch vụ', route: '/admin/services' },
  products: { label: 'Sản phẩm', route: '/admin/products' },
  packages: { label: 'Gói dịch vụ', route: '/admin/service-packages' },
} satisfies Record<CatalogKind, { label: string; route: string }>
export const statusLabels: Record<string, string> = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', SUSPENDED: 'Tạm ngừng', CANCELLED: 'Đã hủy', REQUESTED: 'Đã yêu cầu', ACCEPTED: 'Đã tiếp nhận', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', REJECTED: 'Đã từ chối', DRAFT: 'Nháp', PUBLISHED: 'Đã công bố', DISCONTINUED: 'Ngừng cung cấp', OUT_OF_STOCK: 'Hết hàng', AVAILABLE: 'Còn cung cấp' }
export const benefitLabels: Record<string, string> = { INCLUDED: 'Đã bao gồm', OPTIONAL: 'Tùy chọn' }
export function catalogTime(value: string | null) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa có thông tin' }
