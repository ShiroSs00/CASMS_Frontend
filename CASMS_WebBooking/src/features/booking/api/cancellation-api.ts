import { apiRequest } from '@/shared/api'

export type CancellationStatus = 'PENDING_OPS' | 'PENDING_FINANCE' | 'COMPLETED' | 'REJECTED' | 'WITHDRAWN'
export type CancellationCase = {
  caseId: string
  bookingId: string
  status: CancellationStatus
  scenario: 'CUSTOMER' | 'COMPANY' | 'OPERATIONAL_DISRUPTION'
  reason: string
  issueId: string | null
  revision: number
  requestedAt: string
  allowedActions: ('verify' | 'approve' | 'reject' | 'withdraw')[]
}
export const cancellationStatus: Record<CancellationStatus, string> = {
  PENDING_OPS: 'Chờ xác minh sự cố',
  PENDING_FINANCE: 'Chờ tài chính duyệt',
  COMPLETED: 'Đã hủy đặt chỗ',
  REJECTED: 'Đã từ chối yêu cầu',
  WITHDRAWN: 'Đã rút yêu cầu',
}

export const cancellationApi = {
  history: (bookingId: string, signal?: AbortSignal) =>
    apiRequest<CancellationCase[]>(`/booking/${encodeURIComponent(bookingId)}/cancellations`, { signal }),
  request: (bookingId: string, reason: string, idempotencyKey: string,
      scenario: CancellationCase['scenario'] = 'CUSTOMER', issueId?: string) =>
    apiRequest<CancellationCase>(`/booking/${encodeURIComponent(bookingId)}/cancellations`, {
      method: 'POST', body: { scenario, reason, ...(issueId ? { issueId } : {}) }, idempotencyKey,
    }),
  transition: (item: CancellationCase, action: CancellationCase['allowedActions'][number], reason?: string) =>
    apiRequest<CancellationCase>(`/cancellations/${encodeURIComponent(item.caseId)}/${action}`, {
      method: 'POST', body: { revision: item.revision, ...(reason ? { reason } : {}) },
    }),
}

