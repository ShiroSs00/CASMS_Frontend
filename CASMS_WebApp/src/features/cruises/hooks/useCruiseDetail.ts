import { useCallback, useEffect, useRef, useState } from 'react'

import { cruiseApi } from '../api/cruise-api'
import type { CruiseDetailView } from '../model/cruise-view'

type DetailState =
  | { status: 'loading'; data: CruiseDetailView | null; error: null }
  | { status: 'ready'; data: CruiseDetailView; error: null }
  | { status: 'error'; data: CruiseDetailView | null; error: string }

export function useCruiseDetail(cruiseId: string | undefined) {
  const [state, setState] = useState<DetailState>({ status: 'loading', data: null, error: null })
  const sequence = useRef(0)
  const lifetime = useRef<AbortController | null>(null)

  const request = useCallback((signal?: AbortSignal) => {
    if (!cruiseId) {
      return
    }
    const attempt = ++sequence.current
    return cruiseApi.getDetail(cruiseId, signal, data => {
      if (!signal?.aborted && sequence.current === attempt) setState({ status: 'loading', data, error: null })
    }).then((data) => {
      if (!signal?.aborted && sequence.current === attempt) setState({ status: 'ready', data, error: null })
    }).catch((error: unknown) => {
      if (!signal?.aborted && sequence.current === attempt) setState({ status: 'error', data: null, error: error instanceof Error ? error.message : 'Không tải được chuyến du lịch.' })
    })
  }, [cruiseId])

  const load = useCallback(() => {
    setState((previous) => ({ status: 'loading', data: previous.data, error: null }))
    return request(lifetime.current?.signal)
  }, [request])

  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; void request(controller.signal); return () => controller.abort() }, [request])
  const visibleState: DetailState = state.data && state.data.cruise.cruiseId !== cruiseId ? { status: 'loading', data: null, error: null } : state
  return { state: visibleState, refresh: load }
}
