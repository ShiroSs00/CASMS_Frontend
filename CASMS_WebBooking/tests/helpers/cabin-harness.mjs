// Test-only renderer seam. The real BookingProvider and selection handlers run unchanged.
import { createElement as h, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { BookingProvider } from '../../src/features/booking/components/BookingProvider.tsx'
import { BookingModelIntegration } from '../../src/features/booking/components/BookingModelIntegration.tsx'
import { CruisePackageCabinSelection } from '../../src/features/booking/components/CruisePackageCabinSelection.tsx'
import { BookingPartyStep } from '../../src/features/booking/components/BookingPartyStep.tsx'
import { initialLiveBooking, useLiveBooking } from '../../src/features/booking/model/live-booking-context.ts'
import '../../src/styles/tokens.css'

function FixtureSelection() {
  const { draft, setDraft, setPersonIds } = useLiveBooking()
  const fixture = window.__bookingFixture
  useEffect(() => {
    const initial = initialLiveBooking()
    setDraft({ ...initial, cruiseId: fixture.cruiseId, passengers: fixture.catalog.offers.map(o => ({ ...initial.passengers[0], farePackageOfferId: o.selection.offerId, farePackagePriceRevisionId: o.selection.priceRevisionId, cabinSelectionMode: 'PHYSICAL_CABIN' })) })
    setPersonIds(['fixture-1', 'fixture-2'])
  }, [fixture, setDraft, setPersonIds])
  return h('main', {}, h(BookingPartyStep), h(CruisePackageCabinSelection, { catalog: fixture.catalog, cabins: fixture.cabins, shipId: fixture.catalog.offers[0].selection.shipId }), h('output', { id: 'selected-cabins' }, draft.passengers.map(p => p.cabinId).join(',')))
}
function FixtureRenderer(context) {
  return h('div', {}, h('output', { id: 'model-selected' }, context.selectedCabinId ?? ''), ...context.cabins.map(c => h('button', { type: 'button', key: c.cabinId, 'data-model-cabin': c.cabinId, onClick: () => context.onSelectCabin(c.cabinId) }, c.cabinId)), h('button', { type: 'button', id: 'invalid-model-choice', onClick: () => context.onSelectCabin('outside-eligible-set') }, 'Synthetic invalid model choice'))
}
createRoot(document.getElementById('root')).render(h(MemoryRouter, {}, h(BookingModelIntegration, { value: FixtureRenderer }, h(Routes, {}, h(Route, { element: h(BookingProvider) }, h(Route, { path: '/', element: h(FixtureSelection) }))))))
