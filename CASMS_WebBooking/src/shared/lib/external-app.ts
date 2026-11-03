/** Optional cross-application navigation carries no session data. */
export function externalAppUrl(origin: string | undefined, path = '/') {
  if (!origin?.trim()) return null
  try {
    const url = new URL(origin)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    return new URL(path, url.origin).href
  } catch { return null }
}
