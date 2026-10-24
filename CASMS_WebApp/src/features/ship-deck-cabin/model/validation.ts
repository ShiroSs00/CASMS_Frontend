import type { CabinDraft, DataSnapshot, DeckDraft, FieldErrors, ShipDraft } from './types'
import { cabinStatuses, cabinTypes } from './types.ts'
const positive = (value: number | ''): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0

// Form-level shape/required validation. Backend remains authoritative for business rules.
export function validateShip(draft: ShipDraft): FieldErrors {
  const errors: FieldErrors = {}
  const code = draft.code.trim()
  if (code && !/^[A-Z0-9-]{3,20}$/.test(code)) errors.code = 'Mã tàu phải từ 3 đến 20 ký tự (chữ in hoa, số và dấu gạch nối, VD: OCV-GRAND-01).'
  
  const name = draft.name.trim()
  if (!name) errors.name = 'Vui lòng nhập tên tàu.'
  else if (name.length < 2 || name.length > 100) errors.name = 'Tên tàu phải từ 2 đến 100 ký tự.'

  if (!positive(draft.capacity)) errors.capacity = 'Sức chứa phải là số nguyên dương.'
  else if (draft.capacity > 50000) errors.capacity = 'Sức chứa không được vượt quá 50,000 hành khách.'

  if (!positive(draft.totalDecks)) errors.totalDecks = 'Số boong phải là số nguyên dương.'
  else if (draft.totalDecks > 40) errors.totalDecks = 'Số boong không được vượt quá 40 boong.'

  if (draft.commissionDate && (Number.isNaN(Date.parse(draft.commissionDate)) || new Date(draft.commissionDate).getFullYear() < 1900 || new Date(draft.commissionDate).getFullYear() > 2100)) {
    errors.commissionDate = 'Ngày đưa vào hoạt động không hợp lệ.'
  }

  return errors
}
const deckContextUnavailable = 'Chưa có đủ dữ liệu tàu và boong để kiểm tra. Vui lòng tải lại dữ liệu.'
export function deckValidationContextError(data: DataSnapshot | null | undefined): string {
  if (!data || !Array.isArray(data.ships) || !Array.isArray(data.decks)) return deckContextUnavailable
  if (!data.ships.every(row => row && typeof row.id === 'string' && row.id.length > 0 && positive(row.totalDecks) && row.totalDecks <= 2147483647)
    || !data.decks.every(row => row && typeof row.id === 'string' && row.id.length > 0 && typeof row.shipId === 'string' && row.shipId.length > 0 && positive(row.number) && row.number <= 2147483647)) return deckContextUnavailable
  if (new Set(data.ships.map(row => row.id)).size !== data.ships.length || new Set(data.decks.map(row => row.id)).size !== data.decks.length) return deckContextUnavailable
  return ''
}

