import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { operationalIssuesApi, type IssueListResult } from '../api/operational-issues-api'
import { issueLocationApi } from '../api/location-lookup-api'
import type { CruiseReference, ShipReference } from '../model/issue'
import {
  DEFAULT_ISSUE_QUERY,
  parseIssueQuery,
  serializeIssueQuery,
  type IssueQuery,
} from '../model/issue-query'

type ListState =
  | { status: 'loading'; data: IssueListResult | null; error: null }
  | { status: 'ready'; data: IssueListResult; error: null; queryKey: string }
  | { status: 'error'; data: IssueListResult | null; error: string }

export function useIssueList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => parseIssueQuery(searchParams), [searchParams])
  const queryKey = useMemo(() => serializeIssueQuery(query).toString(), [query])
  const [state, setState] = useState<ListState>({ status: 'loading', data: null, error: null })
  const [catalogShips, setCatalogShips] = useState<ShipReference[]>([])
  const [catalogCruises, setCatalogCruises] = useState<CruiseReference[]>([])
  const requestSequence = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      issueLocationApi.ships(controller.signal).catch(() => []),
      issueLocationApi.cruises(controller.signal).catch(() => []),
    ]).then(([shipRows, cruiseRows]) => {
      if (controller.signal.aborted) return
      setCatalogShips(shipRows.map(s => ({ id: s.shipId, name: s.shipName })))
      setCatalogCruises(cruiseRows.filter(c => Boolean(c.shipId)).map(c => ({ id: c.cruiseId, code: c.cruiseCode, name: c.cruiseName, shipId: c.shipId ?? '' })))
    })
    return () => controller.abort()
  }, [])

  const request = useCallback(() => {
    const sequence = ++requestSequence.current
    void operationalIssuesApi
      .list(query)
      .then((data) => {
        if (requestSequence.current !== sequence) return
        setState({ status: 'ready', data, error: null, queryKey })
      })
      .catch((error: unknown) => {
        if (requestSequence.current !== sequence) return
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : 'Không tải được danh sách sự cố.',
        })
      })
  }, [query, queryKey])

  const load = useCallback(() => {
    setState((current) => ({ status: 'loading', data: current.data, error: null }))
    request()
  }, [request])

  useEffect(() => {
    request()
  }, [request])

  function updateQuery(patch: Partial<IssueQuery>) {
    const changesFiltering = Object.keys(patch).some((key) => key !== 'page')
    const next = {
      ...query,
      ...patch,
      page: changesFiltering ? 1 : (patch.page ?? query.page),
    }

    setSearchParams(serializeIssueQuery(next))
  }

  const visibleState =
    state.status === 'ready' && state.queryKey !== queryKey
      ? ({ status: 'loading', data: null, error: null } as const)
      : state

  return {
    query,
    state: visibleState,
    updateQuery,
    resetQuery: () => setSearchParams(serializeIssueQuery(DEFAULT_ISSUE_QUERY)),
    retry: load,
    handlers: state.data?.handlers ?? [...new Map((state.data?.items.flatMap((item) => item.assignedTo ? [item.assignedTo] : []) ?? []).map((item) => [item.id, item])).values()],
    ships: [...new Map([...catalogShips, ...(state.data?.items.map((item) => item.ship) ?? [])].map((item) => [item.id, item])).values()],
    cruises: [...new Map([...catalogCruises, ...(state.data?.items.flatMap((item) => item.cruise ? [item.cruise] : []) ?? [])].map((item) => [item.id, item])).values()],
  }
}
