import { journeyTime, validTimeZone, wallTimeToInstant, zonedInput } from '@/shared/lib/journey-time'
import {businessCopy} from '@/shared/i18n/business-copy'
import { EditorLayout,useUnsavedFormGuard } from '@/shared/ui'
import { PermissionLink as Link } from '@/shared/ui'
import { useCallback, useState, type FormEvent } from 'react'
import {useSearchParams} from 'react-router'
import {cruiseContextReturn, validCruiseContextId} from '@/shared/lib/cruise-context'

import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, FormErrorSummary, Loading, Notice } from '@/shared/ui'
import { excursionContextApi, excursionWindow, scheduledExcursions, suggestExcursionTimes, validateExcursionWindow } from '../api/excursion-context-api'
import { shoreExcursionApi } from '../api/shore-excursion-api'
import { emptyExcursionForm, excursionToForm, formToExcursionRequest, validateExcursionForm, type ExcursionFormValues, type ExcursionRequest, type ShoreExcursion } from '../model/shore-excursion'
import styles from './ShoreExcursions.module.css'

const fields: { key: keyof ExcursionFormValues; label: string; type?: string; maxLength?: number; required?: boolean }[] = [
  { key: 'excursionName', label: 'Tên chuyến tham quan', maxLength: 250, required: true },
  { key: 'meetingPoint', label: 'Điểm tập trung', maxLength: 250, required: true },
  { key: 'startTime', label: 'Thời gian bắt đầu', type: 'datetime-local', required: true },
  { key: 'plannedReturnTime', label: 'Thời gian trở về dự kiến', type: 'datetime-local', required: true },
  { key: 'maximumCapacity', label: 'Sức chứa tối đa', type: 'number', required: true },
  { key: 'minimumParticipants', label: 'Số khách tối thiểu để tổ chức', type: 'number' },
  { key: 'price', label: businessCopy('program.field.priceUsd'), type: 'text', required:true },
]
export function ExcursionForm({ initial, busy, pending=busy, onSave }: { initial?: ShoreExcursion; busy: boolean;pending?:boolean; onSave: (request: ExcursionRequest,allowLeave:()=>void) => Promise<void> }) {
  const access = useSessionAccess()
  const [params]=useSearchParams(),requestedCruise=params.get('cruiseId'),requestedStop=params.get('cruiseStopId')
  const returnTo = cruiseContextReturn(params.get('returnTo'), requestedCruise)
  const stops = useReadQuery('excursion-stop-options:'+requestedCruise, useCallback(signal=>excursionContextApi.stops(signal,validCruiseContextId(requestedCruise)?requestedCruise:undefined),[requestedCruise]))
  const suppliers = useReadQuery('excursion-supplier-options', excursionContextApi.suppliers)
  const [contextError, setContextError] = useState('')
  const [values, setValues] = useState(() => initial ? {...excursionToForm(initial),startTime:'',plannedReturnTime:'',currencyCode:'USD',price:initial.currencyCode==='USD'?initial.price?.toString()??'':''} : { ...emptyExcursionForm,currencyCode:'USD',...(validCruiseContextId(requestedStop)?{cruiseStopId:requestedStop}:{}) })
  const [timeEdits, setTimeEdits] = useState<Partial<Record<'startTime' | 'plannedReturnTime', string>>>({})
  const [baseline]=useState(()=>structuredClone(values))
  const dirty=Object.keys(timeEdits).length>0||(Object.keys(values) as (keyof ExcursionFormValues)[]).some(key=>!Object.is(values[key],baseline[key]))
  const guard=useUnsavedFormGuard(dirty,pending)
  const [errors, setErrors] = useState<Partial<Record<keyof ExcursionFormValues, string>>>({})
  const stopId = values.cruiseStopId
  const schedule = useReadQuery('excursion-stop-schedule:' + stopId, useCallback(signal => stopId ? shoreExcursionApi.list({ cruiseStopId: stopId }, signal) : Promise.resolve([]), [stopId]))
  const stop = stops.data?.find(item => item.cruiseStopId === stopId)
  const zone = stop?.timeZoneId
  const hasZone = validTimeZone(zone)
  const displayTime = (instant: string) => hasZone ? journeyTime(instant, zone) : 'Chưa có múi giờ cảng'
  const timeValue = (field: 'startTime' | 'plannedReturnTime') => timeEdits[field] ??
    (initial && initial.cruiseStopId === stopId && hasZone ? zonedInput(initial[field], zone) : '')
  const window = excursionWindow(stop)
  const occupied = scheduledExcursions(schedule.data ?? [], initial?.shoreExcursionId)
  const suggestion = schedule.data ? suggestExcursionTimes(stop, occupied) : null
  const earliest = window && hasZone ? zonedInput(Math.ceil(window.earliestStart / 60000) * 60000, zone).slice(0, 16) : undefined
  const latest = window && hasZone ? zonedInput((Math.ceil(window.returnDeadline / 60000) - 1) * 60000, zone).slice(0, 16) : undefined
  function change(key: keyof ExcursionFormValues, value: string) {
    if (key === 'startTime' || key === 'plannedReturnTime') setTimeEdits(previous => ({ ...previous, [key]: value }))
    else setValues(previous => ({ ...previous, [key]: value }))
    if (key === 'cruiseStopId') setTimeEdits({ startTime: '', plannedReturnTime: '' })
    setErrors(previous => {
      const next = { ...previous }
      delete next[key]
      if (key === 'cruiseStopId' || key === 'startTime' || key === 'plannedReturnTime') { delete next.startTime; delete next.plannedReturnTime }
      return next
    })
    setContextError('')
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !access.canDo(initial ? 'EXCURSION_UPDATE' : 'EXCURSION_CREATE')) return
    if(params.has('cruiseStopId')&&(!validCruiseContextId(requestedStop)||stopId!==requestedStop)||params.has('cruiseId')&&(!validCruiseContextId(requestedCruise)||stop?.cruiseId!==requestedCruise)){setContextError('Lần ghé cảng không khớp chuyến khởi hành trong đường dẫn. Mở lại từ đúng hồ sơ.');return}
    if (stops.error || suppliers.error || stops.loading || suppliers.loading) { setContextError('Chưa tải đủ điểm dừng và nhà cung cấp. Vui lòng thử tải lại.'); return }
    setContextError('')
    const converted = { ...values }
    const timeErrors: Partial<Record<keyof ExcursionFormValues, string>> = {}
    if (hasZone) {
      for (const field of ['startTime', 'plannedReturnTime'] as const) {
        try {
          converted[field] = initial && initial.cruiseStopId === stopId && timeEdits[field] === undefined
            ? initial[field] : wallTimeToInstant(timeValue(field), zone)
        } catch (reason) { timeErrors[field] = reason instanceof Error ? reason.message : 'Nhập giờ cảng hợp lệ.' }
      }
    }
    const next = { ...validateExcursionForm(converted), ...validateExcursionWindow(converted.startTime, converted.plannedReturnTime, stop), ...timeErrors }
    if (!suppliers.data?.some(item => item.supplierId === values.supplierId && item.status === 'ACTIVE' && item.verificationStatus === 'VERIFIED')) next.supplierId = 'Chọn nhà cung cấp đang hoạt động và đã xác minh.'
    const conflict = occupied.find(item => Date.parse(converted.startTime) < Date.parse(item.plannedReturnTime) && Date.parse(converted.plannedReturnTime) > Date.parse(item.startTime))
    if (conflict && !next.startTime && !next.plannedReturnTime) next.startTime = `Trùng lịch ${conflict.excursionName} (${displayTime(conflict.startTime)} – ${displayTime(conflict.plannedReturnTime)}). Chọn khung giờ khác.`
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) { event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return }
    void onSave(formToExcursionRequest(converted),guard.allowLeave)
  }
  return <>{guard.prompt}
    {(stops.loading || suppliers.loading) && <Loading label="Đang tải điểm dừng và nhà cung cấp…" />}
    {[stops, suppliers].map((query, index) => query.error && <Notice key={index} tone="error" title={`Không tải được ${index ? 'nhà cung cấp' : 'điểm dừng'}`}>{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>)}
    {!stops.loading && stops.data?.length === 0 && <Notice title="Chưa có điểm dừng">Cần có lần ghé cảng trước khi tạo chuyến tham quan. <Link to="/admin/cruises">Xem chuyến khởi hành</Link></Notice>}
    {contextError && <Notice tone="error" title="Kiểm tra thông tin liên quan">{contextError}</Notice>}
    <EditorLayout ><form className={styles.form} onSubmit={submit} noValidate>
      <fieldset disabled={busy}>
        <div className={styles.fullRow}><FormErrorSummary errors={errors} /></div>
        <Field htmlFor="excursion-cruiseStopId" label="Điểm dừng *" error={errors.cruiseStopId}><select id="excursion-cruiseStopId" name="cruiseStopId" required value={values.cruiseStopId} disabled={Boolean(requestedStop) || stops.loading || Boolean(stops.error)} onChange={event => change('cruiseStopId', event.target.value)}><option value="">Chọn lịch trình và cảng ghé</option>{stops.data?.map(item => <option key={item.cruiseStopId} value={item.cruiseStopId}>{item.label}</option>)}</select></Field>
        <Field htmlFor="excursion-supplierId" label="Nhà cung cấp *" error={errors.supplierId}><select id="excursion-supplierId" name="supplierId" required value={values.supplierId} disabled={suppliers.loading || Boolean(suppliers.error)} onChange={event => change('supplierId', event.target.value)}><option value="">Chọn nhà cung cấp</option>{suppliers.data?.map(item => <option key={item.supplierId} value={item.supplierId} disabled={item.status !== 'ACTIVE' || item.verificationStatus !== 'VERIFIED'}>{item.supplierName}{item.status !== 'ACTIVE' ? ' · Ngừng hoạt động' : item.verificationStatus !== 'VERIFIED' ? ' · Chưa xác minh' : ''}</option>)}</select></Field>
        {stop && <section className={styles.stopContext} aria-label="Khung giờ điểm dừng">
          <strong>Khung giờ tham quan tại điểm dừng</strong>
          <dl className={styles.windowFacts}><div><dt>Tàu đến cảng</dt><dd>{displayTime(stop.plannedArrival)}</dd></div><div><dt>Tàu rời cảng</dt><dd>{displayTime(stop.plannedDeparture)}</dd></div>{window && <><div><dt>Bắt đầu sớm nhất</dt><dd>{displayTime(new Date(window.earliestStart).toISOString())}{(stop.tenderTransferMinutes ?? 0) > 0 && ` (đã gồm ${stop.tenderTransferMinutes} phút trung chuyển)`}</dd></div><div><dt>Phải trở về trước</dt><dd>{displayTime(new Date(window.returnDeadline).toISOString())}</dd></div></>}</dl>
          {schedule.loading && <p className={styles.hint} role="status">Đang tải lịch tham quan tại điểm dừng…</p>}
          {schedule.error && <Notice title="Chưa tải được lịch tham quan" tone="warning">Có thể nhập giờ thủ công; hệ thống sẽ kiểm tra trùng lịch khi lưu. <Button tone="secondary" onClick={schedule.retry}>Tải lại lịch</Button></Notice>}
          {occupied.length > 0 && <div><strong>Lịch đã có tại điểm dừng</strong><ul className={styles.scheduleList}>{occupied.map(item => <li key={item.shoreExcursionId}>{item.excursionName}: {displayTime(item.startTime)} – {displayTime(item.plannedReturnTime)}</li>)}</ul></div>}
          {suggestion && <div className={styles.suggestion}><p>Khung giờ trống gợi ý: {displayTime(suggestion.startTime)} – {displayTime(suggestion.plannedReturnTime)}. Có thể chỉnh lại sau khi chọn.</p><Button tone="secondary" onClick={() => { setTimeEdits(suggestion); setErrors({}); setContextError('') }}>Dùng khung giờ gợi ý</Button></div>}
          {!schedule.loading && !schedule.error && !suggestion && <p className={styles.hint}>Chưa có khoảng trống đủ một phút trong giờ lưu cảng. Chọn điểm dừng khác hoặc cập nhật lịch tham quan đã có.</p>}
        </section>}
        {fields.map(({ key, label, type = 'text', maxLength, required }) => <div key={key} className={key === 'price' ? styles.fullRow : undefined}><Field htmlFor={`excursion-${key}`} label={`${label}${required ? ' *' : ''}`} error={errors[key]}>
          <input id={`excursion-${key}`} name={key} type={type} required={required} maxLength={maxLength}
            min={type === 'number' ? 1 : type === 'datetime-local' ? earliest : undefined} max={type === 'number' ? 2147483647 : type === 'datetime-local' ? latest : undefined} step={type === 'datetime-local' ? 60 : type === 'number' ? 1 : undefined}
            inputMode={key === 'price' ? 'decimal' : undefined} value={key === 'startTime' || key === 'plannedReturnTime' ? timeValue(key) : values[key]} disabled={type==='datetime-local'&&!hasZone} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `excursion-${key}-hint` : undefined}
            onChange={(event) => change(key, event.target.value)} />
        </Field></div>)}
        <div className={styles.actions}><Link className={styles.link} to={returnTo ?? (initial ? `/admin/shore-excursions/${initial.shoreExcursionId}` : '/admin/shore-excursions')}>Quay lại</Link>{access.canDo(initial ? 'EXCURSION_UPDATE' : 'EXCURSION_CREATE') && <Button type="submit" disabled={busy || !hasZone || stops.loading || suppliers.loading || Boolean(stops.error || suppliers.error) || !stops.data?.length}>{busy ? 'Đang lưu…' : 'Lưu chuyến tham quan'}</Button>}</div>
      </fieldset>
    </form></EditorLayout>
  </>
}
