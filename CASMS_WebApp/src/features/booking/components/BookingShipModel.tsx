import { useState, type ReactNode } from 'react'
import { Field } from '@/shared/ui'
import type { AvailableCabin } from '../api/real-booking-api'
import { useLiveBooking } from '../model/live-booking-context'
import styles from './LiveBooking.module.css'

export type BookingModelContext = {
  shipId: string; cruiseId: string; selectedCabinId?: string
  cabins: Array<{ cabinId: string; remainingCapacity: number }>
  onSelectCabin: (id: string) => void
}
export type BookingModelRenderer = (context: BookingModelContext) => ReactNode

export function BookingShipModel({ shipId, cabins, render }: { shipId: string; cabins: AvailableCabin[]; render: BookingModelRenderer }) {
  const { draft, setDraft, setErrors } = useLiveBooking()
  const [requestedPerson, setPerson] = useState(0)
  const person = Math.min(requestedPerson, draft.passengers.length - 1)
  const inventory = cabins.map(cabin => ({ cabinId: cabin.cabinId, remainingCapacity: Math.max(0, cabin.remainingCapacity - draft.passengers.filter((other, index) => index !== person && other.cabinId === cabin.cabinId).length) }))
  function select(id: string) {
    // Selection in a GLB never substitutes for checking the current inventory.
    if (!inventory.some(cabin => cabin.cabinId === id && cabin.remainingCapacity > 0)) return
    setDraft(current => ({ ...current, passengers: current.passengers.map((value, index) => index === person ? { ...value, cabinId: id } : value) }))
    setErrors(current => { const next = { ...current }; delete next[`person-${person}-cabinId`]; return next })
  }
  return <section className={styles.stack} aria-label="Chọn phòng trên mô hình 3D">
    <Field htmlFor="model-booking-person" label="Chọn phòng 3D cho hành khách"><select id="model-booking-person" value={person} onChange={event => setPerson(Number(event.target.value))}>{draft.passengers.map((value, index) => <option key={index} value={index}>Hành khách {index + 1}{value.fullName ? ` · ${value.fullName}` : ''}</option>)}</select></Field>
    {render({ shipId, cruiseId: draft.cruiseId, selectedCabinId: draft.passengers[person]?.cabinId, cabins: inventory, onSelectCabin: select })}
  </section>
}
