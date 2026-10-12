import type { Cabin, DataSnapshot, HistoryEntry, CruisePreview } from '../model/types.ts'

const meta = { version: 1, createdAt: '2026-10-01T08:00:00+07:00', updatedAt: '2026-10-10T08:00:00+07:00' }
const cabin = (id: string, number: string, deckId: string, type: Cabin['type'], capacity: number,
  status: Cabin['status'], accessible = false): Cabin => ({
  ...meta, id, shipId: 'ship-aurora', deckId, number, type, capacity, status, accessible,
})
export const initialData: DataSnapshot = {
  ships: [
    { ...meta, id: 'ship-aurora', code: 'CAS-AUR-01', name: 'CASMS Aurora', capacity: 120, totalDecks: 4, status: 'ACTIVE', commissionDate: '2022-05-15' },
    { ...meta, id: 'ship-lanha', code: 'CAS-LAN-02', name: 'CASMS Lan Ha', capacity: 80, totalDecks: 3, status: 'MAINTENANCE', commissionDate: '2023-03-10' },
    { ...meta, id: 'ship-seabreeze', code: 'CAS-SEA-03', name: 'CASMS Seabreeze', capacity: 100, totalDecks: 4, status: 'INACTIVE', commissionDate: '' },
  ],
  decks: [
    { ...meta, id: 'deck-main', shipId: 'ship-aurora', number: 1, name: 'Main Deck' },
    { ...meta, id: 'deck-ocean', shipId: 'ship-aurora', number: 2, name: 'Ocean Deck' },
    { ...meta, id: 'deck-sky', shipId: 'ship-aurora', number: 3, name: 'Sky Deck' },
    { ...meta, id: 'deck-sun', shipId: 'ship-aurora', number: 4, name: 'Sun Deck' },
    { ...meta, id: 'deck-lan-main', shipId: 'ship-lanha', number: 1, name: 'Main Deck' },
  ],
  cabins: [
    cabin('cabin-101', '101', 'deck-main', 'INTERIOR', 2, 'AVAILABLE'),
    cabin('cabin-201', '201', 'deck-ocean', 'OCEAN_VIEW', 2, 'OCCUPIED', true),
    cabin('cabin-202', '202', 'deck-ocean', 'BALCONY', 3, 'MAINTENANCE'),
    cabin('cabin-301', '301', 'deck-sky', 'SUITE', 4, 'OUT_OF_SERVICE', true),
    { ...cabin('cabin-lan-101', '101', 'deck-lan-main', 'INTERIOR', 2, 'AVAILABLE'), shipId: 'ship-lanha' },
  ],
}

// Explicit service previews; these are examples, not computed business policy.
export const cruiseFixtures: CruisePreview[] = [
  { code: 'CR-DEMO-001', name: 'Hạ Long — Lan Hạ', period: '10/10/2026 – 14/10/2026', status: 'Đang vận hành' },
  { code: 'CR-DEMO-002', name: 'Hành trình vịnh Hạ Long', period: '20/10/2026 – 22/10/2026', status: 'Đã lên lịch' },
]
export const historyFixtures: Record<string, HistoryEntry[]> = {
  'cabin-201': [
    { date: '2026-10-10', cruise: 'CR-DEMO-001', action: 'Gán cabin', actor: 'Admin demo' },
    { date: '2026-09-28', cruise: 'CR-DEMO-000', action: 'Kết thúc gán cabin', actor: 'Admin demo' },
  ],
}
