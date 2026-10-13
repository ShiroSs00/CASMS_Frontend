import type { CruiseRecord, PortRecord, ShipRecord } from '../model/cruise-record'
import type { IssueSummary, ItinerarySummary, RegulationSummary } from '../model/cruise-view'

const createdAt = '2026-10-01T02:00:00Z'
const updatedAt = '2026-10-12T06:00:00Z'

export const shipFixtures: ShipRecord[] = [
  { shipId: '20000000-0000-4000-8000-000000000001', shipCode: 'SH-001', shipName: 'CASMS Aurora', status: 'ACTIVE', totalCapacity: 120, totalDecks: 8, commissionDate: '2020-06-10', createdAt, updatedAt },
  { shipId: '20000000-0000-4000-8000-000000000002', shipCode: 'SH-002', shipName: 'CASMS Horizon', status: 'ACTIVE', totalCapacity: 140, totalDecks: 9, commissionDate: '2021-03-20', createdAt, updatedAt },
  { shipId: '20000000-0000-4000-8000-000000000003', shipCode: 'SH-003', shipName: 'CASMS Ocean', status: 'ACTIVE', totalCapacity: 110, totalDecks: 7, commissionDate: '2019-09-02', createdAt, updatedAt },
  { shipId: '20000000-0000-4000-8000-000000000004', shipCode: 'SH-004', shipName: 'CASMS Breeze', status: 'ACTIVE', totalCapacity: 70, totalDecks: 6, commissionDate: '2018-05-14', createdAt, updatedAt },
  { shipId: '20000000-0000-4000-8000-000000000005', shipCode: 'SH-005', shipName: 'CASMS Pearl', status: 'MAINTENANCE', totalCapacity: 160, totalDecks: 10, commissionDate: '2022-08-01', createdAt, updatedAt },
  { shipId: '20000000-0000-4000-8000-000000000006', shipCode: 'SH-006', shipName: 'CASMS Legacy', status: 'INACTIVE', totalCapacity: 100, totalDecks: 7, commissionDate: '2012-02-11', createdAt, updatedAt },
]

export const portFixtures: PortRecord[] = [
  { portId: '30000000-0000-4000-8000-000000000001', portCode: 'TCH', portName: 'Tuần Châu, Quảng Ninh', countryCode: 'VN', timeZoneId: 'Asia/Ho_Chi_Minh', status: 'ACTIVE' },
  { portId: '30000000-0000-4000-8000-000000000002', portCode: 'LHA', portName: 'Lan Hạ, Hải Phòng', countryCode: 'VN', timeZoneId: 'Asia/Ho_Chi_Minh', status: 'ACTIVE' },
  { portId: '30000000-0000-4000-8000-000000000003', portCode: 'HLC', portName: 'Hạ Long, Quảng Ninh', countryCode: 'VN', timeZoneId: 'Asia/Ho_Chi_Minh', status: 'ACTIVE' },
]

export const cruiseFixtures: CruiseRecord[] = [
  { cruiseId: '10000000-0000-4000-8000-000000000001', cruiseCode: 'CR-261120-01', cruiseName: 'Hạ Long — Lan Hạ', shipId: shipFixtures[0].shipId, cruiseType: 'MULTI_DAYS', departureDatetime: '2026-11-20T08:00:00+07:00', returnDatetime: '2026-11-22T18:00:00+07:00', departurePortId: portFixtures[0].portId, returnPortId: portFixtures[0].portId, status: 'PUBLISHED', createdAt, updatedAt },
  { cruiseId: '10000000-0000-4000-8000-000000000002', cruiseCode: 'CR-281120-02', cruiseName: 'Vịnh Hạ Long cuối tuần', shipId: shipFixtures[1].shipId, cruiseType: 'MULTI_DAYS', departureDatetime: '2026-11-28T08:00:00+07:00', returnDatetime: '2026-11-30T18:00:00+07:00', departurePortId: portFixtures[0].portId, returnPortId: portFixtures[0].portId, status: 'DRAFT', createdAt, updatedAt },
  { cruiseId: '10000000-0000-4000-8000-000000000003', cruiseCode: 'CR-051220-03', cruiseName: 'Lan Hạ trong ngày', shipId: null, cruiseType: 'ONE_DAY', departureDatetime: '2026-12-05T07:30:00+07:00', returnDatetime: '2026-12-05T18:00:00+07:00', departurePortId: portFixtures[1].portId, returnPortId: portFixtures[1].portId, status: 'DRAFT', createdAt, updatedAt },
  { cruiseId: '10000000-0000-4000-8000-000000000004', cruiseCode: 'CR-261121-04', cruiseName: 'Hạ Long khám phá', shipId: shipFixtures[2].shipId, cruiseType: 'MULTI_DAYS', departureDatetime: '2026-11-21T06:00:00+07:00', returnDatetime: '2026-11-23T19:00:00+07:00', departurePortId: portFixtures[2].portId, returnPortId: portFixtures[2].portId, status: 'PUBLISHED', createdAt, updatedAt },
  { cruiseId: '10000000-0000-4000-8000-000000000005', cruiseCode: 'CR-101220-05', cruiseName: 'Lan Hạ đang vận hành', shipId: shipFixtures[2].shipId, cruiseType: 'MULTI_DAYS', departureDatetime: '2026-12-10T07:00:00+07:00', returnDatetime: '2026-12-12T17:00:00+07:00', departurePortId: portFixtures[1].portId, returnPortId: portFixtures[0].portId, status: 'IN_PROGRESS', createdAt, updatedAt },
  { cruiseId: '10000000-0000-4000-8000-000000000006', cruiseCode: 'CR-101026-06', cruiseName: 'Chuyến tháng mười', shipId: shipFixtures[0].shipId, cruiseType: 'ONE_DAY', departureDatetime: '2026-10-10T07:00:00+07:00', returnDatetime: '2026-10-10T18:00:00+07:00', departurePortId: portFixtures[0].portId, returnPortId: portFixtures[0].portId, status: 'COMPLETED', createdAt, updatedAt },
  { cruiseId: '10000000-0000-4000-8000-000000000007', cruiseCode: 'CR-151226-07', cruiseName: 'Chuyến đã hủy', shipId: null, cruiseType: 'MULTI_DAYS', departureDatetime: '2026-12-15T08:00:00+07:00', returnDatetime: '2026-12-17T18:00:00+07:00', departurePortId: portFixtures[0].portId, returnPortId: portFixtures[2].portId, status: 'CANCELLED', createdAt, updatedAt },
]

