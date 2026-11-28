import type { Choice, Selection } from '../api/plan-packages'

/** Presentation only: eligibility and eligible price always come from the server. */
export function invalidPackageChoices(data: Selection, choices: readonly Choice[]) {
  return choices.filter(choice => !data.offers.some(candidate =>
    candidate.product.offer.id === choice.offerId && candidate.planEligibility.eligible
    && candidate.eligiblePriceRevisionId === choice.priceRevisionId))
}

export function packageSelectionState(data: Selection, choices: readonly Choice[]) {
  if (invalidPackageChoices(data, choices).length) return {
    title: 'Lựa chọn gói cần cập nhật',
    description: 'Gói hoặc giá đã chọn không còn đủ điều kiện. Chọn giá hiện tại nếu có, hoặc bỏ gói không còn khả dụng trước khi lưu.',
    tone: 'warning' as const,
  }
  if (!data.offers.length) return {
    title: 'Chưa có gói để chọn',
    description: 'Quản lý dịch vụ cần chuẩn bị gói và gửi bảng giá cho chuyến này. Khi có gói đủ điều kiện, bạn có thể chọn ngay tại đây.',
    tone: 'neutral' as const,
  }
  if (!data.offers.some(candidate => candidate.planEligibility.eligible && candidate.eligiblePriceRevisionId)) return {
    title: 'Chưa có gói đủ điều kiện gửi duyệt',
    description: 'Xem lý do dưới từng gói để đối chiếu với bộ phận phụ trách. Hiện chưa thể chọn gói vào hồ sơ.',
    tone: 'warning' as const,
  }
  return {
    title: choices.length ? `Đã chọn ${choices.length} gói` : 'Chọn gói đưa vào hồ sơ',
    description: 'Chọn gói và phiên bản giá đủ điều kiện để Quản lý vận hành xét duyệt cùng hồ sơ chuyến.',
    tone: 'neutral' as const,
  }
}

export const packagePreparationBlockers = ['FARE_PLAN_SELECTION_REQUIRED', 'FARE_PLAN_SELECTION_STALE', 'SALE_TERMS_REQUIRED'] as const

export function bookingWindowsNeedAttention(blockers: readonly string[]) {
  return blockers.some(code => ['BOOKING_WINDOW_REQUIRED', 'GUIDANCE_WINDOW_REQUIRED', 'GUIDANCE_BEFORE_BOOKING_CLOSE'].includes(code))
}
