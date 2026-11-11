import { useState } from 'react'
import { Field } from '@/shared/ui'
import { ShipVenueCabinField, ShipVenueDeckField, type ShipVenueCabin, type ShipVenueOptions } from '@/domain/ship-venue'

export type ActivityArea = { id: string; name: string; deckId: string; usage?: string }
export type CruiseVenueOptions = ShipVenueOptions & {
  cabins?: ShipVenueCabin[]
  activityAreas?: ActivityArea[]
}

export function CruiseActivityVenueFields({ options, initialDeckId = null, initialCabinId = null, useAsLocation = false }: {
  options: CruiseVenueOptions
  initialDeckId?: string | null
  initialCabinId?: string | null
  useAsLocation?: boolean
}) {
  const [deckId, setDeckId] = useState(initialDeckId)
  const [cabinId, setCabinId] = useState(initialCabinId)
  const [areaId, setAreaId] = useState('')
  const areas = options.activityAreas?.filter(area => area.deckId === deckId) ?? []
  const shipDecks = new Map(options.decks
    .filter(deck => deck.shipId === options.ship.id)
    .map(deck => [deck.id, deck]))
  const shipRooms = (options.cabins ?? []).filter(room =>
    room.shipId === options.ship.id && shipDecks.has(room.deckId))
  const rooms = shipRooms.filter(room => room.deckId === deckId)
  const roomHint = !deckId ? 'Chọn boong để xem phòng.'
    : options.cabins && rooms.length === 0 ? 'Boong này không có phòng. Có thể để trống điểm tập trung.'
    : undefined

  const selectedDeck = deckId ? shipDecks.get(deckId) : undefined
  const selectedRoom = shipRooms.find(room => room.id === cabinId && room.deckId === deckId)

  return <>
    {useAsLocation && <>
      <input type="hidden" name="location" value={selectedDeck ? `Boong ${selectedDeck.number} · ${selectedDeck.name}` : ''} />
      <input type="hidden" name="meetingPoint" value={selectedRoom ? `Phòng ${selectedRoom.number}` : ''} />
    </>}
    <ShipVenueDeckField
      options={options}
      label={useAsLocation ? 'Địa điểm (boong)' : undefined}
      required={useAsLocation}
      value={deckId}
      onChange={nextDeckId => {
        setDeckId(nextDeckId)
        setAreaId('')
        setCabinId(null)
      }}
    />
    <ShipVenueCabinField
      cabins={rooms}
      label={useAsLocation ? 'Điểm tập trung (phòng)' : undefined}
      value={cabinId}
      onChange={setCabinId}
      disabled={!shipDecks.has(deckId ?? '') || !options.cabins || (rooms.length === 0 && !cabinId)}
      hint={roomHint}
      error={options.ship.id && !options.cabins ? 'Chưa tải được danh sách phòng của tàu.' : undefined}
    />
    {useAsLocation && <Field htmlFor="program-activity-area" label="Khu vực hoạt động *"
      hint={!options.activityAreas ? 'Chưa tải được danh sách khu vực hoạt động.' : !deckId
        ? 'Chọn boong để xem khu vực hoạt động.'
        : areas.length ? 'Khu vực chưa phân loại sẽ được ghi nhận cho hoạt động khi lưu.' : 'Boong này không có khu vực phù hợp. Chọn boong khác.'}>
      <select id="program-activity-area" name="areaId" required value={areaId}
        onChange={event => setAreaId(event.target.value)} aria-required="true">
        <option value="">Chọn khu vực hoạt động</option>
        {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
      </select>
    </Field>}
    {!options.cabins && cabinId && <input type="hidden" name="cabinId" value={cabinId} />}
  </>
}
