type BookingAction = 'confirm' | 'cancel' | 'cabin'
type BookingAccess = { canDo: (permission: string) => boolean }

/** Match BookingController in BE 15a113a; lifecycle validation remains server-side. */
export function canManageBooking(action: BookingAction, status: string, access: BookingAccess) {
  if (action==='confirm') return status==='Draft' && access.canDo('BOOKING_CONFIRM')
  if (status==='Cancelled') return false
  return action==='cancel' ? access.canDo('BOOKING_CANCEL') : access.canDo('BOOKING_CABIN_ASSIGN') || access.canDo('BOOKING_UPDATE')
}