export function validateDeck(draft: DeckDraft, data: DataSnapshot | null | undefined, currentDeckId?: string): FieldErrors {
  const errors: FieldErrors = {}
  if ((currentDeckId || draft.number !== '') && !positive(draft.number)) errors.number = 'Số boong phải là số nguyên dương.'
  if (typeof draft.name !== 'string') errors.name = 'Tên boong không hợp lệ.'
  else if (draft.name.length > 50) errors.name = 'Tên boong không được vượt quá 50 ký tự.'
  if (draft.priceMultiplier !== undefined) {
    if (typeof draft.priceMultiplier !== 'number' || Number.isNaN(draft.priceMultiplier) || draft.priceMultiplier < 0.50 || draft.priceMultiplier > 5.00) {
      errors.priceMultiplier = 'Hệ số giá tầng phải là số từ 0.50 đến 5.00 (mặc định 1.00).'
    }
  }
  const contextError = deckValidationContextError(data)
  if (!data || contextError) return { ...errors, shipId: contextError || deckContextUnavailable }
  const ship = data.ships.find(row => row.id === draft.shipId)
  if (!ship) errors.shipId = 'Vui lòng chọn tàu hợp lệ.'
  if (currentDeckId !== undefined && !data.decks.some(row => row.id === currentDeckId && row.shipId === draft.shipId)) {
    errors.shipId = 'Không xác thực được boong đang chỉnh sửa. Vui lòng tải lại dữ liệu.'
  }
  if (positive(draft.number) && ship) {
    const limit = ship.deckNumberLimit ?? ship.totalDecks
    if (draft.number > limit) errors.number = `Số boong không được vượt quá ${limit} boong của tàu.`
    else if (data.decks.some(row => row.shipId === draft.shipId && row.number === draft.number && row.id !== currentDeckId)) {
      errors.number = 'Số boong này đã tồn tại trên tàu đã chọn.'
    }
  }
  return errors
}
export function cabinValidationContextError(data: DataSnapshot | null | undefined): string {
  const unavailable = 'Chưa có đủ dữ liệu tàu, boong và cabin để kiểm tra. Vui lòng tải lại dữ liệu.'
  if (!data || !Array.isArray(data.ships) || !Array.isArray(data.decks) || !Array.isArray(data.cabins)) return unavailable
  if (!data.ships.every(row => row && typeof row.id === 'string' && row.id.length > 0)
    || !data.decks.every(row => row && typeof row.id === 'string' && row.id.length > 0 && typeof row.shipId === 'string' && row.shipId.length > 0)
    || !data.cabins.every(row => row && typeof row.id === 'string' && row.id.length > 0 && typeof row.shipId === 'string' && row.shipId.length > 0 && typeof row.deckId === 'string' && row.deckId.length > 0 && typeof row.number === 'string' && row.number.length > 0)) return unavailable
  if ([data.ships, data.decks, data.cabins].some(rows => new Set(rows.map(row => row.id)).size !== rows.length)) return unavailable
  return ''
}

export function validateCabin(draft: CabinDraft, data: DataSnapshot | null | undefined, currentCabinId?: string): FieldErrors {
  const errors: FieldErrors = {}
  const number = typeof draft.number === 'string' ? draft.number.trim() : ''
  if (!number) errors.number = 'Vui lòng nhập số cabin.'
  else if (number.length > 10) errors.number = 'Số cabin không được vượt quá 10 ký tự.'
  if (!positive(draft.capacity) || draft.capacity > 20) errors.capacity = 'Sức chứa cabin phải là số nguyên từ 1 đến 20 khách.'
  if (!Object.hasOwn(cabinTypes, draft.type)) errors.type = 'Vui lòng chọn loại cabin hợp lệ.'
  if (!Object.hasOwn(cabinStatuses, draft.status)) errors.status = 'Vui lòng chọn trạng thái cabin hợp lệ.'
  if (typeof draft.accessible !== 'boolean') errors.accessible = 'Vui lòng xác nhận thông tin hỗ trợ tiếp cận.'
  const contextError = cabinValidationContextError(data)
  if (!data || contextError) return { ...errors, shipId: contextError }
  if (!data.ships.some((row) => row.id === draft.shipId)) errors.shipId = 'Vui lòng chọn tàu.'
  if (!data.decks.some((row) => row.id === draft.deckId && row.shipId === draft.shipId)) errors.deckId = 'Chọn boong thuộc đúng tàu.'
  if (number && data.cabins.some(row => row.shipId === draft.shipId && row.number === number && row.id !== currentCabinId)) errors.number = 'Số cabin này đã tồn tại trên tàu đã chọn.'
  if (currentCabinId !== undefined) {
    const current = data.cabins.find(row => row.id === currentCabinId)
    if (!current || current.shipId !== draft.shipId || current.deckId !== draft.deckId || current.number !== draft.number) {
      errors.shipId = 'Không xác thực được cabin đang chỉnh sửa. Vui lòng tải lại dữ liệu.'
    }
  }
  return errors
}
