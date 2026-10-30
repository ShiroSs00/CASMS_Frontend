/** Work responsibilities, including CRUISE_MANAGER = Itinerary Coordinator (2026-10-27).
 * This policy limits FE workspaces/actions; it does not grant backend permissions.
 * Reference API reads deliberately remain independent of workspace membership.
 */
export const ROLE_WORK_MODULES: Readonly<Record<string, readonly string[]>> = {
  ADMIN: ['system', 'ship-import', 'ship-models'],
  SHIP_MANAGER: ['fleet-dashboard', 'ships', 'decks', 'cabins', 'passenger-tracking', 'ship-regulations'],
  CRUISE_MANAGER: ['trips', 'cruises', 'itineraries', 'itinerary-history', 'cruise-regulations'],
  OPERATIONS_MANAGER: ['cruise-plan-reviews', 'issues', 'regulations', 'destinations', 'ports', 'trips', 'cruises', 'itineraries', 'itinerary-history', 'ship-regulations', 'cruise-regulations'],
  ACTIVITY_SERVICE_MANAGER: ['activities', 'shore-excursions', 'tour-groups', 'suppliers', 'services', 'products', 'service-packages', 'service-requests', 'activity-registrations', 'cruises'],
  BOOKING_AGENT: ['bookings', 'package-assignments', 'cruises'],
  CHECKIN_STAFF: ['staff/checkin'],
  CUSTOMER_SERVICE: ['bookings', 'service-requests'],
  FINANCE_OFFICER: ['staff/finance', 'bookings'],
  ONBOARD_STAFF: ['service-requests', 'activities', 'shore-excursions', 'tour-groups', 'activity-registrations'],
  PASSENGER: [],
}

export function hasWorkScope(roles: readonly string[], module: string): boolean {
  return roles.some(role => ROLE_WORK_MODULES[role]?.includes(module))
}

// These are reference/inspection authorities, not permission to manage a module.
const referencePermission = /(?:_READ(?:_|$)|_VIEW$|_REPORT$|_SEARCH$|_AVAILABILITY$|_HISTORY$|_SUMMARY$|_READINESS$|_CHECK$|_CURRENT_CRUISE$|_AFFECTED_CRUISES$)/
const actionPatterns: Readonly<Record<string, readonly RegExp[]>> = {
  ADMIN: [/^USER_/, /^SHIP_MODEL_/, /^SHIP_CONFIGURATION_/, /^BLE_ANCHOR_/, /^SHIP_(CREATE|UPDATE)$/],
  SHIP_MANAGER: [/^SHIP_/, /^DECK_/, /^CABIN_/, /^BLE_ANCHOR_/],
  // Aligned with RolePermissionInitializer.CRUISE_MANAGER. /auth/me remains mandatory.
  // Source-version review is intentionally absent; legacy ITINERARY_PUBLISH is a different authority.
  CRUISE_MANAGER: [
    /^TRIP_(CREATE|UPDATE|DELETE|SUBMIT|PLAN_WRITE|PLAN_VALIDATE|PLAN_SUBMIT)$/,
    /^CRUISE_(CREATE|UPDATE_DRAFT|DELETE_DRAFT|ASSIGN_SHIP|CHANGE_SHIP|UNASSIGN_SHIP|VALIDATE|PUBLISH|START|COMPLETE|STATUS_CHANGE)$/,
    /^CRUISE_STOP_(ADD|UPDATE|REMOVE_DRAFT|REORDER|ALL_ABOARD|ACTUAL_ARRIVAL|ACTUAL_DEPARTURE|OMIT|SUBSTITUTE|VALIDATE|TIME_MANAGE)$/,
    /^CRUISE_REGULATION_(ASSIGN|REMOVE)$/,
    /^ITINERARY_(CREATE|UPDATE_DRAFT|DELETE_DRAFT|VALIDATE|SUBMIT|APPLY_CHANGE|PUBLISH|CANCEL|DAYS_MANAGE|DAY_CREATE|DAY_UPDATE|DAY_DELETE|DAY_TYPE_SET|DAY_TIMEZONE_SET|CHANGE_RECORD)$/,
  ],
  OPERATIONS_MANAGER: [/^TRIP_PLAN_(REVIEW|VALIDATE)$/, /^(PORT_|DESTINATION_|REGULATION_|OPERATIONAL_ISSUE_|CRUISE_STAFF_|CRUISE_REGULATION_|SHIP_REGULATION_)/, /^ITINERARY_(APPROVE|REJECT|VALIDATE|DAYS_MANAGE)$/, /^CRUISE_(CANCEL|START|COMPLETE|VALIDATE|STATUS_CHANGE|OPEN_SALE|STOP_SALE|RESUME_SALE)$/, /^CRUISE_STOP_(ACTUAL_ARRIVAL|ACTUAL_DEPARTURE|ALL_ABOARD|OMIT|SUBSTITUTE|VALIDATE|TIME_MANAGE)$/],
  ACTIVITY_SERVICE_MANAGER: [/^(ACTIVITY_|EXCURSION_|TOUR_GROUP_|SUPPLIER_|SERVICE_|PRODUCT_|PACKAGE_COMPONENT_|REGISTRATION_|PARTICIPATION_)/, /^TOUR_PACKAGE_MANAGE$/],
  BOOKING_AGENT: [/^BOOKING_/, /^TOUR_PACKAGE_ASSIGN$/, /^CABIN_(BLOCK|RELEASE|STATUS_CHANGE)$/],
  CHECKIN_STAFF: [/^CHECKIN_/, /^PASSENGER_BLE_/, /^CRUISE_GUIDANCE_/],
  CUSTOMER_SERVICE: [/^BOOKING_(UPDATE|CANCEL)$/, /^SERVICE_REQUEST_CREATE$/],
  FINANCE_OFFICER: [/^(PAYMENT_|INVOICE_|SETTLEMENT_)/],
  ONBOARD_STAFF: [/^SERVICE_REQUEST_(ASSIGN|EXECUTE)$/, /^ACTIVITY_ATTENDANCE$/, /^PARTICIPATION_ATTENDANCE$/, /^TOUR_GROUP_PASSENGER_ATTENDANCE$/, /^PRODUCT_SALE$/],
}

export function actionInWorkScope(roles: readonly string[], permission: string): boolean {
  if (referencePermission.test(permission)) return true
  return roles.some(role => actionPatterns[role]?.some(pattern => pattern.test(permission)))
}
