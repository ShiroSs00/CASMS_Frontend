import { ApiError, apiRequestRaw } from '@/shared/api'
import { decodeCruisePackageCatalog } from './purchase-contract'
function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu gói du thuyền không đúng định dạng.')
  return value as Record<string, unknown>
}
function request<T>(path: string, decode: (value: unknown) => T, options: { method?: 'POST'; body?: unknown; signal?: AbortSignal } = {}) {
  return apiRequestRaw(path,(value,statusCode)=>{
    try { const envelope=row(value); if (envelope.success!==true) throw new Error('Server chưa xác nhận kết quả.'); return decode(envelope.data) }
    catch (error) { throw new ApiError(error instanceof Error?error.message:'Không đọc được dữ liệu gói du thuyền.',statusCode) }
  },options)
}
// Public purchase catalogue; administrative template/price APIs live in WebAdmin.
export const cruisePackageApi = {
  available: (cruiseId: string, signal?: AbortSignal) => request(`/cruise/${encodeURIComponent(cruiseId)}/cruise-package-offers/available`, value => decodeCruisePackageCatalog(value, cruiseId), { signal }),
}
