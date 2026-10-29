import { useCallback, useEffect, useRef, useState } from 'react'
import {useSessionAccess} from '@/shared/auth'

import { cruiseApi } from '../api/cruise-api'
import type { CruiseDetailView } from '../model/cruise-view'
import {useReadinessClock} from './useReadinessClock'

type DetailState = (
  | { status: 'loading'; data: CruiseDetailView | null; error: null }
  | { status: 'ready'; data: CruiseDetailView; error: null }
  | { status: 'error'; data: CruiseDetailView | null; error: string }
) & {contextKey?:string}

export function useCruiseDetail(cruiseId: string | undefined) {
  const access=useSessionAccess(),contextKey=JSON.stringify([access.userId,access.status,access.permissions])
  const [state, setState] = useState<DetailState>({ status: 'loading', data: null, error: null })
  const sequence = useRef(0)
  const lifetime = useRef<AbortController | null>(null)

  const request = useCallback((signal?: AbortSignal) => {
    if (!cruiseId) {
      return
    }
    const attempt = ++sequence.current
    return cruiseApi.getDetail(cruiseId, signal, data => {
      if (!signal?.aborted && sequence.current === attempt) setState({ status: 'loading', data, error: null,contextKey })
    }).then((data) => {
      if (!signal?.aborted && sequence.current === attempt) setState({ status: 'ready', data, error: null,contextKey })
    }).catch((error: unknown) => {
      if (!signal?.aborted && sequence.current === attempt) setState({ status: 'error', data: null, error: error instanceof Error ? error.message : 'Không tải được chuyến đi.',contextKey })
    })
  }, [cruiseId,contextKey])

  const load = useCallback(() => {
    setState((previous) => ({ status: 'loading', data: previous.contextKey===contextKey ? previous.data : null, error: null,contextKey }))
    return request(lifetime.current?.signal)
  }, [request,contextKey])

  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; void request(controller.signal); return () => controller.abort() }, [request])
  const visibleState: DetailState = state.contextKey!==contextKey||state.data && state.data.cruise.cruiseId !== cruiseId ? { status: 'loading', data: null, error: null } : state
  const now=useReadinessClock(visibleState.data?.readiness.validUntil)
  if(visibleState.data?.readiness.validUntil&&Date.parse(visibleState.data.readiness.validUntil)<=now) {
    const data=visibleState.data
    return {state:{...visibleState,data:{...data,readiness:{...data.readiness,state:'UNKNOWN' as const,stale:true,checks:data.readiness.checks.map(check=>({...check,state:'UNKNOWN' as const,reason:'Kết quả đã hết hạn. Tải lại đánh giá hiện tại.'}))}}},refresh:load}
  }
  return { state: visibleState, refresh: load }
}
