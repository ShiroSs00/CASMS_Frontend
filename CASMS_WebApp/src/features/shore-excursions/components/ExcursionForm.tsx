import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Field } from '@/shared/ui'
import { emptyExcursionForm, excursionToForm, formToExcursionRequest, validateExcursionForm, type ExcursionFormValues, type ExcursionRequest, type ShoreExcursion } from '../model/shore-excursion'
import styles from './ShoreExcursions.module.css'

const fields: { key: keyof ExcursionFormValues; label: string; type?: string; maxLength?: number; required?: boolean }[] = [
  { key: 'excursionName', label: 'Tên chuyến tham quan', maxLength: 250, required: true },
  { key: 'excursionCode', label: 'Mã chuyến tham quan', maxLength: 50 },
  { key: 'cruiseStopId', label: 'ID điểm dừng', required: true }, { key: 'supplierId', label: 'ID nhà cung cấp', required: true },
  { key: 'startTime', label: 'Thời gian bắt đầu', type: 'datetime-local', required: true },
  { key: 'plannedReturnTime', label: 'Thời gian trở về dự kiến', type: 'datetime-local', required: true },
  { key: 'meetingPoint', label: 'Điểm tập trung', maxLength: 250, required: true },
  { key: 'maximumCapacity', label: 'Sức chứa tối đa', type: 'number', required: true },
  { key: 'minimumParticipants', label: 'Số khách tối thiểu', type: 'number' },
  { key: 'price', label: 'Giá', type: 'text' }, { key: 'currencyCode', label: 'Mã tiền tệ', maxLength: 3 },
]
export function ExcursionForm({ initial, busy, onSave }: { initial?: ShoreExcursion; busy: boolean; onSave: (request: ExcursionRequest) => Promise<void> }) {
  const [values, setValues] = useState(() => initial ? excursionToForm(initial) : { ...emptyExcursionForm })
  const [errors, setErrors] = useState<Partial<Record<keyof ExcursionFormValues, string>>>({})
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = validateExcursionForm(values); setErrors(next)
    if (!Object.keys(next).length) void onSave(formToExcursionRequest(values))
  }
  return <>
    <p className={styles.hint}>Nhập ID UUID của điểm dừng và nhà cung cấp hiện có. Nhà cung cấp phải đang hoạt động và đã xác minh. Hệ thống kiểm tra lịch, thời gian trở về và điều kiện sử dụng khi lưu.</p>
    <p className={styles.hint}>Thời gian theo múi giờ trình duyệt: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Các trường có dấu * là bắt buộc.</p>
    <form className={styles.form} onSubmit={submit} noValidate>
      <fieldset disabled={busy}>
        {fields.map(({ key, label, type = 'text', maxLength, required }) => <Field key={key} htmlFor={`excursion-${key}`} label={`${label}${required ? ' *' : ''}`} error={errors[key]}>
          <input id={`excursion-${key}`} name={key} type={type} required={required} maxLength={maxLength}
            min={type === 'number' ? 1 : undefined} max={type === 'number' ? 2147483647 : undefined} step={type === 'datetime-local' ? '0.001' : type === 'number' ? 1 : undefined}
            inputMode={key === 'price' ? 'decimal' : undefined} value={values[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `excursion-${key}-hint` : undefined}
            onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
        </Field>)}
        <div className={styles.actions}><Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu chuyến tham quan'}</Button><Link to={initial ? `/admin/shore-excursions/${initial.shoreExcursionId}` : '/admin/shore-excursions'}>Quay lại</Link></div>
      </fieldset>
    </form>
  </>
}
