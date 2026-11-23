import { useCallback } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'

export const programReadOnlyReason = 'Bạn cần được giao việc và đang xử lý để chỉnh sửa. Nếu đã bàn giao, liên hệ Quản lý lịch trình để yêu cầu bổ sung, rồi nhận lại việc.'

export function programWriteAllowed(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const context = value as { mayConfigure?: unknown; planStatus?: unknown }
  return context.mayConfigure === true && ['DRAFT', 'WITHDRAWN', 'REVISION_REQUESTED'].includes(String(context.planStatus))
}

export function programLockReason(value: unknown): string | null {
  if (programWriteAllowed(value)) return null
  if (value && typeof value === 'object' && (value as { mayConfigure?: unknown }).mayConfigure === true) {
    return 'Hồ sơ kế hoạch đang khóa chỉnh sửa. Liên hệ Quản lý lịch trình để xử lý yêu cầu chỉnh sửa theo quy trình xét duyệt.'
  }
  return programReadOnlyReason
}

/** Scheduled occurrences use their saved Cruise scope; independent catalogue editing stays separate. */
export function useActivityProgramAccess(cruiseId: string | null | undefined, catalogEntry = false) {
  const access = useSessionAccess()
  const requiresHandoff = access.roles.includes('ACTIVITY_SERVICE_MANAGER') && !catalogEntry
  const query = useReadQuery(`activity-program-access:${access.userId}:${cruiseId}:${requiresHandoff}`,
    useCallback(signal => requiresHandoff && cruiseId
      ? apiRequest<unknown>(`/cruise-work/${encodeURIComponent(cruiseId)}/program-context`, { signal })
      : Promise.resolve(null), [requiresHandoff, cruiseId]))
  return {
    editable: !requiresHandoff || Boolean(cruiseId && !query.loading && !query.error && programWriteAllowed(query.data)),
    reason: !requiresHandoff ? null : query.loading ? 'Đang kiểm tra quyền sửa chương trình…'
      : query.error ? 'Chưa kiểm tra được quyền sửa chương trình. Tải lại trước khi chỉnh sửa.'
      : programLockReason(query.data),
    retry: query.retry,
  }
}
