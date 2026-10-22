import { useCallback, useRef, useState, type FormEvent } from 'react'

import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Field, Loading, Notice, Panel } from '@/shared/ui'

import { itineraryApi } from '../api/itinerary-api'
import type { CruiseStop, ItineraryStatus } from '../model/itinerary'
import { stopOperations, validateStopOperation, type StopOperation } from '../model/stop-operations'
import styles from './Itineraries.module.css'

export function StopOperations({ stop: summary, stops, itineraryStatus, onChanged }: { stop: CruiseStop; stops: CruiseStop[]; itineraryStatus: ItineraryStatus; onChanged: () => void }) {
  const access = useSessionAccess()
  const load = useCallback((signal: AbortSignal) => itineraryApi.getStop(summary.cruiseStopId, signal), [summary.cruiseStopId])
  const query = useReadQuery(`stop:${summary.cruiseStopId}`, load)
  const stop = query.data ?? summary
  const [action, setAction] = useState<StopOperation>('reorder')
  const [value, setValue] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const lock = useRef(false)
  const spec = stopOperations[action]
  const allowed = access.has(spec.permission)
  const terminal = ['COMPLETED', 'CANCELLED'].includes(itineraryStatus) || ['OMITTED', 'SUBSTITUTED', 'COMPLETED'].includes(stop.status)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !allowed || terminal || !query.data) return
    const invalid = validateStopOperation(action, value, stop, stops, itineraryStatus)
    setError(invalid); setSuccess('')
    if (invalid) return
    if (!confirmed) { setConfirmed(true); return }
    lock.current = true; setBusy(true)
    try {
      if (action === 'reorder') await itineraryApi.reorderStop(stop.cruiseStopId, Number(value))
      else if (action === 'plannedArrival') await itineraryApi.setPlannedArrival(stop.cruiseStopId, value)
      else if (action === 'plannedDeparture') await itineraryApi.setPlannedDeparture(stop.cruiseStopId, value)
      else if (action === 'allAboard') await itineraryApi.setAllAboardTime(stop.cruiseStopId, value)
      else if (action === 'actualArrival') await itineraryApi.recordActualArrival(stop.cruiseStopId, value)
      else if (action === 'actualDeparture') await itineraryApi.recordActualDeparture(stop.cruiseStopId, value)
      else if (action === 'omit') await itineraryApi.omitStop(stop.cruiseStopId, value.trim())
      else await itineraryApi.substituteStop(stop.cruiseStopId, value)
      setConfirmed(false); setSuccess('Đã lưu thay đổi điểm dừng. Hãy kiểm tra lại tính khả thi và các dịch vụ phụ thuộc.'); query.retry(); onChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể lưu thay đổi.'); setConfirmed(false) }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Điều hành điểm dừng" subtitle={`Điểm ${stop.stopOrder} · ${stop.portName || 'Cảng ghé'}`}>
    {query.loading && <Loading label="Đang tải chi tiết điểm dừng…" />}
    {query.error && <Notice title="Không tải được điểm dừng" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>}
    <p>Giờ dự kiến và giờ thực tế được quản lý riêng. Khi đổi lịch hoặc bỏ cảng, cần rà soát chuyến tham quan và quyền lợi dịch vụ; không tự động hủy hoặc hoàn tiền.</p>
    <div className={styles.actions}><ButtonLink tone="secondary" to={`/admin/shore-excursions?cruiseStopId=${encodeURIComponent(stop.cruiseStopId)}`}>Rà soát chuyến tham quan</ButtonLink></div>
    <dl><dt>Đến thực tế</dt><dd>{stop.actualArrival ? new Date(stop.actualArrival).toLocaleString('vi-VN') : 'Chưa ghi nhận'}</dd><dt>Rời thực tế</dt><dd>{stop.actualDeparture ? new Date(stop.actualDeparture).toLocaleString('vi-VN') : 'Chưa ghi nhận'}</dd><dt>Giờ khách lên tàu</dt><dd>{stop.allAboardTime ? new Date(stop.allAboardTime).toLocaleString('vi-VN') : 'Chưa đặt'}</dd></dl>
    <form onSubmit={submit} className={styles.stopForm}>
      <Field htmlFor="stop-operation" label="Thao tác vận hành"><select id="stop-operation" value={action} disabled={busy} onChange={event => { setAction(event.target.value as StopOperation); setValue(''); setConfirmed(false); setError(''); setSuccess('') }}>{Object.entries(stopOperations).map(([key, operation]) => <option key={key} value={key}>{operation.label}</option>)}</select></Field>
      {spec.kind === 'stop' ? <Field htmlFor="stop-operation-value" label="Điểm dừng thay thế"><select id="stop-operation-value" value={value} disabled={busy} required onChange={event => { setValue(event.target.value); setConfirmed(false) }}><option value="">Chọn điểm dừng cùng lịch trình</option>{stops.filter(item => item.cruiseStopId !== stop.cruiseStopId && !['OMITTED', 'SUBSTITUTED', 'COMPLETED'].includes(item.status)).map(item => <option key={item.cruiseStopId} value={item.cruiseStopId}>Điểm {item.stopOrder} · {item.portName || 'Cảng ghé'} · {new Date(item.plannedArrival).toLocaleString('vi-VN')}</option>)}</select></Field>
        : <Field htmlFor="stop-operation-value" label={spec.kind === 'time' ? `Thời gian (${Intl.DateTimeFormat().resolvedOptions().timeZone})` : spec.kind === 'number' ? 'Thứ tự mới' : 'Lý do'}><input id="stop-operation-value" type={spec.kind === 'time' ? 'datetime-local' : spec.kind === 'number' ? 'number' : 'text'} min={spec.kind === 'number' ? 1 : undefined} required value={value} disabled={busy} onChange={event => { setValue(event.target.value); setConfirmed(false) }} /></Field>}
      {access.status === 'error' && <Notice tone="error" title="Chưa xác định được quyền">{access.error}</Notice>}
      {!allowed && <p>{access.status === 'loading' ? 'Đang tải quyền thao tác…' : 'Tài khoản chưa có quyền thực hiện thao tác này.'}</p>}
      {terminal && <p>Điểm dừng hoặc lịch trình đã kết thúc, chỉ có thể xem.</p>}
      {error && <Notice tone="error" title="Chưa thể cập nhật">{error}</Notice>}
      {success && <Notice tone="success" title="Đã cập nhật">{success}</Notice>}
      {confirmed && <Notice tone="warning" title="Xác nhận thay đổi"><p>{spec.label}: {spec.kind === 'stop' ? 'điểm dừng đã chọn' : value}. Thay đổi có thể ảnh hưởng đến kế hoạch hoạt động và hành khách.</p></Notice>}
      <Button type="submit" disabled={busy || !allowed || terminal || !query.data}>{busy ? 'Đang lưu…' : confirmed ? 'Xác nhận lưu thay đổi' : 'Kiểm tra và tiếp tục'}</Button>
      {confirmed && <Button type="button" tone="secondary" disabled={busy} onClick={() => setConfirmed(false)}>Quay lại</Button>}
    </form>
  </Panel>
}
