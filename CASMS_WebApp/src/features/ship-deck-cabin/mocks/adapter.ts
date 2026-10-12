import { initialData, cruiseFixtures, historyFixtures } from './fixtures.ts'
import type {
  CabinDraft, CabinStatus, Capability, CheckResult, DataSnapshot, DeckDraft,
  EntityKind, FieldErrors, ShipDraft, ShipStatus,
} from '../model/types.ts'

export class MockValidationError extends Error {
  fields: FieldErrors
  constructor(fields: FieldErrors) {
    super('Kiểm tra lại các trường được đánh dấu.'); this.fields = fields
  }
}
const positiveInteger = (value: number) => Number.isSafeInteger(value) && value > 0
const clone = <T,>(value: T): T => structuredClone(value)

export function createShipDeckCabinAdapter(delay = 240) {
  let data = clone(initialData)
  let revision = 0
  let nextId = 1
  const listeners = new Set<() => void>()
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, delay))
  const notify = () => { revision += 1; listeners.forEach((listener) => listener()) }
  const freshMeta = (id: string) => ({ id, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  const exists = (kind: EntityKind, id: string) => {
    const item = data[kind].find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy dữ liệu. Hãy quay lại danh sách.')
    return item
  }
  const ensureVersion = (kind: EntityKind, id: string, version?: number) => {
    if (id && exists(kind, id).version !== version) throw new Error('Dữ liệu đã thay đổi. Tải lại bản mới trước khi lưu.')
  }
  const validateShip = (draft: ShipDraft, id = '') => {
    const errors: FieldErrors = {}
    if (!draft.code.trim() || draft.code.length > 20) errors.code = 'Nhập mã tàu, tối đa 20 ký tự.'
    if (data.ships.some((row) => row.id !== id && row.code === draft.code.trim())) errors.code = 'Mã tàu đã tồn tại.'
    if (!draft.name.trim() || draft.name.length > 100) errors.name = 'Nhập tên tàu, tối đa 100 ký tự.'
    if (!positiveInteger(draft.capacity)) errors.capacity = 'Sức chứa phải là số nguyên dương.'
    if (!positiveInteger(draft.totalDecks)) errors.totalDecks = 'Số boong phải là số nguyên dương.'
    if (!['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(draft.status)) errors.status = 'Trạng thái không hợp lệ.'
    if (draft.commissionDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.commissionDate)) errors.commissionDate = 'Ngày không hợp lệ.'
    if (id) {
      const current = data.ships.find((row) => row.id === id)
      if (current && current.code !== draft.code) errors.code = 'Mã tàu không được đổi sau khi tạo.'
      if (data.decks.some((deck) => deck.shipId === id && deck.number > draft.totalDecks)) errors.totalDecks = 'Đã có boong vượt giới hạn mới. Giữ số boong phù hợp với dữ liệu hiện có.'
    }
    return errors
  }
  const validateDeck = (draft: DeckDraft, id = '') => {
    const errors: FieldErrors = {}
    const ship = data.ships.find((row) => row.id === draft.shipId)
    if (!ship) errors.shipId = 'Vui lòng chọn tàu.'
    if (!positiveInteger(draft.number)) errors.number = 'Số boong phải là số nguyên dương.'
    else if (ship && draft.number > ship.totalDecks) errors.number = `Tàu này có tối đa ${ship.totalDecks} boong.`
    if (data.decks.some((row) => row.id !== id && row.shipId === draft.shipId && row.number === draft.number)) errors.number = 'Số boong đã tồn tại trong tàu.'
    if (draft.name.length > 50) errors.name = 'Tên boong tối đa 50 ký tự.'
    const current = data.decks.find((row) => row.id === id)
    if (current && current.shipId !== draft.shipId) errors.shipId = 'Không đổi tàu của boong trong bản demo này.'
    return errors
  }
  const validateCabin = (draft: CabinDraft, id = '') => {
    const errors: FieldErrors = {}
    if (!data.ships.some((row) => row.id === draft.shipId)) errors.shipId = 'Vui lòng chọn tàu.'
    if (!data.decks.some((row) => row.id === draft.deckId && row.shipId === draft.shipId)) errors.deckId = 'Chọn boong thuộc đúng tàu.'
    if (!draft.number.trim() || draft.number.length > 10) errors.number = 'Nhập số cabin, tối đa 10 ký tự.'
    if (data.cabins.some((row) => row.id !== id && row.shipId === draft.shipId && row.number === draft.number.trim())) errors.number = 'Số cabin đã tồn tại trong tàu.'
    if (!positiveInteger(draft.capacity)) errors.capacity = 'Sức chứa phải là số nguyên dương.'
    if (!['INTERIOR', 'OCEAN_VIEW', 'BALCONY', 'SUITE'].includes(draft.type)) errors.type = 'Loại cabin không hợp lệ.'
    const current = data.cabins.find((row) => row.id === id)
    if (current && current.shipId !== draft.shipId) errors.shipId = 'Không đổi tàu của cabin trong bản demo này.'
    if (!['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OUT_OF_SERVICE'].includes(draft.status)) errors.status = 'Trạng thái không hợp lệ.'
    if (draft.status === 'OCCUPIED' && current?.status !== 'OCCUPIED') errors.status = 'Đang có khách là trạng thái chỉ đọc, không đặt thủ công.'
    if (current && current.status !== draft.status) errors.status = 'Đổi trạng thái tại phần thao tác vận hành.'
    if (current?.status === 'OCCUPIED' && (current.deckId !== draft.deckId || current.number !== draft.number || current.capacity !== draft.capacity || current.type !== draft.type || current.accessible !== draft.accessible)) {
      errors.number = 'Cabin đang có khách: chỉnh sửa bị khóa trong kịch bản mock này.'
    }
    return errors
  }
  const requireValid = (errors: FieldErrors) => { if (Object.keys(errors).length) throw new MockValidationError(errors) }
  const deleteCapability = (kind: EntityKind, id: string): Capability => {
    if (!data[kind].some((row) => row.id === id)) return { allowed: false, reason: 'Đối tượng không còn tồn tại trong phiên demo.' }
    if (kind === 'ships' && (id === 'ship-aurora' || data.decks.some((row) => row.shipId === id) || data.cabins.some((row) => row.shipId === id))) {
      return { allowed: false, reason: 'Tàu còn boong/cabin hoặc chuyến liên quan trong dữ liệu demo.' }
    }
    if (kind === 'decks' && data.cabins.some((row) => row.deckId === id)) return { allowed: false, reason: 'Boong còn cabin. Không thể xóa trong dữ liệu demo.' }
    if (kind === 'cabins' && ((historyFixtures[id]?.length ?? 0) > 0 || data.cabins.find((row) => row.id === id)?.status === 'OCCUPIED')) {
      return { allowed: false, reason: 'Cabin đã có lịch sử gán hoặc đang có khách trong dữ liệu demo.' }
    }
    return { allowed: true }
  }
  const operationalCapability = (id: string): Capability => {
    const row = data.cabins.find((item) => item.id === id)
    if (!row) throw new Error('Không tìm thấy cabin.')
    return row.status === 'OCCUPIED' ? { allowed: false, reason: 'Cabin đang có khách: thao tác vận hành bị chặn trong kịch bản mock.' } : { allowed: true }
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getRevision: () => revision,
    async list(): Promise<DataSnapshot> { await pause(); return clone(data) },
    validateShip, validateDeck, validateCabin, deleteCapability, operationalCapability,
    async saveShip(draft: ShipDraft, id = '', version?: number) {
      await pause(); ensureVersion('ships', id, version); requireValid(validateShip(draft, id))
      const current = data.ships.find((row) => row.id === id)
      // Existing status is changed only through the explicit status action.
      if (current && draft.status !== current.status) throw new MockValidationError({ status: 'Đổi trạng thái tại phần thao tác vận hành.' })
      const row = { ...(current ?? freshMeta(`ship-new-${nextId++}`)), ...draft, code: draft.code.trim(), name: draft.name.trim(), version: (current?.version ?? 0) + 1, updatedAt: new Date().toISOString() }
      data.ships = current ? data.ships.map((item) => item.id === id ? row : item) : [...data.ships, row]
      notify(); return clone(row)
    },
    async saveDeck(draft: DeckDraft, id = '', version?: number) {
      await pause(); ensureVersion('decks', id, version); requireValid(validateDeck(draft, id))
      const current = data.decks.find((row) => row.id === id)
      const row = { ...(current ?? freshMeta(`deck-new-${nextId++}`)), ...draft, name: draft.name.trim(), version: (current?.version ?? 0) + 1, updatedAt: new Date().toISOString() }
      data.decks = current ? data.decks.map((item) => item.id === id ? row : item) : [...data.decks, row]
      notify(); return clone(row)
    },
    async saveCabin(draft: CabinDraft, id = '', version?: number) {
      await pause(); ensureVersion('cabins', id, version); requireValid(validateCabin(draft, id))
      const current = data.cabins.find((row) => row.id === id)
      const row = { ...(current ?? freshMeta(`cabin-new-${nextId++}`)), ...draft, number: draft.number.trim(), version: (current?.version ?? 0) + 1, updatedAt: new Date().toISOString() }
      data.cabins = current ? data.cabins.map((item) => item.id === id ? row : item) : [...data.cabins, row]
      notify(); return clone(row)
    },
    async deleteUnused(kind: EntityKind, id: string, version: number) {
      await pause(); ensureVersion(kind, id, version)
      const capability = deleteCapability(kind, id)
      if (!capability.allowed) throw new Error(capability.reason)
      data = { ...data, [kind]: data[kind].filter((row) => row.id !== id) }
      notify()
    },
    async changeShipStatus(id: string, status: ShipStatus, version: number) {
      await pause(); ensureVersion('ships', id, version)
      if (!['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(status)) throw new Error('Trạng thái không hợp lệ.')
      const current = data.ships.find((row) => row.id === id)!
      if (id === 'ship-aurora' && status !== 'ACTIVE') throw new Error('Kịch bản mock chặn thay đổi: tàu có chuyến đang vận hành. Chưa có chính sách xử lý chuyến thật.')
      data.ships = data.ships.map((row) => row.id === id ? { ...row, status, version: current.version + 1, updatedAt: new Date().toISOString() } : row)
      notify()
    },
    async changeCabinStatus(id: string, status: CabinStatus, version: number) {
      await pause(); ensureVersion('cabins', id, version)
      const capability = operationalCapability(id)
      if (!capability.allowed) throw new Error(capability.reason)
      if (!['AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE'].includes(status)) throw new Error('Không thể đặt trạng thái này thủ công.')
      data.cabins = data.cabins.map((row) => row.id === id ? { ...row, status, version: row.version + 1, updatedAt: new Date().toISOString() } : row)
      notify()
    },
    getCruises: (shipId: string) => clone(shipId === 'ship-aurora' ? cruiseFixtures : []),
    getHistory: (cabinId: string) => clone(historyFixtures[cabinId] ?? []),
    async inspectShip(id: string, scenario: 'ready' | 'schedule', result: 'clear' | 'blocked' | 'error'): Promise<CheckResult> {
      await pause(); exists('ships', id)
      if (result === 'error') throw new Error('Dịch vụ mock kiểm tra tạm thời không khả dụng. Hãy thử lại.')
      return result === 'blocked'
        ? { tone: 'warning', allowed: false, title: 'Kết quả mock: chưa đáp ứng', message: scenario === 'schedule' ? 'Khoảng kiểm tra có chuyến trùng lịch trong kịch bản minh họa.' : 'Kịch bản minh họa yêu cầu kiểm tra cabin trước khi vận hành.' }
        : { tone: 'success', allowed: true, title: 'Kết quả mock: đáp ứng', message: 'Kết quả minh họa từ adapter; không xác nhận lịch hoặc điều kiện vận hành thật.' }
    },
    async inspectCabin(id: string, result: 'clear' | 'blocked' | 'error'): Promise<CheckResult> {
      await pause(); exists('cabins', id)
      if (result === 'error') throw new Error('Không nhận được kết quả mock. Không coi lỗi là khả dụng.')
      return result === 'blocked'
        ? { tone: 'warning', allowed: false, title: 'Kết quả mock: không phù hợp', message: 'Kịch bản minh họa không đáp ứng sức chứa, khả dụng hoặc tương thích đã yêu cầu.' }
        : { tone: 'success', allowed: true, title: 'Kết quả mock: phù hợp', message: 'Kịch bản minh họa đáp ứng. Không phải kết quả xác nhận đặt/gán phòng thật.' }
    },
  }
}
export const shipDeckCabinAdapter = createShipDeckCabinAdapter()
