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
export function validateDeck(draft: DeckDraft, data: DataSnapshot): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.ships.some((row) => row.id === draft.shipId)) errors.shipId = 'Vui lòng chọn tàu.'
  if (!positive(draft.number)) errors.number = 'Số boong phải là số nguyên dương.'
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
