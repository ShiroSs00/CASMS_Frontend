import { ApiError } from '@/shared/api'
import { decodeSchedule } from './departure-contract'

export type DelayRequest = {
  delayMinutes: number
  reason: string
  category: string
  requestId: string
  expectedRevision: number
}

const invalid = () => new ApiError('Phản hồi dời giờ không đúng định dạng.', 502)
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
function string(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw invalid()
  return value
}
function integer(value: unknown, min = 0) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw invalid()
  return value
}
function instant(value: unknown) {
  const result = string(value)
  if (!Number.isFinite(Date.parse(result))) throw invalid()
  return result
}
function list<T>(value: unknown, decode: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw invalid()
  return value.map(decode)
}

export function delayFieldErrors(delayMinutes: number, reason: string, category: string) {
  return {
    delayMinutes: Number.isInteger(delayMinutes) && delayMinutes > 0 && delayMinutes <= 2147483647 ? undefined : 'Nhập số phút nguyên dương trong phạm vi cho phép.',
    reason: reason.trim() && reason.length <= 1000 ? undefined : 'Nhập lý do, tối đa 1.000 ký tự.',
    category: /^[A-Z][A-Z0-9_]{0,49}$/.test(category) ? undefined : 'Dùng tối đa 50 ký tự. Bắt đầu bằng chữ in hoa, sau đó dùng chữ in hoa, số hoặc dấu gạch dưới.',
  }
}

export function decodeDelayRequest(value: unknown): DelayRequest {
  const row = record(value)
  const request = {
    delayMinutes: integer(row.delayMinutes, 1),
    reason: string(row.reason),
    category: string(row.category),
    requestId: string(row.requestId),
    expectedRevision: integer(row.expectedRevision, 1),
  }
  if (Object.values(delayFieldErrors(request.delayMinutes, request.reason, request.category)).some(Boolean)
    || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(request.requestId)) throw invalid()
  return request
}

function portCheck(value: unknown) {
  const row = record(value)
  return { status: string(row.status), message: row.message == null ? null : string(row.message) }
}

export function decodeDelayBlockers(value: unknown) {
  const row = record(value)
  return { blockers: list(row.blockers, string), portWindowChecks: list(row.portWindowChecks, portCheck) }
}

export function decodeDelayPreview(value: unknown, revision: number) {
  const row = record(value)
  if (integer(row.revision, 1) !== revision) throw invalid()
  return {
    revision, evaluatedAt: instant(row.evaluatedAt), secondsUntilDeparture: integer(row.secondsUntilDeparture),
    ...decodeDelayBlockers(row), before: decodeSchedule(row.before), after: decodeSchedule(row.after),
  }
}
export type DelayPreview = ReturnType<typeof decodeDelayPreview>

function event(value: unknown, cruiseId: string) {
  const row = record(value)
  if (row.cruiseId !== cruiseId) throw invalid()
  return {
    eventId: string(row.eventId), requestId: string(row.requestId), createdBy: string(row.createdBy),
    createdAt: instant(row.createdAt), delayMinutes: integer(row.delayMinutes, 1),
    category: string(row.category), reason: string(row.reason), status: string(row.status),
    revision: integer(row.revision, 1), before: decodeSchedule(row.before), after: decodeSchedule(row.after),
  }
}
export type DelayEvent = ReturnType<typeof event>

export function matchesDelay(saved: DelayEvent, request: DelayRequest, userId: string) {
  return saved.requestId === request.requestId && saved.createdBy === userId
    && saved.delayMinutes === request.delayMinutes && saved.category === request.category && saved.reason === request.reason.trim()
}

export function decodeDelayEvent(value: unknown, cruiseId: string, request: DelayRequest, userId: string) {
  const saved = event(value, cruiseId)
  if (!matchesDelay(saved, request, userId)) throw invalid()
  return saved
}

export function decodeDelayHistory(value: unknown, cruiseId: string) {
  const row = record(value)
  return {
    originalDeparture: row.originalDeparture == null ? null : instant(row.originalDeparture),
    expectedDeparture: row.expectedDeparture == null ? null : instant(row.expectedDeparture),
    actualDeparture: row.actualDeparture == null ? null : instant(row.actualDeparture),
    totalDelayMinutes: integer(row.totalDelayMinutes), events: list(row.events, item => event(item, cruiseId)),
  }
}
