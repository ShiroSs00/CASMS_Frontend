export type ShipStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'
export type CabinStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
export type CabinType = 'INTERIOR' | 'OCEAN_VIEW' | 'BALCONY' | 'SUITE'
export type EntityKind = 'ships' | 'decks' | 'cabins'
export type Capability = { allowed: boolean; reason?: string }
export type RecordBase = { id: string; version: number; createdAt: string; updatedAt: string }
export type Ship = RecordBase & {
  code: string; name: string; status: ShipStatus
  capacity: number; totalDecks: number; commissionDate: string
}
export type Deck = RecordBase & { shipId: string; number: number; name: string }
export type Cabin = RecordBase & {
  shipId: string; deckId: string; number: string; type: CabinType
  capacity: number; status: CabinStatus; accessible: boolean
}
export type ShipDraft = Omit<Ship, keyof RecordBase>
export type DeckDraft = Omit<Deck, keyof RecordBase>
export type CabinDraft = Omit<Cabin, keyof RecordBase>
export type Entity = Ship | Deck | Cabin
export type DataSnapshot = { ships: Ship[]; decks: Deck[]; cabins: Cabin[] }
export type FieldErrors = Record<string, string>
export type CheckResult = {
  tone: 'success' | 'warning' | 'error'
  title: string; message: string; allowed: boolean
}
export type CruisePreview = { code: string; name: string; period: string; status: string }
export type HistoryEntry = { date: string; cruise: string; action: string; actor: string }

export const shipStatuses: Record<ShipStatus, string> = {
  ACTIVE: 'Hoạt động', MAINTENANCE: 'Bảo trì', INACTIVE: 'Ngừng hoạt động',
}
export const cabinStatuses: Record<CabinStatus, string> = {
  AVAILABLE: 'Sẵn sàng', OCCUPIED: 'Đang có khách',
  MAINTENANCE: 'Bảo trì', OUT_OF_SERVICE: 'Ngừng phục vụ',
}
export const cabinTypes: Record<CabinType, string> = {
  INTERIOR: 'Interior', OCEAN_VIEW: 'Ocean View', BALCONY: 'Balcony', SUITE: 'Suite',
}
export const kindLabels: Record<EntityKind, string> = { ships: 'tàu', decks: 'boong', cabins: 'cabin' }
export const sectionLabels: Record<EntityKind, string> = { ships: 'Ship', decks: 'Deck', cabins: 'Cabin' }
export function entityName(entity: Entity) {
  return 'code' in entity ? `${entity.code} · ${entity.name}`
    : 'deckId' in entity ? `Cabin ${entity.number}` : `Boong ${entity.number} · ${entity.name || 'Chưa đặt tên'}`
}
export function formatDate(value: string) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value)) : 'Chưa cập nhật'
}
