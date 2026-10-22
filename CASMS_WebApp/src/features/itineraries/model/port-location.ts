import locations from '../data/asia-port-locations.json' with { type: 'json' }

export const portLocations = locations
const displayNames = new Intl.DisplayNames(['vi'], { type: 'region' })
export const portCountries = [...new Set(locations.map(item => item.country))]
  .map(code => ({ code, name: displayNames.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

export function countryPortLocations(country: string) {
  return portLocations.filter(item => item.country === country)
}

export type GeocodingPlace = { id: number; name: string; kind: 'CITY' | 'ISLAND'; region: string; countryCode: string; latitude: number; longitude: number; timeZoneId: string }

export function geocodingUrl(endpoint: string, name: string, country: string) {
  if (name.trim().length < 2 || name.trim().length > 200) throw new Error('Nhập tên thành phố hoặc đảo từ 2 đến 200 ký tự.')
  if (!portCountries.some(item => item.code === country)) throw new Error('Chọn quốc gia trong danh sách trước khi tra tọa độ.')
  const url = new URL(endpoint)
  url.search = new URLSearchParams({ name: name.trim(), countryCode: country, count: '10', language: 'vi', format: 'json' }).toString()
  return url.toString()
}

export function decodeGeocoding(value: unknown, country: string): GeocodingPlace[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dịch vụ tọa độ trả dữ liệu không hợp lệ.')
  const dto = value as Record<string, unknown>
  if (dto.error || (dto.results !== undefined && !Array.isArray(dto.results))) throw new Error('Dịch vụ tọa độ chưa xử lý được yêu cầu.')
  return ((dto.results ?? []) as unknown[]).flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Kết quả tọa độ không hợp lệ.')
    const row = item as Record<string, unknown>
    if (row.country_code !== country) return []
    // Tourism gateways include islands such as Boracay; airports and country centroids are excluded.
    if (typeof row.feature_code !== 'string' || (!row.feature_code.startsWith('PPL') && !['ISL', 'ISLS'].includes(row.feature_code))) return []
    if (!Number.isSafeInteger(row.id) || typeof row.name !== 'string' || !row.name.trim()
      || typeof row.latitude !== 'number' || !Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90
      || typeof row.longitude !== 'number' || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180
      || typeof row.timezone !== 'string') throw new Error('Kết quả thiếu tọa độ hoặc múi giờ hợp lệ.')
    try { new Intl.DateTimeFormat('vi', { timeZone: row.timezone }) } catch { throw new Error('Dịch vụ trả múi giờ không hợp lệ.') }
    return [{ id: row.id as number, name: row.name, kind: row.feature_code.startsWith('ISL') ? 'ISLAND' as const : 'CITY' as const, region: [row.admin1, row.admin2].filter(part => typeof part === 'string').join(' · '), countryCode: country, latitude: row.latitude, longitude: row.longitude, timeZoneId: row.timezone }]
  })
}
