import { SHIP_TIME_ZONE, wallTimeToInstant, journeyTime } from '@/shared/lib/journey-time'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Field, Notice, Panel } from '@/shared/ui'
import { serviceSlots, type ServiceSlot } from '../api/schedule-api'
import { CatalogState } from './CatalogUI'
import styles from './Catalog.module.css'

export function ServiceSchedules({ serviceId }: { serviceId: string }) {
  const access = useSessionAccess(), canCreate = access.canDo('SERVICE_CREATE'), canCruise = access.canDo('CRUISE_READ')
  const slots = useReadQuery(`service-slots:${serviceId}`, useCallback(signal => serviceSlots(serviceId, signal), [serviceId]))
  const cruises = useReadQuery(`service-slot-cruises:${canCreate}:${canCruise}`, useCallback(async signal => {
    const rows: { cruiseId: string; cruiseName: string; status: string }[] = []
    if (!canCreate || !canCruise) return rows
    for (let page = 0, pages = 1; page < pages; page++) {
      const data = await apiRequest<{ content: typeof rows; totalPages: number }>('/cruise', { signal, query: { page, size: 100 } })
      if (!Array.isArray(data.content) || !Number.isSafeInteger(data.totalPages)) throw new Error('Chưa tải được các chuyến.')
      rows.push(...data.content); pages = data.totalPages
    }
    return rows.filter(row => !['CANCELLED', 'COMPLETED'].includes(row.status))
  }, [canCreate, canCruise]))
  const [cruiseId, setCruiseId] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState(''), [location, setLocation] = useState(''), [capacity, setCapacity] = useState('1')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false)
  async function create(e: FormEvent) {
    e.preventDefault()
    if (lock.current || !canCreate) return
    let startsAt: string, endsAt: string
    try { startsAt = wallTimeToInstant(start, SHIP_TIME_ZONE); endsAt = wallTimeToInstant(end, SHIP_TIME_ZONE) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ngày giờ chưa hợp lệ.'); return }
    if (!cruises.data?.some(c => c.cruiseId === cruiseId) || Date.parse(endsAt) <= Date.parse(startsAt) || !location.trim() || !Number.isSafeInteger(Number(capacity)) || Number(capacity) < 1) { setError('Chọn chuyến, giờ hợp lệ, địa điểm và sức chứa nguyên dương.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const row = await apiRequest<ServiceSlot>('/servicepackage/schedules', { method: 'POST', body: { serviceId, cruiseId, startsAt, endsAt, location: location.trim(), capacity: Number(capacity) } })
      if (!row.id || row.serviceId !== serviceId) throw new Error('Chưa xác nhận được khung giờ đã tạo. Tải lại lịch trước khi tạo lại.')
      slots.retry(); setStart(''); setEnd('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa tạo được lịch dịch vụ.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Lịch đặt dịch vụ" subtitle="Khung giờ nhận đặt chỗ có sức chứa; không phải giờ phục vụ kế hoạch của nhà hàng hoặc spa."><CatalogState {...slots} />{slots.data && <DataTable label="Khung giờ dịch vụ" headers={['Thời gian', 'Địa điểm', 'Còn chỗ', 'Trạng thái']}>{slots.data.map(s => <tr key={s.id}><td>{journeyTime(s.startsAt)} → {journeyTime(s.endsAt)}</td><td>{s.location}</td><td>{s.remainingCapacity}/{s.capacity}</td><td>{s.status}</td></tr>)}</DataTable>}{slots.data?.length === 0 && <p>Chưa có khung giờ được mở.</p>}
    {canCreate && canCruise && <details><summary>Thêm khung giờ theo chuyến</summary><p>Dịch vụ phải được cấu hình cho phép đặt theo lịch trước khi mở khung giờ.</p><CatalogState {...cruises} /><form className={styles.editor} onSubmit={create}>
      <Field htmlFor="slot-cruise" label="Chuyến"><select id="slot-cruise" required disabled={busy} value={cruiseId} onChange={e => setCruiseId(e.target.value)}><option value="">Chọn chuyến</option>{cruises.data?.map(c => <option key={c.cruiseId} value={c.cruiseId}>{c.cruiseName}</option>)}</select></Field><Field htmlFor="slot-location" label="Địa điểm"><input id="slot-location" maxLength={250} required disabled={busy} value={location} onChange={e => setLocation(e.target.value)} /></Field><Field htmlFor="slot-start" label="Bắt đầu (giờ Việt Nam)"><input id="slot-start" type="datetime-local" required disabled={busy} value={start} onChange={e => setStart(e.target.value)} /></Field><Field htmlFor="slot-end" label="Kết thúc"><input id="slot-end" type="datetime-local" required disabled={busy} value={end} onChange={e => setEnd(e.target.value)} /></Field><Field htmlFor="slot-capacity" label="Sức chứa"><input id="slot-capacity" type="number" min={1} step={1} required disabled={busy} value={capacity} onChange={e => setCapacity(e.target.value)} /></Field>{error && <Notice title="Chưa mở được khung giờ" tone="error">{error}</Notice>}<div className={styles.editorActions}><Button type="submit" disabled={busy || cruises.loading || Boolean(cruises.error)}>Mở khung giờ</Button></div>
    </form></details>}
  </Panel>
}
