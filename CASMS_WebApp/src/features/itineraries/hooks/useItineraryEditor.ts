import { getSessionAccess, hasPermissions } from '@/shared/auth'
import { useCallback, useEffect, useRef, useState } from 'react'

import { itineraryApi } from '../api/itinerary-api'

type EditorData = {
  cruise?: Awaited<ReturnType<typeof itineraryApi.getCruise>>
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
  const access = getSessionAccess()
  const read = <T,>(permission: string, load: () => Promise<T>) => hasPermissions(access,{mode:'ANY',permissions:[permission]}) ? load() : Promise.reject(new Error('Tài khoản chưa được cấp quyền xem ' + ({ITINERARY_DAY_READ:'ngày trong lịch trình',CRUISE_STOP_READ:'lần ghé cảng',PORT_READ:'danh mục cảng',DESTINATION_READ:'điểm đến',CRUISE_READ:'chuyến đi'}[permission] ?? 'dữ liệu liên quan') + '.'))
  const results = await Promise.allSettled([read('ITINERARY_DAY_READ', () => itineraryApi.listDays(id, signal)), read('CRUISE_STOP_READ', () => itineraryApi.listStops(id, signal)), read('PORT_READ', () => itineraryApi.activePorts(signal)), read('DESTINATION_READ', () => itineraryApi.activeDestinations(signal)), read('CRUISE_READ', () => itineraryApi.getCruise(itinerary.cruiseId, signal))])
  const [days, stops, ports, destinations, cruise] = results
  for (const [index, key] of ['days', 'stops', 'ports', 'destinations', 'cruise'].entries()) {
    const result = results[index]
    if (result.status === 'rejected') data.supplementaryErrors[key] = result.reason instanceof Error ? result.reason.message : 'Không tải được dữ liệu liên quan.'
  }
  if (stops.status === 'fulfilled' && ports.status === 'fulfilled') {
    const missing = [...new Set(stops.value.map(stop => stop.portId))].filter(portId => !ports.value.some(port => port.portId === portId))
    const savedPorts = await Promise.allSettled(missing.map(portId => itineraryApi.getPort(portId, signal)))
    for (const result of savedPorts) {
      if (result.status === 'fulfilled') ports.value.push(result.value)
      else data.supplementaryErrors.ports = 'Chưa tải được cấu hình cảng đã lưu trong lịch trình.'
    }
  }
  return { ...data, cruise: cruise.status === 'fulfilled' ? cruise.value : undefined, days: days.status === 'fulfilled' ? days.value : [], stops: stops.status === 'fulfilled' ? stops.value : [], ports: ports.status === 'fulfilled' ? ports.value : [], destinations: destinations.status === 'fulfilled' ? destinations.value : [], supplementaryLoading: false }
}

export function useItineraryEditor(id: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchEditor>> | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [stale, setStale] = useState(false)
  const lock = useRef(false)
  const sequence = useRef(0)
  const lifetime = useRef<AbortController | null>(null)

  const retry = useCallback(async (signal: AbortSignal | undefined = lifetime.current?.signal) => {
    const request = ++sequence.current
    try {
      const result = await fetchEditor(id, signal, core => { if (!signal?.aborted && sequence.current === request) { setError(''); setData(current => current?.itinerary.itineraryId === id ? current : core) } })
      if (!signal?.aborted && sequence.current === request) { setData(result); setStale(false) }
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
      if (refresh && !await retry()) {
        setStale(true)
        setError('Thao tác đã lưu thành công nhưng chưa tải lại được dữ liệu. Hãy tải lại trước khi thao tác tiếp; không gửi lại yêu cầu tạo.')
        return true
      }
      setSuccess(label)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể thực hiện thao tác.')
      return false
    } finally { lock.current = false; setBusy(false) }
  }, [retry])

  return { data: data?.itinerary.itineraryId === id ? data : null, error, success, busy, stale, run, retry }
}
