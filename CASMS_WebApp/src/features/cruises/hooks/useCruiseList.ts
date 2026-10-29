import { useSessionAccess } from '@/shared/auth'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { cruiseApi } from '../api/cruise-api'
import type { ShipRecord } from '../model/cruise-record'
import {
  DEFAULT_CRUISE_QUERY,
  parseCruiseQuery,
  serializeCruiseQuery,
  type CruiseQuery,
} from '../model/cruise-query'
import type { CruiseListResult } from '../model/cruise-view'
import { bookingCruiseView } from '../model/cruise-visibility'

export type CruiseListState =
  | { status: 'loading'; data: CruiseListResult | null; error: null }
  | { status: 'ready'; data: CruiseListResult; error: null; queryKey: string }
  | { status: 'error'; data: CruiseListResult | null; error: string }

export function useCruiseList() {
  const access = useSessionAccess()
  const canShips = access.has('SHIP_READ')
  const booking = bookingCruiseView(access.roles)
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => ({...parseCruiseQuery(searchParams), ...(booking ? {status: '' as const} : {})}), [searchParams, booking])
  const sessionKey = `${access.userId}:${access.status}:${access.roles.join(',')}:${access.permissions.join(',')}`
  const queryKey = useMemo(() => `${sessionKey}:${serializeCruiseQuery(query)}`, [query, sessionKey])
  const sequence = useRef(0)
  const [state, setState] = useState<CruiseListState>({ status: 'loading', data: null, error: null })
  const [shipsError, setShipsError] = useState('')
  const [shipsAttempt, setShipsAttempt] = useState(0)
  const [ships, setShips] = useState<ShipRecord[]>([])

  const request = useCallback(() => {
    const controller = new AbortController()
    const current = ++sequence.current
    void cruiseApi.list(query, controller.signal).then((data) => {
      if (controller.signal.aborted || current !== sequence.current) return
      if (data.total > 0 && data.items.length === 0 && query.page > 1) {
        setSearchParams(serializeCruiseQuery({ ...query, page: 1 }), { replace: true })
        return
      }
      setState({ status: 'ready', data, error: null, queryKey })
    }).catch((error: unknown) => {
      if (controller.signal.aborted || current !== sequence.current) return
      setState({
        status: 'error',
        data: null,
        error: error instanceof Error ? error.message : 'Không tải được danh sách cruise.',
      })
    })
    return () => controller.abort()
  }, [query, queryKey, setSearchParams])

  const load = useCallback(() => {
    setState((previous) => ({ status: 'loading', data: previous.data, error: null }))
    request()
  }, [request])

  useEffect(() => request(), [request])
  useEffect(() => {
    const controller = new AbortController()
    if (!canShips) return () => controller.abort()
    void cruiseApi.listShips(controller.signal).then(value => { if (!controller.signal.aborted) { setShips(value); setShipsError('') } }).catch((error:unknown) => { if (!controller.signal.aborted) setShipsError(error instanceof Error ? error.message : 'Không tải được danh sách tàu.') })
    return () => controller.abort()
  }, [shipsAttempt, canShips])

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
    ships, shipsError, retryShips: () => setShipsAttempt(value=>value+1),
  }
}
