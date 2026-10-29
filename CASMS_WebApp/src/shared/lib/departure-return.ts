/** Only a local departure form/detail may be used as the source viewer's return destination. */
export function departureReturn(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value, 'https://casms.local')
    if (url.origin !== 'https://casms.local' || !/^\/admin\/cruises\/(?:new|[0-9a-f-]{36})(?:\/edit)?$/i.test(url.pathname)) return null
    return url.pathname + url.search
  } catch { return null }
}
