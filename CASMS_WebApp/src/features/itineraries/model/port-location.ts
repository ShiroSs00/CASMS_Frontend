import locations from '../data/asia-port-locations.json' with { type: 'json' }

export const portLocations = locations
const displayNames = new Intl.DisplayNames(['vi'], { type: 'region' })
export const portCountries = [...new Set(locations.map(item => item.country))]
  .map(code => ({ code, name: displayNames.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

export function countryPortLocations(country: string) {
  return portLocations.filter(item => item.country === country)
}

export type PortCoordinateSource = {
  provider:'OPEN_METEO_GEOCODING';dataset:'GEONAMES';externalLocationId:number;locationName:string
  coordinateReferenceType:'GEOCODED_LOCALITY';countryCode?:string;featureCode?:string;timezone?:string;admin1?:string;recordedAt?:string
}
export type GeocodingPlace = { id: number; name: string; kind: 'CITY' | 'ISLAND' | 'LOCALITY'; region: string; countryCode?: string; latitude: number; longitude: number; timeZoneId?: string; featureCode?:string; admin1?:string }
export function coordinateSourceOf(place:GeocodingPlace):PortCoordinateSource {
  return {provider:'OPEN_METEO_GEOCODING',dataset:'GEONAMES',externalLocationId:place.id,locationName:place.name,coordinateReferenceType:'GEOCODED_LOCALITY',
    ...(place.countryCode?{countryCode:place.countryCode}:{}),...(place.featureCode?{featureCode:place.featureCode}:{}),...(place.timeZoneId?{timezone:place.timeZoneId}:{}),...(place.admin1?{admin1:place.admin1}:{})}
}

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
    if (typeof row.country_code==='string'&&row.country_code!==country) return []
    // Tourism gateways include islands such as Boracay; airports and country centroids are excluded.
    if (typeof row.feature_code==='string'&&!row.feature_code.startsWith('PPL')&&!['ISL','ISLS'].includes(row.feature_code)) return []
    if (!Number.isSafeInteger(row.id) || (row.id as number)<1 || typeof row.name !== 'string' || !row.name.trim()
      || typeof row.latitude !== 'number' || !Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90
      || typeof row.longitude !== 'number' || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180) throw new Error('Kết quả thiếu định danh, tên hoặc tọa độ hợp lệ.')
    if(typeof row.timezone==='string'){try{new Intl.DateTimeFormat('vi-VN',{timeZone:row.timezone})}catch{throw new Error('Múi giờ trong kết quả địa danh không hợp lệ.')}}
    return [{ id: row.id as number, name: row.name, kind: typeof row.feature_code!=='string'?'LOCALITY' as const:row.feature_code.startsWith('ISL')?'ISLAND' as const:'CITY' as const,
      region:[row.admin1,row.admin2].filter(part=>typeof part==='string').join(' · '),latitude:row.latitude,longitude:row.longitude,
      ...(typeof row.country_code==='string'?{countryCode:row.country_code}:{}),...(typeof row.feature_code==='string'?{featureCode:row.feature_code}:{}),
      ...(typeof row.timezone==='string'?{timeZoneId:row.timezone}:{}),...(typeof row.admin1==='string'?{admin1:row.admin1}:{}) }]
  })
}
