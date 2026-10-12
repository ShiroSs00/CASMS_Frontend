import { useEffect, useState, useSyncExternalStore, useCallback, useRef } from 'react'
import { shipDeckCabinAdapter } from '../mocks/adapter'
import type { DataSnapshot } from '../model/types'

export function useAdminData() {
  const revision = useSyncExternalStore(shipDeckCabinAdapter.subscribe, shipDeckCabinAdapter.getRevision)
  const [result, setResult] = useState<{ data: DataSnapshot | null; error: string; revision: number; attempt: number }>({ data: null, error: '', revision: -1, attempt: -1 })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    void shipDeckCabinAdapter.list().then((data) => {
      if (active) setResult({ data, error: '', revision, attempt: retry })
    }).catch((error: unknown) => {
      if (active) setResult({ data: null, error: error instanceof Error ? error.message : 'Không tải được dữ liệu.', revision, attempt: retry })
    })
    return () => { active = false }
  }, [revision, retry])
  return { data: result.data, error: result.error, loading: result.revision !== revision || result.attempt !== retry, retry: () => setRetry((value) => value + 1) }
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
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Thao tác thất bại. Dữ liệu cũ được giữ nguyên.'); return false }
    finally { inFlight.current = false; setBusy(false) }
  }, [])
  return { busy, error, success, run, clear: () => { setError(''); setSuccess('') } }
}
