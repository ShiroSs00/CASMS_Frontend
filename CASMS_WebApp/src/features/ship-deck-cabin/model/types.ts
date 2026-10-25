export type ShipStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'
export type CabinStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
export type CabinType = 'INTERIOR' | 'OCEAN_VIEW' | 'BALCONY' | 'SUITE'
export type EntityKind = 'ships' | 'decks' | 'cabins'
export type RecordBase = { id: string; createdAt?: string; updatedAt?: string }
export type Ship = RecordBase & {
  code: string; name: string; status: ShipStatus
  capacity: number; totalDecks: number; commissionDate: string
  manifestModelId?: string | null; deckNumberLimit?: number; lengthMeters?: number | null; beamMeters?: number | null
}
export type Deck = RecordBase & { shipId: string; number: number; name: string; priceMultiplier?: number }
export type Cabin = RecordBase & {
  shipId: string; deckId: string; number: string; type: CabinType
  capacity: number; status: CabinStatus; accessible: boolean
  modelWidth?: number | null; modelHeight?: number | null; modelDepth?: number | null
}
export type ShipDraft = Omit<Ship, keyof RecordBase>
export type DeckDraft = Omit<Deck, keyof RecordBase | 'number'> & { number: number | '' }
export type CabinDraft = Omit<Cabin, keyof RecordBase>
export type Entity = Ship | Deck | Cabin
export type DataSnapshot = { ships: Ship[]; decks: Deck[]; cabins: Cabin[] }
export type FieldErrors = Record<string, string>
export type CheckResult = {
  tone: 'success' | 'warning' | 'error'
  title: string; message: string; allowed: boolean
}
export type CruisePreview = { id: string; code: string; name: string; departure: string; returnAt: string; status: string }
export type HistoryEntry = { id: string; passengerId: string; from: string; to: string | null; actorId: string; reason: string }
export type ShipCapacity = { configuredTotalCapacity: number; configuredTotalDecks: number; actualCabinCount: number; availableCabinCount: number; actualDeckCount: number }
export type DeckCapacity = { totalCabins: number; availableCabins: number; totalPassengerCapacity: number }
export type AvailableCabinQuery = { shipId?: string; deckId?: string; cabinType?: CabinType; minCapacity?: number; isAccessible?: boolean }

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
export function formatDate(value?: string | null) {
  return value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value)) : 'Chưa cập nhật'
}
