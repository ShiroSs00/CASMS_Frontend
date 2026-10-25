import type { Cabin, CabinStatus, CabinType, Deck, Ship, ShipDraft } from './types'

export const roomTypeLabels: Record<CabinType, string> = { INTERIOR: 'Phòng trong', OCEAN_VIEW: 'Hướng biển', BALCONY: 'Có ban công', SUITE: 'Phòng suite' }
export type RoomFilters = { search: string; deck: string; status: CabinStatus | ''; type: CabinType | '' }
export const emptyRoomFilters: RoomFilters = { search: '', deck: '', status: '', type: '' }
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').trim().toLocaleLowerCase('vi')
export function filterRooms(rooms: Cabin[], filters: RoomFilters) {
  return rooms.filter(room => (!filters.search.trim() || normalize(room.number).includes(normalize(filters.search)))
    && (!filters.deck || room.deckId === filters.deck) && (!filters.status || room.status === filters.status) && (!filters.type || room.type === filters.type))
}
export function roomCounts(decks: Deck[], rooms: Cabin[]) {
  return new Map(decks.map(deck => [deck.id, { total: rooms.filter(room => room.deckId === deck.id).length,
    available: rooms.filter(room => room.deckId === deck.id && room.status === 'AVAILABLE').length }]))
}
export function validateShipEdit(draft: ShipDraft, current: Ship) {
  const errors: Record<string, string> = {}
  if (!draft.name.trim() || draft.name.trim().length > 100) errors.name = 'Nhập tên tàu, tối đa 100 ký tự.'
  if (!Number.isInteger(draft.capacity) || draft.capacity < 1 || draft.capacity > 2147483647) errors.capacity = 'Sức chứa phải là số nguyên dương hợp lệ.'
  if (!Number.isInteger(draft.totalDecks) || draft.totalDecks < 1 || draft.totalDecks > 2147483647) errors.totalDecks = 'Số boong phải là số nguyên dương hợp lệ.'
  if (draft.commissionDate) {
    const day = new Date(draft.commissionDate)
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.commissionDate) || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== draft.commissionDate || draft.commissionDate > today) errors.commissionDate = 'Ngày hoạt động phải hợp lệ và không ở tương lai.'
  }
  if ((draft.lengthMeters == null) !== (draft.beamMeters == null)) errors.dimensions = 'Nhập cả chiều dài và chiều rộng, hoặc để trống cả hai.'
  if ([draft.lengthMeters, draft.beamMeters].some(value => value != null && (!Number.isFinite(value) || value <= 0))) errors.dimensions = 'Kích thước tàu phải là số lớn hơn 0.'
  if ((current.lengthMeters != null || current.beamMeters != null) && (draft.lengthMeters == null || draft.beamMeters == null)) errors.dimensions = 'Nhập đầy đủ kích thước hiện có của tàu.'
  return errors
}
export function fleetError(message: string) {
  const translations: Array<[RegExp, string]> = [
    [/Total ship capacity cannot be lower/, 'Sức chứa tàu không được nhỏ hơn tổng sức chứa các phòng hiện có.'],
    [/Total decks cannot be lower/, 'Số boong cấu hình không được nhỏ hơn số boong đã nhập.'],
    [/Cabin type, position, rotation and dimensions/, 'Loại phòng và thông tin 3D được quản lý bằng dữ liệu mô hình.'],
    [/Cannot change status while an active passenger assignment/, 'Phòng đang có khách được gán. Hoàn tất quy trình gán phòng trước khi đổi trạng thái.'],
    [/A cabin can only become OCCUPIED/, 'Trạng thái đang có khách được cập nhật qua quy trình gán phòng.'],
    [/in.progress|ongoing cruise/i, 'Tàu đang có chuyến vận hành. Chưa thể chuyển sang trạng thái đã chọn.'],
  ]
  return translations.find(([pattern]) => pattern.test(message))?.[1] ?? message
}
