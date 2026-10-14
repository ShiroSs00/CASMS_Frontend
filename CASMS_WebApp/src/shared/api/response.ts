export type ApiEnvelope<T> = {
  success: boolean
  message?: string
  error?: string
  data?: T
  code?: string
  details?: Record<string, unknown>
  traceId?: string
}

export class ApiPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiPayloadError'
  }
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean'
  )
}

export function apiPayloadMessage(value: unknown) {
  if (typeof value !== 'object' || value === null) return ''
  if ('message' in value && typeof value.message === 'string') return value.message
  if ('error' in value && typeof value.error === 'string') return value.error
  return ''
}

export function apiErrorMetadata(value: unknown) {
  if (typeof value !== 'object' || value === null) return {}
  return {
    code: 'code' in value && typeof value.code === 'string' ? value.code : undefined,
    traceId: 'traceId' in value && typeof value.traceId === 'string' ? value.traceId : undefined,
    details: 'details' in value && typeof value.details === 'object' && value.details !== null
      ? value.details as Record<string, unknown> : undefined,
  }
}

/**
 * Current OIM/Regulation controllers use ApiResponse<T>; raw DTO support is
 * retained for compatibility with other consumers of this shared transport.
 */
export function extractApiData<T>(payload: unknown, status: number): T {
  if (isEnvelope(payload)) {
    if (!payload.success) {
      throw new ApiPayloadError(apiPayloadMessage(payload) || 'Backend từ chối thao tác.')
    }
    return payload.data as T
  }

  if (status >= 200 && status < 300) return payload as T
  throw new ApiPayloadError(apiPayloadMessage(payload) || `HTTP ${status}`)
}
