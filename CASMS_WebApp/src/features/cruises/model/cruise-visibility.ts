export function bookingCruiseView(roles: readonly string[]) {
  return roles.includes('BOOKING_AGENT') && !roles.some(role =>
    ['ADMIN', 'CRUISE_MANAGER', 'OPERATIONS_MANAGER', 'SHIP_MANAGER', 'ACTIVITY_SERVICE_MANAGER'].includes(role))
}
