import { useId, useRef, useState, type SubmitEvent } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Modal, Notice } from '@/shared/ui'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useMutation } from '../hooks/useAdminData'
import { entityPermission } from '../model/permissions'
import { fleetError, roomTypeLabels, validateShipEdit } from '../model/ship-management'
import type { Cabin, Deck, EntityKind, Ship, ShipDraft } from '../model/types'
import styles from './ShipManagement.module.css'

export type FleetEditTarget = { kind: 'ships'; item: Ship } | { kind: 'decks'; item: Deck } | { kind: 'cabins'; item: Cabin }
export function FleetEditDialog({ target, onClose, onSaved }: { target: FleetEditTarget; onClose: () => void; onSaved: (message: string) => void }) {
  const access = useSessionAccess()
  const permitted = access.canDo(entityPermission(target.kind, 'UPDATE'))
  const source = target.item
  const [draft, setDraft] = useState<ShipDraft>(target.kind === 'ships' ? target.item : { code: '', name: '', capacity: 1, totalDecks: 1, commissionDate: '', status: 'ACTIVE' })
  const [deckName, setDeckName] = useState(target.kind === 'decks' ? target.item.name : '')
  const [multiplier, setMultiplier] = useState(target.kind === 'decks' ? target.item.priceMultiplier ?? 1 : 1)
  const [capacity, setCapacity] = useState(target.kind === 'cabins' ? target.item.capacity : 1)
  const [accessible, setAccessible] = useState(target.kind === 'cabins' && target.item.accessible)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useMutation()
  const formId = useId()
  const form = useRef<HTMLFormElement>(null)
  const titles: Record<EntityKind, string> = { ships: 'Chỉnh sửa thông tin tàu', decks: 'Chỉnh sửa boong', cabins: 'Chỉnh sửa phòng' }
  const change = <K extends keyof ShipDraft>(key: K, value: ShipDraft[K]) => { setDraft(current => ({ ...current, [key]: value })); setErrors({}); mutation.clear() }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!permitted || mutation.busy) return
    let validation: Record<string, string> = {}
    if (target.kind === 'ships') validation = validateShipEdit(draft, target.item)
    else if (target.kind === 'decks') {
      if (deckName.length > 50) validation.name = 'Tên boong tối đa 50 ký tự.'
      if (!Number.isFinite(multiplier) || multiplier < .5 || multiplier > 5) validation.multiplier = 'Hệ số giá phải từ 0,50 đến 5,00.'
    } else if (!Number.isInteger(capacity) || capacity < 1 || capacity > 2147483647) validation.capacity = 'Sức chứa phải là số nguyên dương hợp lệ.'
    setErrors(validation)
    if (Object.keys(validation).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return }
    await mutation.run(async () => {
      if (target.kind === 'ships') await shipDeckCabinApi.saveShip(draft, source.id)
      else if (target.kind === 'decks') await shipDeckCabinApi.updateDeckOperations(source.id, deckName, multiplier)
      else await shipDeckCabinApi.saveCabin({ ...target.item, capacity, accessible }, source.id)
      onSaved('Thông tin đã được cập nhật.'); onClose()
    })
  }
  return <Modal title={titles[target.kind]} description={target.kind === 'ships' ? `${target.item.code} · ${target.item.name}` : `${target.kind === 'decks' ? 'Boong' : 'Phòng'} ${target.item.number}`} onClose={onClose} busy={mutation.busy} wide={target.kind === 'ships'}
    footer={<><Button tone="secondary" data-overlay-dismiss disabled={mutation.busy} onClick={onClose}>Hủy</Button><Button type="submit" form={formId} disabled={mutation.busy || !permitted}>{mutation.busy ? 'Đang lưu…' : 'Lưu thay đổi'}</Button></>}>
    {mutation.error && <Notice title="Chưa lưu được thay đổi" tone="error">{fleetError(mutation.error)}</Notice>}
    <form ref={form} id={formId} onSubmit={event => void submit(event)} noValidate className={styles.form}>
      {target.kind === 'ships' ? <>
        <Field htmlFor={`${formId}-name`} label="Tên tàu *" error={errors.name}><input id={`${formId}-name`} value={draft.name} maxLength={100} required disabled={mutation.busy} onChange={event => change('name', event.target.value)} /></Field>
        <div className={styles.formGrid}>
          <Field htmlFor={`${formId}-capacity`} label="Sức chứa hành khách *" error={errors.capacity}><input id={`${formId}-capacity`} type="number" min={1} step={1} value={draft.capacity || ''} required disabled={mutation.busy} onChange={event => change('capacity', Number(event.target.value))} /></Field>
          <Field htmlFor={`${formId}-decks`} label="Tổng số boong *" error={errors.totalDecks} hint="Số lượng boong, không phải số thứ tự boong cao nhất."><input id={`${formId}-decks`} type="number" min={1} step={1} value={draft.totalDecks || ''} required disabled={mutation.busy} onChange={event => change('totalDecks', Number(event.target.value))} /></Field>
          <Field htmlFor={`${formId}-length`} label="Chiều dài (m)" error={errors.dimensions}><input id={`${formId}-length`} type="number" min={.01} step="any" value={draft.lengthMeters ?? ''} disabled={mutation.busy} onChange={event => change('lengthMeters', event.target.value === '' ? null : Number(event.target.value))} /></Field>
          <Field htmlFor={`${formId}-beam`} label="Chiều rộng (m)"><input id={`${formId}-beam`} type="number" min={.01} step="any" value={draft.beamMeters ?? ''} disabled={mutation.busy} onChange={event => change('beamMeters', event.target.value === '' ? null : Number(event.target.value))} /></Field>
        </div>
        <Field htmlFor={`${formId}-date`} label="Ngày đưa vào hoạt động" error={errors.commissionDate} hint="Để trống để giữ nguyên ngày hiện tại."><input id={`${formId}-date`} type="date" value={draft.commissionDate} disabled={mutation.busy} onChange={event => change('commissionDate', event.target.value)} /></Field>
      </> : target.kind === 'decks' ? <>
        <p className={styles.muted}>Boong {target.item.number}. Số boong và vị trí trong mô hình được giữ nguyên khi cập nhật thông tin vận hành.</p>
        <Field htmlFor={`${formId}-name`} label="Tên boong" error={errors.name}><input id={`${formId}-name`} value={deckName} maxLength={50} disabled={mutation.busy} onChange={event => { setDeckName(event.target.value); setErrors({}); mutation.clear() }} /></Field>
        <Field htmlFor={`${formId}-multiplier`} label="Hệ số giá" error={errors.multiplier} hint="1,00 là giá gốc; 1,15 tương ứng tăng 15%."><input id={`${formId}-multiplier`} type="number" min={.5} max={5} step={.01} value={multiplier} disabled={mutation.busy} onChange={event => { setMultiplier(Number(event.target.value)); setErrors({}); mutation.clear() }} /></Field>
      </> : <>
        <dl className={styles.readonly}><div><dt>Số phòng</dt><dd>{target.item.number}</dd></div><div><dt>Loại phòng</dt><dd>{roomTypeLabels[target.item.type]}</dd></div></dl>
        <p className={styles.muted}>Loại phòng và thông tin 3D được cập nhật qua dữ liệu mô hình. Trạng thái vận hành được thay đổi bằng thao tác riêng.</p>
        <Field htmlFor={`${formId}-capacity`} label="Sức chứa hành khách *" error={errors.capacity}><input id={`${formId}-capacity`} type="number" min={1} step={1} value={capacity || ''} disabled={mutation.busy} required onChange={event => { setCapacity(Number(event.target.value)); setErrors({}); mutation.clear() }} /></Field>
        <label className={styles.checkbox}><input type="checkbox" checked={accessible} disabled={mutation.busy} onChange={event => { setAccessible(event.target.checked); mutation.clear() }} />Hỗ trợ người khuyết tật</label>
      </>}
    </form>
  </Modal>
}
