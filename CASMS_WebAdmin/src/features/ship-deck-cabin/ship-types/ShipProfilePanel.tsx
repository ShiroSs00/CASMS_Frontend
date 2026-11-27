import { useCallback, useId, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Field, FormErrorSummary, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { refreshShipStructure } from '@/shared/lib/ship-structure-revision'
import { shipTypesApi, shipError, type OperationalProfile } from './api'
import { ProfileFacts, ProfileFields } from './ProfileFields'
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
  const formId = useId()
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
  return <Modal wide title="Chỉnh sửa hồ sơ vận hành" description="Cập nhật thông tin bàn giao, đăng ký, đăng kiểm và tham chiếu hồ sơ." busy={busy} onClose={onClose}
    footer={<><Button tone="secondary" data-overlay-dismiss disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" form={formId} busy={busy}>Lưu hồ sơ</Button></>}>
    <form id={formId} className={styles.profileEditor} ref={form} noValidate onSubmit={event => { event.preventDefault(); void save() }}>
      {error && <Notice title="Chưa lưu được hồ sơ" tone="error">{error}</Notice>}
      <FormErrorSummary errors={errors} />
      <ProfileFields draft={draft} errors={errors} disabled={busy}
        onChange={(key, value) => { setDraft(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })) }}
        onBlur={key => setErrors(current => ({ ...current, [key]: validateProfile(draft)[key] }))} />
    </form>
  </Modal>
}

export function ShipProfilePanel({ id, readOnly = false }: { id: string; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const load = useCallback((signal: AbortSignal) => shipTypesApi.profile(id, signal), [id])
  const result = useReadQuery('operational-profile:' + id, load)
  return <Panel className={styles.profilePanel}>
    <div className={styles.profileHeader}><div><h3>Hồ sơ vận hành</h3><p>{readOnly ? 'Hồ sơ ở chế độ chỉ đọc.' : 'Thông tin bàn giao, đăng ký, đăng kiểm và các hồ sơ liên quan.'}</p></div>
      {!readOnly && !result.loading && !result.error && <Button tone="secondary" autoWidth onClick={() => { setSaved(false); setEditing(true) }}>Chỉnh sửa hồ sơ vận hành</Button>}
    </div>
    {result.loading && <Loading label="Đang tải hồ sơ…" />}
    {result.error && <Notice title="Chưa tải được hồ sơ" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
    {saved && <Notice title="Đã lưu hồ sơ" tone="success">Hồ sơ vận hành đã cập nhật.</Notice>}
    {!result.loading && !result.error && <>
      {result.data && Object.keys(result.data).length ? <ProfileFacts profile={result.data} className={styles.profileRecord} /> :
        <div className={styles.profileEmpty}><strong>Chưa bổ sung hồ sơ vận hành</strong><p>Bổ sung thông tin đăng kiểm, chứng nhận, bảo hành và bảo trì trước khi đổi trạng thái tàu.</p></div>}
    </>}
    {editing && !readOnly && <ProfileEditor id={id} initial={result.data} onClose={() => setEditing(false)}
      onSave={() => { setEditing(false); setSaved(true); result.retry() }} />}
  </Panel>
}

export function ShipRenameDialog({ id, initial, onClose }: { id: string; initial: string; onClose: () => void }) {
  const formId = useId()
  const [name, setName] = useState(initial)
  const [nameError, setNameError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function save() {
    if (lock.current) return
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Vui lòng nhập tên tàu hợp lệ (không để trống hoặc chỉ gồm khoảng trắng).')
      return
    }
    if (trimmed === initial.trim()) {
      setNameError('Tên mới đang trùng với tên tàu hiện tại.')
      return
    }
    lock.current = true
    setNameError('')
    setError('')
    setBusy(true)
    try {
      await shipTypesApi.rename(id, trimmed)
      refreshShipStructure()
      onClose()
    } catch (failure) {
      setError(shipError(failure))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <Modal
    title="Đổi tên tàu"
    busy={busy}
    onClose={() => { if (!busy) onClose() }}
    footer={<>
      <Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={onClose}>Hủy</Button>
      <Button type="submit" form={formId} busy={busy} disabled={busy}>Lưu tên tàu</Button>
    </>}
  >
    <form id={formId} noValidate onSubmit={event => { event.preventDefault(); void save() }}>
      <Field htmlFor="ship-rename" label="Tên tàu *" error={nameError || undefined}>
        <input
          id="ship-rename"
          value={name}
          maxLength={100}
          required
          disabled={busy}
          aria-invalid={Boolean(nameError)}
          onChange={event => {
            setName(event.target.value)
            if (nameError) setNameError('')
          }}
        />
      </Field>
      {error && <Notice title="Chưa đổi được tên tàu" tone="error">{error}</Notice>}
    </form>
  </Modal>
}
