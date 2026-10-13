import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { mockCruiseAdapter } from '../mocks/mock-cruise-adapter'
import {
  DEFAULT_CRUISE_QUERY,
  parseCruiseQuery,
  serializeCruiseQuery,
  type CruiseQuery,
} from '../model/cruise-query'
import type { CruiseListResult } from '../model/cruise-view'

export type CruiseListState =
  | { status: 'loading'; data: CruiseListResult | null; error: null }
  | { status: 'ready'; data: CruiseListResult; error: null; queryKey: string }
  | { status: 'error'; data: CruiseListResult | null; error: string }

export function useCruiseList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => parseCruiseQuery(searchParams), [searchParams])
  const queryKey = useMemo(() => serializeCruiseQuery(query).toString(), [query])
  const sequence = useRef(0)
  const [state, setState] = useState<CruiseListState>({ status: 'loading', data: null, error: null })

  const request = useCallback(() => {
    const current = ++sequence.current
    void mockCruiseAdapter.list(query).then((data) => {
      if (current !== sequence.current) return
      if (data.total > 0 && data.items.length === 0 && query.page > 1) {
        setSearchParams(serializeCruiseQuery({ ...query, page: 1 }), { replace: true })
        return
      }
      setState({ status: 'ready', data, error: null, queryKey })
    }).catch((error: unknown) => {
      if (current !== sequence.current) return
      setState({
        status: 'error',
        data: null,
        error: error instanceof Error ? error.message : 'Không tải được danh sách cruise.',
      })
    })
  }, [query, queryKey, setSearchParams])

  const load = useCallback(() => {
    setState((previous) => ({ status: 'loading', data: previous.data, error: null }))
    request()
  }, [request])

  useEffect(() => { request() }, [request])

  function updateQuery(patch: Partial<CruiseQuery>) {
    const changesFilter = Object.keys(patch).some((key) => key !== 'page')
    setSearchParams(serializeCruiseQuery({
      ...query,
      ...patch,
      page: changesFilter ? 1 : (patch.page ?? query.page),
    }))
  }

  const visibleState = state.status === 'ready' && state.queryKey !== queryKey
    ? ({ status: 'loading', data: null, error: null } as const)
    : state

  return {
    query,
    state: visibleState,
    updateQuery,
    resetQuery: () => setSearchParams(serializeCruiseQuery(DEFAULT_CRUISE_QUERY)),
    retry: load,
    ships: mockCruiseAdapter.ships,
  }
}
