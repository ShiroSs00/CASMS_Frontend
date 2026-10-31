import { ApiError } from '@/shared/api'
import type { CruiseDraft, CruiseRecord } from './cruise-record'

type RecordState = { owner: string; key: string; payload: CruiseDraft; status: 'sending' | 'unknown' | 'rejected' | 'succeeded'; cruiseId?: string }
type IntentStorage = Pick<Storage, 'getItem' | 'setItem'>

/** One user intent, one immutable payload/key. Recovery never creates a new intent. */
export function cruiseCreateIntent(owner: string, storage?: IntentStorage) {
  const storageKey = 'ocvviet:cruise-create:v1:' + owner
  let record: RecordState | null = null, storageError = false
  let inFlight: Promise<CruiseRecord> | null = null
  try {
    const raw = storage?.getItem(storageKey)
    if (raw && raw !== 'null') {
      const parsed = JSON.parse(raw) as RecordState
      const payload=parsed?.payload
      if (parsed?.owner !== owner || !parsed.key || !payload || !['cruiseName','cruiseCode','departureDatetime','returnDatetime','departurePortId','returnPortId','cruiseType'].every(key=>typeof payload[key as keyof CruiseDraft]==='string') || !['sending','unknown','rejected','succeeded'].includes(parsed.status) || parsed.status==='succeeded'&&typeof parsed.cruiseId!=='string') throw Error('Invalid intent')
      record = { ...parsed, status: parsed.status === 'sending' ? 'unknown' : parsed.status }
    }
  } catch { storageError = true }
  function persist() {
    try { storage?.setItem(storageKey, JSON.stringify(record)) } catch { storageError = true }
  }
  return {
    owner,
    get record() { return record },
    get storageError() { return storageError },
    startNew() {
      if (inFlight || record?.status === 'unknown' || record?.status === 'sending' || storageError) return false
      record = null; persist(); return !storageError
    },
    execute(payload: CruiseDraft, send: (payload: CruiseDraft, key: string) => Promise<CruiseRecord>) {
      if (inFlight) return inFlight
      if (storageError) return Promise.reject(new ApiError('Chưa đọc hoặc lưu được thông tin thao tác tạo. Đối chiếu danh sách trước khi tiếp tục.', 0))
      if (record?.status === 'succeeded') return Promise.reject(new ApiError('Yêu cầu này đã tạo chuyến khởi hành. Hãy mở bản ghi đã lưu.', 409))
      if (record && record.status !== 'rejected' && JSON.stringify(record.payload) !== JSON.stringify(payload)) return Promise.reject(new ApiError('Kết quả tạo trước chưa xác định. Chỉ được gửi lại đúng bản nhập và mã thao tác cũ.', 409))
      if (!record || record.status === 'rejected' && JSON.stringify(record.payload) !== JSON.stringify(payload)) {
        record = { owner, key: crypto.randomUUID(), payload: structuredClone(payload), status: 'sending' }
      } else record = { ...record, status: 'sending' }
      persist()
      if (storageError) return Promise.reject(new ApiError('Chưa lưu được thông tin thao tác; chưa gửi yêu cầu tạo.', 0))
      const intent = record
      inFlight = Promise.resolve().then(() => send(structuredClone(intent.payload), intent.key)).then(saved => {
        record = { ...intent, status: 'succeeded', cruiseId: saved.cruiseId }; persist(); return saved
      }).catch(error => {
        const rejected = error instanceof ApiError && [400,404,422].includes(error.status)
        record = { ...intent, status: rejected ? 'rejected' : 'unknown' }; persist(); throw error
      }).finally(() => { inFlight = null })
      return inFlight
    },
  }
}
