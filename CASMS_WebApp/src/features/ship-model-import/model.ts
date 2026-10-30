import type { PermissionRequirement } from '@/shared/auth'
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
export type ImportSession = {
  modelKey: string; assetVersion: string; fileName: string; uploaded: boolean
  registration: Registration | null; job: ImportJob | null
}
export const emptySession: ImportSession = { modelKey: '', assetVersion: '', fileName: '', uploaded: false, registration: null, job: null }
export const importRequirements = {
  upload: { mode: 'ALL', permissions: ['SHIP_UPDATE'] },
  register: { mode: 'ALL', permissions: ['SHIP_MODEL_CREATE','SHIP_CREATE'] },
  import: { mode: 'ALL', permissions: ['SHIP_UPDATE'] },
} satisfies Record<string, PermissionRequirement>
export function bundleLabel(session: ImportSession) {
  if (['Gói đã lưu trên hệ thống', 'Gói đã tải (chờ kiểm tra)'].includes(session.fileName)) {
    return session.registration ? 'Gói đã lưu trên hệ thống' : 'Gói đã tải (chờ kiểm tra)'
  }
  return session.fileName
}
export function validateBundle(modelKey: string, assetVersion: string, file: { name: string; size: number } | null, stored: boolean) {
  const errors: Record<string, string> = {}
  if (!/^[a-z0-9-]{1,80}$/.test(modelKey)) errors.modelKey = 'Nhập mã từ 1–80 ký tự: chữ thường, chữ số hoặc dấu gạch ngang.'
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(assetVersion) || ['.', '..'].includes(assetVersion)) errors.assetVersion = 'Nhập phiên bản từ 1–80 ký tự: chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.'
  if (!stored && (!file || !/\.zip$/i.test(file.name) || file.size <= 0 || file.size > 2 * 1024 ** 3)) errors.file = 'Chọn gói ZIP có dữ liệu, dung lượng tối đa 2 GB.'
  return errors
}
export function jobLabel(status: ImportJob['status']) {
  return { RUNNING: 'Đang nhập dữ liệu', SUCCEEDED: 'Nhập thành công', PARTIAL: 'Đã nhập một phần', FAILED: 'Nhập không thành công' }[status]
}
export function issueMessage(code: string, fallback: string) {
  const messages: Record<string, string> = {
    MANIFEST_GLB_MISMATCH: 'Thông tin trong manifest chưa khớp với mô hình 3D. Kiểm tra lại dữ liệu và xuất lại gói.',
    INVALID_DECK_ID: 'Mã boong bị thiếu hoặc trùng trong gói dữ liệu.',
    INVALID_CABIN_ID: 'Mã phòng bị thiếu hoặc trùng trong gói dữ liệu.',
    INVALID_DECK_NUMBER: 'Số boong nằm ngoài phạm vi được khai báo cho tàu.',
    UNKNOWN_DECK: 'Phòng thuộc một boong chưa được nhập thành công. Kiểm tra lỗi của boong trước.',
    INVALID_CABIN_TYPE: 'Loại phòng bị thiếu hoặc chưa được hệ thống hỗ trợ.',
    INVALID_CAPACITY: 'Sức chứa của phòng phải là số nguyên lớn hơn 0.',
    MISSING_ACCESSIBILITY: 'Thiếu thông tin phòng có hỗ trợ người khuyết tật hay không.',
    CABIN_DECK_CONFLICT: 'Số phòng này đã tồn tại trên một boong khác của tàu.',
    NODE_TYPE_CONFLICT: 'Mã đối tượng đã được dùng cho một loại đối tượng khác trong mô hình.',
  }
  return messages[code] ?? fallback
}
export function restoreSession(raw: string | null): ImportSession | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as ImportSession
    if (!value || typeof value.modelKey !== 'string' || typeof value.assetVersion !== 'string' || typeof value.fileName !== 'string' || value.uploaded !== true) return null
    if (Object.keys(validateBundle(value.modelKey, value.assetVersion, null, true)).length) return null
    if (value.registration && (typeof value.registration.shipId !== 'string' || typeof value.registration.shipModelId !== 'string' || typeof value.registration.shipCreated !== 'boolean')) return null
    // Re-read persisted jobs from the server, never trust a cached completion status.
    return { ...value, job: null }
  } catch { return null }
}
