import { apiRequest, ApiError } from '@/shared/api'
import type { ShipDto } from '../api/dto'

export type TypeStatus = 'ACTIVE' | 'INACTIVE'
export type StoredDesign = { modelKey: string; assetVersion: string }
export type ShipType = StoredDesign & {
  shipTypeId: string
  code: string
  name: string
  status: TypeStatus
  manufacturerName: string
  engineType: string
  totalCapacity: number
  totalDecks: number
  lengthMeters: number
  beamMeters: number
  shipCount: number
}
export type Page<T> = { content: T[]; number: number; size: number; totalElements: number; totalPages: number }
export type OperationalProfile = {
  manufacturerShipCode?: string
  imoNumber?: string
  shipyard?: string
  buildCountry?: string
  buildYear?: number
  deliveryDate?: string
  registrationCountry?: string
  registrationNumber?: string
  classificationSociety?: string
  classificationExpiryDate?: string
  certificateReferences?: string[]
  warrantyReferences?: string[]
  maintenanceReferences?: string[]
}
export type ProvisionPayload = { shipName: string; profile: OperationalProfile | null }
export type PendingProvision = { typeId: string; key: string; payload: ProvisionPayload }
export type DesignManifest = {
  modelId: string; name?: string; shipManufacturerName?: string; engineType?: string
  passengerCapacity?: number; deckCount?: number; length?: number; beam?: number
  assets: { full?: string; exterior?: string }; decks: unknown[]; cabins: unknown[]
}

const part = encodeURIComponent
const typePath = (id: string) => '/ship-types/' + part(id)
const profilePath = (id: string) => '/ships/' + part(id) + '/operational-profile'
const bundlePath = (key: string) => '/ship-model-assets/' + part(key)
const designBody = ({ modelKey, assetVersion }: StoredDesign): StoredDesign => ({ modelKey, assetVersion })

export function storedAssetPath(design: StoredDesign, file: string) {
  const parts = file.split('/')
  if (!file.endsWith('.glb') || parts.some(p => !/^[\w.-]+$/.test(p) || p === '.' || p === '..')) {
    throw new Error('Đường dẫn GLB trong manifest không hợp lệ.')
  }
  return bundlePath(design.modelKey) + '/versions/' + part(design.assetVersion) + '/assets/' + parts.map(part).join('/')
}

export const shipTypesApi = {
  list: (page: number, q: string, status: TypeStatus | undefined, signal?: AbortSignal) =>
    apiRequest<Page<ShipType>>('/ship-types', { query: { page, size: 20, q: q || undefined, status, sort: 'code,asc' }, signal }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<ShipType>(typePath(id), { signal }),
  ships: (id: string, page: number, signal?: AbortSignal) =>
    apiRequest<Page<ShipDto>>(typePath(id) + '/ships', { query: { page, size: 20 }, signal }),
  async upload(modelKey: string, bundle: File) {
    const form = new FormData()
    form.append('modelKey', modelKey)
    form.append('bundle', bundle)
    const stored = await apiRequest<StoredDesign>('/ship-model-assets', { method: 'POST', body: form, timeoutMs: 180000 })
    if (stored?.modelKey !== modelKey || !stored.assetVersion) {
      throw new Error('Backend chưa trả phiên bản gói. Kiểm tra kết nối và tải lại cùng tệp ZIP.')
    }
    return designBody(stored)
  },
  async preview(design: StoredDesign, signal?: AbortSignal) {
    const manifest = await apiRequest<DesignManifest>(bundlePath(design.modelKey) + '/preview', {
      query: { assetVersion: design.assetVersion }, signal,
    })
    if (manifest?.modelId !== design.modelKey || !manifest.assets?.full
      || !Array.isArray(manifest.decks) || !Array.isArray(manifest.cabins)) {
      throw new Error('Manifest không khớp gói mô hình đã chọn.')
    }
    storedAssetPath(design, manifest.assets.full)
    return manifest
  },
  create: (design: StoredDesign) => apiRequest<ShipType>('/ship-types/from-stored', { method: 'POST', body: designBody(design) }),
  replace: (id: string, design: StoredDesign) => apiRequest<ShipType>(typePath(id) + '/model', { method: 'PUT', body: designBody(design) }),
  setStatus: (id: string, status: TypeStatus) => apiRequest<ShipType>(typePath(id) + '/status', { method: 'PATCH', query: { status } }),
  remove: (id: string) => apiRequest<void>(typePath(id), { method: 'DELETE' }),
  provision: (attempt: PendingProvision) => apiRequest<ShipDto>(typePath(attempt.typeId) + '/ships', {
    method: 'POST', body: attempt.payload, idempotencyKey: attempt.key, timeoutMs: 180000,
  }),
  result: (attempt: PendingProvision) =>
    apiRequest<ShipDto>(typePath(attempt.typeId) + '/ships/provisioning/' + part(attempt.key)),
  profile: (id: string, signal?: AbortSignal) => apiRequest<OperationalProfile | null>(profilePath(id), { signal }),
  saveProfile: (id: string, profile: OperationalProfile) =>
    apiRequest<OperationalProfile>(profilePath(id), { method: 'PUT', body: profile }),
  rename: (id: string, shipName: string) =>
    apiRequest<ShipDto>('/ships/' + part(id) + '/name', { method: 'PATCH', body: { shipName } }),
}

export function unknownOutcome(error: unknown) {
  return !(error instanceof ApiError) || error.status === 0 || error.status === 408 || error.status >= 500
}

export function shipError(error: unknown): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : 'Không thực hiện được yêu cầu.'
  const fallback = error.serverMessage || error.message
  switch (error.code) {
    case 'SHIP_TYPE_INACTIVE': return 'Loại tàu đã ngừng sử dụng. Chọn một loại đang hoạt động.'
    case 'SHIP_TYPE_CODE_CONFLICT': return 'Mã loại này đã có phiên bản khác. Mở chi tiết loại tàu để cập nhật phiên bản.'
    case 'SHIP_TYPE_DESIGN_MISMATCH': return 'Gói thay thế phải có cùng mã thiết kế.'
    case 'SHIP_TYPE_IN_USE': return 'Loại tàu đang được sử dụng. Có thể ngừng sử dụng loại trong trang chi tiết.'
    case 'IDEMPOTENCY_CONFLICT': return 'Mã xác nhận đã được dùng cho dữ liệu khác. Kiểm tra tàu đã tạo trước khi bắt đầu thao tác mới.'
    case 'DUPLICATE_RESOURCE': return 'Số IMO hoặc số đăng ký đã được sử dụng. Kiểm tra thông tin hồ sơ.'
    case 'SHIP_MODEL_IMPORT_REJECTED': return 'Không dựng được cấu trúc tàu từ phiên bản này. Kiểm tra các lỗi mô hình bên dưới.'
  }
  if (error.status === 403) return 'Tài khoản của bạn không có quyền thực hiện thao tác này.'
  if (error.status === 410) return 'Thao tác này đã được thay thế. Mở luồng quản lý loại tàu để tiếp tục.'
  return fallback
}

export function importIssues(error: unknown): { objectIdentifier?: string; message: string }[] {
  if (!(error instanceof ApiError) || error.code !== 'SHIP_MODEL_IMPORT_REJECTED') return []
  const issues = (error.details as { issues?: unknown } | undefined)?.issues
  return Array.isArray(issues) ? issues.filter(item => item && typeof item.message === 'string') : []
}
