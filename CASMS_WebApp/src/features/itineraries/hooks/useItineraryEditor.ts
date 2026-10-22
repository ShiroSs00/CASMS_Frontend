import { useCallback, useEffect, useRef, useState } from 'react'

import { itineraryApi } from '../api/itinerary-api'

type EditorData = {
  itinerary: Awaited<ReturnType<typeof itineraryApi.get>>
  days: Awaited<ReturnType<typeof itineraryApi.listDays>>
  stops: Awaited<ReturnType<typeof itineraryApi.listStops>>
  ports: Awaited<ReturnType<typeof itineraryApi.activePorts>>
  destinations: Awaited<ReturnType<typeof itineraryApi.activeDestinations>>
  supplementaryErrors: Record<string, string>
  supplementaryLoading: boolean
}

export async function fetchEditor(id: string, signal?: AbortSignal, onCore?: (data: EditorData) => void): Promise<EditorData> {
  const itinerary = await itineraryApi.get(id, signal)
  const data: EditorData = { itinerary, days: [], stops: [], ports: [], destinations: [], supplementaryErrors: {}, supplementaryLoading: true }
  onCore?.(data)
  const results = await Promise.allSettled([itineraryApi.listDays(id, signal), itineraryApi.listStops(id, signal), itineraryApi.activePorts(signal), itineraryApi.activeDestinations(signal)])
  const [days, stops, ports, destinations] = results
  for (const [index, key] of ['days', 'stops', 'ports', 'destinations'].entries()) {
    const result = results[index]
    if (result.status === 'rejected') data.supplementaryErrors[key] = result.reason instanceof Error ? result.reason.message : 'Không tải được dữ liệu liên quan.'
  }
  return { ...data, days: days.status === 'fulfilled' ? days.value : [], stops: stops.status === 'fulfilled' ? stops.value : [], ports: ports.status === 'fulfilled' ? ports.value : [], destinations: destinations.status === 'fulfilled' ? destinations.value : [], supplementaryLoading: false }
}

export function useItineraryEditor(id: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchEditor>> | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const sequence = useRef(0)
  const lifetime = useRef<AbortController | null>(null)

  const retry = useCallback(async (signal: AbortSignal | undefined = lifetime.current?.signal) => {
    const request = ++sequence.current
    try {
      const result = await fetchEditor(id, signal, core => { if (!signal?.aborted && sequence.current === request) { setError(''); setData(core) } })
      if (!signal?.aborted && sequence.current === request) setData(result)
      return true
    } catch (reason) {
      if (!signal?.aborted && sequence.current === request) setError(reason instanceof Error ? reason.message : 'Không tải được lịch trình.')
      return false
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    void retry(controller.signal)
    return () => controller.abort()
  }, [retry])

  const run = useCallback(async (operation: () => Promise<unknown>, label: string, refresh = true) => {
    if (lock.current) return false
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    const generation = sequence.current
    try {
      await operation()
      if (sequence.current !== generation || lifetime.current?.signal.aborted) return false
      if (refresh && !await retry()) throw new Error('Thao tác đã thực hiện nhưng chưa tải lại được dữ liệu. Hãy kiểm tra trước khi thao tác tiếp.')
      setSuccess(label)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể thực hiện thao tác.')
      return false
    } finally { lock.current = false; setBusy(false) }
  }, [retry])

  return { data: data?.itinerary.itineraryId === id ? data : null, error, success, busy, run, retry }
}
