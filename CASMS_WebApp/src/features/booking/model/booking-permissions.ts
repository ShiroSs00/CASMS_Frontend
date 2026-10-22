type BookingAction = 'confirm' | 'cancel' | 'cabin'
type BookingAccess = { has: (permission: string) => boolean }

/** Match BookingController in BE 15a113a; lifecycle validation remains server-side. */
export function canManageBooking(action: BookingAction, status: string, access: BookingAccess) {
  if (action==='confirm') return status==='Draft' && access.has('BOOKING_CONFIRM')
  if (status==='Cancelled') return false
  return action==='cancel' ? access.has('BOOKING_CANCEL') : access.has('BOOKING_CABIN_ASSIGN') || access.has('BOOKING_UPDATE')
}
