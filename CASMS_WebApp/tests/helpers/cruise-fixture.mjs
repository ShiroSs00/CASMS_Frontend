// Explicit, synthetic DTO for adapter tests. Production never imports this file.
export function cruiseFixture(overrides = {}) {
  return {
    cruiseId: 'fixture-cruise', cruiseCode: 'CR-FIXTURE', cruiseName: 'Lần khởi hành thử nghiệm',
    cruiseType: 'MULTI_DAYS', status: 'DRAFT', departurePortId: 'port-a', returnPortId: 'port-b',
    departureDatetime: '2027-01-01T01:00:00Z', returnDatetime: '2027-01-03T11:00:00Z',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', ...overrides,
  }
}
