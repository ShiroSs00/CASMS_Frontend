import { ApiError, apiRequestRaw } from '@/shared/api'
import type { Benefits, CatalogItem, CatalogKind, ServiceRequest } from '../model/catalog'
import { serializeCatalogDraft, type CatalogDraft } from '../model/catalog-editor'
function data(value: unknown, status: number): unknown {
  if (!value || typeof value !== 'object' || !('success' in value) || value.success !== true || !('data' in value)) throw new ApiError('Dữ liệu dịch vụ không đúng định dạng.', status)
  return value.data
}
function record<T extends { id: string }>(value: unknown, status: number, request = false): T {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !('status' in value) || typeof value.status !== 'string'
    || (!request && (!('name' in value) || typeof value.name !== 'string' || !('code' in value) || typeof value.code !== 'string' || !('type' in value) || typeof value.type !== 'string' || !('price' in value) || (value.price !== null && (typeof value.price !== 'number' || !Number.isFinite(value.price)))))
    || (request && (!('serviceId' in value) || typeof value.serviceId !== 'string' || !('quantity' in value) || typeof value.quantity !== 'number'))) throw new ApiError('Không đọc được thông tin dịch vụ.', status)
  return value as T
}
function list<T extends { id: string }>(value: unknown, status: number, request = false): T[] {
  const rows = data(value, status)
  if (!Array.isArray(rows)) throw new ApiError('Danh sách dịch vụ không đúng định dạng.', status)
  return rows.map(row => record<T>(row, status, request))
}
const endpoint = (kind: string, id?: string) => '/servicepackage/' + kind + (id ? '/' + encodeURIComponent(id) : '')
export type BenefitKind = 'services' | 'activities' | 'excursions'
export type BenefitRow = { entityId: string; benefitType: 'INCLUDED' | 'OPTIONAL' }
export type PackageAssignment = { bookingPassengerId: string; packageId: string; agreedPrice: number; currency: string; assignedAt: string }
function assignment(value: unknown, status: number): PackageAssignment {
  if (!value || typeof value !== 'object' || !('bookingPassengerId' in value) || typeof value.bookingPassengerId !== 'string' || !('packageId' in value) || typeof value.packageId !== 'string' || !('agreedPrice' in value) || typeof value.agreedPrice !== 'number' || !Number.isFinite(value.agreedPrice) || !('currency' in value) || typeof value.currency !== 'string' || !('assignedAt' in value) || typeof value.assignedAt !== 'string') throw new ApiError('Không đọc được phân bổ gói.', status)
  return value as PackageAssignment
}
export const servicePackageApi = {
  assignments: (bookingId?: string, signal?: AbortSignal): Promise<PackageAssignment[]> => apiRequestRaw(endpoint('package-assignments'), (value, status) => {
    const rows = data(value, status); if (!Array.isArray(rows)) throw new ApiError('Danh sách phân bổ gói không đúng định dạng.', status)
    return rows.map(row => assignment(row, status))
  }, { query: { bookingId }, signal }),
  assignment: (bookingPassengerId: string, signal?: AbortSignal) => apiRequestRaw(endpoint('package-assignments', bookingPassengerId), (value, status) => {
    const row = assignment(data(value, status), status)
    if (row.bookingPassengerId !== bookingPassengerId) throw new ApiError('Phân bổ không thuộc hành khách đã chọn.', status)
    return row
  }, { signal }),
  changeAssignment: (bookingPassengerId: string, tourPackageId: string, method: 'POST' | 'PUT' | 'DELETE') => apiRequestRaw(endpoint('package-assignments', bookingPassengerId), (value, status) => {
    if (method === 'DELETE') { if (status !== 204) throw new ApiError('Chưa xác nhận được kết quả gỡ gói.', status); return }
    const row = assignment(data(value, status), status)
    if (row.bookingPassengerId !== bookingPassengerId || row.packageId !== tourPackageId) throw new ApiError('Phản hồi phân bổ không khớp yêu cầu.', status)
    return row
  }, { method, body: method === 'DELETE' ? undefined : { tourPackageId } }),
  saveRequest: (draft: { serviceId: string; bookingPassengerId?: string; quantity: number; note: string }, id?: string) => apiRequestRaw(endpoint('requests', id), (value, status) => record<ServiceRequest>(data(value, status), status, true), { method: id ? 'PUT' : 'POST', body: id ? { quantity: draft.quantity, note: draft.note.trim() || null } : { serviceId: draft.serviceId, bookingPassengerId: draft.bookingPassengerId || null, quantity: draft.quantity, note: draft.note.trim() || null } }),
  requestAction: (id: string, action: 'assign' | 'accept' | 'reject' | 'start' | 'complete' | 'cancel') => apiRequestRaw(endpoint('requests', id) + (action === 'cancel' ? '/cancel' : '/actions/' + action), (value, status) => record<ServiceRequest>(data(value, status), status, true), { method: 'POST' }),
  components: (id: string, kind: BenefitKind, signal?: AbortSignal): Promise<BenefitRow[]> => apiRequestRaw(endpoint('packages', id) + '/' + kind, (value, status) => {
    const rows = data(value, status), field = kind === 'services' ? 'serviceId' : kind === 'activities' ? 'activityId' : 'excursionId'
    if (!Array.isArray(rows) || rows.some(row => !row || row.packageId !== id || typeof row[field] !== 'string' || !['INCLUDED', 'OPTIONAL'].includes(row.benefitType))) throw new ApiError('Thành phần quyền lợi không đúng định dạng.', status)
    return rows.map(row => ({ entityId: row[field], benefitType: row.benefitType }))
  }, { signal }),
  benefitOptions: (kind: BenefitKind, signal?: AbortSignal): Promise<{ id: string; name: string }[]> => apiRequestRaw(kind === 'excursions' ? '/shore-excursions' : kind === 'activities' ? '/activities' : endpoint('services'), (value, status) => {
    const rows = kind === 'excursions' ? value : data(value, status)
    const id = kind === 'excursions' ? 'shoreExcursionId' : 'id', name = kind === 'excursions' ? 'excursionName' : 'name'
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row[id] !== 'string' || !row[id] || typeof row[name] !== 'string' || !row[name])) throw new ApiError('Không đọc được danh mục thành phần.', status)
    return rows.map(row => ({ id: row[id], name: row[name] }))
  }, { signal }),
  changeBenefit: (id: string, kind: BenefitKind, entityId: string, method: 'POST' | 'PUT' | 'DELETE', benefitType: 'INCLUDED' | 'OPTIONAL') => apiRequestRaw(endpoint('packages', id) + '/' + kind + '/' + encodeURIComponent(entityId), (value, status) => {
    if (method === 'DELETE') { if (status !== 204) throw new ApiError('Chưa xác nhận được kết quả gỡ quyền lợi.', status); return }
    const row = data(value, status)
    if (!row || typeof row !== 'object' || !('packageId' in row) || row.packageId !== id || !('benefitType' in row) || row.benefitType !== benefitType) throw new ApiError('Phản hồi quyền lợi không khớp yêu cầu.', status)
  }, { method, body: method === 'DELETE' ? undefined : { benefitType } }),
  save: (kind: CatalogKind, draft: CatalogDraft, id?: string) => apiRequestRaw(endpoint(kind, id), (value, status) => record<CatalogItem>(data(value, status), status), { method: id ? 'PUT' : 'POST', body: serializeCatalogDraft(kind, draft) }),
  remove: (kind: CatalogKind, id: string) => apiRequestRaw(endpoint(kind, id), (_value, status) => { if (status !== 204) throw new ApiError('Chưa xác nhận được kết quả xóa.', status) }, { method: 'DELETE' }),
  status: (kind: CatalogKind, id: string, action: 'activate' | 'suspend' | 'deactivate' | 'discontinue') => apiRequestRaw(endpoint(kind, id) + (kind === 'products' ? '/status/' : '/') + action, (value, status) => record<CatalogItem>(data(value, status), status), { method: 'POST' }),
  list: (kind: CatalogKind, signal?: AbortSignal) => apiRequestRaw(endpoint(kind), (value, status) => list<CatalogItem>(value, status), { signal }),
  get: (kind: CatalogKind, id: string, signal?: AbortSignal) => apiRequestRaw(endpoint(kind, id), (value, status) => record<CatalogItem>(data(value, status), status), { signal }),
  requests: (signal?: AbortSignal) => apiRequestRaw(endpoint('requests'), (value, status) => list<ServiceRequest>(value, status, true), { signal }),
  request: (id: string, signal?: AbortSignal) => apiRequestRaw(endpoint('requests', id), (value, status) => record<ServiceRequest>(data(value, status), status, true), { signal }),
  availability: (id: string, signal?: AbortSignal) => apiRequestRaw(endpoint('services', id) + '/availability', (value, status) => {
    const dto = data(value, status)
    if (!dto || typeof dto !== 'object' || !('available' in dto) || typeof dto.available !== 'boolean') throw new ApiError('Không đọc được khả năng đáp ứng dịch vụ.', status)
    return dto as { serviceId: string; requestedQuantity: number; available: boolean }
  }, { query: { quantity: 1 }, signal }),
  benefits: (id: string, signal?: AbortSignal) => apiRequestRaw(endpoint('packages', id) + '/benefits', (value, status) => {
    const dto = data(value, status)
    if (!dto || typeof dto !== 'object' || !('packageInfo' in dto) || !('services' in dto) || !Array.isArray(dto.services) || !('activities' in dto) || !Array.isArray(dto.activities) || !('excursions' in dto) || !Array.isArray(dto.excursions)) throw new ApiError('Không đọc được quyền lợi gói dịch vụ.', status)
    if (record<CatalogItem>(dto.packageInfo, status).id !== id) throw new ApiError('Quyền lợi không thuộc gói đã chọn.', status)
    for (const [rows, key] of [[dto.services, 'serviceId'], [dto.activities, 'activityId'], [dto.excursions, 'excursionId']] as const) {
      if (rows.some((row: unknown) => !row || typeof row !== 'object' || !('packageId' in row) || row.packageId !== id || !(key in row) || typeof (row as Record<string, unknown>)[key] !== 'string' || !('benefitType' in row) || !['INCLUDED', 'OPTIONAL'].includes(String(row.benefitType)))) throw new ApiError('Thành phần quyền lợi không đúng định dạng.', status)
    }
    return dto as Benefits
  }, { signal }),
}
