import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Loading, Notice } from '@/shared/ui'
import { listExcursionOptions } from '../api/group-context-api'
import { emptyGroupForm, formToGroupRequest, groupToForm, validateGroupForm, type GroupFormValues, type GroupRequest, type TourGroup } from '../model/tour-group'
import styles from './TourGroups.module.css'

const fields: { key: keyof GroupFormValues; label: string; required?: boolean; type?: string; maxLength?: number }[] = [
  { key: 'maximumCapacity', label: 'Sức chứa tối đa (để trống để lấy từ chuyến tham quan)', type: 'number' },
  { key: 'meetingPoint', label: 'Điểm tập trung (mặc định theo chuyến tham quan)', maxLength: 250 },
  { key: 'assemblyTime', label: 'Giờ tập trung', type: 'datetime-local' },
  { key: 'plannedDepartureTime', label: 'Giờ khởi hành dự kiến', type: 'datetime-local' },
  { key: 'plannedReturnTime', label: 'Giờ trở về dự kiến', type: 'datetime-local' },
]
export function GroupForm({ initial, busy, onSave }: { initial?: TourGroup; busy: boolean; onSave: (request: GroupRequest) => Promise<void> }) {
  const access = useSessionAccess()
  const excursions = useReadQuery('group-excursion-options', listExcursionOptions)
  const [contextError, setContextError] = useState('')
  const [values, setValues] = useState(() => initial ? groupToForm(initial) : { ...emptyGroupForm })
  const [errors, setErrors] = useState<Partial<Record<keyof GroupFormValues, string>>>({})
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !access.has(initial ? 'TOUR_GROUP_UPDATE' : 'TOUR_GROUP_CREATE')) return
    if (excursions.loading || excursions.error || !excursions.data?.some(item => item.shoreExcursionId === values.shoreExcursionId)) { setContextError('Chọn chuyến tham quan từ danh sách đã tải.'); return }
    setContextError('')
    const next = validateGroupForm(values); setErrors(next)
    if (!Object.keys(next).length) void onSave(formToGroupRequest(values))
  }
  return <>
    <p className={styles.hint}>Chọn chuyến tham quan có thật. Cần hoàn thiện điểm tập trung, lịch trình và phân công trước khi xác nhận nhóm.</p>
    <Notice title="Danh mục nhân sự và phương tiện">Chưa có danh mục hướng dẫn viên/phương tiện phù hợp để lựa chọn. Phân công có sẵn được giữ nguyên; không nhập mã định danh thủ công.</Notice>
    {excursions.loading && <Loading label="Đang tải chuyến tham quan…" />}
    {excursions.error && <Notice title="Không tải được chuyến tham quan" tone="error">{excursions.error.message}<Button onClick={excursions.retry}>Thử lại</Button></Notice>}
    {contextError && <Notice title="Kiểm tra chuyến tham quan" tone="error">{contextError}</Notice>}
    <p className={styles.hint}>Thời gian theo múi giờ trình duyệt: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Các trường có dấu * là bắt buộc.</p>
    <form className={styles.form} onSubmit={submit} noValidate><fieldset disabled={busy}>
      <Field htmlFor="group-shoreExcursionId" label="Chuyến tham quan *" error={errors.shoreExcursionId}><select id="group-shoreExcursionId" name="shoreExcursionId" value={values.shoreExcursionId} disabled={excursions.loading || Boolean(excursions.error)} onChange={event => setValues({ ...values, shoreExcursionId: event.target.value })}><option value="">Chọn chuyến tham quan</option>{excursions.data?.map(item => <option key={item.shoreExcursionId} value={item.shoreExcursionId}>{item.excursionName}{item.excursionCode ? ` · ${item.excursionCode}` : ''}</option>)}</select></Field>
      {fields.map(({ key, label, required, type = 'text', maxLength }) => <Field key={key} htmlFor={`group-${key}`} label={`${label}${required ? ' *' : ''}`} error={errors[key]}>
        <input id={`group-${key}`} name={key} type={type} required={required} maxLength={maxLength} value={values[key]}
          min={type === 'number' ? 1 : undefined} max={type === 'number' ? 2147483647 : undefined} step={type === 'number' ? 1 : type === 'datetime-local' ? '0.001' : undefined}
          aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `group-${key}-hint` : undefined} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
      </Field>)}
      <Field htmlFor="group-notes" label="Ghi chú" error={errors.notes}><textarea id="group-notes" name="notes" maxLength={500} value={values.notes} aria-invalid={!!errors.notes} aria-describedby={errors.notes ? 'group-notes-hint' : undefined} onChange={(event) => setValues({ ...values, notes: event.target.value })} /></Field>
      <div className={styles.actions}><Button type="submit" disabled={busy || !access.has(initial ? 'TOUR_GROUP_UPDATE' : 'TOUR_GROUP_CREATE') || excursions.loading || Boolean(excursions.error) || !excursions.data?.length}>{busy ? 'Đang lưu…' : 'Lưu nhóm tour'}</Button><Link to={initial ? `/admin/tour-groups/${initial.tourGroupId}` : '/admin/tour-groups'}>Quay lại</Link></div>
    </fieldset></form>
  </>
}
