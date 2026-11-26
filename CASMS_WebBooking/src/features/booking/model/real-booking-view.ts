export const bookingStatusName: Record<string, string> = { Draft: 'Chờ xác nhận', Confirmed: 'Đã xác nhận', Cancelled: 'Đã hủy' }
export const bookingWhen = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa có thông tin'
export const bookingPlanName = (value: string | null) => value ? ({ FULL: 'Thanh toán toàn bộ', DEPOSIT: 'Đặt cọc', STAGES: 'Thanh toán theo đợt' } as Record<string, string>)[value] ?? value : 'Chưa có kế hoạch thanh toán'

export function bookingBirthDate(value: string | null | undefined) {
  if (!value) return 'Chưa cung cấp'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  return value
}

const nationalityVi: Record<string, string> = {
  vn: 'Việt Nam',
  vnm: 'Việt Nam',
  vietnam: 'Việt Nam',
  vietnamese: 'Việt Nam',
  us: 'Hoa Kỳ',
  usa: 'Hoa Kỳ',
  american: 'Hoa Kỳ',
  jp: 'Nhật Bản',
  jpn: 'Nhật Bản',
  japan: 'Nhật Bản',
  japanese: 'Nhật Bản',
  kr: 'Hàn Quốc',
  kor: 'Hàn Quốc',
  korea: 'Hàn Quốc',
  korean: 'Hàn Quốc',
  sg: 'Singapore',
  sgp: 'Singapore',
  singaporean: 'Singapore',
  au: 'Úc',
  aus: 'Úc',
  australia: 'Úc',
  australian: 'Úc',
  gb: 'Anh',
  gbr: 'Anh',
  uk: 'Anh',
  british: 'Anh',
  fr: 'Pháp',
  fra: 'Pháp',
  french: 'Pháp',
  de: 'Đức',
  deu: 'Đức',
  german: 'Đức',
  cn: 'Trung Quốc',
  chn: 'Trung Quốc',
  chinese: 'Trung Quốc',
  th: 'Thái Lan',
  tha: 'Thái Lan',
  thai: 'Thái Lan',
  my: 'Malaysia',
  mys: 'Malaysia',
  malaysian: 'Malaysia',
  ca: 'Canada',
  can: 'Canada',
  canadian: 'Canada',
}

export function bookingNationalityName(value: string | null | undefined) {
  const cleaned = (value ?? '').trim()
  if (!cleaned) return 'Chưa cung cấp'
  return nationalityVi[cleaned.toLowerCase()] ?? cleaned
}