export const itineraryFixtures: Record<string, ItinerarySummary> = {
  [cruiseFixtures[0].cruiseId]: { itineraryId: '40000000-0000-4000-8000-000000000001', itineraryName: 'Hạ Long — Lan Hạ', itineraryType: 'ROUND_TRIP', status: 'PENDING_APPROVAL', startDate: '2026-11-20', endDate: '2026-11-22', dayCount: 3, portCallCount: 2, seaDayCount: 1, routeLabel: 'Tuần Châu → Lan Hạ → Tuần Châu', schedule: [{ day: 1, label: 'Tuần Châu → Lan Hạ', planned: '20/11 · 08:00–18:00', actual: null }, { day: 2, label: 'Sea day / Lan Hạ', planned: '21/11 · Cả ngày', actual: null }, { day: 3, label: 'Lan Hạ → Tuần Châu', planned: '22/11 · 08:00–18:00', actual: null }] },
  [cruiseFixtures[1].cruiseId]: { itineraryId: '40000000-0000-4000-8000-000000000002', itineraryName: 'Vịnh Hạ Long cuối tuần', itineraryType: 'ROUND_TRIP', status: 'DRAFT', startDate: '2026-11-28', endDate: '2026-11-30', dayCount: 3, portCallCount: 2, seaDayCount: 1, routeLabel: 'Tuần Châu → Hạ Long → Tuần Châu', schedule: [] },
  [cruiseFixtures[2].cruiseId]: { itineraryId: '40000000-0000-4000-8000-000000000003', itineraryName: 'Lan Hạ trong ngày', itineraryType: 'ROUND_TRIP', status: 'DRAFT', startDate: '2026-12-05', endDate: '2026-12-05', dayCount: 1, portCallCount: 2, seaDayCount: 0, routeLabel: 'Lan Hạ → Vịnh Lan Hạ → Lan Hạ', schedule: [] },
  [cruiseFixtures[3].cruiseId]: { itineraryId: '40000000-0000-4000-8000-000000000004', itineraryName: 'Hạ Long khám phá', itineraryType: 'ROUND_TRIP', status: 'OPEN_FOR_SALE', startDate: '2026-11-21', endDate: '2026-11-23', dayCount: 3, portCallCount: 3, seaDayCount: 0, routeLabel: 'Hạ Long → Lan Hạ → Hạ Long', schedule: [] },
  [cruiseFixtures[4].cruiseId]: { itineraryId: '40000000-0000-4000-8000-000000000005', itineraryName: 'Lan Hạ vận hành', itineraryType: 'ONE_WAY', status: 'ACTIVE', startDate: '2026-12-10', endDate: '2026-12-12', dayCount: 3, portCallCount: 2, seaDayCount: 1, routeLabel: 'Lan Hạ → Tuần Châu', schedule: [] },
}

export const activePassengerCounts: Record<string, number> = {
  [cruiseFixtures[0].cruiseId]: 82,
  [cruiseFixtures[1].cruiseId]: 0,
  [cruiseFixtures[2].cruiseId]: 0,
  [cruiseFixtures[3].cruiseId]: 48,
  [cruiseFixtures[4].cruiseId]: 69,
  [cruiseFixtures[5].cruiseId]: 96,
}

export const regulationFixtures: Record<string, RegulationSummary[]> = {
  [cruiseFixtures[0].cruiseId]: [
    { regulationId: '50000000-0000-4000-8000-000000000001', code: 'REG-CAP-003', name: 'Giới hạn khách', source: 'CRUISE', status: 'DRAFT' },
    { regulationId: '50000000-0000-4000-8000-000000000002', code: 'REG-SPD-001', name: 'Giới hạn tốc độ', source: 'SHIP', status: 'ACTIVE' },
    { regulationId: '50000000-0000-4000-8000-000000000003', code: 'REG-SAF-002', name: 'Hướng dẫn an toàn', source: 'GLOBAL', status: 'ACTIVE' },
  ],
}

export const issueFixtures: Record<string, IssueSummary[]> = {
  [cruiseFixtures[0].cruiseId]: [
    { issueId: '60000000-0000-4000-8000-000000000001', issueCode: 'OI-261120-01', severity: 'CRITICAL', status: 'OPEN', description: 'Hệ thống lái cần kiểm tra' },
    { issueId: '60000000-0000-4000-8000-000000000002', issueCode: 'OI-261120-02', severity: 'HIGH', status: 'IN_PROGRESS', description: 'Chậm tiếp nhiên liệu' },
  ],
}
