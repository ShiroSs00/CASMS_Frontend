import { shipModelErrorMessage } from './ship-model-errors'
import { prepareCreateBody } from './create-body'
import { businessErrorMessage } from './business-errors'
import { apiPermissionRequirement, getSessionAccess, hasPermissions } from '@/shared/auth'

type ApiEnvelope<T> = { success: boolean; message?: string; error?: string; code?: string; data?: T; details?: unknown }
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  signal?: AbortSignal
  authenticated?: boolean
  timeoutMs?: number
  ifMatch?: number
  idempotencyKey?: string
  guestToken?: string
}
export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message); this.name = 'ApiError'; this.status = status; this.code = code; this.details = details
  }
}

// A login provider may supply JWT in memory. Never store it in public VITE_* vars.
let accessToken: string | null = null
let sessionGeneration = 0
const activeRequests = new Set<AbortController>()
export function setApiAccessToken(token: string | null) {
  if (token === accessToken) return
  accessToken = token
  sessionGeneration += 1
  activeRequests.forEach(controller => controller.abort())
}
const unauthorizedListeners = new Set<() => void>()
export function subscribeApiUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener)
  return () => { unauthorizedListeners.delete(listener) }
}
const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

/** Authenticated asset bytes; credentials are only sent through the configured API origin. */
export async function apiAsset(path: string, signal: AbortSignal, progress?: (loaded: number, total: number) => void, publicModel = false): Promise<ArrayBuffer> {
  if (!(publicModel ? /^\/ships\/[^/]+\/public-model\/[^/]+\/assets\/[\w./-]+\.glb$/.test(path) : /^\/ships\/[^/]+\/models\/[^/]+\/assets\//.test(path)) || path.includes('..') || /[?#\\]/.test(path)) throw new ApiError('Đường dẫn asset không hợp lệ.', 400)
  const token = publicModel ? null : accessToken, generation = sessionGeneration
  const required = apiPermissionRequirement(path)
  const checkAccess = () => {
    if (generation !== sessionGeneration) throw new ApiError('Phiên đăng nhập đã thay đổi. Dữ liệu của phiên cũ được bỏ qua.', 0, 'SESSION_CHANGED')
    if (!publicModel && (!token || !required || !hasPermissions(getSessionAccess(), required))) throw new ApiError('Bạn chưa được cấp quyền đọc asset mô hình.', token ? 403 : 401, 'ACCESS_DENIED')
  }
  checkAccess()
  const controller = new AbortController()
  const abort = () => controller.abort()
  activeRequests.add(controller)
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    checkAccess()
    if (!response.ok) {
      if (response.status === 401 && token === accessToken) unauthorizedListeners.forEach(listener => listener())
      throw new ApiError(response.status === 403 ? 'Bạn không có quyền đọc asset mô hình.' : `Không tải được asset (HTTP ${response.status}).`, response.status)
    }
    const total = Number(response.headers.get('content-length')) || 0
    if (!response.body) {
      const bytes = await response.arrayBuffer()
      checkAccess()
      controller.signal.throwIfAborted()
      return bytes
    }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []
    let loaded = 0, lastProgress = 0
    try {
      while (true) {
        const part = await reader.read()
        checkAccess()
        if (part.done) break
        chunks.push(part.value); loaded += part.value.length
        if (Date.now()-lastProgress>150) { progress?.(loaded,total);lastProgress=Date.now() }
      }
    } finally { reader.releaseLock() }
    checkAccess()
    controller.signal.throwIfAborted()
    progress?.(loaded,total)
    const bytes = new Uint8Array(loaded); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return bytes.buffer
  } catch (error) {
    if (generation !== sessionGeneration) throw new ApiError('Phiên đăng nhập đã thay đổi. Dữ liệu của phiên cũ được bỏ qua.', 0, 'SESSION_CHANGED')
    throw error
  } finally {
    activeRequests.delete(controller)
    signal.removeEventListener('abort', abort)
  }
}

async function request<T>(path: string, options: RequestOptions, decode: (payload: unknown, status: number) => T): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) query.set(key, String(value))
  }
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.ifMatch !== undefined) headers['If-Match'] = String(options.ifMatch)
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  if (options.guestToken) headers['X-Guest-Token'] = options.guestToken
  const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body !== undefined && !multipart) headers['Content-Type'] = 'application/json'
  const requestToken = options.authenticated === false ? null : accessToken
  const generation = sessionGeneration
  const required = options.authenticated === false ? null : apiPermissionRequirement(path, options.method)
  if (required && (!requestToken || !hasPermissions(getSessionAccess(), required))) throw new ApiError('Bạn chưa được cấp quyền thực hiện thao tác này.', requestToken ? 403 : 401, 'ACCESS_DENIED')
  if (requestToken) headers.Authorization = `Bearer ${requestToken}`
  const controller = new AbortController()
  activeRequests.add(controller)
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  const timeout = setTimeout(abort, options.timeoutMs ?? 20000)
  try {
    const response = await fetch(`${baseUrl}${path}${query.size ? `?${query}` : ''}`, {
      method: options.method ?? 'GET', headers, signal: controller.signal,
      body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(prepareCreateBody(path, options.method, options.body)),
    })
    if (generation !== sessionGeneration) throw new ApiError('Phiên đăng nhập đã thay đổi. Dữ liệu của phiên cũ được bỏ qua.', 0, 'SESSION_CHANGED')
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
      throw new ApiError(response.status === 401 ? 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.'
        : response.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
          : (shipModelErrorMessage(path,message) ?? businessErrorMessage(payload?.code ?? payload?.error,message)) || `Không thể thực hiện yêu cầu (HTTP ${response.status}).`, response.status, payload?.code ?? payload?.error, payload?.details ?? payload?.data)
    }
    if (generation !== sessionGeneration) throw new ApiError('Phiên đăng nhập đã thay đổi. Dữ liệu của phiên cũ được bỏ qua.', 0, 'SESSION_CHANGED')
    if (required && !hasPermissions(getSessionAccess(), required)) throw new ApiError('Quyền truy cập đã thay đổi. Vui lòng tải lại dữ liệu.', 403, 'ACCESS_DENIED')
    return decode(payload, response.status)
  } catch (error) {
    if (generation !== sessionGeneration) throw new ApiError('Phiên đăng nhập đã thay đổi. Dữ liệu của phiên cũ được bỏ qua.', 0, 'SESSION_CHANGED')
    if (error instanceof ApiError || options.signal?.aborted) throw error
    if (controller.signal.aborted) throw new ApiError(options.method && options.method !== 'GET' ? 'Chưa nhận được kết quả thao tác. Kiểm tra dữ liệu đã lưu trước khi gửi lại để tránh tạo trùng.' : 'Tải dữ liệu quá thời gian. Vui lòng tải lại.', 0)
    throw new ApiError(options.method && options.method !== 'GET' ? 'Kết nối bị gián đoạn. Chưa xác định được kết quả thao tác; kiểm tra dữ liệu đã lưu trước khi gửi lại.' : 'Không thể kết nối hệ thống. Kiểm tra kết nối mạng rồi tải lại dữ liệu.', 0)
  } finally {
    activeRequests.delete(controller)
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}

export function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request(path, options, (value, status) => {
    if (status === 204) return undefined as T
    const payload = value as ApiEnvelope<T> | null
    if (!payload || typeof payload.success !== 'boolean') throw new ApiError('Dữ liệu hệ thống trả về chưa hợp lệ. Chưa thể xác nhận kết quả thao tác.', status)
    const message = typeof payload.message === 'string' ? payload.message
      : typeof payload.error === 'string' ? payload.error : ''
    if (!payload.success) throw new ApiError((shipModelErrorMessage(path,message) ?? businessErrorMessage(payload.code ?? payload.error,message)) || 'Hệ thống chưa chấp nhận thao tác này.', status, payload.code ?? payload.error,payload.details??payload.data)
    return payload.data as T
  })
}

// Raw endpoints must supply their own runtime decoder; JWT handling stays here.
export function apiRequestRaw<T>(path: string, decode: (payload: unknown, status: number) => T, options: RequestOptions = {}): Promise<T> {
  return request(path, options, decode)
}
