// Backend preview omits only the root revision; registered manifests retain it.
export async function previewFingerprint(value: unknown) {
  function canonical(row: unknown): unknown {
    if (Array.isArray(row)) return row.map(canonical)
    if (row && typeof row === 'object') return Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
    return row
  }
  const { revision: _revision, ...manifest } = value as Record<string, unknown>
  void _revision
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(manifest)))
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
}
