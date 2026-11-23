export const cruisePortPhotos = [
  { image: '/images/ports/ha-long-editorial.jpg', caption: 'Vịnh Hạ Long, Việt Nam', story: 'Di sản Thiên nhiên Thế giới UNESCO với hàng nghìn đảo đá vôi kỳ vĩ giữa làn nước ngọc bích.', match: 'ha long' },
  { image: '/images/ports/da-nang-editorial.jpg', caption: 'Đà Nẵng, Việt Nam', story: 'Thành phố biển năng động với bán đảo Sơn Trà xanh mướt, bãi biển Mỹ Khê và cửa ngõ di sản Miền Trung.', match: 'da nang' },
  { image: '/images/ports/port-klang-cruise.webp', caption: 'Port Klang, Malaysia', story: 'Cửa ngõ hàng hải dẫn tới thủ đô Kuala Lumpur sôi động và giao thoa văn hóa Đông Nam Á.', match: 'klang' },
  { image: '/images/ports/kobe-port.webp', caption: 'Kobe, Nhật Bản', story: 'Thành phố cảng thanh lịch nổi tiếng với ẩm thực tinh hoa và không gian vịnh biển hiện đại.', match: 'kobe' },
  { image: '/images/ports/yokohama-osanbashi.webp', caption: 'Yokohama, Nhật Bản', story: 'Bến cảng Osanbashi biểu tượng mở ra hành trình khám phá vịnh Tokyo và văn hóa Nhật Bản.', match: 'yokohama' },
  { image: '/images/ports/singapore-marina-bay.webp', caption: 'Singapore', story: 'Đô thị biển hiện đại bậc nhất châu Á với vịnh Marina rực rỡ và kiến trúc xanh ấn tượng.', match: 'singapore' },
  { image: '/images/ports/kyushu-nagasaki.webp', caption: 'Nagasaki, Nhật Bản', story: 'Thành phố cảng giàu dấu ấn lịch sử, cảnh quan đồi vịnh thơ mộng và giao lưu Đông – Tây.', match: 'nagasaki' },
  { image: '/images/ports/hong-kong-victoria.webp', caption: 'Hồng Kông', story: 'Cảng Victoria ngoạn mục với đường chân trời rực sáng và trải nghiệm ẩm thực đặc sắc.', match: 'hong kong' },
  { image: '/images/ports/keelung-harbour.webp', caption: 'Keelung, Đài Loan', story: 'Cảng biển nhộn nhịp cửa ngõ Đài Bắc, nổi tiếng với chợ đêm hải sản và bờ biển đá kỳ thú.', match: 'keelung' },
  { image: '/images/ports/busan-port.webp', caption: 'Busan, Hàn Quốc', story: 'Thành phố biển năng động với bãi biển Haeundae, làng văn hóa ven đồi và hải sản tươi sống.', match: 'busan' },
] as const

const fallbackCoastalPhoto = {
  image: '/images/ports/coastal-excursion.jpg',
  caption: 'Điểm dừng ven biển châu Á',
  story: 'Khám phá cảnh sắc vịnh biển trong xanh, văn hóa bản địa và các trải nghiệm tham quan bờ đặc trưng.',
} as const

function portKey(name: string) {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replaceAll('đ', 'd').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function photosForPorts(names: readonly (string | null | undefined)[]) {
  const ports = names.map(name => name && portKey(name)).filter(Boolean)
  return cruisePortPhotos.filter(photo => ports.some(port => port && ` ${port} `.includes(` ${photo.match} `)))
}

export function primaryPhotoForCruise(
  cruise: { title?: string | null; departurePort?: string | null; returnPort?: string | null },
  fallbackIndex = 0,
) {
  const text = portKey([cruise.title, cruise.departurePort, cruise.returnPort].filter(Boolean).join(' '))
  return cruisePortPhotos.find(photo => ` ${text} `.includes(` ${photo.match} `))
    ?? cruisePortPhotos[fallbackIndex % cruisePortPhotos.length]
}

export function portPhotoForName(portName?: string | null) {
  if (!portName) return fallbackCoastalPhoto
  const key = portKey(portName)
  return cruisePortPhotos.find(photo => ` ${key} `.includes(` ${photo.match} `)) ?? fallbackCoastalPhoto
}

const cabinPhotos = {
  suite: '/images/cabins/suite.jpg',
  balcony: '/images/cabins/balcony.jpg',
  oceanview: '/images/cabins/oceanview.jpg',
  interior: '/images/cabins/interior.jpg',
} as const

export function cabinPhotoForType(cabinType?: string | null) {
  const normalized = (cabinType ?? '').toLowerCase()
  if (normalized.includes('suite') || normalized.includes('penthouse') || normalized.includes('villa')) return cabinPhotos.suite
  if (normalized.includes('balcony') || normalized.includes('veranda')) return cabinPhotos.balcony
  if (normalized.includes('ocean') || normalized.includes('sea') || normalized.includes('window')) return cabinPhotos.oceanview
  return cabinPhotos.interior
}

export const experiencePhotos = {
  dining: '/images/experiences/dining.jpg',
  spaWellness: '/images/experiences/spa-wellness.jpg',
  entertainment: '/images/experiences/entertainment.jpg',
  seaDay: '/images/experiences/sea-day.jpg',
} as const

export function experiencePhotoFor(categoryOrName?: string | null) {
  const key = portKey(categoryOrName ?? '')
  if (/(dining|buffet|restaurant|nha hang|am thuc|bar|drink|cafe|coffee|cook|food)/.test(key)) return experiencePhotos.dining
  if (/(spa|wellness|massage|pool|gym|fitness|yoga|sauna|relax)/.test(key)) return experiencePhotos.spaWellness
  if (/(entertain|music|show|theater|stage|concert|dance|hat|mua|giai tri|cinema|karaoke)/.test(key)) return experiencePhotos.entertainment
  return experiencePhotos.seaDay
}
