import { Navigate, useLocation } from 'react-router'

// Account management was not integrated in the legacy app. Preserve lookup recovery,
// including bookingId/query/hash, without exposing staff login or inventing customer auth.
export function CustomerRecoveryRedirect() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const bookingId = location.pathname.split('/')[2]
  if (bookingId) query.set('bookingId', bookingId)
  return <Navigate to={{ pathname: '/booking/lookup', search: query.toString() ? '?' + query : '', hash: location.hash }} replace />
}
