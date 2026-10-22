import type { ShipListState } from '../model/ship-list-types'

// Fleet aggregates intentionally represent more ships than the three visible samples.
export const shipListFixture: ShipListState = {
  metrics: { activeCount: 6, maintenanceCount: 1, configuredCabinCount: 428, attentionCount: 3 },
  items: [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Ocean Voyager', code: 'SH-001', status: 'ACTIVE', capacity: { status: 'loaded', data: { deckCount: 12, cabinCount: 156 } }, readiness: { status: 'loaded', data: 'READY' }, currentCruise: { status: 'loaded', data: { id: '00000000-0000-4000-8000-000000000021', code: 'CR-2026-021' } } },
    { id: '00000000-0000-4000-8000-000000000002', name: 'Aurora Pearl', code: 'SH-002', status: 'ACTIVE', capacity: { status: 'loaded', data: { deckCount: 10, cabinCount: 132 } }, readiness: { status: 'loaded', data: 'ATTENTION' }, currentCruise: { status: 'loaded', data: null } },
    { id: '00000000-0000-4000-8000-000000000003', name: 'Pacific Dawn', code: 'SH-003', status: 'MAINTENANCE', capacity: { status: 'loaded', data: { deckCount: 9, cabinCount: 120 } }, readiness: { status: 'loaded', data: 'BLOCKED' }, currentCruise: { status: 'loaded', data: null } },
  ],
}
