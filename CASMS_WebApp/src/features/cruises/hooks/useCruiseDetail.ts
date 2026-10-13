import { useCallback, useEffect, useState } from 'react'

import { mockCruiseAdapter } from '../mocks/mock-cruise-adapter'
import type { CruiseDetailView } from '../model/cruise-view'

type DetailState =
  | { status: 'loading'; data: CruiseDetailView | null; error: null }
  | { status: 'ready'; data: CruiseDetailView; error: null }
  | { status: 'error'; data: CruiseDetailView | null; error: string }

export function useCruiseDetail(cruiseId: string | undefined) {
  const [state, setState] = useState<DetailState>({ status: 'loading', data: null, error: null })

  const request = useCallback(() => {
    if (!cruiseId) {
      return
    }
    void mockCruiseAdapter.getDetail(cruiseId).then((data) => {
      setState({ status: 'ready', data, error: null })
    }).catch((error: unknown) => {
      setState({ status: 'error', data: null, error: error instanceof Error ? error.message : 'Không tải được cruise.' })
    })
  }, [cruiseId])

  const load = useCallback(() => {
    setState((previous) => ({ status: 'loading', data: previous.data, error: null }))
    request()
  }, [request])

  useEffect(() => { request() }, [request])
  return { state, refresh: load }
}
