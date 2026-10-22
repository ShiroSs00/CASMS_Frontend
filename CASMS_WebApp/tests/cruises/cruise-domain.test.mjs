import assert from 'node:assert/strict'
import test from 'node:test'
import { URLSearchParams } from 'node:url'

async function loadValidation() {
  try {
    return await import('../../src/features/cruises/model/cruise-validation.ts')
  } catch {
    return {}
  }
}

test('Cruise schedule follows BE: positive instants, optional type and no invented five-day limit', async () => {
  const {validateCruiseDraft,validateCruiseSchedule,inferCruiseType}=await loadValidation()
  assert.deepEqual(validateCruiseSchedule('', '2026-11-20T08:00','2026-12-10T18:00'),{})
  assert.deepEqual(validateCruiseSchedule('ONE_DAY','2026-11-20T08:00','2026-11-22T09:00'),{})
  assert.equal(inferCruiseType('2026-11-20T08:00','2026-11-20T18:00'),'ONE_DAY')
  assert.equal(inferCruiseType('2026-11-20T08:00','2026-11-21T08:59'),'ONE_DAY')
  assert.equal(inferCruiseType('2026-11-20T08:00','2026-11-21T09:00'),'MULTI_DAYS')
  assert.ok(validateCruiseSchedule('MULTI_DAYS','2026-11-20T08:00','2026-11-19T18:00').returnDatetime)
  assert.deepEqual(validateCruiseDraft({cruiseCode:'',cruiseName:'',cruiseType:'',departureDatetime:'2026-11-20T08:00',returnDatetime:'2026-11-20T18:00',departurePortId:'',returnPortId:''}),{
    cruiseName:'Tên hiển thị là bắt buộc.',departurePortId:'Vui lòng chọn cảng khởi hành.',returnPortId:'Vui lòng chọn cảng trở về.',
  })
})

test('Cruise list query keeps SQL enums and resets invalid URL values', async () => {
  let queryModule = {}
  try {
    queryModule = await import('../../src/features/cruises/model/cruise-query.ts')
  } catch {
    // The red step reports the missing public behavior below.
  }
  const { parseCruiseQuery, serializeCruiseQuery } = queryModule

  assert.equal(typeof parseCruiseQuery, 'function', 'query parsing is not implemented')
  assert.equal(typeof serializeCruiseQuery, 'function', 'query serialization is not implemented')

  const parsed = parseCruiseQuery(
    new URLSearchParams('q=aurora&status=PUBLISHED&type=MULTI_DAYS&departureDate=2026-11-20&ship=UNASSIGNED&page=2&pageSize=5'),
  )
  assert.deepEqual(parsed, {
    search: 'aurora',
    status: 'PUBLISHED',
    cruiseType: 'MULTI_DAYS',
    departureDate: '2026-11-20',
    shipId: 'UNASSIGNED',
    page: 2,
    pageSize: 5,
  })
  assert.equal(serializeCruiseQuery(parsed).toString(), 'q=aurora&status=PUBLISHED&type=MULTI_DAYS&departureDate=2026-11-20&ship=UNASSIGNED&page=2&pageSize=5')

  assert.deepEqual(
    parseCruiseQuery(new URLSearchParams('status=OPEN&type=ROUND_TRIP&departureDate=20-11-2026&page=-1')),
    {
      search: '', status: '', cruiseType: '', departureDate: '', shipId: '', page: 1, pageSize: 4,
    },
  )
})

test('Ship assignment precheck returns authoritative reasons and mutates only allowed cruises', async () => {
  let adapterModule = {}
  try {
    adapterModule = await import('../../src/features/cruises/mocks/mock-cruise-adapter.ts')
  } catch {
    // The red step reports the missing adapter behavior below.
  }
  const { createMockCruiseAdapter } = adapterModule

  assert.equal(typeof createMockCruiseAdapter, 'function', 'mock Cruise adapter is not implemented')
  const adapter = createMockCruiseAdapter()

  const cruiseAurora = '10000000-0000-4000-8000-000000000001'
  const cruiseUnassigned = '10000000-0000-4000-8000-000000000003'
  const shipHorizon = '20000000-0000-4000-8000-000000000002'
  const shipOcean = '20000000-0000-4000-8000-000000000003'
  const shipBreeze = '20000000-0000-4000-8000-000000000004'

  const overlapping = await adapter.precheckShip(cruiseAurora, shipOcean)
  assert.equal(overlapping.state, 'UNAVAILABLE')
  assert.match(overlapping.reasons.join(' '), /CR-261121-04/)

  const capacity = await adapter.precheckShip(cruiseAurora, shipBreeze)
  assert.equal(capacity.state, 'UNAVAILABLE')
  assert.match(capacity.reasons.join(' '), /70.*82/)

  const available = await adapter.precheckShip(cruiseUnassigned, shipHorizon)
  assert.equal(available.state, 'AVAILABLE')
  await adapter.assignShip(cruiseUnassigned, shipHorizon)
  assert.equal((await adapter.getDetail(cruiseUnassigned)).cruise.shipId, shipHorizon)

  await assert.rejects(() => adapter.unassignShip(cruiseAurora), /đã phát hành/)
})

test('Mock adapter keeps Cruise persistence SQL-shaped and filters combined list criteria', async () => {
  const { createMockCruiseAdapter } = await import('../../src/features/cruises/mocks/mock-cruise-adapter.ts')
  const adapter = createMockCruiseAdapter()
  const port = adapter.ports[0].portId

  const filtered = await adapter.list({
    search: 'lan hạ',
    status: 'DRAFT',
    cruiseType: 'ONE_DAY',
    departureDate: '2026-12-05',
    shipId: 'UNASSIGNED',
    page: 1,
    pageSize: 4,
  })
  assert.equal(filtered.total, 1)
  assert.equal(filtered.items[0].cruise.cruiseCode, 'CR-051220-03')

  await assert.rejects(() => adapter.createCruise({
    cruiseCode: 'cr-051220-03',
    cruiseName: 'Trùng mã',
    cruiseType: 'ONE_DAY',
    departureDatetime: '2026-12-20T08:00',
    returnDatetime: '2026-12-20T18:00',
    departurePortId: port,
    returnPortId: port,
  }), /đã tồn tại/)

  const created = await adapter.createCruise({
    cruiseCode: ' CR-NEW-08 ',
    cruiseName: ' Cruise mới ',
    cruiseType: 'MULTI_DAYS',
    departureDatetime: '2026-12-20T08:00',
    returnDatetime: '2026-12-22T18:00',
    departurePortId: port,
    returnPortId: port,
  })
  assert.equal(created.cruiseCode, 'CR-NEW-08')
  assert.equal(created.cruiseName, 'Cruise mới')
  assert.equal(created.status, 'DRAFT')
  assert.equal(created.shipId, null)
})
