import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Loading, Notice } from '@/shared/ui'
import { excursionContextApi, validateExcursionWindow } from '../api/excursion-context-api'
import { emptyExcursionForm, excursionToForm, formToExcursionRequest, validateExcursionForm, type ExcursionFormValues, type ExcursionRequest, type ShoreExcursion } from '../model/shore-excursion'
import styles from './ShoreExcursions.module.css'

const fields: { key: keyof ExcursionFormValues; label: string; type?: string; maxLength?: number; required?: boolean }[] = [
  { key: 'excursionName', label: 'Tên chuyến tham quan', maxLength: 250, required: true },
  { key: 'startTime', label: 'Thời gian bắt đầu', type: 'datetime-local', required: true },
  { key: 'plannedReturnTime', label: 'Thời gian trở về dự kiến', type: 'datetime-local', required: true },
  { key: 'meetingPoint', label: 'Điểm tập trung', maxLength: 250, required: true },
  { key: 'maximumCapacity', label: 'Sức chứa tối đa', type: 'number', required: true },
  { key: 'minimumParticipants', label: 'Số khách tối thiểu', type: 'number' },
  { key: 'price', label: 'Giá', type: 'text' }, { key: 'currencyCode', label: 'Mã tiền tệ', maxLength: 3 },
]
export function ExcursionForm({ initial, busy, onSave }: { initial?: ShoreExcursion; busy: boolean; onSave: (request: ExcursionRequest) => Promise<void> }) {
  const access = useSessionAccess()
  const stops = useReadQuery('excursion-stop-options', excursionContextApi.stops)
  const suppliers = useReadQuery('excursion-supplier-options', excursionContextApi.suppliers)
  const [contextError, setContextError] = useState('')
  const [values, setValues] = useState(() => initial ? excursionToForm(initial) : { ...emptyExcursionForm })
  const [errors, setErrors] = useState<Partial<Record<keyof ExcursionFormValues, string>>>({})
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !access.has(initial ? 'EXCURSION_UPDATE' : 'EXCURSION_CREATE')) return
    const invalid = stops.error || suppliers.error || stops.loading || suppliers.loading ? 'Chưa tải đủ điểm dừng và nhà cung cấp.' : !suppliers.data?.some(item => item.supplierId === values.supplierId && item.status === 'ACTIVE' && item.verificationStatus === 'VERIFIED') ? 'Chọn nhà cung cấp đang hoạt động và đã xác minh.' : validateExcursionWindow(values.startTime, values.plannedReturnTime, stops.data?.find(item => item.cruiseStopId === values.cruiseStopId))
    setContextError(invalid)
    if (invalid) return
    const next = validateExcursionForm(values); setErrors(next)
    if (!Object.keys(next).length) void onSave(formToExcursionRequest(values))
  }
  return <>
    <p className={styles.hint}>Chọn điểm dừng của lịch trình và nhà cung cấp đã xác minh. Lịch tham quan phải phù hợp với giờ lưu cảng và giờ khách trở lại tàu.</p>
    {(stops.loading || suppliers.loading) && <Loading label="Đang tải điểm dừng và nhà cung cấp…" />}
    {[stops, suppliers].map((query, index) => query.error && <Notice key={index} tone="error" title={`Không tải được ${index ? 'nhà cung cấp' : 'điểm dừng'}`}>{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>)}
    {!stops.loading && stops.data?.length === 0 && <Notice title="Chưa có điểm dừng">Cần cấu hình lịch trình và điểm dừng trước khi tạo chuyến tham quan. <Link to="/admin/itineraries">Mở hải trình</Link></Notice>}
    {contextError && <Notice tone="error" title="Kiểm tra thông tin liên quan">{contextError}</Notice>}
    <p className={styles.hint}>Thời gian theo múi giờ trình duyệt: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Các trường có dấu * là bắt buộc.</p>
    <form className={styles.form} onSubmit={submit} noValidate>
      <fieldset disabled={busy}>
        <Field htmlFor="excursion-cruiseStopId" label="Điểm dừng *"><select id="excursion-cruiseStopId" name="cruiseStopId" required value={values.cruiseStopId} disabled={stops.loading || Boolean(stops.error)} onChange={event => setValues({ ...values, cruiseStopId: event.target.value })}><option value="">Chọn lịch trình và cảng ghé</option>{stops.data?.map(item => <option key={item.cruiseStopId} value={item.cruiseStopId}>{item.label}</option>)}</select></Field>
        <Field htmlFor="excursion-supplierId" label="Nhà cung cấp *"><select id="excursion-supplierId" name="supplierId" required value={values.supplierId} disabled={suppliers.loading || Boolean(suppliers.error)} onChange={event => setValues({ ...values, supplierId: event.target.value })}><option value="">Chọn nhà cung cấp</option>{suppliers.data?.map(item => <option key={item.supplierId} value={item.supplierId} disabled={item.status !== 'ACTIVE' || item.verificationStatus !== 'VERIFIED'}>{item.supplierName}{item.status !== 'ACTIVE' ? ' · Ngừng hoạt động' : item.verificationStatus !== 'VERIFIED' ? ' · Chưa xác minh' : ''}</option>)}</select></Field>
        {fields.map(({ key, label, type = 'text', maxLength, required }) => <Field key={key} htmlFor={`excursion-${key}`} label={`${label}${required ? ' *' : ''}`} error={errors[key]}>
          <input id={`excursion-${key}`} name={key} type={type} required={required} maxLength={maxLength}
            min={type === 'number' ? 1 : undefined} max={type === 'number' ? 2147483647 : undefined} step={type === 'datetime-local' ? '0.001' : type === 'number' ? 1 : undefined}
            inputMode={key === 'price' ? 'decimal' : undefined} value={values[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `excursion-${key}-hint` : undefined}
            onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
        </Field>)}
        <div className={styles.actions}><Button type="submit" disabled={busy || !access.has(initial ? 'EXCURSION_UPDATE' : 'EXCURSION_CREATE') || stops.loading || suppliers.loading || Boolean(stops.error || suppliers.error) || !stops.data?.length}>{busy ? 'Đang lưu…' : 'Lưu chuyến tham quan'}</Button><Link to={initial ? `/admin/shore-excursions/${initial.shoreExcursionId}` : '/admin/shore-excursions'}>Quay lại</Link></div>
      </fieldset>
    </form>
  </>
}
