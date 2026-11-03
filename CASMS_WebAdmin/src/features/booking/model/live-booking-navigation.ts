/** Staff return links stay inside this application's booking workspace. */
export function catalogReturn(value: string | null) {
  if (!value || value.includes('\\')) return '/admin/bookings'
  try {
    const url = new URL(value, 'https://local.invalid')
    if (url.origin !== 'https://local.invalid' || url.pathname !== '/admin/bookings') return '/admin/bookings'
    return url.pathname + url.search
  } catch { return '/admin/bookings' }
}
