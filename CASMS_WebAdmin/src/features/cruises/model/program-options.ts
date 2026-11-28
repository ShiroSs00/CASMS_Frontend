type AreaOnDeck = { id: string; deckId: string }
type ProgramVenue<Area extends AreaOnDeck = AreaOnDeck> = {
  ship: { id: string | null; modelId?: string | null }
  decks: { id: string; shipId: string }[]
  activityAreas?: Area[]
}

export function effectiveActivityAreas<Area extends AreaOnDeck>(options: ProgramVenue<Area>): Area[] {
  const decks = new Set(options.decks.filter(deck => deck.shipId === options.ship.id).map(deck => deck.id))
  return options.ship.id && options.ship.modelId
    ? (options.activityAreas ?? []).filter(area => decks.has(area.deckId))
    : []
}

export function programModelBlocker(options: ProgramVenue) {
  if (!options.ship.id) return 'Quản lý lịch trình cần gán tàu cho chuyến.'
  if (options.decks.length === 0) return 'Quản lý tàu cần hoàn tất cấu hình boong.'
  if (!options.ship.modelId) return 'Tàu chưa có mô hình khu vực để chọn nơi tổ chức hoạt động. Quản lý tàu phụ trách bổ sung mô hình.'
  return null
}

export function programServiceLabel(service: { name: string; configuredOnShip?: boolean }) {
  if (service.configuredOnShip === true) return `${service.name} · Đã gán trên boong`
  if (service.configuredOnShip === false) return `${service.name} · Đề xuất, cần Quản lý tàu bố trí`
  return service.name
}
