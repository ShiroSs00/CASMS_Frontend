import { ApiError } from '@/shared/api'

/** A timeout or an unreadable success cannot prove a write was rejected. */
export function mutationOutcomeUnknown(error: unknown) {
  return !(error instanceof ApiError) || error.status === 0 || error.status === 408
    || error.status >= 500 || error.status >= 200 && error.status < 300
}
