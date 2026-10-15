import { useCallback, useEffect, useRef, useState } from 'react'

import { itineraryApi } from '../api/itinerary-api'

async function fetchEditor(id: string, signal?: AbortSignal) {
  const [itinerary, days, stops, ports, destinations] = await Promise.all([
    itineraryApi.get(id, signal), itineraryApi.listDays(id, signal), itineraryApi.listStops(id, signal),
    itineraryApi.activePorts(signal), itineraryApi.activeDestinations(signal),
  ])
  return { itinerary, days, stops, ports, destinations }
}

export function useItineraryEditor(id: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchEditor>> | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetchEditor(id, controller.signal).then((result) => { if (!controller.signal.aborted) setData(result) }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được lịch trình.')
    })
    return () => controller.abort()
  }, [id])

  const run = useCallback(async (operation: () => Promise<unknown>, label: string, refresh = true) => {
    if (lock.current) return false
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      await operation()
      if (refresh) setData(await fetchEditor(id))
      setSuccess(label)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể thực hiện thao tác.')
      return false
    } finally { lock.current = false; setBusy(false) }
  }, [id])

  return { data, error, success, busy, run }
}
