import { useState } from 'react'
import { Outlet } from 'react-router'
import { BookingContext } from '../model/booking-context'
import { initialDraft } from '../model/booking-draft'
import { defaultScenario } from '../model/booking-scenarios'

export function BookingProvider() {
  const [draft, setDraft] = useState(initialDraft)
  const [scenario, setScenario] = useState(defaultScenario)

  return (
    <BookingContext.Provider value={{ draft, setDraft, scenario, setScenario }}>
      <Outlet />
    </BookingContext.Provider>
  )
}
