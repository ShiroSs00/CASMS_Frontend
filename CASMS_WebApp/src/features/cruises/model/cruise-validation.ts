import type { CruiseDraft, CruiseType } from './cruise-record'

export type CruiseFormErrors = Partial<Record<keyof CruiseDraft, string>>

const DISPLAY_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function scheduleInstant(value: string) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  return new Date(hasTimeZone ? value : `${value}:00+07:00`)
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

export function validateCruiseSchedule(
  cruiseType: CruiseType,
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

  const sameDate = calendarDate(departureDatetime) === calendarDate(returnDatetime)
  if (cruiseType === 'ONE_DAY' && !sameDate) {
    errors.returnDatetime = 'Chuyến một ngày phải kết thúc trong cùng ngày khởi hành.'
  }
  if (cruiseType === 'MULTI_DAYS' && sameDate) {
    errors.returnDatetime = 'Chuyến nhiều ngày phải kết thúc vào ngày sau ngày khởi hành.'
  }

  return errors
}

export function validateCruiseDraft(draft: CruiseDraft): CruiseFormErrors {
  const errors = validateCruiseSchedule(
    draft.cruiseType,
    draft.departureDatetime,
    draft.returnDatetime,
  )

  if (!draft.cruiseCode.trim()) errors.cruiseCode = 'Mã chuyến là bắt buộc.'
  if (!draft.cruiseName.trim()) errors.cruiseName = 'Tên hiển thị là bắt buộc.'
  if (!draft.departurePortId) errors.departurePortId = 'Vui lòng chọn cảng khởi hành.'
  if (!draft.returnPortId) errors.returnPortId = 'Vui lòng chọn cảng trở về.'

  return errors
}
