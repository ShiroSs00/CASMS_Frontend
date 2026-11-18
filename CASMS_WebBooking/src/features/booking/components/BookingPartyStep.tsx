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

  function changed() {
    setErrors({})
    setPartyConfirmed(false)
  }

  function hasPersonData(index: number) {
    const person = draft.passengers[index]
    if (!person) return false
    return Boolean(person.fullName || person.email || person.documentNumber || person.cabinId || person.farePackageOfferId)
  }

  function addGuestToGroup(groupKey: string) {
    setDraft(d => ({
      ...d,
      passengers: [...d.passengers, { ...blankBookingPerson(), cabinGroupKey: groupKey }],
    }))
    setPersonIds(ids => [...ids, crypto.randomUUID()])
    changed()
  }

  function removeGuest(index: number) {
    change(() => {
      const result = removePartyPerson(draft.passengers, personIds, index)
      setDraft(d => ({ ...d, passengers: result.passengers }))
      setPersonIds(result.ids)
      changed()
    }, hasPersonData(index))
  }

  function addRoom() {
    const newKey = crypto.randomUUID()
    setDraft(d => ({
      ...d,
      passengers: [...d.passengers, { ...blankBookingPerson(), cabinGroupKey: newKey }],
    }))
    setPersonIds(ids => [...ids, crypto.randomUUID()])
    changed()
  }

  return <Panel title="Hành trình của bạn bắt đầu tại đây" subtitle="Xác nhận số phòng và số lượng hành khách đi cùng.">
    <div className={styles.section}>
      {groups.map((group, groupIndex) => {
        const lastMemberIndex = group.members[group.members.length - 1]
        const canDecrease = draft.passengers.length > 1 && group.members.length > 1
        return <section className={styles.roomCard} key={group.key} aria-label={`Cấu hình ${group.label}`}>
          <div className={styles.roomCardHead}>
            <div>
              <h3>Cấu hình {group.label}</h3>
              <p className={styles.muted}>
                {group.members.includes(0) ? 'Bao gồm người đại diện liên hệ · ' : ''}
                {group.members.length} hành khách trong phòng này
              </p>
            </div>
            {/* UX: Fitts's Law — 44x44px stepper controls for quick guest adjustment */}
            <div className={styles.guestStepper} role="group" aria-label={`Số khách trong ${group.label}`}>
              <span className={styles.stepperLabel}>Số khách</span>
              <div className={styles.stepperControls}>
                <button
                  type="button"
                  className={styles.stepperBtn}
                  aria-label={`Giảm 1 khách trong ${group.label}`}
                  disabled={!canDecrease}
                  onClick={() => removeGuest(lastMemberIndex)}
                >−</button>
                <span className={styles.stepperCount} aria-live="polite">{group.members.length}</span>
                <button
                  type="button"
                  className={styles.stepperBtn}
                  aria-label={`Thêm 1 khách vào ${group.label}`}
                  onClick={() => addGuestToGroup(group.key)}
                >+</button>
              </div>
            </div>
          </div>

          <div className={styles.roomGuestList}>
            {group.members.map(index => {
              const person = draft.passengers[index]
              return <div className={styles.row} key={personIds[index] ?? index}>
                <div className={styles.guestIdentity}>
                  <strong>{person.fullName || `Hành khách ${index + 1}`}</strong>
                  {index === 0 && <span className={styles.leadTag}>Người đại diện</span>}
                </div>
                <div className={styles.guestControls}>
                  <Field htmlFor={`party-${index}-group`} label="Ở cùng phòng">
                    <select id={`party-${index}-group`} value={personGroup(person)} onChange={event => {
                      const key = event.target.value === '__new' ? crypto.randomUUID() : event.target.value
                      change(() => {
                        setDraft(d => ({ ...d, passengers: moveToGroup(d.passengers, index, key) }))
                        changed()
                      }, Boolean(person.cabinId))
                    }}>
                      {groups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                      <option value="__new">Phòng riêng mới</option>
                    </select>
                  </Field>
                  {draft.passengers.length > 1 && <Button tone="text" onClick={() => removeGuest(index)}>
                    Bỏ hành khách {index + 1}
                  </Button>}
                </div>
              </div>
            })}
          </div>
          {groupIndex === groups.length - 1 && <p className={styles.roomHint}>
            Mỗi phòng sẽ chọn một cabin hoặc hạng cabin phù hợp ở bước tiếp theo.
          </p>}
        </section>
      })}

      <div className={styles.partyActions}>
        <Button tone="secondary" autoWidth onClick={() => addGuestToGroup(personGroup(draft.passengers[0]))}>
          Thêm hành khách
        </Button>
        <Button tone="secondary" autoWidth onClick={addRoom}>
          + Thêm phòng khác
        </Button>
      </div>
    </div>

    {pending && <Modal title="Thay đổi người đi và phòng?" onClose={() => setPending(null)} footer={<>
      <Button tone="secondary" data-overlay-dismiss onClick={() => setPending(null)}>Giữ nguyên</Button>
      <Button onClick={() => { pending(); setPending(null) }}>Xác nhận thay đổi</Button>
    </>}><p>Thông tin của người còn lại được giữ nguyên. Lựa chọn cabin bị ảnh hưởng sẽ cần chọn lại.</p></Modal>}
  </Panel>
}
