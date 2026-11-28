import type { PlanView } from '../api/mainflow-api'
import { uniqueConditionCodes } from './operations-issues'
import { ApiError } from '@/shared/api'

export type QueueMode = 'tour-dossiers' | 'section-groups' | 'port-fees' | 'operating-budgets'
export type QueueFilter = 'pending' | 'reviewed' | 'returned'
export type SubmittedBudget = { cruiseId: string; cruiseCode: string; cruiseName: string; amountVnd: string | null; status: 'SUBMITTED' | 'APPROVED' | 'REJECTED'; reviewRevision: number; reason: string | null; submittedByName: string | null; canReview: boolean }
export function decodeSubmittedBudgets(value: unknown): SubmittedBudget[] {
  if (!Array.isArray(value) || value.some(row => !row || typeof row.cruiseId !== 'string' || !row.cruiseId || typeof row.cruiseCode !== 'string' || typeof row.cruiseName !== 'string'
    || !['SUBMITTED', 'APPROVED', 'REJECTED'].includes(row.status) || !Number.isSafeInteger(row.reviewRevision) || row.reviewRevision < 1
    || typeof row.canReview !== 'boolean' || (row.amountVnd != null && (typeof row.amountVnd !== 'string' || !/^\d{1,18}$/.test(row.amountVnd)))
    || (row.reason != null && typeof row.reason !== 'string') || (row.submittedByName != null && typeof row.submittedByName !== 'string'))) {
    throw new ApiError('Danh sách ngân sách thiếu dữ liệu hoặc quyền xét duyệt. Hãy tải lại để đối chiếu.', 502)
  }
  return value.map(row => ({ ...row, amountVnd:row.amountVnd ?? null,reason:row.reason ?? null,submittedByName:row.submittedByName ?? null }))
}
export function queueSelection(params: URLSearchParams) {
  const mode = params.get('mode'), filter = params.get('filter')
  return {
    mode: (['tour-dossiers', 'section-groups', 'port-fees', 'operating-budgets'].includes(mode ?? '') ? mode : 'tour-dossiers') as QueueMode,
    filter: (['pending', 'reviewed', 'returned'].includes(filter ?? '') ? filter : 'pending') as QueueFilter,
  }
}

/** Null means the queue has never been read; zero is reserved for a completed read. */
export function queueCount(data: readonly unknown[] | null, loading: boolean, error: Error | null, pending: number, unit: string) {
  if (error) return 'Chưa tải được'
  if (loading) return 'Đang tải…'
  if (data === null) return ''
  return `${pending} ${unit}`
}

/** Program issues add detail to plan blockers, rather than another count of the same rule. */
export function planQueueConditions(plan: Pick<PlanView, 'planBlockers' | 'programIssues'>) {
  return uniqueConditionCodes([...plan.planBlockers, ...(plan.programIssues ?? []).map(issue => issue.code)])
}
