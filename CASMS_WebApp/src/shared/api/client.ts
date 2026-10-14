import { ApiPayloadError, apiErrorMetadata, apiPayloadMessage, extractApiData } from './response'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  signal?: AbortSignal
}
export class ApiError extends Error {
  status: number
  code?: string
  details?: Record<string, unknown>
  traceId?: string
  constructor(message: string, status: number, payload?: unknown) {
    const metadata = apiErrorMetadata(payload)
    super(`${message}${metadata.code ? ` [${metadata.code}]` : ''}${metadata.traceId ? ` · Trace: ${metadata.traceId}` : ''}`)
    this.name = 'ApiError'
    this.status = status
    this.code = metadata.code
    this.details = metadata.details
    this.traceId = metadata.traceId
  }
}

// A login provider may supply JWT in memory. Never store it in public VITE_* vars.
let accessToken: string | null = null
export function setApiAccessToken(token: string | null) { accessToken = token }
const baseUrl = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) query.set(key, String(value))
  }
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  const timeout = setTimeout(abort, 20000)
  try {
    const response = await fetch(`${baseUrl}${path}${query.size ? `?${query}` : ''}`, {
      method: options.method ?? 'GET', headers, signal: controller.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    if (response.status === 204 && response.ok) return undefined as T
    let payload: unknown = null
    let parsed = false
    try {
      payload = await response.json() as unknown
      parsed = true
    } catch { /* Do not render HTML error pages. */ }
    const message = apiPayloadMessage(payload)
    if (!response.ok) {
      throw new ApiError(response.status === 401 ? 'Cần đăng nhập với JWT hợp lệ hoặc phiên đăng nhập đã hết hạn.'
        : response.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
          : message || `Không thể thực hiện yêu cầu (HTTP ${response.status}).`, response.status, payload)
    }
    if (!parsed) throw new ApiError('Response API không phải JSON hợp lệ.', response.status)
    try {
      return extractApiData<T>(payload, response.status)
    } catch (error) {
      if (error instanceof ApiPayloadError) throw new ApiError(error.message, response.status, payload)
      throw error
    }
  } catch (error) {
    if (error instanceof ApiError || options.signal?.aborted) throw error
    if (controller.signal.aborted) throw new ApiError('Yêu cầu quá thời gian. Hãy thử lại.', 0)
    throw new ApiError('Không kết nối được backend. Kiểm tra server và cấu hình API.', 0)
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}
