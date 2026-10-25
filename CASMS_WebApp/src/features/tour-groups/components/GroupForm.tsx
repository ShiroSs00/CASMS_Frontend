import { PermissionLink as Link } from '@/shared/ui'
import { useState, type FormEvent } from 'react'

import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, FormErrorSummary, Loading, Notice } from '@/shared/ui'
import { listExcursionOptions } from '../api/group-context-api'
import { canUseGroupExcursion, displayTime, emptyGroupForm, excursionGroupDefaults, formToGroupRequest, groupToForm, inheritedGroupFields, validateGroupForm, type GroupFormValues, type GroupRequest, type TourGroup } from '../model/tour-group'
import styles from './TourGroups.module.css'

type InheritedField = typeof inheritedGroupFields[number]
const fields: { key: InheritedField; label: string; type?: string; maxLength?: number }[] = [
  { key: 'maximumCapacity', label: 'Sức chứa tối đa', type: 'number' },
  { key: 'meetingPoint', label: 'Điểm tập trung', maxLength: 250 },
  { key: 'plannedDepartureTime', label: 'Giờ khởi hành dự kiến', type: 'datetime-local' },
  { key: 'plannedReturnTime', label: 'Giờ trở về dự kiến', type: 'datetime-local' },
  { key: 'assemblyTime', label: 'Giờ tập trung', type: 'datetime-local' },
]
export function GroupForm({ initial, initialExcursionId = '', busy, onSave }: { initial?: TourGroup; initialExcursionId?: string; busy: boolean; onSave: (request: GroupRequest) => Promise<void> }) {
  const access = useSessionAccess()
  const excursions = useReadQuery('group-excursion-options', listExcursionOptions)
  const [excursionId, setExcursionId] = useState(initial?.shoreExcursionId ?? initialExcursionId)
  const [contextError, setContextError] = useState('')
  const [draft, setDraft] = useState<Partial<GroupFormValues>>(() => {
    if (!initial) return {}
    const saved: Partial<GroupFormValues> = groupToForm(initial)
    for (const key of inheritedGroupFields) if (!saved[key]) delete saved[key]
    return saved
  })
  const [errors, setErrors] = useState<Partial<Record<keyof GroupFormValues, string>>>({})
  const selected = excursions.data?.find(item => item.shoreExcursionId === excursionId)
  const inherited = excursionGroupDefaults(selected)
  const values: GroupFormValues = { ...emptyGroupForm, ...inherited, ...draft, shoreExcursionId: excursionId }
  const missingFields = fields.filter(field => !inherited[field.key])
  const adjustableFields = fields.filter(field => Boolean(inherited[field.key]))
  const customCount = adjustableFields.filter(field => values[field.key] !== inherited[field.key]).length
  function resetInherited(includeMissing = false) {
    setDraft(previous => {
      const next = { ...previous }
      for (const key of inheritedGroupFields) if (includeMissing || inherited[key]) delete next[key]
      return next
    })
    setErrors({}); setContextError('')
  }
  function change(key: keyof GroupFormValues, value: string) {
    setDraft(previous => ({ ...previous, [key]: value }))
    setErrors(previous => { const next = { ...previous }; delete next[key]; return next })
    setContextError('')
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !access.has(initial ? 'TOUR_GROUP_UPDATE' : 'TOUR_GROUP_CREATE')) return
    if (excursions.loading || excursions.error) { setContextError('Chưa tải được chuyến tham quan. Vui lòng tải lại danh sách trước khi lưu.'); return }
    setContextError('')
    const next = validateGroupForm(values, selected, initial?.assignedPassengers ?? 0)
    if (!selected) next.shoreExcursionId = 'Chọn chuyến tham quan từ danh sách đã tải.'
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) {
      const input = event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)
      input?.closest('details')?.setAttribute('open', '')
      input?.focus()
      return
    }
    void onSave(formToGroupRequest(values))
  }
  function renderField({ key, label, type = 'text', maxLength }: typeof fields[number]) {
    return <Field key={key} htmlFor={`group-${key}`} label={`${label} *`} error={errors[key]} hint={key === 'maximumCapacity' && selected?.maximumCapacity != null ? `Tối đa ${selected.maximumCapacity} khách, theo sức chứa chuyến tham quan.` : undefined}>
      <input id={`group-${key}`} name={key} type={type} required maxLength={maxLength} value={values[key]}
        min={type === 'number' ? Math.max(1, initial?.assignedPassengers ?? 0) : key === 'plannedDepartureTime' && inherited.plannedDepartureTime ? inherited.plannedDepartureTime : undefined}
        max={type === 'number' ? selected?.maximumCapacity ?? 2147483647 : key === 'plannedReturnTime' && inherited.plannedReturnTime ? inherited.plannedReturnTime : undefined}
        step={type === 'number' ? 1 : type === 'datetime-local' ? 60 : undefined}
        aria-invalid={!!errors[key]} onChange={event => change(key, event.target.value)} />
    </Field>
  }
  return <>
    <p className={styles.hint}>Chọn chuyến tham quan để lấy sẵn sức chứa, điểm tập trung và lịch trình. Chỉ bổ sung thông tin còn thiếu hoặc điều chỉnh riêng khi cần.</p>
    {excursions.loading && <Loading label="Đang tải chuyến tham quan…" />}
    {excursions.error && <Notice title="Không tải được chuyến tham quan" tone="error">{excursions.error.message}<Button tone="secondary" onClick={excursions.retry}>Thử lại</Button></Notice>}
    {!excursions.loading && excursions.data?.length === 0 && <Notice title="Chưa có chuyến tham quan">Cần có chuyến tham quan trước khi tạo nhóm. <Link to="/admin/shore-excursions">Mở chuyến tham quan</Link></Notice>}
    {contextError && <Notice title="Kiểm tra chuyến tham quan" tone="error">{contextError}</Notice>}
    <p className={styles.hint}>Thời gian theo múi giờ trình duyệt: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Các trường có dấu * là bắt buộc.</p>
    <form className={styles.form} onSubmit={submit} noValidate><fieldset disabled={busy}>
      <div className={styles.fullRow}><FormErrorSummary errors={errors} /></div>
      <div className={styles.fullRow}><Field htmlFor="group-shoreExcursionId" label="Chuyến tham quan *" error={errors.shoreExcursionId} hint="Khi đổi chuyến tham quan, sức chứa, điểm tập trung và lịch trình của nhóm sẽ lấy theo chuyến mới.">
        <select id="group-shoreExcursionId" name="shoreExcursionId" required value={excursionId} disabled={excursions.loading || Boolean(excursions.error)} onChange={event => { setExcursionId(event.target.value); resetInherited(true) }}>
          <option value="">Chọn chuyến tham quan</option>
          {excursions.data?.map(item => <option key={item.shoreExcursionId} value={item.shoreExcursionId} disabled={!canUseGroupExcursion(item)}>{item.excursionName}{item.excursionCode ? ` · ${item.excursionCode}` : ''}{item.startTime ? ` · ${displayTime(item.startTime)}` : ''}{!canUseGroupExcursion(item) ? ' · Không thể tạo hoặc chỉnh sửa nhóm' : ''}</option>)}
        </select>
      </Field></div>
      {selected && <>
        <section className={styles.excursionContext} aria-label="Thông tin từ chuyến tham quan">
          <strong>Thông tin từ chuyến tham quan</strong>
          <dl className={styles.contextFacts}>
            <div><dt>Chuyến tham quan</dt><dd>{selected.excursionName}</dd></div>
            <div><dt>Sức chứa tối đa</dt><dd>{selected.maximumCapacity == null ? 'Chưa có — bổ sung bên dưới' : `${selected.maximumCapacity} khách`}</dd></div>
            <div><dt>Điểm tập trung</dt><dd>{selected.meetingPoint || 'Chưa có — bổ sung bên dưới'}</dd></div>
            <div><dt>Tập trung / khởi hành</dt><dd>{selected.startTime ? displayTime(selected.startTime) : 'Chưa có — bổ sung bên dưới'}</dd></div>
            <div><dt>Trở về dự kiến</dt><dd>{selected.plannedReturnTime ? displayTime(selected.plannedReturnTime) : 'Chưa có — bổ sung bên dưới'}</dd></div>
          </dl>
          <p className={styles.hint}>{initial || customCount > 0 ? 'Nhóm đang có thông tin riêng. Mở phần điều chỉnh để xem hoặc thay đổi.' : 'Nhóm sẽ dùng các thông tin trên. Giờ tập trung mặc định bằng giờ bắt đầu chuyến tham quan.'} <Link className={styles.link} to={`/admin/shore-excursions/${selected.shoreExcursionId}`}>Xem chuyến tham quan</Link></p>
        </section>
        {missingFields.length > 0 && <section className={styles.formSection} aria-labelledby="group-missing-title">
          <h3 id="group-missing-title">Bổ sung thông tin còn thiếu</h3>
          <p className={styles.hint}>Chuyến tham quan chưa có các thông tin này. Nhập một lần cho nhóm để hoàn thiện lịch trình.</p>
          <div className={styles.fieldGrid}>{missingFields.map(renderField)}</div>
        </section>}
        {adjustableFields.length > 0 && <details className={styles.customization} open={initial ? true : undefined}>
          <summary>Điều chỉnh riêng cho nhóm{customCount > 0 && <span className={styles.customCount}>Đã điều chỉnh {customCount} thông tin</span>}</summary>
          <div className={styles.customizationBody}>
            <p className={styles.hint}>Có thể giảm sức chứa để chia nhóm hoặc đổi điểm tập trung, lịch trình trong phạm vi chuyến tham quan.</p>
            <div className={styles.fieldGrid}>{adjustableFields.map(renderField)}</div>
            <div className={styles.resetActions}><Button tone="secondary" onClick={() => resetInherited()}>Lấy lại thông tin chuyến tham quan</Button></div>
          </div>
        </details>}
        <div className={styles.fullRow}><Field htmlFor="group-notes" label="Ghi chú riêng cho nhóm (không bắt buộc)" error={errors.notes}><textarea id="group-notes" name="notes" maxLength={500} value={values.notes} aria-invalid={!!errors.notes} onChange={event => change('notes', event.target.value)} /></Field></div>
        <p className={`${styles.hint} ${styles.fullRow}`}>Hướng dẫn viên và hành khách được phân công trong trang chi tiết sau khi tạo nhóm.</p>
      </>}
      <div className={styles.actions}><Link className={styles.link} to={initial ? `/admin/tour-groups/${initial.tourGroupId}` : '/admin/tour-groups'}>Quay lại</Link>{access.has(initial ? 'TOUR_GROUP_UPDATE' : 'TOUR_GROUP_CREATE') && <Button type="submit" disabled={busy || excursions.loading || Boolean(excursions.error) || !selected}>{busy ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Tạo nhóm tour'}</Button>}</div>
    </fieldset></form>
  </>
}
