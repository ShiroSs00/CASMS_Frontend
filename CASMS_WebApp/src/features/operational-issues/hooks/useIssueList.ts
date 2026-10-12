import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { mockOperationalIssues, type IssueListResult } from '../mocks/mock-operational-issues'
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
  const requestSequence = useRef(0)

  const request = useCallback(() => {
    const sequence = ++requestSequence.current
    void mockOperationalIssues
      .list(query)
      .then((data) => {
        if (requestSequence.current !== sequence) return
        if (data.total > 0 && data.items.length === 0 && query.page > 1) {
          setSearchParams(serializeIssueQuery({ ...query, page: 1 }), { replace: true })
          return
        }
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
  }, [query, queryKey, setSearchParams])

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

    if (patch.shipId !== undefined && patch.shipId !== query.shipId) {
      const cruise = mockOperationalIssues.cruises.find(
        (candidate) => candidate.id === next.cruiseId,
      )
      if (cruise && cruise.shipId !== patch.shipId) next.cruiseId = ''
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
    handlers: mockOperationalIssues.handlers,
    ships: mockOperationalIssues.ships,
    cruises: mockOperationalIssues.cruises,
  }
}
