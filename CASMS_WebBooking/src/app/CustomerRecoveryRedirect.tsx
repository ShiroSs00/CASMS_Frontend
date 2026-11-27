import { Navigate, useLocation } from 'react-router'

// Account registration/password reset are not standalone customer flows yet.
// Preserve lookup recovery (including bookingId/query/hash) and pass a clear notice reason.
export function CustomerRecoveryRedirect() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const bookingId = location.pathname.split('/')[2]
  if (bookingId && location.pathname.startsWith('/bookings/')) query.set('bookingId', bookingId)
  if (location.pathname === '/register') query.set('notice', 'register')
  else if (location.pathname === '/forgot-password' || location.pathname === '/reset-password') query.set('notice', 'password-reset')
  return <Navigate to={{ pathname: '/booking/lookup', search: query.toString() ? '?' + query : '', hash: location.hash }} replace />
}
