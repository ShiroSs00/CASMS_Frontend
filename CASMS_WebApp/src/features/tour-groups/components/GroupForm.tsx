import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Field } from '@/shared/ui'
import { emptyGroupForm, formToGroupRequest, groupToForm, validateGroupForm, type GroupFormValues, type GroupRequest, type TourGroup } from '../model/tour-group'
import styles from './TourGroups.module.css'

const fields: { key: keyof GroupFormValues; label: string; required?: boolean; type?: string; maxLength?: number }[] = [
  { key: 'groupCode', label: 'Mã nhóm', required: true, maxLength: 50 },
  { key: 'shoreExcursionId', label: 'ID chuyến tham quan', required: true },
  { key: 'maximumCapacity', label: 'Sức chứa tối đa', required: true, type: 'number' },
  { key: 'guideId', label: 'ID hướng dẫn viên' }, { key: 'vehicleId', label: 'ID phương tiện' },
  { key: 'meetingPoint', label: 'Điểm tập trung', required: true, maxLength: 250 },
  { key: 'assemblyTime', label: 'Giờ tập trung', type: 'datetime-local' },
  { key: 'plannedDepartureTime', label: 'Giờ khởi hành dự kiến', type: 'datetime-local' },
  { key: 'plannedReturnTime', label: 'Giờ trở về dự kiến', type: 'datetime-local' },
]
export function GroupForm({ initial, busy, onSave }: { initial?: TourGroup; busy: boolean; onSave: (request: GroupRequest) => Promise<void> }) {
  const [values, setValues] = useState(() => initial ? groupToForm(initial) : { ...emptyGroupForm })
  const [errors, setErrors] = useState<Partial<Record<keyof GroupFormValues, string>>>({})
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = validateGroupForm(values); setErrors(next)
    if (!Object.keys(next).length) void onSave(formToGroupRequest(values))
  }
  return <>
    <p className={styles.hint}>Nhập ID UUID của chuyến tham quan hiện có. Cần hoàn thiện hướng dẫn viên, điểm tập trung và lịch trình trước khi xác nhận nhóm.</p>
    <p className={styles.hint}>Thời gian theo múi giờ trình duyệt: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Các trường có dấu * là bắt buộc.</p>
    <form className={styles.form} onSubmit={submit} noValidate><fieldset disabled={busy}>
      {fields.map(({ key, label, required, type = 'text', maxLength }) => <Field key={key} htmlFor={`group-${key}`} label={`${label}${required ? ' *' : ''}`} error={errors[key]}>
        <input id={`group-${key}`} name={key} type={type} required={required} maxLength={maxLength} value={values[key]}
          min={type === 'number' ? 1 : undefined} max={type === 'number' ? 2147483647 : undefined} step={type === 'number' ? 1 : type === 'datetime-local' ? '0.001' : undefined}
          aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `group-${key}-hint` : undefined} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
      </Field>)}
      <Field htmlFor="group-notes" label="Ghi chú" error={errors.notes}><textarea id="group-notes" name="notes" maxLength={500} value={values.notes} aria-invalid={!!errors.notes} aria-describedby={errors.notes ? 'group-notes-hint' : undefined} onChange={(event) => setValues({ ...values, notes: event.target.value })} /></Field>
      <div className={styles.actions}><Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu nhóm tour'}</Button><Link to={initial ? `/admin/tour-groups/${initial.tourGroupId}` : '/admin/tour-groups'}>Quay lại</Link></div>
    </fieldset></form>
  </>
}
