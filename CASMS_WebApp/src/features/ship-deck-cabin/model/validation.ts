import type { CabinDraft, DataSnapshot, DeckDraft, FieldErrors, ShipDraft } from './types'
const positive = (value: number) => Number.isSafeInteger(value) && value > 0

// Form-level shape/required validation. Backend remains authoritative for business rules.
export function validateShip(draft: ShipDraft): FieldErrors {
  const errors: FieldErrors = {}
  if (!draft.code.trim()) errors.code = 'Vui lòng nhập mã tàu.'
  if (!draft.name.trim()) errors.name = 'Vui lòng nhập tên tàu.'
  if (!positive(draft.capacity)) errors.capacity = 'Sức chứa phải là số nguyên dương.'
  if (!positive(draft.totalDecks)) errors.totalDecks = 'Số boong phải là số nguyên dương.'
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
  if (!positive(draft.number)) errors.number = 'Số boong phải là số nguyên dương.'
  if (typeof draft.name !== 'string') errors.name = 'Tên boong không hợp lệ.'
  else if (draft.name.length > 50) errors.name = 'Tên boong không được vượt quá 50 ký tự.'
  const contextError = deckValidationContextError(data)
  if (!data || contextError) return { ...errors, shipId: contextError || deckContextUnavailable }
  const ship = data.ships.find(row => row.id === draft.shipId)
  if (!ship) errors.shipId = 'Vui lòng chọn tàu hợp lệ.'
  if (currentDeckId !== undefined && !data.decks.some(row => row.id === currentDeckId && row.shipId === draft.shipId)) {
    errors.shipId = 'Không xác thực được boong đang chỉnh sửa. Vui lòng tải lại dữ liệu.'
  }
  if (positive(draft.number) && ship) {
    if (draft.number > ship.totalDecks) errors.number = `Số boong không được vượt quá ${ship.totalDecks} boong của tàu.`
    else if (data.decks.some(row => row.shipId === draft.shipId && row.number === draft.number && row.id !== currentDeckId)) {
      errors.number = 'Số boong này đã tồn tại trên tàu đã chọn.'
    }
  }
  return errors
}
export function validateCabin(draft: CabinDraft, data: DataSnapshot): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.ships.some((row) => row.id === draft.shipId)) errors.shipId = 'Vui lòng chọn tàu.'
  if (!data.decks.some((row) => row.id === draft.deckId && row.shipId === draft.shipId)) errors.deckId = 'Chọn boong thuộc đúng tàu.'
  if (!draft.number.trim()) errors.number = 'Vui lòng nhập số cabin.'
  if (!positive(draft.capacity)) errors.capacity = 'Sức chứa phải là số nguyên dương.'
  return errors
}
