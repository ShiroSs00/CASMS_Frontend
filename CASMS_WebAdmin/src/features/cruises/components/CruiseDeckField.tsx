import { useCallback, useState } from 'react'
import { readShipVenueCabins, ShipVenueCabinField, ShipVenueDeckField, type ShipVenueOptions } from '@/domain/ship-venue'
import { useReadQuery } from '@/shared/api'
import { Button, Notice } from '@/shared/ui'

export type { ShipVenueOptions as CruiseVenueOptions } from '@/domain/ship-venue'

export function CruiseActivityVenueFields({ options, initialDeckId = null, initialCabinId = null }: {
  options: ShipVenueOptions
  initialDeckId?: string | null
  initialCabinId?: string | null
}) {
  const [deckId, setDeckId] = useState(initialDeckId)
  const [cabinId, setCabinId] = useState(initialCabinId)
  const shipId = options.ship.id
  const validDeck = options.decks.some(deck => deck.id === deckId && deck.shipId === shipId)
  const cabins = useReadQuery(`cruise-activity-venue:${shipId}:${deckId}:${validDeck}`, useCallback(
    signal => shipId && deckId && validDeck ? readShipVenueCabins(shipId, deckId, signal) : Promise.resolve([]),
    [shipId, deckId, validDeck],
  ))
  return <>
    <ShipVenueDeckField options={options} value={deckId} onChange={next => {
      setDeckId(next)
      setCabinId(null)
    }}/>
    {validDeck && <>
      {cabins.loading && <p role="status">Đang tải cabin/phòng của boong…</p>}
      {cabins.error && <Notice title="Chưa tải được cabin/phòng" tone="error"><Button tone="secondary" onClick={cabins.retry}>Tải lại</Button></Notice>}
      <ShipVenueCabinField cabins={cabins.data ?? []} value={cabinId}
        disabled={cabins.loading || Boolean(cabins.error)} onChange={setCabinId}/>
    </>}
    {cabinId && (!validDeck || cabins.loading || cabins.error) && <input type="hidden" name="cabinId" value={cabinId}/>}
  </>
}
