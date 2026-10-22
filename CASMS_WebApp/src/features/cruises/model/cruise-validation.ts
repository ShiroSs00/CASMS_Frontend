import type { CruiseDraft, CruiseType } from './cruise-record'

export type CruiseFormErrors = Partial<Record<keyof CruiseDraft, string>>

const DISPLAY_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function scheduleInstant(value: string) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  return new Date(hasTimeZone ? value : `${value.length === 16 ? `${value}:00` : value}+07:00`)
}

function calendarDate(value: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(scheduleInstant(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

// Retain legacy transport codes ONE_DAY/MULTI_DAYS while applying the user
// defined Short Day/Long Days ranges in FE. Include departure and return days.
export function cruiseDurationDays(departureDatetime: string, returnDatetime: string): number | null {
  const departure = scheduleInstant(departureDatetime)
  const returning = scheduleInstant(returnDatetime)
  if (!Number.isFinite(departure.getTime()) || !Number.isFinite(returning.getTime()) || returning <= departure) return null
  const startDay = Date.parse(calendarDate(departureDatetime))
  const endDay = Date.parse(calendarDate(returnDatetime))
  return (endDay - startDay) / 86400000 + 1
}

export function inferCruiseType(departureDatetime: string, returnDatetime: string): CruiseType | '' {
  const days = cruiseDurationDays(departureDatetime, returnDatetime)
  return days !== null && days >= 1 && days <= 2 ? 'ONE_DAY'
    : days !== null && days >= 3 && days <= 5 ? 'MULTI_DAYS' : ''
}

export function validateCruiseSchedule(
  cruiseType: CruiseType | '',
  departureDatetime: string,
  returnDatetime: string,
): CruiseFormErrors {
  const errors: CruiseFormErrors = {}
  const departure = scheduleInstant(departureDatetime)
  const returning = scheduleInstant(returnDatetime)

  if (!departureDatetime || Number.isNaN(departure.getTime())) {
    errors.departureDatetime = 'Vui lòng nhập thời gian khởi hành hợp lệ.'
  }
  if (!returnDatetime || Number.isNaN(returning.getTime())) {
    errors.returnDatetime = 'Vui lòng nhập thời gian kết thúc hợp lệ.'
  }
  if (errors.departureDatetime || errors.returnDatetime) return errors

  if (returning <= departure) {
    errors.returnDatetime = 'Thời gian kết thúc phải sau thời gian khởi hành.'
    return errors
  }

  const inferred = inferCruiseType(departureDatetime, returnDatetime)
  if (!inferred) errors.returnDatetime = 'Chuyến đi phải kéo dài từ 1 đến 5 ngày, tính cả ngày đi và ngày về.'
  else if (cruiseType && cruiseType !== inferred) errors.cruiseType = inferred === 'ONE_DAY'
    ? 'Hành trình 1–2 ngày thuộc Short Day.' : 'Hành trình 3–5 ngày thuộc Long Days.'

  return errors
}

export function validateCruiseDraft(draft: CruiseDraft): CruiseFormErrors {
  const errors = validateCruiseSchedule(
    draft.cruiseType,
    draft.departureDatetime,
    draft.returnDatetime,
  )

  if (draft.cruiseCode.trim().length > 20) errors.cruiseCode = 'Mã chuyến tối đa 20 ký tự.'
  if (!draft.cruiseName.trim()) errors.cruiseName = 'Tên hiển thị là bắt buộc.'
  if (!draft.departurePortId) errors.departurePortId = 'Vui lòng chọn cảng khởi hành.'
  if (!draft.returnPortId) errors.returnPortId = 'Vui lòng chọn cảng trở về.'

  return errors
}
