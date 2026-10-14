import { ApiError } from '@/shared/api'
import { IssueAdapterError, type OperationalIssuesAdapter } from '../model/issue-adapter'
import { operationalIssuesApi } from './operational-issues-api'

/** Production requests never fall back to mock records or mock mutations. */
export const operationalIssuesAdapter: OperationalIssuesAdapter = {
  ...operationalIssuesApi,
  async detail(id) {
    try {
      return await operationalIssuesApi.detail(id)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        throw new IssueAdapterError('FORBIDDEN', error.message)
      }
      if (error instanceof ApiError && error.status === 404) {
        throw new IssueAdapterError('NOT_FOUND', error.message)
      }
      throw error
    }
  },
}
