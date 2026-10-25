export const AUTH_ROLES = [
  'ADMIN', 'CRUISE_MANAGER', 'SHIP_MANAGER', 'OPERATIONS_MANAGER', 'ACTIVITY_SERVICE_MANAGER', 'BOOKING_AGENT',
  'CHECKIN_STAFF', 'ONBOARD_STAFF', 'FINANCE_OFFICER', 'CUSTOMER_SERVICE', 'PASSENGER',
] as const
export type Role = typeof AUTH_ROLES[number]
export type AuthUser = { id: string; username: string; email: string | null; roles: Role[] }
export type AuthSession = { accessToken: string; expiresAt: number; refreshAt: number; user: AuthUser }
export type AuthState = { status: 'loading' | 'anonymous' | 'authenticated' | 'expired'; session: AuthSession | null }

// Coarse navigation UX only. Backend remains the authority for every action.
export const isStaff = (user: AuthUser | null | undefined) => Boolean(user?.roles.some((role) => role !== 'PASSENGER'))
export const canSignIn = isStaff

export function safeAdminReturnTo(value: string | null): string | null {
  if (!value || !/^\/admin(?:[/?#]|$)/.test(value) || value.includes('\\')
    || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return null
  try {
    const parsed = new URL(value, 'https://aurora.invalid')
    if (parsed.origin !== 'https://aurora.invalid' || !/^\/admin(?:\/|$)/.test(parsed.pathname)) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch { return null }
}

// Only known local customer routes may be restored after authentication.
export function safeCustomerReturnTo(value: string | null): string | null {
  if (!value || value.includes('\\') || [...value].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return null
  try {
    const parsed = new URL(value, 'https://aurora.invalid')
    if (parsed.origin !== 'https://aurora.invalid' || !/^\/(?:cruises|booking|my-bookings)(?:\/|$)/.test(parsed.pathname)) return null
    return parsed.pathname + parsed.search + parsed.hash
  } catch { return null }
}
