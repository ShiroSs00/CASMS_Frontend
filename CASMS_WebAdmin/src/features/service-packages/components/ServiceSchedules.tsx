import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import { SHIP_TIME_ZONE, wallTimeToInstant, journeyTime, validTimeZone } from '@/shared/lib/journey-time'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ApiError,apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Field, Notice, Panel,UnsavedForms,useFormChanges } from '@/shared/ui'
import { serviceSlots } from '../api/schedule-api'
import { CatalogState } from './CatalogUI'
import styles from './Catalog.module.css'

function ServiceScheduleWorkspace({ serviceId }: { serviceId: string }) {
  const access = useSessionAccess(), canCreate = access.roles.includes('CRUISE_MANAGER') && access.canDo('CRUISE_UPDATE_DRAFT'), canCruise = access.canDo('CRUISE_READ')
  const slots = useReadQuery(`service-slots:${access.userId}:${serviceId}`, useCallback(signal => serviceSlots(serviceId, signal), [serviceId]))
  const cruises = useReadQuery(`service-slot-cruises:${access.userId}:${canCreate}:${canCruise}`, useCallback(async signal => {
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
  const options=useReadQuery(`service-schedule-options:${access.userId}:${cruiseId}`,useCallback(async signal=>{if(!cruiseId)return null;const value=await apiRequest<Options>(`/cruise-plans/${cruiseId}/program-options`,{signal});if(!Number.isSafeInteger(value.cruiseRevision)||!Array.isArray(value.stops)||!Array.isArray(value.suppliers)||!Array.isArray(value.services))throw new Error('Chưa đối chiếu được dữ liệu cấu hình lịch dịch vụ.');return value},[cruiseId]))
  const selectedStop=options.data?.stops.find(s=>s.id===stopId),zone=stopId?selectedStop?.timeZoneId:SHIP_TIME_ZONE
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false)
  useFormChanges(Boolean(start||end||location||capacity),busy)
  const pending=useRef<{before:Set<string>;cruiseId:string;stopId:string;startsAt:string;endsAt:string;location:string;capacity:number}|null>(null)
  async function create(e: FormEvent) {
    e.preventDefault()
    if (lock.current || uncertain || !canCreate || options.loading || options.error || !options.data) return
    if(!options.data.services.some(s=>s.id===serviceId&&s.scheduled)){setError('Dịch vụ cần có trên tàu và được cấu hình đặt theo lịch trước khi tạo khung giờ.');return}
    let startsAt: string, endsAt: string
    try { startsAt = wallTimeToInstant(start, zone??''); endsAt = wallTimeToInstant(end, zone??'') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ngày giờ chưa hợp lệ.'); return }
    if (!cruises.data?.some(c => c.cruiseId === cruiseId) || Date.parse(endsAt) <= Date.parse(startsAt) || !location.trim() || !Number.isSafeInteger(Number(capacity)) || Number(capacity) < 1) { setError('Chọn chuyến, giờ hợp lệ, địa điểm và sức chứa nguyên dương.'); return }
    if(!slots.data||slots.loading||slots.error){setError('Cần tải lịch hiện hành trước khi tạo.');return}
    pending.current={before:new Set(slots.data.map(s=>s.id)),cruiseId,stopId,startsAt,endsAt,location:location.trim(),capacity:Number(capacity)}
    lock.current = true; setBusy(true); setError('')
    let saved = false
    try {
      const row = await apiRequest<{ id: string; cruiseId: string }>(`/cruise-plans/${cruiseId}/serving-windows`, { method: 'POST', ifMatch: options.data.cruiseRevision, body: { serviceId,cruiseStopId:stopId||null,supplierId:supplierId||null, startsAt, endsAt, location: location.trim(), capacity: Number(capacity) } })
      saved = true
      const fresh = await serviceSlots(serviceId)
      if (!row.id || row.cruiseId !== cruiseId || !fresh.some(slot =>
        slot.id === row.id && slot.cruiseId === cruiseId && (slot.cruiseStopId ?? '') === stopId
        && Date.parse(slot.startsAt) === Date.parse(startsAt) && Date.parse(slot.endsAt) === Date.parse(endsAt)
        && slot.capacity === Number(capacity) && slot.location === location.trim())) {
        throw new Error('Chưa đối chiếu được khung giờ đã tạo. Tải lại lịch trước khi tạo lại.')
      }
      slots.retry();options.retry(); setStart(''); setEnd('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa tạo được lịch dịch vụ.');if(saved||mutationOutcomeUnknown(reason))setUncertain(true);if(reason instanceof ApiError&&reason.code==='STALE_REVISION')options.retry() }
    finally { lock.current = false; setBusy(false) }
  }
  async function reconcile(){
    if(lock.current||!pending.current)return
    lock.current=true;setBusy(true)
    try{
      const actual=await serviceSlots(serviceId),expected=pending.current
      const matches=actual.filter(s=>!expected.before.has(s.id)&&s.cruiseId===expected.cruiseId&&(s.cruiseStopId??'')===expected.stopId&&Date.parse(s.startsAt)===Date.parse(expected.startsAt)&&Date.parse(s.endsAt)===Date.parse(expected.endsAt)&&s.location===expected.location&&s.capacity===expected.capacity)
      if(matches.length!==1){setError('Chưa đối chiếu được duy nhất khung giờ vừa gửi. Không gửi lại khi chưa xác nhận kết quả.');slots.retry();return}
      setUncertain(false);pending.current=null;setError('');setStart('');setEnd('');slots.retry();options.retry()
    }catch(reason){setError(reason instanceof Error?reason.message:'Chưa đối chiếu được lịch.')}
    finally{lock.current=false;setBusy(false)}
  }
  return <Panel title="Lịch đang mở đặt dịch vụ" subtitle="Danh sách chỉ gồm lịch OPEN của dịch vụ. Không phải lịch sử tất cả trạng thái hoặc giờ phục vụ kế hoạch."><CatalogState {...slots} />{slots.data && <DataTable label="Khung giờ dịch vụ" headers={['Chuyến khởi hành','Tàu / cảng','Thời gian', 'Địa điểm', 'Còn chỗ', 'Trạng thái']}>{slots.data.map(s => <tr key={s.id}><td>{s.cruiseName||cruises.data?.find(c=>c.cruiseId===s.cruiseId)?.cruiseName||'Chưa đọc được tên chuyến'}</td><td>{[s.shipName,s.portName].filter(Boolean).join(' · ') || 'Chưa có thông tin'}</td><td>{s.cruiseStopId && !validTimeZone(s.timeZoneId) ? 'Chưa có múi giờ cảng' : <>{journeyTime(s.startsAt,s.timeZoneId??SHIP_TIME_ZONE)} → {journeyTime(s.endsAt,s.timeZoneId??SHIP_TIME_ZONE)}</>}</td><td>{s.location}</td><td>{s.remainingCapacity}/{s.capacity}</td><td>{s.status}</td></tr>)}</DataTable>}{slots.data?.length === 0 && <p>Chưa có khung giờ được mở.</p>}
    {canCreate && canCruise && <details><summary>Thêm khung giờ theo chuyến</summary><p>Dịch vụ phải được cấu hình cho phép đặt theo lịch trước khi mở khung giờ.</p><CatalogState {...cruises} /><form className={styles.editor} onSubmit={create}>
      <Field htmlFor="slot-cruise" label="Chuyến"><select id="slot-cruise" required disabled={busy} value={cruiseId} onChange={e => {setCruiseId(e.target.value);setStopId('');setSupplierId('');setStart('');setEnd('')}}><option value="">Chọn chuyến</option>{cruises.data?.map(c => <option key={c.cruiseId} value={c.cruiseId}>{c.cruiseName}</option>)}</select></Field><CatalogState {...options}/>{options.data&&!options.data.services.some(s=>s.id===serviceId&&s.scheduled)&&<Notice title="Chưa cấu hình được lịch cho dịch vụ này" tone="warning">Quản lý tàu cần có dịch vụ trên tàu; dịch vụ phải hỗ trợ đặt theo lịch. Không tự thêm nguồn để vượt kiểm tra.</Notice>}<Field htmlFor="slot-stop" label="Lần ghé cảng (nếu có)"><select id="slot-stop" value={stopId} disabled={busy||uncertain||options.loading} onChange={e=>{setStopId(e.target.value);setStart('');setEnd('')}}><option value="">Không gắn lần ghé cảng</option>{options.data?.stops.map(s=><option key={s.id} value={s.id}>{s.sequence} · {s.name}</option>)}</select></Field><Field htmlFor="slot-supplier" label="Nhà cung cấp (nếu có)"><select id="slot-supplier" value={supplierId} disabled={busy||uncertain||options.loading} onChange={e=>setSupplierId(e.target.value)}><option value="">Chưa chọn nhà cung cấp</option>{options.data?.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><p>Giờ nhập theo {zone??'múi giờ cảng chưa được xác minh'}.</p><Field htmlFor="slot-location" label="Mô tả địa điểm phục vụ"><input id="slot-location" maxLength={250} required disabled={busy} value={location} onChange={e => setLocation(e.target.value)} /></Field><Field htmlFor="slot-start" label="Bắt đầu"><input id="slot-start" type="datetime-local" required disabled={busy} value={start} onChange={e => setStart(e.target.value)} /></Field><Field htmlFor="slot-end" label="Kết thúc"><input id="slot-end" type="datetime-local" required disabled={busy} value={end} onChange={e => setEnd(e.target.value)} /></Field><Field htmlFor="slot-capacity" label="Sức chứa"><input id="slot-capacity" type="number" min={1} step={1} required disabled={busy} value={capacity} onChange={e => setCapacity(e.target.value)} /></Field>{error && <Notice title="Chưa mở được khung giờ" tone="error">{error}</Notice>}<div className={styles.editorActions}><Button type="submit" disabled={busy || uncertain || slots.loading || Boolean(slots.error) || !zone || !options.data?.services.some(s=>s.id===serviceId&&s.scheduled) || options.loading || Boolean(options.error) || cruises.loading || Boolean(cruises.error)}>Mở khung giờ</Button></div>
    </form>{uncertain&&<Notice title="Cần đối chiếu trước khi tạo tiếp">Tải lại lịch dịch vụ để kiểm tra kết quả đã lưu; biểu mẫu gửi lại đang bị khóa.<Button tone="secondary" onClick={()=>void reconcile()}>Đối chiếu lịch đã lưu</Button></Notice>}</details>}
  </Panel>
}
export function ServiceSchedules(props:{serviceId:string}){return <UnsavedForms><ServiceScheduleWorkspace key={props.serviceId} {...props}/></UnsavedForms>}


