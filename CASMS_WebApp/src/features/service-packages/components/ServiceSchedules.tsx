import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import { SHIP_TIME_ZONE, wallTimeToInstant, journeyTime } from '@/shared/lib/journey-time'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ApiError,apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Field, Notice, Panel,UnsavedForms,useFormChanges } from '@/shared/ui'
import { serviceSlots, type ServiceSlot } from '../api/schedule-api'
import { CatalogState } from './CatalogUI'
import styles from './Catalog.module.css'

function ServiceScheduleWorkspace({ serviceId }: { serviceId: string }) {
  const access = useSessionAccess(), canCreate = access.roles.includes('ACTIVITY_SERVICE_MANAGER') && access.canDo('SERVICE_UPDATE'), canCruise = access.canDo('CRUISE_READ')
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
  const [cruiseId, setCruiseId] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState(''), [location, setLocation] = useState(''), [capacity, setCapacity] = useState('')
  const [stopId,setStopId]=useState(''),[supplierId,setSupplierId]=useState(''),[uncertain,setUncertain]=useState(false)
  type Options={cruiseRevision:number;stops:{id:string;name:string;sequence:number;timeZoneId:string|null}[];suppliers:{id:string;name:string}[];services:{id:string;scheduled:boolean}[]}
  const options=useReadQuery(`service-schedule-options:${cruiseId}`,useCallback(async signal=>{if(!cruiseId)return null;const value=await apiRequest<Options>(`/cruise-plans/${cruiseId}/program-options`,{signal});if(!Number.isSafeInteger(value.cruiseRevision)||!Array.isArray(value.stops)||!Array.isArray(value.suppliers)||!Array.isArray(value.services))throw new Error('Chưa đối chiếu được dữ liệu cấu hình lịch dịch vụ.');return value},[cruiseId]))
  const selectedStop=options.data?.stops.find(s=>s.id===stopId),zone=stopId?selectedStop?.timeZoneId:SHIP_TIME_ZONE
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false)
  useFormChanges(Boolean(start||end||location||capacity),busy)
  async function create(e: FormEvent) {
    e.preventDefault()
    if (lock.current || uncertain || !canCreate || options.loading || options.error || !options.data) return
    if(!options.data.services.some(s=>s.id===serviceId&&s.scheduled)){setError('Dịch vụ cần có trên tàu và được cấu hình đặt theo lịch trước khi tạo khung giờ.');return}
    let startsAt: string, endsAt: string
    try { startsAt = wallTimeToInstant(start, zone??''); endsAt = wallTimeToInstant(end, zone??'') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ngày giờ chưa hợp lệ.'); return }
    if (!cruises.data?.some(c => c.cruiseId === cruiseId) || Date.parse(endsAt) <= Date.parse(startsAt) || !location.trim() || !Number.isSafeInteger(Number(capacity)) || Number(capacity) < 1) { setError('Chọn chuyến, giờ hợp lệ, địa điểm và sức chứa nguyên dương.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const row = await apiRequest<ServiceSlot>('/servicepackage/schedules', { method: 'POST', body: { serviceId, cruiseId,expectedCruiseRevision:options.data.cruiseRevision,cruiseStopId:stopId||null,supplierId:supplierId||null, startsAt, endsAt, location: location.trim(), capacity: Number(capacity) } })
      if (!row.id || row.serviceId !== serviceId) throw new Error('Chưa xác nhận được khung giờ đã tạo. Tải lại lịch trước khi tạo lại.')
      slots.retry();options.retry(); setStart(''); setEnd('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa tạo được lịch dịch vụ.');if(mutationOutcomeUnknown(reason))setUncertain(true);if(reason instanceof ApiError&&reason.code==='STALE_REVISION')options.retry() }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Lịch đặt dịch vụ" subtitle="Khung giờ nhận đặt chỗ có sức chứa; không phải giờ phục vụ kế hoạch của nhà hàng hoặc spa."><CatalogState {...slots} />{slots.data && <DataTable label="Khung giờ dịch vụ" headers={['Thời gian', 'Địa điểm', 'Còn chỗ', 'Trạng thái']}>{slots.data.map(s => <tr key={s.id}><td>{journeyTime(s.startsAt)} → {journeyTime(s.endsAt)}</td><td>{s.location}</td><td>{s.remainingCapacity}/{s.capacity}</td><td>{s.status}</td></tr>)}</DataTable>}{slots.data?.length === 0 && <p>Chưa có khung giờ được mở.</p>}
    {canCreate && canCruise && <details><summary>Thêm khung giờ theo chuyến</summary><p>Dịch vụ phải được cấu hình cho phép đặt theo lịch trước khi mở khung giờ.</p><CatalogState {...cruises} /><form className={styles.editor} onSubmit={create}>
      <Field htmlFor="slot-cruise" label="Chuyến"><select id="slot-cruise" required disabled={busy} value={cruiseId} onChange={e => {setCruiseId(e.target.value);setStopId('');setSupplierId('');setStart('');setEnd('')}}><option value="">Chọn chuyến</option>{cruises.data?.map(c => <option key={c.cruiseId} value={c.cruiseId}>{c.cruiseName}</option>)}</select></Field><CatalogState {...options}/>{options.data&&!options.data.services.some(s=>s.id===serviceId&&s.scheduled)&&<Notice title="Chưa cấu hình được lịch cho dịch vụ này" tone="warning">Quản lý tàu cần có dịch vụ trên tàu; dịch vụ phải hỗ trợ đặt theo lịch. Không tự thêm nguồn để vượt kiểm tra.</Notice>}<Field htmlFor="slot-stop" label="Lần ghé cảng (nếu có)"><select id="slot-stop" value={stopId} disabled={busy||uncertain||options.loading} onChange={e=>{setStopId(e.target.value);setStart('');setEnd('')}}><option value="">Không gắn lần ghé cảng</option>{options.data?.stops.map(s=><option key={s.id} value={s.id}>{s.sequence} · {s.name}</option>)}</select></Field><Field htmlFor="slot-supplier" label="Nhà cung cấp (nếu có)"><select id="slot-supplier" value={supplierId} disabled={busy||uncertain||options.loading} onChange={e=>setSupplierId(e.target.value)}><option value="">Chưa chọn nhà cung cấp</option>{options.data?.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><p>Giờ nhập theo {zone??'múi giờ cảng chưa được xác minh'}.</p><Field htmlFor="slot-location" label="Mô tả địa điểm phục vụ"><input id="slot-location" maxLength={250} required disabled={busy} value={location} onChange={e => setLocation(e.target.value)} /></Field><Field htmlFor="slot-start" label="Bắt đầu"><input id="slot-start" type="datetime-local" required disabled={busy} value={start} onChange={e => setStart(e.target.value)} /></Field><Field htmlFor="slot-end" label="Kết thúc"><input id="slot-end" type="datetime-local" required disabled={busy} value={end} onChange={e => setEnd(e.target.value)} /></Field><Field htmlFor="slot-capacity" label="Sức chứa"><input id="slot-capacity" type="number" min={1} step={1} required disabled={busy} value={capacity} onChange={e => setCapacity(e.target.value)} /></Field>{error && <Notice title="Chưa mở được khung giờ" tone="error">{error}</Notice>}<div className={styles.editorActions}><Button type="submit" disabled={busy || uncertain || !zone || !options.data?.services.some(s=>s.id===serviceId&&s.scheduled) || options.loading || Boolean(options.error) || cruises.loading || Boolean(cruises.error)}>Mở khung giờ</Button></div>
    </form>{uncertain&&<Notice title="Cần đối chiếu trước khi tạo tiếp">Tải lại lịch dịch vụ để kiểm tra kết quả đã lưu; biểu mẫu gửi lại đang bị khóa.<Button tone="secondary" onClick={slots.retry}>Đối chiếu lịch đã lưu</Button></Notice>}</details>}
  </Panel>
}
export function ServiceSchedules(props:{serviceId:string}){return <UnsavedForms><ServiceScheduleWorkspace {...props}/></UnsavedForms>}


