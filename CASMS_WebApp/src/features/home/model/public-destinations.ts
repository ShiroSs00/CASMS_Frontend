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

const verifiedPhotos: { country: string; match: (n: string, p: string) => boolean; image: string; alt: string; portLabel: string }[] = [
  {
    country: 'MY',
    match: (n, p) => n.includes('malacca') || n.includes('klang') || n.includes('malaysia') || p.includes('klang') || p.includes('boustead'),
    image: 'port-klang-cruise.webp',
    alt: 'Cảng đón tàu du lịch Port Klang, Malaysia',
    portLabel: 'Cảng Port Klang, Malaysia',
  },
  {
    country: 'JP',
    match: (n, p) => n.includes('tokyo bay') || n.includes('kanto') || p.includes('osanbashi') || p.includes('yokohama'),
    image: 'yokohama-osanbashi.webp',
    alt: 'Nhà ga Ōsanbashi ở Yokohama, vùng vịnh Tokyo, Nhật Bản',
    portLabel: 'Cảng Yokohama, Nhật Bản',
  },
  {
    country: 'JP',
    match: (n, p) => n.includes('kansai') || n.includes('kobe') || p.includes('kobe'),
    image: 'kobe-port.webp',
    alt: 'Cảng Kobe thuộc vùng Kansai, Nhật Bản',
    portLabel: 'Cảng Kobe, Nhật Bản',
  },
  {
    country: 'JP',
    match: (n, p) => n.includes('kyushu') || n.includes('nagasaki') || p.includes('nagasaki'),
    image: 'kyushu-nagasaki.webp',
    alt: 'Cảng Nagasaki trên đảo Kyushu, Nhật Bản',
    portLabel: 'Cảng Nagasaki, Nhật Bản',
  },
  {
    country: 'VN',
    match: (n, p) => n.includes('vinh ha long') || n.includes('ha long') || p.includes('ha long'),
    image: 'ha-long-bay.webp',
    alt: 'Núi đá vôi và mặt nước Vịnh Hạ Long, Việt Nam',
    portLabel: 'Cảng quốc tế Hạ Long, Việt Nam',
  },
  {
    country: 'VN',
    match: (n, p) => n.includes('da nang') || n.includes('mien trung') || p.includes('tien sa'),
    image: 'da-nang-panorama.webp',
    alt: 'Sông Hàn nhìn từ cầu Rồng tại Đà Nẵng lúc bình minh',
    portLabel: 'Cảng Tiên Sa, Đà Nẵng',
  },
  {
    country: 'SG',
    match: (n, p) => n.includes('singapore') || n.includes('marina') || p.includes('marina'),
    image: 'singapore-marina-bay.webp',
    alt: 'Marina Bay Cruise Centre tại Singapore',
    portLabel: 'Cảng Marina Bay, Singapore',
  },
  {
    country: 'HK',
    match: (n, p) => n.includes('hong kong') || n.includes('victoria') || p.includes('victoria'),
    image: 'hong-kong-victoria.webp',
    alt: 'Toàn cảnh cảng Victoria tại Hồng Kông',
    portLabel: 'Cảng Victoria, Hồng Kông',
  },
  {
    country: 'KR',
    match: (n, p) => n.includes('busan') || p.includes('busan'),
    image: 'busan-port.webp',
    alt: 'Cảng biển quốc tế Busan, Hàn Quốc',
    portLabel: 'Cảng Busan, Hàn Quốc',
  },
  {
    country: 'TW',
    match: (n, p) => n.includes('keelung') || n.includes('dai loan') || p.includes('keelung'),
    image: 'keelung-harbour.webp',
    alt: 'Cảng Keelung và nhà ga đón tàu du lịch tại Đài Loan',
    portLabel: 'Cảng Keelung, Đài Loan',
  },
]

export function destinationPhoto(destination: Pick<PublicDestination, 'destinationName' | 'countryCode'> & { ports?: { portName: string }[] }) {
  const name = normalizedDestinationName(destination.destinationName)
  if (/\bdemo\b|\btest\b/i.test(name)) return null
  const portsStr = (destination.ports ?? []).map(p => normalizedDestinationName(p.portName)).join(' ')
  const country = destination.countryCode.toUpperCase()

  const found = verifiedPhotos.find(p => p.country === country && p.match(name, portsStr))
  if (found) {
    return { src: '/images/ports/' + found.image, alt: found.alt, portLabel: found.portLabel }
  }
  return null
}
