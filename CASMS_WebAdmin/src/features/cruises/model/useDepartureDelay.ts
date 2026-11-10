import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/shared/api'
import { getSessionAccess, hasPermissions } from '@/shared/auth'
import { departureApi } from '../api/departure-api'
import { decodeDelayBlockers, decodeDelayRequest, matchesDelay, type DelayPreview, type DelayRequest } from './departure-delay-contract'

const emptyDraft = { minutes: '', reason: '', category: '' }
const rejected = ['STALE_CRUISE_REVISION', 'CRUISE_DELAY_BLOCKED', 'DEPARTURE_TIME_REACHED']
const delayPermission = { mode: 'ALL', permissions: ['CRUISE_START'], roles: ['OPERATIONS_MANAGER'] } as const
export const canSendDelay = () => hasPermissions(getSessionAccess(), delayPermission)

function loadPending(key: string) {
  try {
    const saved = sessionStorage.getItem(key)
    return { request: saved ? decodeDelayRequest(JSON.parse(saved)) : null, unavailable: false }
  } catch {
    return { request: null, unavailable: true }
  }
}

export function useDepartureDelay(id: string, userId: string, revision: number | null | undefined, eligible: boolean, onChanged: () => void) {
  const key = `ocevie:departure-delay:${userId}:${id}`
  const [pending, setPending] = useState(() => loadPending(key))
  const [draft, setDraft] = useState(emptyDraft)
  const [preview, setPreview] = useState<{ request: DelayRequest; data: DelayPreview; deadline: number } | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [success, setSuccess] = useState(false)
  const lock = useRef(false)
  const canConfirm = eligible && !pending.request && !pending.unavailable && preview !== null
    && preview.data.revision === revision && seconds > 0 && preview.data.blockers.length === 0

  useEffect(() => {
    if (!preview) return
    const timer = window.setInterval(() => setSeconds(Math.max(0, Math.ceil((preview.deadline - performance.now()) / 1000))), 250)
    return () => window.clearInterval(timer)
  }, [preview])

  function reset() {
    setDraft(emptyDraft)
    setPreview(null)
    setError(null)
    setSuccess(false)
  }

  function change(field: keyof typeof draft, value: string) {
    if (lock.current || pending.request) return
    setDraft(previous => ({ ...previous, [field]: value }))
    setPreview(null)
    setError(null)
    setSuccess(false)
  }

  async function run(operation: () => Promise<void>) {
    if (lock.current || !canSendDelay() || getSessionAccess().userId !== userId) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await operation()
    } catch (cause) {
      const fault = cause instanceof ApiError ? cause : new ApiError('Chưa nhận được kết quả từ hệ thống.', 0)
      setError(fault)
      if (fault.code === 'STALE_CRUISE_REVISION' || fault.code === 'DEPARTURE_TIME_REACHED') onChanged()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  function requestPreview() {
    if (!eligible || !revision || pending.request || pending.unavailable) return
    void run(async () => {
      setPreview(null)
      const request = decodeDelayRequest({
        delayMinutes: Number(draft.minutes), reason: draft.reason.trim(), category: draft.category,
        requestId: crypto.randomUUID(), expectedRevision: revision,
      })
      const started = performance.now()
      const data = await departureApi.previewDelay(id, request)
      // Count from request start so transport time can only shorten the confirmation window.
      const deadline = started + data.secondsUntilDeparture * 1000
      setSeconds(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)))
      setPreview({ request, data, deadline })
    })
  }

  function clearPending() {
    sessionStorage.removeItem(key)
    setPending({ request: null, unavailable: false })
  }

  function complete() {
    clearPending()
    setDraft(emptyDraft)
    setPreview(null)
    setSuccess(true)
    onChanged()
  }

  function confirm() {
    const retry = pending.request
    const request = retry ?? preview?.request
    if (!request || (!retry && (!canConfirm || !preview || performance.now() >= preview.deadline))) return
    void run(async () => {
      if (!retry) {
        try {
          sessionStorage.setItem(key, JSON.stringify(request))
        } catch {
          setPending({ request: null, unavailable: true })
          return
        }
        setPending({ request, unavailable: false })
      }
      setPreview(null)
      try {
        await departureApi.confirmDelay(id, request, userId)
      } catch (cause) {
        // The server checks for an existing successful request before checking revision or blockers.
        if (cause instanceof ApiError && (rejected.includes(cause.code ?? '') || (!retry && cause.status === 400))) clearPending()
        throw cause
      }
      complete()
    })
  }

  function checkHistory() {
    const request = pending.request
    if (!request || !getSessionAccess().permissions.includes('CRUISE_READ')) return
    void run(async () => {
      const history = await departureApi.delayHistory(id)
      if (history.events.some(saved => matchesDelay(saved, request, userId))) complete()
      else throw new ApiError('Chưa tìm thấy yêu cầu này trong lịch sử. Chọn kiểm tra lại yêu cầu để nhận kết quả.', 0)
    })
  }

  let rejection: ReturnType<typeof decodeDelayBlockers> | null = null
  if (error?.code === 'CRUISE_DELAY_BLOCKED') {
    try { rejection = decodeDelayBlockers(error.details) } catch { /* The error message remains available. */ }
  }
  return { draft, change, reset, preview, seconds, canConfirm, requestPreview, confirm, checkHistory, busy, pending, error, rejection, success }
}
