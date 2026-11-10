import { useState } from 'react'
import { ShipVenueCabinField, ShipVenueDeckField, type ShipVenueCabin, type ShipVenueOptions } from '@/domain/ship-venue'

export type CruiseVenueOptions = ShipVenueOptions & { cabins?: ShipVenueCabin[] }

export function CruiseActivityVenueFields({ options, initialDeckId = null, initialCabinId = null }: {
  options: CruiseVenueOptions
  initialDeckId?: string | null
  initialCabinId?: string | null
}) {
  const [deckId, setDeckId] = useState(initialDeckId)
  const [cabinId, setCabinId] = useState(initialCabinId)
  const validDeck = options.decks.some(deck => deck.id === deckId && deck.shipId === options.ship.id)
  const cabins = validDeck
    ? (options.cabins ?? []).filter(cabin => cabin.shipId === options.ship.id && cabin.deckId === deckId)
    : []

  return <>
    <ShipVenueDeckField
      options={options}
      value={deckId}
      onChange={nextDeckId => {
        setDeckId(nextDeckId)
        setCabinId(null)
      }}
    />
    <ShipVenueCabinField
      cabins={cabins}
      value={cabinId}
      onChange={setCabinId}
      disabled={!validDeck || !options.cabins || (cabins.length === 0 && !cabinId)}
      hint={!validDeck ? 'Chọn boong để xem phòng.' : options.cabins && cabins.length === 0 ? 'Boong đã chọn không có phòng. Có thể nhập địa điểm bên dưới.' : undefined}
      error={validDeck && !options.cabins ? 'Chưa tải được danh sách phòng của tàu.' : undefined}
    />
    {!options.cabins && cabinId && <input type="hidden" name="cabinId" value={cabinId} />}
  </>
}
