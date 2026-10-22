import { decodeGeocoding, geocodingUrl, type GeocodingPlace } from '../model/port-location'

const cache = new Map<string, GeocodingPlace[]>()
export async function findCityCoordinates(city: string, country: string, signal: AbortSignal) {
  const url = geocodingUrl(import.meta.env.VITE_GEOCODING_API_URL || 'https://geocoding-api.open-meteo.com/v1/search', city, country)
  const cached = cache.get(url)
  if (cached) return cached
  try {
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) })
    if (!response.ok) throw new Error(response.status === 429 ? 'Dịch vụ đang giới hạn lượt tra cứu. Vui lòng thử lại sau.' : 'Không tra được tọa độ. Vui lòng thử lại.')
    const result = decodeGeocoding(await response.json(), country)
    if (cache.size >= 100) cache.clear()
    cache.set(url, result)
    return result
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error(error instanceof Error && error.name !== 'TypeError' && error.name !== 'TimeoutError' ? error.message : 'Không kết nối được dịch vụ tọa độ. Kiểm tra mạng và thử lại.', { cause: error })
  }
}
