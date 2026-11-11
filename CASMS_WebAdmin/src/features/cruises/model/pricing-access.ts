type PricingAccess = { roles: readonly string[]; has: (permission: string) => boolean }

// Match Backend pricing actor checks: CRM drafts/submits, independent OPS reviews.
export function pricingCapabilities(access: PricingAccess) {
  return {
    draft: access.roles.includes('CRUISE_MANAGER') && access.has('CRUISE_UPDATE_DRAFT'),
    review: access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_PRICING_APPROVE'),
  }
}
