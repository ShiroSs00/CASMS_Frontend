import { useCallback, useEffect, useRef, useState } from 'react'

import { operationalIssuesAdapter } from '../api/operational-issues-adapter'
import { IssueAdapterError, type IssueDetailResult } from '../model/issue-adapter'

type DetailState =
  | { status: 'loading'; issue: null; error: null }
  | ({ status: 'ready'; error: null } & IssueDetailResult)
  | { status: 'forbidden'; issue: null; error: string }
  | { status: 'not-found'; issue: null; error: string }
  | { status: 'error'; issue: null; error: string }

export function useIssueDetail(issueId: string | undefined) {
  const [state, setState] = useState<DetailState>({ status: 'loading', issue: null, error: null })
  const requestSequence = useRef(0)

  const request = useCallback(() => {
    const sequence = ++requestSequence.current
    if (!issueId) {
      return
    }
    void operationalIssuesAdapter
      .detail(issueId)
      .then((result) => {
        if (requestSequence.current !== sequence) return
        setState({ status: 'ready', error: null, ...result })
      })
      .catch((error: unknown) => {
        if (requestSequence.current !== sequence) return
        const message = error instanceof Error ? error.message : 'Không tải được sự cố.'
        setState({
          status: error instanceof IssueAdapterError && error.code === 'FORBIDDEN'
            ? 'forbidden'
            : error instanceof IssueAdapterError && error.code === 'NOT_FOUND'
              ? 'not-found'
              : 'error',
          issue: null,
          error: message,
        })
      })
  }, [issueId])

  const load = useCallback(() => {
    if (!issueId) {
      setState({ status: 'not-found', issue: null, error: 'Thiếu mã định danh sự cố.' })
      return
    }
    setState({ status: 'loading', issue: null, error: null })
    request()
  }, [issueId, request])

  useEffect(() => {
    request()
  }, [request])

  const visibleState =
    state.status === 'ready' && state.issue.id !== issueId
      ? ({ status: 'loading', issue: null, error: null } as const)
      : state

  return { state: visibleState, reload: load }
}
