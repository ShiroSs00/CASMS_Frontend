import type { Placement, PlacementBlocker, ReviewDetails, StaffingAction, StaffingRequest } from './staffing-api'

export const placementGuidance: Record<PlacementBlocker, string> = {
  SERVICE_INACTIVE: 'Quản lý danh mục cần kiểm tra trạng thái hoạt động của dịch vụ.',
  SHIP_MODEL_REQUIRED: 'Quản lý tàu cần hoàn tất mô hình tàu sẵn sàng sử dụng.',
  DECK_SERVICE_REQUIRED: 'Quản lý tàu cần gán dịch vụ cho boong phù hợp.',
  AREA_SERVICE_REQUIRED: 'Quản lý tàu cần gán dịch vụ cho khu vực phục vụ trên boong.',
  SERVICE_AREA_POS_REQUIRED: 'Quản lý tàu cần liên kết máy POS đang hoạt động với khu vực phục vụ.',
  SERVICE_POS_PERMISSION_REQUIRED: 'Người phụ trách cấu hình POS cần cấp quyền đọc dịch vụ cho máy tại khu vực.',
  ACTIVE_AREA_POS_SELECTION_REQUIRED: 'Quản lý tàu cần mở khu vực và chọn đúng máy POS đã cấu hình cho dịch vụ.',
}

export function shipReviewReady(details: ReviewDetails) {
  return details.request.workflowVersion !== 'V2' || details.shipPlanReady === true
}

export function placementKey(placement: Placement) {
  return `${placement.areaId}:${placement.terminalId}`
}

export function servicePlacementChoices(details: ReviewDetails, service: ReviewDetails['plannedServices'][number]) {
  if (details.request.workflowVersion === 'V2') return service.eligiblePlacements ?? []
  return details.areas.flatMap(area => service.eligibleAreaIds.includes(area.areaId)
    ? area.terminals.slice(0, 1).map(terminal => ({ areaId: area.areaId, terminalId: terminal.terminalId }))
    : [])
}

export function resetImpactCopy(request: StaffingRequest, action: 'save' | StaffingAction) {
  const impact = request.planResetImpact
  if (request.workflowVersion !== 'V2' || !impact) return ''
  const replacesNeeds = action === 'save' && impact.needsToReplaceOnSave > 0
  const clearsAssignments = impact.assignmentsToClear > 0
    && ['save', 'SHIP_RETURN_ASM', 'HR_RETURN_SHIP', 'CRM_RETURN_SHIP'].includes(action)
  return [
    replacesNeeds ? `Phương án mới sẽ thay thế ${impact.needsToReplaceOnSave} nhu cầu nhân sự hiện tại.` : '',
    clearsAssignments ? `Thao tác sẽ gỡ ${impact.assignmentsToClear} phân công theo nhu cầu.` : '',
  ].filter(Boolean).join(' ')
}

export function requiresReviewReload(code?: string) {
  return code === 'STAFFING_REVISION_CONFLICT' || code === 'STAFFING_SHIP_REVIEW_STALE'
    || code === 'STAFFING_SERVICE_POS_PERMISSION_REQUIRED' || code === 'STAFFING_POS_PLACEMENT_OUT_OF_SCOPE'
}
