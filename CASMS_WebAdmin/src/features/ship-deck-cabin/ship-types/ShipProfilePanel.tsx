import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Empty, Field, FormErrorSummary, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { refreshShipStructure } from '@/shared/lib/ship-structure-revision'
import { shipTypesApi, shipError, type OperationalProfile } from './api'
import { ManufacturingFacts, ProfileFacts, ProfileFields } from './ProfileFields'
import { profilePayload, toProfileDraft, validateProfile, type ProfileErrors } from './profile'
import styles from './ShipWork.module.css'

function ProfileEditor({ id, initial, onClose, onSave }: {
  id: string; initial: OperationalProfile | null; onClose: () => void; onSave: () => void
}) {
  const [draft, setDraft] = useState(() => toProfileDraft(initial))
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  async function save() {
    if (lock.current) return
    const validation = validateProfile(draft)
    setErrors(validation)
    if (Object.keys(validation).length) {
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    lock.current = true
    setError('')
    setBusy(true)
    try {
      await shipTypesApi.saveProfile(id, profilePayload(draft))
      refreshShipStructure()
      onSave()
    } catch (failure) {
      setError(shipError(failure))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <Modal wide title="Chỉnh sửa hồ sơ vận hành" busy={busy} onClose={onClose}>
    <form ref={form} noValidate onSubmit={event => { event.preventDefault(); void save() }}>
      {error && <Notice title="Chưa lưu được hồ sơ" tone="error">{error}</Notice>}
      <FormErrorSummary errors={errors} />
      <ProfileFields draft={draft} errors={errors} disabled={busy} importedProfile={initial}
        onChange={(key, value) => { setDraft(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })) }}
        onBlur={key => setErrors(current => ({ ...current, [key]: validateProfile(draft)[key] }))} />
      <div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" busy={busy}>Lưu hồ sơ</Button></div>
    </form>
  </Modal>
}

export function ShipProfilePanel({ id }: { id: string }) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const load = useCallback((signal: AbortSignal) => shipTypesApi.profile(id, signal), [id])
  const result = useReadQuery('operational-profile:' + id, load)
  return <Panel title="Hồ sơ vận hành">
    {result.loading && <Loading label="Đang tải hồ sơ…" />}
    {result.error && <Notice title="Chưa tải được hồ sơ" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
    {saved && <Notice title="Đã lưu hồ sơ" tone="success">Hồ sơ vận hành đã cập nhật.</Notice>}
    {!result.loading && !result.error && <>
      <ManufacturingFacts profile={result.data} />
      {result.data && Object.keys(result.data).length ? <ProfileFacts profile={result.data} /> :
        <Empty title="Chưa bổ sung hồ sơ vận hành">Bổ sung thông tin đăng kiểm, chứng nhận, bảo hành và bảo trì trước khi đổi trạng thái tàu.</Empty>}
      <div className={styles.actions}><Button tone="secondary" onClick={() => setEditing(true)}>Chỉnh sửa hồ sơ vận hành</Button></div>
    </>}
    {editing && <ProfileEditor id={id} initial={result.data} onClose={() => setEditing(false)}
      onSave={() => { setEditing(false); setSaved(true); result.retry() }} />}
  </Panel>
}

export function ShipRenameDialog({ id, initial, onClose }: { id: string; initial: string; onClose: () => void }) {
  const [name, setName] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function save() {
    if (lock.current || !name.trim()) return
    lock.current = true
    setError('')
    setBusy(true)
    try {
      await shipTypesApi.rename(id, name.trim())
      refreshShipStructure()
      onClose()
    } catch (failure) {
      setError(shipError(failure))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <Modal title="Đổi tên tàu" busy={busy} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); void save() }}>
      <Field htmlFor="ship-rename" label="Tên tàu *"><input value={name} maxLength={100} required disabled={busy}
        onChange={event => setName(event.target.value)} /></Field>
      {error && <Notice title="Chưa đổi được tên tàu" tone="error">{error}</Notice>}
      <div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={onClose}>Hủy</Button>
        <Button type="submit" busy={busy} disabled={!name.trim() || initial === name.trim()}>Lưu tên tàu</Button></div>
    </form>
  </Modal>
}
