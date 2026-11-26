import { useState } from 'react'
import { Button, Field, Modal, Panel } from '@/shared/ui'
import { blankBookingPerson, useLiveBooking } from '../model/live-booking-context'
import { groupPassengers, moveToGroup, personGroup, removePartyPerson } from '../model/booking-party'
import styles from './BookingParty.module.css'

const partyPresets = [
  { label: 'Đi một mình', sub: '1 khách · 1 phòng', rooms: [1] },
  { label: 'Cặp đôi / Bạn bè', sub: '2 khách · 1 phòng', rooms: [2] },
  { label: 'Nhóm nhỏ', sub: '3 khách · 1 phòng', rooms: [3] },
  { label: 'Gia đình', sub: '4 khách · 2 phòng', rooms: [2, 2] },
] as const

export function BookingPartyStep() {
  const { draft, setDraft, personIds, setPersonIds, setErrors, setPartyConfirmed } = useLiveBooking()
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [showAdvancedMove, setShowAdvancedMove] = useState(false)
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

  function applyPreset(roomSizes: readonly number[]) {
    const totalNeeded = roomSizes.reduce((a, b) => a + b, 0)
    const hasExtraData = draft.passengers.slice(totalNeeded).some((_, i) => hasPersonData(totalNeeded + i))
    change(() => {
      const lead = draft.passengers[0] ?? blankBookingPerson()
      const nextPassengers: typeof draft.passengers = []
      const nextIds: string[] = []
      let cursor = 0
      roomSizes.forEach((size, roomIdx) => {
        const groupKey = roomIdx === 0 ? (lead.cabinGroupKey || 'room-1') : crypto.randomUUID()
        for (let i = 0; i < size; i++) {
          const existing = draft.passengers[cursor]
          nextPassengers.push({
            ...(existing ?? blankBookingPerson()),
            cabinGroupKey: groupKey,
          })
          nextIds.push(personIds[cursor] ?? crypto.randomUUID())
          cursor++
        }
      })
      setDraft(d => ({ ...d, passengers: nextPassengers }))
      setPersonIds(nextIds)
      changed()
    }, hasExtraData)
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

  function removeRoom(groupKey: string) {
    const indicesToRemove = draft.passengers
      .map((p, idx) => (personGroup(p) === groupKey ? idx : -1))
      .filter(idx => idx > 0)
    if (!indicesToRemove.length) return
    const protect = indicesToRemove.some(hasPersonData)
    change(() => {
      const removeSet = new Set(indicesToRemove)
      setDraft(d => ({ ...d, passengers: d.passengers.filter((_, idx) => !removeSet.has(idx)) }))
      setPersonIds(ids => ids.filter((_, idx) => !removeSet.has(idx)))
      changed()
    }, protect)
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

  const currentShape = groups.map(g => g.members.length).join(',')

  return <Panel title="Số phòng &amp; hành khách đi cùng">
    <div className={styles.section}>
      <div className={styles.presetGrid} role="group" aria-label="Chọn nhanh số khách và số phòng">
        {partyPresets.map(preset => {
          const active = currentShape === preset.rooms.join(',')
          return <button
            key={preset.label}
            type="button"
            className={`${styles.presetCard} ${active ? styles.presetCardActive : ''}`}
            aria-pressed={active}
            onClick={() => applyPreset(preset.rooms)}
          >
            <strong>{preset.label}</strong>
            <span>{preset.sub}</span>
          </button>
        })}
      </div>

      <div className={styles.roomList}>
        {groups.map(group => {
          const isLeadRoom = group.members.includes(0)
          const lastMemberIndex = group.members[group.members.length - 1]
          const canDecrease = draft.passengers.length > 1 && group.members.length > 1
          return <section className={styles.roomCard} key={group.key} aria-label={group.label}>
            <div className={styles.roomCardHead}>
              <div className={styles.roomCardMeta}>
                <div className={styles.roomTitleRow}>
                  <span className={styles.roomIndexBadge}>{group.label}</span>
                  {isLeadRoom && <span className={styles.leadTag}>Người đại diện</span>}
                </div>
                <p className={styles.muted}>
                  {group.members.length} hành khách
                </p>
              </div>
              <div className={styles.roomCardRight}>
                <div className={styles.guestStepper} role="group" aria-label={`Số khách trong ${group.label}`}>
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
                {!isLeadRoom && (
                  <Button tone="text" size="compact" autoWidth onClick={() => removeRoom(group.key)}>
                    Xóa phòng
                  </Button>
                )}
              </div>
            </div>
          </section>
        })}
      </div>

      <div className={styles.partyActions}>
        <Button tone="secondary" autoWidth onClick={addRoom}>+ Thêm phòng khác</Button>
        {groups.length > 1 && draft.passengers.length > 2 && (
          <Button tone="text" autoWidth onClick={() => setShowAdvancedMove(v => !v)}>
            {showAdvancedMove ? 'Ẩn tùy chỉnh chuyển phòng' : 'Chuyển khách giữa các phòng'}
          </Button>
        )}
      </div>

      {showAdvancedMove && groups.length > 1 && (
        <div className={styles.roomGuestList}>
          {draft.passengers.map((person, index) => (
            <div className={styles.row} key={personIds[index] ?? index}>
              <div className={styles.guestIdentity}>
                <strong>{person.fullName || `Hành khách ${index + 1}`}</strong>
                {index === 0 && <span className={styles.leadTag}>Người đại diện</span>}
              </div>
              <div className={styles.guestControls}>
                <Field htmlFor={`party-${index}-group`} label="Phòng">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {pending && <Modal title="Xác nhận thay đổi số khách" onClose={() => setPending(null)}>
      <p>Thao tác này sẽ bỏ thông tin hoặc phòng đã chọn của hành khách bị giảm. Bạn có muốn tiếp tục?</p>
      <div className={styles.partyActions}>
        <Button tone="secondary" autoWidth onClick={() => setPending(null)}>Giữ nguyên</Button>
        <Button autoWidth onClick={() => { pending(); setPending(null) }}>Xác nhận thay đổi</Button>
      </div>
    </Modal>}
  </Panel>
}
