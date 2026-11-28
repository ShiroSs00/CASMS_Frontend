/** Work responsibilities, including CRUISE_MANAGER = Itinerary Coordinator (2026-10-27).
 * This policy limits FE workspaces/actions; it does not grant backend permissions.
 * Reference API reads deliberately remain independent of workspace membership.
 */
export const ROLE_WORK_MODULES: Readonly<Record<string, readonly string[]>> = {
  ADMIN: ['system', 'ships', 'ship-types', 'ship-import'],
  SHIP_MANAGER: ['fleet-dashboard', 'ships', 'decks', 'cabins', 'ship-models', 'passenger-tracking', 'ship-regulations', 'service-locations', 'preparation-requests', 'staffing-reviews'],
  HR_MANAGER: ['staffing', 'system'],
  CRUISE_MANAGER: ['trips', 'cruises', 'itineraries', 'itinerary-history', 'cruise-regulations'],
  OPERATIONS_MANAGER: ['cruise-plan-reviews', 'staffing-reviews', 'issues', 'regulations', 'destinations', 'ports', 'ship-regulations', 'cruise-regulations', 'itinerary-history'],
  ACTIVITY_SERVICE_MANAGER: ['preparation-requests','activities', 'shore-excursions', 'tour-groups', 'suppliers', 'services', 'products', 'service-packages', 'package-assignments', 'cruise-package-templates', 'fare-package-templates', 'service-requests', 'activity-registrations', 'cruises'],
  BOOKING_AGENT: ['bookings', 'staff/checkin'],
  FINANCE_OFFICER: ['staff/finance', 'bookings'],
  ONBOARD_STAFF: ['activities', 'shore-excursions', 'tour-groups', 'service-requests'],
  PASSENGER: [],
}

export function hasWorkScope(roles: readonly string[], module: string): boolean {
  return roles.some(role => ROLE_WORK_MODULES[role]?.includes(module))
}

// These are reference/inspection authorities, not permission to manage a module.
const referencePermission = /(?:_READ(?:_|$)|_VIEW$|_REPORT$|_SEARCH$|_AVAILABILITY$|_HISTORY$|_SUMMARY$|_READINESS$|_CHECK$|_CURRENT_CRUISE$|_AFFECTED_CRUISES$)/
const actionPatterns: Readonly<Record<string, readonly RegExp[]>> = {
  ADMIN: [/^USER_/, /^SHIP_MODEL_/, /^SHIP_CONFIGURATION_/, /^SHIP_(CREATE|UPDATE)$/, /^DECK_UPDATE$/, /^CABIN_UPDATE$/, /^POS_MANAGE$/],
  SHIP_MANAGER: [
    /^SHIP_(ARCHIVE|STATUS_CHANGE|VALIDATE|CABIN_CATEGORY_MAPPING_CONFIRM|CONFIGURATION_VALIDATE|REGULATION_ASSIGN|REGULATION_REMOVE)$/,
    /^DECK_VALIDATE$/,
    /^CABIN_(STATUS_CHANGE|BLOCK|RELEASE|VALIDATE)$/,
    /^BLE_ANCHOR_/,
  ],
  HR_MANAGER: [/^CRUISE_STAFF_(ASSIGN|REMOVE)$/, /^USER_(CREATE|UPDATE|STATUS_CHANGE)$/],
  // Aligned with RolePermissionInitializer.CRUISE_MANAGER. /auth/me remains mandatory.
  // Source-version review is intentionally absent; legacy ITINERARY_PUBLISH is a different authority.
  CRUISE_MANAGER: [
    /^TRIP_(CREATE|UPDATE|DELETE|SUBMIT|PLAN_WRITE|PLAN_VALIDATE|PLAN_SUBMIT)$/,
    /^CRUISE_(CREATE|UPDATE_DRAFT|DELETE_DRAFT|ASSIGN_SHIP|CHANGE_SHIP|UNASSIGN_SHIP|VALIDATE|PUBLISH|START|COMPLETE|STATUS_CHANGE)$/,
    /^CRUISE_PREPARATION_SUBMIT$/,
    /^CRUISE_STOP_(ADD|UPDATE|REMOVE_DRAFT|REORDER|ALL_ABOARD|ACTUAL_ARRIVAL|ACTUAL_DEPARTURE|OMIT|SUBSTITUTE|VALIDATE|TIME_MANAGE)$/,
    /^CRUISE_REGULATION_(ASSIGN|REMOVE)$/,
    /^ITINERARY_(CREATE|UPDATE_DRAFT|DELETE_DRAFT|VALIDATE|SUBMIT|APPLY_CHANGE|PUBLISH|CANCEL|DAYS_MANAGE|DAY_CREATE|DAY_UPDATE|DAY_DELETE|DAY_TYPE_SET|DAY_TIMEZONE_SET|CHANGE_RECORD)$/,
  ],
  OPERATIONS_MANAGER: [/^(PORT_|DESTINATION_|REGULATION_|OPERATIONAL_ISSUE_|CRUISE_STAFF_|CRUISE_REGULATION_|SHIP_REGULATION_)/, /^ITINERARY_(APPROVE|REJECT|VALIDATE|DAYS_MANAGE)$/, /^CRUISE_(CANCEL|START|COMPLETE|VALIDATE|STATUS_CHANGE|OPEN_SALE|STOP_SALE|RESUME_SALE|PRICING_APPROVE)$/, /^CRUISE_STOP_(ACTUAL_ARRIVAL|ACTUAL_DEPARTURE|ALL_ABOARD|OMIT|SUBSTITUTE|VALIDATE|TIME_MANAGE)$/],
  ACTIVITY_SERVICE_MANAGER: [/^(ACTIVITY_|EXCURSION_|TOUR_GROUP_|SUPPLIER_|SERVICE_|PRODUCT_|PACKAGE_COMPONENT_|REGISTRATION_|PARTICIPATION_)/, /^TOUR_PACKAGE_MANAGE$/],
  BOOKING_AGENT: [/^BOOKING_/, /^CHECKIN_(CREATE|UPDATE|STEP_UPDATE|IDENTITY_VERIFY|DOCUMENT_VERIFY|PAYMENT_VERIFY|BOARDING)$/, /^TOUR_PACKAGE_ASSIGN$/, /^CABIN_(BLOCK|RELEASE|STATUS_CHANGE)$/],
  FINANCE_OFFICER: [/^(PAYMENT_|INVOICE_|SETTLEMENT_)/],
  ONBOARD_STAFF: [/^SERVICE_REQUEST_(ASSIGN|EXECUTE)$/, /^ACTIVITY_ATTENDANCE$/, /^PARTICIPATION_ATTENDANCE$/, /^TOUR_GROUP_PASSENGER_ATTENDANCE$/, /^CHECKOUT_PROCESS$/],
}

export function actionInWorkScope(roles: readonly string[], permission: string): boolean {
  if (referencePermission.test(permission)) return true
  return roles.some(role => actionPatterns[role]?.some(pattern => pattern.test(permission)))
}
