import { prepareCreateBody } from './create-body'

type ApiEnvelope<T> = { success: boolean; message?: string; error?: string; code?: string; data?: T }
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  signal?: AbortSignal
  authenticated?: boolean
  timeoutMs?: number
}
export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message); this.name = 'ApiError'; this.status = status; this.code = code
  }
}

// A login provider may supply JWT in memory. Never store it in public VITE_* vars.
let accessToken: string | null = null
export function setApiAccessToken(token: string | null) { accessToken = token }
const unauthorizedListeners = new Set<() => void>()
export function subscribeApiUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener)
  return () => { unauthorizedListeners.delete(listener) }
}
const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function request<T>(path: string, options: RequestOptions, decode: (payload: unknown, status: number) => T): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) query.set(key, String(value))
  }
  const headers: Record<string, string> = { Accept: 'application/json' }
  const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body !== undefined && !multipart) headers['Content-Type'] = 'application/json'
  const requestToken = options.authenticated === false ? null : accessToken
  if (requestToken) headers.Authorization = `Bearer ${requestToken}`
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  const timeout = setTimeout(abort, options.timeoutMs ?? 20000)
  try {
    const response = await fetch(`${baseUrl}${path}${query.size ? `?${query}` : ''}`, {
      method: options.method ?? 'GET', headers, signal: controller.signal,
      body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(prepareCreateBody(path, options.method, options.body)),
    })
    if (response.status === 204 && response.ok) return decode(undefined, response.status)
    let payload: ApiEnvelope<T> | null = null
    try { payload = await response.json() as ApiEnvelope<T> } catch { /* Do not render HTML error pages. */ }
    const message = typeof payload?.message === 'string' ? payload.message
      : typeof payload?.error === 'string' ? payload.error : ''
    if (!response.ok) {
      // Ignore late 401s from an older session and unauthenticated login requests.
      if (response.status === 401 && requestToken && requestToken === accessToken) {
        unauthorizedListeners.forEach((listener) => listener())
      }
      throw new ApiError(response.status === 401 ? 'Cần đăng nhập với JWT hợp lệ hoặc phiên đăng nhập đã hết hạn.'
        : response.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
          : message || `Không thể thực hiện yêu cầu (HTTP ${response.status}).`, response.status, payload?.code ?? payload?.error)
    }
    return decode(payload, response.status)
  } catch (error) {
    if (error instanceof ApiError || options.signal?.aborted) throw error
    if (controller.signal.aborted) throw new ApiError('Yêu cầu quá thời gian. Hãy thử lại.', 0)
    throw new ApiError('Không kết nối được backend. Kiểm tra server và cấu hình API.', 0)
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}

export function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request(path, options, (value, status) => {
    if (status === 204) return undefined as T
    const payload = value as ApiEnvelope<T> | null
    if (!payload || typeof payload.success !== 'boolean') throw new ApiError('Response API không đúng định dạng đã công bố.', status)
    const message = typeof payload.message === 'string' ? payload.message
      : typeof payload.error === 'string' ? payload.error : ''
    if (!payload.success) throw new ApiError(message || 'Backend từ chối thao tác.', status, payload.code ?? payload.error)
    return payload.data as T
  })
}

// Raw endpoints must supply their own runtime decoder; JWT handling stays here.
export function apiRequestRaw<T>(path: string, decode: (payload: unknown, status: number) => T, options: RequestOptions = {}): Promise<T> {
  return request(path, options, decode)
}
