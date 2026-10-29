import { useEffect, useRef, useState } from 'react'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'

export function useShoreRequest<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<({ data: T; error?: never } | { data?: never; error: unknown }) & { load: typeof load; version: number }>()
  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => load(controller.signal)).then((data) => {
      if (!controller.signal.aborted) setResult({ data, load, version })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ error, load, version })
    })
    return () => controller.abort()
  }, [load, version])
  const current = result?.load === load && result.version === version ? result : undefined
  return { loading: !current, data: current?.data, error: current?.error, reload: () => setVersion((value) => value + 1) }
}

export function useShoreMutation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [unknown,setUnknown]=useState(false)
  const unknownRef=useRef(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
    if (controller.current||unknownRef.current) return { ok: false }
    const request = new AbortController()
    controller.current = request; setBusy(true); setError(null)
    try {
      const value = await operation(request.signal)
      return request.signal.aborted ? { ok: false } : { ok: true, value }
    } catch (reason) {
      if(mutationOutcomeUnknown(reason)){unknownRef.current=true;setUnknown(true)}
      if (!request.signal.aborted) setError(reason)
      return { ok: false }
    } finally {
      if (!request.signal.aborted) setBusy(false)
      controller.current = null
    }
  }
  return { busy, error, unknown, run, clearError: () => {if(!unknownRef.current)setError(null)} }
}
