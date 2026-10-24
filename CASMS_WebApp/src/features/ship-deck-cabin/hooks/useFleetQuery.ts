import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'

// Keep the current ship visible during refresh, but never reuse another scope's data.
export function useFleetQuery<T>(scope: string, load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const revision = useSyncExternalStore(shipDeckCabinApi.subscribe, shipDeckCabinApi.getRevision)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${scope}:${revision}:${attempt}`
  const [result, setResult] = useState<{ scope: string; key: string; data: T | null; error: string }>({ scope: '', key: '', data: null, error: '' })
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void load(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ scope, key: requestKey, data, error: '' })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ scope, key: requestKey, data: null, error: error instanceof Error ? error.message : 'Không tải được dữ liệu.' })
    })
    return () => controller.abort()
  }, [load, requestKey, scope, enabled])
  return { data: enabled && result.scope === scope ? result.data : null, loading: enabled && result.key !== requestKey,
    error: enabled && result.key === requestKey ? result.error : '', retry: useCallback(() => setAttempt(value => value + 1), []) }
}
