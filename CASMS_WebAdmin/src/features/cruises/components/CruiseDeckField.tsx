import { useState } from 'react'
import { ShipVenueDeckField, type ShipVenueOptions } from '@/domain/ship-venue'

export type { ShipVenueOptions as CruiseVenueOptions } from '@/domain/ship-venue'

export function CruiseActivityVenueFields({ options, initialDeckId = null }: {
  options: ShipVenueOptions
  initialDeckId?: string | null
  initialCabinId?: string | null
}) {
  const [deckId, setDeckId] = useState(initialDeckId)
  return (
    <ShipVenueDeckField
      options={options}
      value={deckId}
      onChange={setDeckId}
    />
  )
}
