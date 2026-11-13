import { apiRequest } from '@/shared/api'

export const windowDays = [
  ['MONDAY', 'Thứ hai'], ['TUESDAY', 'Thứ ba'], ['WEDNESDAY', 'Thứ tư'],
  ['THURSDAY', 'Thứ năm'], ['FRIDAY', 'Thứ sáu'], ['SATURDAY', 'Thứ bảy'], ['SUNDAY', 'Chủ nhật'],
] as const

export type WindowDraft = {
  windowType: 'ARRIVAL' | 'DEPARTURE'
  validFrom: string
  validTo: string | null
  daysOfWeek: Array<typeof windowDays[number][0]>
  localStartTime: string
  localEndTime: string
  sourceType: 'PORT_AUTHORITY' | 'PORT_AGENT'
  sourceReference: string
  sourceEffectiveDate: string | null
  overnightAllowed: boolean | null
  maxStayMinutes: number | null
}

export type PortWindow = WindowDraft & {
  windowId: string
  revision: number
  verificationStatus: 'VERIFIED' | 'UNVERIFIED'
  lifecycleStatus: 'ACTIVE' | 'INACTIVE'
  verifiedTimeZoneId: string | null
}

type Directory = { portId: string; portTimeZoneId: string; windows: PortWindow[] }
type History = { content: { auditId: string; occurredAt: string; action: string }[]; last: boolean }
const path = (port: string) => `/ports/${encodeURIComponent(port)}/call-windows`
const item = (port: string, window: PortWindow) => `${path(port)}/${encodeURIComponent(window.windowId)}`

export const portWindowApi = {
  list: (port: string, signal?: AbortSignal) => apiRequest<Directory>(path(port), { signal }),
  save: (port: string, draft: WindowDraft, window: PortWindow | null) => apiRequest<PortWindow>(
    window ? item(port, window) : path(port),
    { method: window ? 'PUT' : 'POST', body: { ...draft, expectedRevision: window?.revision ?? null } },
  ),
  verify: (port: string, window: PortWindow) => apiRequest<PortWindow>(item(port, window) + '/verify',
    { method: 'POST', body: { expectedRevision: window.revision } }),
  lifecycle: (port: string, window: PortWindow) => apiRequest<PortWindow>(item(port, window) + '/lifecycle',
    { method: 'PATCH', body: { expectedRevision: window.revision, lifecycleStatus: window.lifecycleStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } }),
  history: (port: string, window: PortWindow, page: number, signal?: AbortSignal) => apiRequest<History>(
    item(port, window) + '/history', { query: { page, size: 10, sort: 'occurredAt,desc' }, signal },
  ),
}

export function validateWindow(draft: WindowDraft) {
  if (!draft.daysOfWeek.length) return 'Chọn ít nhất một ngày trong tuần.'
  if (draft.localStartTime >= draft.localEndTime) return 'Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.'
  if (draft.validTo && draft.validFrom > draft.validTo) return 'Ngày kết thúc hiệu lực phải từ ngày bắt đầu trở đi.'
  if (!draft.sourceReference) return 'Nhập văn bản hoặc thông tin xác nhận từ nguồn.'
  return ''
}
