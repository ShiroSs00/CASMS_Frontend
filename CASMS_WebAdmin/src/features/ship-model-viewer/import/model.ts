import type { PermissionRequirement } from '@/shared/auth'
import { ApiError } from '@/shared/api'
export type ImportJob = {
  jobId: string; shipId: string; modelId: string
  status: 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED'
  startedAt: string; finishedAt: string | null; requestedBy: string | null
  totalObjects: number; decksImported: number; cabinsImported: number
  objectsSucceeded: number; objectsFailed: number; objectsSkipped: number
  errorMessage: string | null
}
export type ImportIssue = { issueId: string; objectIdentifier: string | null; objectType: string; errorCode: string; message: string }
export type Registration = { shipId: string; shipModelId: string; shipCreated: boolean }
export type ModelScope = Pick<Registration, 'shipId' | 'shipModelId'>
export type ImportSession = {
  modelKey: string; fileName: string; uploaded: boolean
  registration: Registration | null; job: ImportJob | null
  pendingStructure?: string[]
  scope?: string; attemptId?: string; previewFingerprint?: string
}
export const emptySession: ImportSession = { modelKey: '', fileName: '', uploaded: false, registration: null, job: null }
export const importSteps = ['Chọn mô hình 3D', 'Xác nhận thông tin tàu', 'Import cấu trúc tàu']
export const importRequirements = {
  upload: { mode: 'ALL', permissions: ['SHIP_MODEL_CREATE'] },
  register: { mode: 'ALL', permissions: ['SHIP_MODEL_CREATE','SHIP_CREATE'] },
  import: { mode: 'ALL', permissions: ['SHIP_MODEL_UPDATE'] },
} satisfies Record<string, PermissionRequirement>
export function bundleLabel(session: ImportSession) {
  if (['Gói đã lưu trên hệ thống', 'Gói đã tải (chờ kiểm tra)'].includes(session.fileName)) {
    return session.registration ? 'Gói đã lưu trên hệ thống' : 'Gói đã tải (chờ kiểm tra)'
  }
  return session.fileName
}
export function validateZip(file: { name: string; size: number } | null) {
  if (!file) return 'Chọn một tệp ZIP.'
  if (!/\.zip$/i.test(file.name) || file.size <= 0) return 'Chọn tệp ZIP có dữ liệu.'
  if (file.size > 2 * 1024 ** 3) return 'Tệp vượt quá 2 GB. Chọn tệp ZIP nhỏ hơn.'
  return ''
}
export function validateBundle(modelKey: string, file: { name: string; size: number } | null, stored: boolean) {
  const errors: Record<string, string> = {}
  if (!/^[a-z0-9-]{1,80}$/.test(modelKey)) errors.modelKey = 'Nhập mã từ 1–80 ký tự: chữ thường, chữ số hoặc dấu gạch ngang.'
  const zipError = stored ? '' : validateZip(file)
  if (zipError) errors.file = zipError
  return errors
}
export function jobLabel(status: ImportJob['status']) {
  return { RUNNING: 'Đang import dữ liệu', SUCCEEDED: 'Import thành công', PARTIAL: 'Đã import một phần', FAILED: 'Import không thành công' }[status]
}
export function issueMessage(code: string, fallback: string) {
  const messages: Record<string, string> = {
    MANIFEST_GLB_MISMATCH: 'Thông tin trong manifest chưa khớp với mô hình 3D. Kiểm tra lại dữ liệu và xuất lại gói.',
    INVALID_DECK_ID: 'Mã boong bị thiếu hoặc trùng trong gói dữ liệu.',
    INVALID_CABIN_ID: 'Mã phòng bị thiếu hoặc trùng trong gói dữ liệu.',
    INVALID_DECK_NUMBER: 'Số boong nằm ngoài phạm vi được khai báo cho tàu.',
    UNKNOWN_DECK: 'Phòng thuộc một boong chưa được import thành công. Kiểm tra lỗi của boong trước.',
    INVALID_CABIN_TYPE: 'Loại phòng bị thiếu hoặc chưa được hệ thống hỗ trợ.',
    INVALID_CAPACITY: 'Sức chứa của phòng phải là số nguyên lớn hơn 0.',
    MISSING_ACCESSIBILITY: 'Thiếu thông tin phòng có hỗ trợ người khuyết tật hay không.',
    CABIN_DECK_CONFLICT: 'Số phòng này đã tồn tại trên một boong khác của tàu.',
    NODE_TYPE_CONFLICT: 'Mã đối tượng đã được dùng cho một loại đối tượng khác trong mô hình.',
    INVALID_AREA: 'Thông tin hoặc hình học khu vực vật lý không hợp lệ.',
    INVALID_AREA_NAME: 'Tên khu vực vượt quá 200 ký tự.',
    INVALID_AREA_SIZE: 'Kích thước các chiều của khu vực phải lớn hơn 0.',
    INVALID_AREA_TRANSFORM: 'Vị trí, tỷ lệ hoặc hướng của khu vực trong GLB không hợp lệ.',
  }
  return messages[code] ?? fallback
}
export function importOutcomeUnknown(error: unknown) {
  return !(error instanceof ApiError) || error.status === 0 || error.status === 408 || error.status >= 500 || error.status < 400
}
export function rejectedImportIssues(error: unknown): ImportIssue[] {
  if (!(error instanceof ApiError) || error.status !== 422 || error.code !== 'SHIP_MODEL_IMPORT_REJECTED') return []
  const details = error.details
  if (!details || typeof details !== 'object' || !('issues' in details) || !Array.isArray(details.issues)) return []
  return details.issues.filter((issue): issue is ImportIssue =>
    !!issue && typeof issue.issueId === 'string' && typeof issue.objectType === 'string'
    && typeof issue.errorCode === 'string' && typeof issue.message === 'string'
    && (issue.objectIdentifier == null || typeof issue.objectIdentifier === 'string'))
}
export function importErrorText(error: unknown) {
  if (error instanceof ApiError && error.status === 0 && !error.code) return error.message
  if (error instanceof ApiError && error.status >= 500) {
    const trace = error.traceId ? ` Mã tra cứu ${error.traceId}.` : ''
    return `Máy chủ trả về HTTP ${error.status}. Chưa xác nhận được kết quả. Kiểm tra dữ liệu trước khi gửi lại.${trace}`
  }
  if (importOutcomeUnknown(error)) return 'Chưa xác định được kết quả. Kiểm tra lại dữ liệu trước khi gửi yêu cầu khác.'
  if (!(error instanceof ApiError)) return 'Không thể xử lý gói mô hình.'
  if (error.status === 413) return 'Tệp vượt quá giới hạn tải của máy chủ. Chọn gói ZIP nhỏ hơn.'
  if (error.status === 422 && error.code === 'SHIP_MODEL_IMPORT_REJECTED') return 'Gói có đối tượng không hợp lệ. Hệ thống đã từ chối lần import này.'
  return error.message
}
export function validRegistration(value: unknown): value is Registration {
  const row = value as Registration | null
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return !!row && uuid.test(row.shipId) && uuid.test(row.shipModelId) && row.shipCreated === true
}
export function restoreSession(raw: string | null, scope?: string): ImportSession | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as ImportSession
    if (!scope || value?.scope !== scope || typeof value.attemptId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.attemptId)) return null
    if (!value || typeof value.modelKey !== 'string' || typeof value.fileName !== 'string' || value.uploaded !== true) return null
    if (Object.keys(validateBundle(value.modelKey, null, true)).length) return null
    if (value.registration && !validRegistration(value.registration)) return null
    if (value.previewFingerprint !== undefined && !/^[0-9a-f]{64}$/.test(value.previewFingerprint)) return null
    if (value.registration && !value.previewFingerprint) return null
    if (value.pendingStructure && (!Array.isArray(value.pendingStructure) || !value.pendingStructure.every(id => typeof id === 'string'))) return null
    // Re-read persisted jobs from the server, never trust a cached completion status.
    const { modelKey, fileName, uploaded, registration, pendingStructure, attemptId, previewFingerprint } = value
    return { modelKey, fileName, uploaded, registration: registration ?? null, pendingStructure, attemptId, scope, previewFingerprint, job: null }
  } catch { return null }
}

export function importStage(session: ImportSession, verified: boolean) {
  return !session.uploaded ? 0 : session.registration && verified ? 2 : 1
}
