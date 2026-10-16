import { useEffect, useState, useSyncExternalStore, useCallback, useRef } from 'react'
import { ApiError } from '@/shared/api'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import type { AvailableCabinQuery, EntityKind } from '../model/types'

export function useApiQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const revision = useSyncExternalStore(shipDeckCabinApi.subscribe, shipDeckCabinApi.getRevision)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${key}:${revision}:${attempt}`
  const [result, setResult] = useState<{ key: string; data: T | null; error: string }>({ key: '', data: null, error: '' })
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void load(controller.signal).then((data) => {
      if (active) setResult({ key: requestKey, data, error: '' })
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted) setResult({ key: requestKey, data: null,
        error: error instanceof Error ? error.message : 'Không tải được dữ liệu.' })
    })
    return () => { active = false; controller.abort() }
  }, [load, requestKey])
  return { data: result.key === requestKey ? result.data : null,
    error: result.key === requestKey ? result.error : '', loading: result.key !== requestKey,
    retry: () => setAttempt((value) => value + 1) }
}
export function useAdminData() { return useApiQuery('snapshot', shipDeckCabinApi.listSnapshot) }
export function useEntity(kind: EntityKind, id?: string) {
  const load = useCallback(async (signal: AbortSignal) => {
    if (!id) return null
    try { return await shipDeckCabinApi.get(kind, id, signal) }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error }
  }, [kind, id])
  return useApiQuery(`${kind}:${id ?? 'new'}`, load)
}
export function useAvailableCabins(enabled: boolean, query: AvailableCabinQuery) {
  const { shipId, deckId, cabinType, minCapacity, isAccessible } = query
  const load = useCallback((signal: AbortSignal) => enabled
    ? shipDeckCabinApi.searchAvailable({ shipId, deckId, cabinType, minCapacity, isAccessible }, signal)
    : Promise.resolve(null), [enabled, shipId, deckId, cabinType, minCapacity, isAccessible])
  return useApiQuery(`available:${enabled}:${JSON.stringify(query)}`, load)
}
export function useMutation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const inFlight = useRef(false)
  const run = useCallback(async (action: () => Promise<void>, message = 'Thao tác thành công.') => {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true); setError(''); setSuccess('')
    try { await action(); setSuccess(message); return true }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Thao tác thất bại.'); return false }
    finally { inFlight.current = false; setBusy(false) }
  }, [])
  return { busy, error, success, run, setSuccess, clear: () => { setError(''); setSuccess('') } }
}
