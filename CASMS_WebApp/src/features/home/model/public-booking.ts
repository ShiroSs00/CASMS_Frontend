export type PublicBookingIntent = 'find-voyage' | 'my-bookings'

// The public booking module has no route/API contract yet. Keep its boundary explicit.
export function pendingBookingMessage(intent: PublicBookingIntent) {
  return intent === 'find-voyage'
    ? 'Tìm kiếm và đặt hành trình sẽ khả dụng khi tính năng booking được triển khai.'
    : 'Booking của tôi chưa khả dụng. Vui lòng liên hệ bộ phận hỗ trợ AURORA.'
}
