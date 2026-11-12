export const cruisePortPhotos = [
  { image: '/images/ports/ha-long-bay.webp', caption: 'Ảnh cảng biển · Vịnh Hạ Long, Việt Nam', match: 'ha long' },
  { image: '/images/ports/da-nang-panorama.webp', caption: 'Ảnh cảng biển · Đà Nẵng, Việt Nam', match: 'da nang' },
  { image: '/images/ports/port-klang-cruise.webp', caption: 'Ảnh cảng biển · Port Klang, Malaysia', match: 'klang' },
  { image: '/images/ports/kobe-port.webp', caption: 'Ảnh cảng biển · Kobe, Nhật Bản', match: 'kobe' },
  { image: '/images/ports/yokohama-osanbashi.webp', caption: 'Ảnh cảng biển · Yokohama, Nhật Bản', match: 'yokohama' },
  { image: '/images/ports/singapore-marina-bay.webp', caption: 'Ảnh cảng biển · Singapore', match: 'singapore' },
  { image: '/images/ports/kyushu-nagasaki.webp', caption: 'Ảnh cảng biển · Nagasaki, Nhật Bản', match: 'nagasaki' },
  { image: '/images/ports/hong-kong-victoria.webp', caption: 'Ảnh cảng biển · Hồng Kông', match: 'hong kong' },
  { image: '/images/ports/keelung-harbour.webp', caption: 'Ảnh cảng biển · Keelung, Đài Loan', match: 'keelung' },
  { image: '/images/ports/busan-port.webp', caption: 'Ảnh cảng biển · Busan, Hàn Quốc', match: 'busan' },
] as const

function portKey(name: string) {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replaceAll('đ', 'd').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function photosForPorts(names: readonly (string | null | undefined)[]) {
  const ports = names.map(name => name && portKey(name)).filter(Boolean)
  return cruisePortPhotos.filter(photo => ports.some(port => port && ` ${port} `.includes(` ${photo.match} `)))
}
