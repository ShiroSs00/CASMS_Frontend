export type PublicDestination = {
  destinationId: string
  destinationName: string
  countryCode: string
  description?: string | null
  status: 'ACTIVE' | 'INACTIVE'
  ports: { portName: string }[]
}

export function decodeDestinations(value: unknown): PublicDestination[] {
  if (!Array.isArray(value)) throw new Error('Invalid destination list')
  const ids = new Set<string>()
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid destination')
    const row = item as Record<string, unknown>
    if (typeof row.destinationId !== 'string' || !row.destinationId.trim() || ids.has(row.destinationId)
      || typeof row.destinationName !== 'string' || !row.destinationName.trim()
      || typeof row.countryCode !== 'string' || !/^[A-Z]{2}$/.test(row.countryCode)
      || !['ACTIVE', 'INACTIVE'].includes(String(row.status))
      || (row.description != null && typeof row.description !== 'string')
      || (row.ports != null && !Array.isArray(row.ports))) throw new Error('Invalid destination')
    ids.add(row.destinationId)
    const ports = (row.ports ?? []) as unknown[]
    if (ports.some(port => !port || typeof port !== 'object' || typeof (port as Record<string, unknown>).portName !== 'string')) throw new Error('Invalid destination ports')
    return { destinationId: row.destinationId, destinationName: row.destinationName, countryCode: row.countryCode, description: row.description as string | null | undefined, status: row.status as PublicDestination['status'], ports: ports as PublicDestination['ports'] }
  }).filter(item => item.status === 'ACTIVE').sort((a,b) => a.destinationName.localeCompare(b.destinationName, 'vi'))
}

export const normalizedDestinationName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()

const photoNames: Record<string, { country: string; image: string; alt: string }> = {
  'tokyo bay & kanto': { country: 'JP', image: 'yokohama-osanbashi.webp', alt: 'Nhà ga Ōsanbashi ở Yokohama, vùng vịnh Tokyo, Nhật Bản' },
  'kansai region': { country: 'JP', image: 'kobe-port.webp', alt: 'Cảng Kobe thuộc vùng Kansai, Nhật Bản' },
  'kyushu island': { country: 'JP', image: 'kyushu-nagasaki.webp', alt: 'Cảng Nagasaki trên đảo Kyushu, Nhật Bản' },
  'vinh ha long & bac bo': { country: 'VN', image: 'ha-long-bay.webp', alt: 'Núi đá vôi và mặt nước Vịnh Hạ Long, Việt Nam' },
  'da nang & mien trung': { country: 'VN', image: 'da-nang-panorama.webp', alt: 'Sông Hàn nhìn từ cầu Rồng tại Đà Nẵng lúc bình minh' },
  'singapore marina hub': { country: 'SG', image: 'singapore-marina-bay.webp', alt: 'Marina Bay Cruise Centre tại Singapore' },
}

export function destinationPhoto(destination: Pick<PublicDestination, 'destinationName' | 'countryCode'>) {
  const name = normalizedDestinationName(destination.destinationName)
  if (/demo|\btest\b/.test(name)) return null
  const photo = photoNames[name]
  return photo?.country === destination.countryCode ? { src: '/images/ports/' + photo.image, alt: photo.alt } : null
}
