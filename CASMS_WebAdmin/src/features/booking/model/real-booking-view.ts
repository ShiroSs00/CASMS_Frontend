import { SHIP_TIME_ZONE } from '@/shared/lib/journey-time'

export const bookingStatusName: Record<string, string> = { Draft: 'Chờ xác nhận', Confirmed: 'Đã xác nhận', Cancelled: 'Đã hủy' }
export function bookingContractStatus(status: string | null) {
  if (status === 'Accepted') return 'Đã ghi nhận bản ký'
  if (status === 'Draft') return 'Chưa ghi nhận bản ký'
  if (status === 'Cancelled') return 'Đã hủy'
  return 'Chưa có thông tin'
}
const bookingDateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: SHIP_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
})
const bookingTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: SHIP_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function bookingWhen(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa có thông tin'
  const date = new Date(value)
  return bookingTimeFormat.format(date) + ' · ' + bookingDateFormat.format(date)
}

export function bookingBirthDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Chưa cung cấp'
  const [year, month, day] = value.split('-')
  return day + '/' + month + '/' + year
}
export const bookingPlanName = (value: string | null) => value ? ({ FULL: 'Thanh toán toàn bộ', DEPOSIT: 'Đặt cọc', STAGES: 'Thanh toán theo đợt' } as Record<string, string>)[value] ?? value : 'Chưa có kế hoạch thanh toán'

const nationalityVi: Record<string, string> = {
  vn: 'Việt Nam', vnm: 'Việt Nam', vietnam: 'Việt Nam', vietnamese: 'Việt Nam',
  us: 'Hoa Kỳ', usa: 'Hoa Kỳ', american: 'Hoa Kỳ',
  jp: 'Nhật Bản', jpn: 'Nhật Bản', japan: 'Nhật Bản', japanese: 'Nhật Bản',
  kr: 'Hàn Quốc', kor: 'Hàn Quốc', korea: 'Hàn Quốc', korean: 'Hàn Quốc',
  sg: 'Singapore', sgp: 'Singapore', singaporean: 'Singapore',
  au: 'Úc', aus: 'Úc', australia: 'Úc', australian: 'Úc',
  gb: 'Anh', gbr: 'Anh', uk: 'Anh', british: 'Anh',
  fr: 'Pháp', fra: 'Pháp', french: 'Pháp',
  de: 'Đức', deu: 'Đức', german: 'Đức',
  cn: 'Trung Quốc', chn: 'Trung Quốc', chinese: 'Trung Quốc',
  th: 'Thái Lan', tha: 'Thái Lan', thai: 'Thái Lan',
  my: 'Malaysia', mys: 'Malaysia', malaysian: 'Malaysia',
  ca: 'Canada', can: 'Canada', canadian: 'Canada',
}

export function bookingNationalityName(value: string | null | undefined) {
  const cleaned = (value ?? '').trim()
  if (!cleaned) return 'Chưa cung cấp'
  return nationalityVi[cleaned.toLowerCase()] ?? cleaned
}
