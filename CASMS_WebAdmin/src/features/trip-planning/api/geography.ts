import { ApiError, apiRequest } from '@/shared/api'

export type GeographyItem = { kind: 'COUNTRY' | 'REGION'; code: string; label: string; status: 'ACTIVE' | 'INACTIVE' }
export type CountryOption = { code: string; label: string }
const root = '/trip-planning/catalogs/geography'

export function decodeGeography(value: unknown): GeographyItem[] {
  if (!Array.isArray(value) || value.some(item => !item ||
    !['COUNTRY', 'REGION'].includes(item.kind) || !['ACTIVE', 'INACTIVE'].includes(item.status) ||
    typeof item.code !== 'string' || !item.code.trim() || typeof item.label !== 'string' || !item.label.trim())) {
    throw new ApiError('Chưa đọc được danh sách quốc gia và miền. Hãy tải lại.', 502)
  }
  return value
}

export const geographyApi = {
  async list(signal?: AbortSignal) { return decodeGeography(await apiRequest(root, { signal })) },
  async countries(signal?: AbortSignal): Promise<CountryOption[]> {
    const value = await apiRequest<CountryOption[]>(root + '/country-options', { signal })
    if (!Array.isArray(value) || value.some(item => !item || !/^[A-Z]{2}$/.test(item.code) || typeof item.label !== 'string')) throw new ApiError('Chưa tải được danh sách quốc gia.', 502)
    return value
  },
  add(country: CountryOption) { return apiRequest(root + '/countries', { method: 'POST', body: country }) },
  status(item: GeographyItem, status: GeographyItem['status']) {
    return apiRequest(`${root}/${item.kind}/${encodeURIComponent(item.code)}/status`, { method: 'PATCH', body: { status } })
  },
}
