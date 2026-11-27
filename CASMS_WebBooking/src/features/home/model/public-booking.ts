import { apiRequest } from '@/shared/api'
import { asianPorts } from './asian-ports'

// Real port photography is editorial inspiration, not live inventory.
export const featuredVoyages = asianPorts.slice(0, 3).map(port => ({ id: port.id, title: port.name + ' — ' + port.location, region: port.country.toLocaleUpperCase('vi'), detail: port.description, image: port.image }))

// The public catalogue and CruiseController support only this Home filter.
export function homeCruiseType(value: string | null) {
  return value === 'ONE_DAY' || value === 'MULTI_DAYS' ? value : ''
}
export function homeCruiseSearch(value: string | null, keyword?: string | null) {
  const query = new URLSearchParams()
  const type = homeCruiseType(value)
  if (type) query.set('cruiseType', type)
  if (keyword?.trim()) query.set('q', keyword.trim())
  const suffix = query.toString()
  return '/cruises' + (suffix ? '?' + suffix : '')
}
export const destinations = asianPorts.map(port => ({ title: port.location, detail: port.name + ' · ' + port.country, image: port.image }))

export type HomeLiveCruise = {
  id: string
  code?: string
  title: string
  ship?: string
  type?: 'ONE_DAY' | 'MULTI_DAYS'
  departure: string
  returnAt: string
  departurePort?: string
  returnPort?: string
}

const UUID_REGEX = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i

export async function loadHomeCruises(signal?: AbortSignal): Promise<HomeLiveCruise[]> {
  const results: HomeLiveCruise[] = []
  for (let page = 0, pages = 1; page < pages && page < 10; page++) {
    const data = await apiRequest<{ content?: unknown[]; totalPages?: number }>('/cruise', {
      query: { status: 'PUBLISHED', saleState: 'OPEN_FOR_SALE', page, size: 100, sort: 'departureDatetime,asc' },
      signal,
      authenticated: false,
    })
    if (!data || !Array.isArray(data.content)) throw new Error('Không đọc được danh mục hải trình công bố.')
    pages = typeof data.totalPages === 'number' && Number.isSafeInteger(data.totalPages) && data.totalPages > 0 ? data.totalPages : 1
    for (const entry of data.content) {
      if (!entry || typeof entry !== 'object') continue
      const row = entry as Record<string, unknown>
      if (row.status !== 'PUBLISHED' || typeof row.cruiseId !== 'string' || !UUID_REGEX.test(row.cruiseId) || typeof row.cruiseName !== 'string' || !row.cruiseName.trim()) {
        continue
      }
      if (typeof row.departureDatetime !== 'string' || !Number.isFinite(Date.parse(row.departureDatetime)) || typeof row.returnDatetime !== 'string' || !Number.isFinite(Date.parse(row.returnDatetime))) {
        continue
      }
      results.push({
        id: row.cruiseId,
        code: typeof row.cruiseCode === 'string' && row.cruiseCode.trim() ? row.cruiseCode.trim() : undefined,
        title: row.cruiseName.trim(),
        ship: typeof row.shipName === 'string' && row.shipName.trim() ? row.shipName.trim() : undefined,
        type: row.cruiseType === 'ONE_DAY' || row.cruiseType === 'MULTI_DAYS' ? row.cruiseType : undefined,
        departure: row.departureDatetime,
        returnAt: row.returnDatetime,
        departurePort: typeof row.departurePortName === 'string' && row.departurePortName.trim() ? row.departurePortName.trim() : undefined,
        returnPort: typeof row.returnPortName === 'string' && row.returnPortName.trim() ? row.returnPortName.trim() : undefined,
      })
    }
  }
  return results
}

const neutralCruisePhoto = {
  image: '/images/ports/coastal-excursion.jpg',
  caption: 'Hải trình du thuyền ven biển châu Á',
} as const

const homePortPhotos = [
  { image: '/images/ports/ha-long-bay.webp', caption: 'Vịnh Hạ Long, Việt Nam', match: 'ha long' },
  { image: '/images/ports/da-nang-panorama.webp', caption: 'Đà Nẵng, Việt Nam', match: 'da nang' },
  { image: '/images/ports/port-klang-cruise.webp', caption: 'Port Klang, Malaysia', match: 'klang' },
  { image: '/images/ports/kobe-port.webp', caption: 'Kobe, Nhật Bản', match: 'kobe' },
  { image: '/images/ports/yokohama-osanbashi.webp', caption: 'Yokohama, Nhật Bản', match: 'yokohama' },
  { image: '/images/ports/singapore-marina-bay.webp', caption: 'Singapore', match: 'singapore' },
  { image: '/images/ports/kyushu-nagasaki.webp', caption: 'Nagasaki, Nhật Bản', match: 'nagasaki' },
  { image: '/images/ports/hong-kong-victoria.webp', caption: 'Hồng Kông', match: 'hong kong' },
  { image: '/images/ports/keelung-harbour.webp', caption: 'Keelung, Đài Loan', match: 'keelung' },
  { image: '/images/ports/busan-port.webp', caption: 'Busan, Hàn Quốc', match: 'busan' },
] as const

function normalizePortText(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replaceAll('đ', 'd').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function homeCruisePhoto(cruise: HomeLiveCruise, fallbackIndex = 0) {
  void fallbackIndex
  const haystack = normalizePortText([cruise.title, cruise.departurePort, cruise.returnPort].filter(Boolean).join(' '))
  return homePortPhotos.find(photo => ` ${haystack} `.includes(` ${photo.match} `)) ?? neutralCruisePhoto
}

export function homeCruiseDetailPath(cruiseId: string) {
  return `/cruises/${encodeURIComponent(cruiseId)}?from=${encodeURIComponent('/cruises')}`
}
