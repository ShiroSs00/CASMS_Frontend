import { useState } from 'react'
import { Button, Field, Modal, Panel } from '@/shared/ui'
import { blankBookingPerson, useLiveBooking } from '../model/live-booking-context'
import { groupPassengers, moveToGroup, personGroup, removePartyPerson } from '../model/booking-party'
import styles from './BookingParty.module.css'

export function BookingPartyStep() {
  const { draft, setDraft, personIds, setPersonIds, setErrors, setPartyConfirmed } = useLiveBooking()
  const [pending, setPending] = useState<(() => void) | null>(null)
  const groups = groupPassengers(draft.passengers)
  function change(action: () => void, protect: boolean) {
    if (protect) setPending(() => action)
    else action()
  }
  function changed() { setErrors({}); setPartyConfirmed(false) }
  return <Panel title="Ai sẽ cùng đi?">
    <div className={styles.section}>{draft.passengers.map((person, index) => <div className={styles.row} key={personIds[index] ?? index}>
      <strong>{person.fullName || `Hành khách ${index + 1}`}{index === 0 ? ' · Người đại diện' : ''}</strong>
      <Field htmlFor={`party-${index}-group`} label="Ở cùng phòng"><select id={`party-${index}-group`} value={personGroup(person)} onChange={event => {
        const key = event.target.value === '__new' ? crypto.randomUUID() : event.target.value
        change(() => { setDraft(d => ({ ...d, passengers: moveToGroup(d.passengers, index, key) })); changed() }, Boolean(person.cabinId))
      }}>{groups.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}<option value="__new">Phòng riêng mới</option></select></Field>
      {draft.passengers.length > 1 && <Button tone="text" onClick={() => change(() => {
        const result = removePartyPerson(draft.passengers, personIds, index)
        setDraft(d => ({ ...d, passengers: result.passengers })); setPersonIds(result.ids); changed()
      }, Boolean(person.fullName || person.email || person.documentNumber || person.cabinId || person.farePackageOfferId))}>Bỏ hành khách {index + 1}</Button>}
    </div>)}
    <div><Button tone="secondary" onClick={() => {
      setDraft(d => ({ ...d, passengers: [...d.passengers, { ...blankBookingPerson(), cabinGroupKey: personGroup(d.passengers[0]) }] }))
      setPersonIds(ids => [...ids, crypto.randomUUID()]); changed()
    }}>Thêm hành khách</Button></div>
    </div>
    {pending && <Modal title="Thay đổi người đi và phòng?" onClose={() => setPending(null)} footer={<>
      <Button tone="secondary" data-overlay-dismiss onClick={() => setPending(null)}>Giữ nguyên</Button>
      <Button onClick={() => { pending(); setPending(null) }}>Xác nhận thay đổi</Button>
    </>}><p>Thông tin của người còn lại được giữ nguyên. Lựa chọn cabin bị ảnh hưởng sẽ cần chọn lại.</p></Modal>}
  </Panel>
}
