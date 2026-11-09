import { ApiError, apiRequestRaw } from '@/shared/api'

export function unwrapActivityResponse(value: unknown, status: number): unknown {
  if (!value || typeof value !== 'object' || !('success' in value) || value.success !== true || !('data' in value)) throw new ApiError('Dữ liệu hoạt động không đúng định dạng.', status)
  return value.data
}

export type ActivityCatalogEntry = {
  id: string; code: string; name: string; catalogEntry: true; description?: string | null
  category?: string | null; capacity?: number | null; price?: number | null; currencyCode?: string | null
}
export function decodeActivityCatalogEntry(dto: unknown, status: number): ActivityCatalogEntry {
  if (!dto || typeof dto !== 'object' || !('catalogEntry' in dto) || dto.catalogEntry !== true
    || !('id' in dto) || typeof dto.id !== 'string' || !('name' in dto) || typeof dto.name !== 'string'
    || !('code' in dto) || typeof dto.code !== 'string'
    || ('capacity' in dto && dto.capacity != null && (!Number.isSafeInteger(dto.capacity) || Number(dto.capacity) < 1))
    || ('price' in dto && dto.price != null && (typeof dto.price !== 'number' || !Number.isFinite(dto.price) || dto.price < 0))) {
    throw new ApiError('Không đọc được hoạt động trong danh mục.', status)
  }
  return dto as ActivityCatalogEntry
}

export function readActivityCatalog(signal?: AbortSignal) {
  return apiRequestRaw('/activities/catalog', (value, status) => {
    const entries = unwrapActivityResponse(value, status)
    if (!Array.isArray(entries)) throw new ApiError('Danh sách hoạt động không đúng định dạng.', status)
    return entries.map(entry => decodeActivityCatalogEntry(entry, status))
  }, { signal })
}
