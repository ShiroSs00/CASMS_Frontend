import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { operationalIssuesAdapter } from '../api/operational-issues-adapter'
import type { IssueListResult } from '../model/issue-adapter'
import { selectIssuePage } from '../model/issue-list'
import { DEFAULT_ISSUE_QUERY, parseIssueQuery, serializeIssueQuery, type IssueQuery } from '../model/issue-query'

type ListState =
  | { status: 'loading'; data: IssueListResult | null; error: null }
  | { status: 'ready'; data: IssueListResult; error: null }
  | { status: 'error'; data: null; error: string }

export function useIssueList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => parseIssueQuery(searchParams), [searchParams])
  const [state, setState] = useState<ListState>({ status: 'loading', data: null, error: null })
  const sequence = useRef(0)
  const request = useCallback(() => {
    const current = ++sequence.current
    void operationalIssuesAdapter.list({ ...DEFAULT_ISSUE_QUERY, pageSize: Number.MAX_SAFE_INTEGER })
      .then((data) => {
        if (sequence.current === current) setState({ status: 'ready', data, error: null })
      })
      .catch((error: unknown) => {
        if (sequence.current === current) setState({
          status: 'error', data: null,
          error: error instanceof Error ? error.message : 'Không tải được danh sách sự cố.',
        })
      })
  }, [])
  useEffect(() => {
    request()
    return () => { sequence.current += 1 }
  }, [request])

  const visibleState = useMemo(() => state.status === 'ready'
    ? { ...state, data: selectIssuePage(state.data, query) } : state, [query, state])
  useEffect(() => {
    if (visibleState.status !== 'ready' || visibleState.data.page === query.page) return
    setSearchParams(serializeIssueQuery({ ...query, page: visibleState.data.page }), { replace: true })
  }, [query, setSearchParams, visibleState])

  function updateQuery(patch: Partial<IssueQuery>) {
    const changesFiltering = Object.keys(patch).some((key) => key !== 'page')
    const next = { ...query, ...patch, page: changesFiltering ? 1 : (patch.page ?? query.page) }
    if (patch.shipId !== undefined && patch.shipId !== query.shipId) {
      const cruise = state.data?.cruises.find((item) => item.id === next.cruiseId)
      if (cruise && cruise.shipId !== patch.shipId) next.cruiseId = ''
    }
    setSearchParams(serializeIssueQuery(next))
  }
  return {
    query, state: visibleState, updateQuery,
    resetQuery: () => setSearchParams(serializeIssueQuery({ ...DEFAULT_ISSUE_QUERY, pageSize: query.pageSize })),
    retry: () => { setState({ status: 'loading', data: null, error: null }); request() },
    handlers: state.data?.handlers ?? [], ships: state.data?.ships ?? [], cruises: state.data?.cruises ?? [],
  }
}
