import {operationsStaffRole,operationsStaffStatus} from '../model/operations-workflow'
import {businessErrorMessage} from '@/shared/api/business-errors'
import { DepartureCommand } from './DepartureCommand'
import { departureManagementApi } from '../api/departure-management-api'
import { journeyTime } from '@/shared/lib/journey-time'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import styles from './Cruises.module.css'
import {businessCopy} from '@/shared/i18n/business-copy'
type Staff = { userId: string; username: string; roleInCruise: string; status: string }
type Guest = { bookingPassengerId: string; fullName: string; bookingCode: string; cabinNumber: string; deckName: string }
type Session = { guidanceSessionId: string; sessionName: string; startAt: string; status: string; attendedCount: number; totalParticipants: number }
type Attendee = { bookingPassengerId: string; passengerFullName: string; attendanceStatus: string }
type User = { id: string; username: string; status: string }
function State({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) { return loading ? <Loading /> : error ? <Notice title={error instanceof ApiError&&error.status===403?'Chưa có quyền xem':'Chưa tải được'} tone="error">{error.message}<Button onClick={retry}>Thử lại</Button></Notice> : null }
export function CruiseOperations({ cruiseId, view='all', onChanged }: { cruiseId: string; view?: 'all'|'staff'|'guests'|'guidance'; onChanged?:()=>void }) {
  const access = useSessionAccess(), canStaff = view!=='guests'&&access.canDo('CRUISE_STAFF_READ'), canManifest = (view==='all'||view==='guests')&&access.canDo('CRUISE_MANIFEST_READ')
  const canLookup = (view==='all'||view==='staff') && canStaff && access.canDo('CRUISE_STAFF_ASSIGN') && ['USER_READ', 'OPERATIONAL_ISSUE_ASSIGN', 'OPERATIONAL_ISSUE_CREATE', 'OPERATIONAL_ISSUE_UPDATE'].some(p => access.canDo(p))
  const staff = useReadQuery(`staff:${cruiseId}:${canStaff}`, useCallback(signal => canStaff ? apiRequest<Staff[]>(`/cruise/${cruiseId}/staff`, { signal }) : Promise.resolve([]), [cruiseId, canStaff]))
  const manifest = useReadQuery(`manifest:${cruiseId}:${canManifest}`, useCallback(signal => canManifest ? apiRequest<{ passengerList: Guest[] }>(`/cruise/${cruiseId}/manifest`, { signal }) : Promise.resolve(null), [cruiseId, canManifest]))
  const [userId, setUserId] = useState(''), [role, setRole] = useState('ONBOARD_STAFF'), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const users = useReadQuery(`staff-users:${canLookup}:${role}`, useCallback(signal => canLookup ? apiRequest<User[]>('/identity/users', { query: { status: 'ACTIVE', assignableFor: role==='ONBOARD_STAFF'?'ONBOARD_STAFF':undefined }, signal }) : Promise.resolve([]), [canLookup,role]))
  const [unknown,setUnknown]=useState(false)
  const lock = useRef(false)
  async function assign(e: FormEvent) {
    e.preventDefault()
    if (lock.current || unknown || staff.loading || staff.error || users.loading || users.error || !access.canDo('CRUISE_STAFF_ASSIGN') || !users.data?.some(u => u.id === userId && u.status === 'ACTIVE')) return
    lock.current = true; setBusy(true); setError('')
    try { await apiRequest(`/cruise/${cruiseId}/staff`, { method: 'POST', body: { userId, roleInCruise: role } }); setUserId(''); staff.retry(); manifest.retry(); onChanged?.() }
    catch (reason) { if(mutationOutcomeUnknown(reason))setUnknown(true);setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,'')) }
    finally { lock.current = false; setBusy(false) }
  }
  return <>
    {(view==='all'||view==='staff')&&!canStaff&&<Notice title="Nhân sự phân công chưa được phép xem">Tài khoản cần quyền xem nhân sự của chuyến khởi hành. Không thể kết luận chuyến chưa có nhân sự.</Notice>}

    {unknown&&<Notice title="Chưa xác định kết quả phân công" tone="warning">Đối chiếu nhân sự đã lưu trước khi tạo yêu cầu mới. Biểu mẫu gửi lại đang bị khóa.</Notice>}
    {canStaff && (view==='all'||view==='staff') && <Panel title="Nhân sự trên chuyến"><State {...staff} />{staff.data?.length ? <DataTable label="Nhân sự chuyến" headers={['Tài khoản', 'Vai trò', 'Trạng thái', 'Thao tác']}>{staff.data.map(s => <tr key={s.userId}><td>{s.username}</td><td>{operationsStaffRole(s.roleInCruise)}</td><td>{operationsStaffStatus(s.status)}</td><td>{s.status==='ACTIVE'&&<DepartureCommand label="Gỡ phân công" tone="danger" permissions={['CRUISE_STAFF_REMOVE']} run={()=>departureManagementApi.removeStaff(cruiseId,s.userId)} onChanged={()=>{staff.retry();onChanged?.()}} explanation={`Gỡ ${s.username} khỏi chuyến khởi hành này.`}/>}</td></tr>)}</DataTable> : !staff.loading && !staff.error && <Empty title="Chưa có nhân sự được phân công" />}
      {access.canDo('CRUISE_STAFF_ASSIGN') && canLookup && <form className={styles.operationForm} onSubmit={assign}><State {...users} /><Field htmlFor="staff-user" label="Nhân viên"><select id="staff-user" required disabled={busy} value={userId} onChange={e => setUserId(e.target.value)}><option value="">Chọn nhân viên</option>{users.data?.filter(u => u.status === 'ACTIVE' && !staff.data?.some(s => s.userId === u.id && s.status === 'ACTIVE')).map(u => <option key={u.id} value={u.id}>{u.username}</option>)}</select></Field><Field htmlFor="staff-role" label="Vai trò trên chuyến"><select id="staff-role" disabled={busy} value={role} onChange={e => {setRole(e.target.value);setUserId('')}}>{['ONBOARD_STAFF', 'CHECKIN_STAFF', 'ACTIVITY_SERVICE_MANAGER', 'TOUR_GUIDE', 'PORT_COORDINATOR', 'BOOKING_AGENT', 'FINANCE_OFFICER', 'CUSTOMER_SERVICE'].map(r => <option key={r} value={r}>{operationsStaffRole(r)}</option>)}</select></Field>{error && <Notice title="Chưa phân công được" tone="error">{error}</Notice>}<Button type="submit" disabled={busy || unknown || !userId || staff.loading || Boolean(staff.error) || users.loading || Boolean(users.error)}>Phân công nhân viên</Button></form>}
    </Panel>}
    {canManifest && <Panel title="Danh sách hành khách"><State {...manifest} />{manifest.data?.passengerList.length ? <DataTable label="Hành khách chuyến" headers={['Khách', 'Đặt chỗ', 'Cabin', 'Boong']}>{manifest.data.passengerList.map(p => <tr key={p.bookingPassengerId}><td>{p.fullName}</td><td>{p.bookingCode}</td><td>{p.cabinNumber === 'ASSIGNED' ? 'Đã gán phòng' : p.cabinNumber}</td><td>{p.deckName === 'MAIN' ? 'Chưa có tên boong từ máy chủ' : p.deckName}</td></tr>)}</DataTable> : !manifest.loading && !manifest.error && <Empty title="Chưa có hành khách trong chuyến khởi hành" />}<p>Danh sách đặt chỗ không đồng nghĩa khách đã thanh toán hoặc lên tàu.</p></Panel>}
    {(view==='all'||view==='guidance') && access.can({mode:'ANY',permissions:['CHECKIN_READ','CHECKIN_CREATE','CHECKIN_UPDATE']}) && <Guidance key={cruiseId} cruiseId={cruiseId} />}
  </>
}
function Guidance({ cruiseId }: { cruiseId: string }) {
  const access = useSessionAccess(), canUpdate = access.canDo('CHECKIN_UPDATE')
  const sessions = useReadQuery(`guidance:${cruiseId}`, useCallback(signal => apiRequest<Session[]>(`/checkin/guidance-sessions/cruise/${cruiseId}`, { signal }), [cruiseId]))
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState<{ path: string; body?: unknown; label: string; method?: 'POST' | 'PATCH' } | null>(null), lock = useRef(false)
  const participants = useReadQuery(`guidance-participants:${selected}:${canUpdate}`, useCallback(signal => selected && canUpdate ? apiRequest<Attendee[]>(`/checkin/guidance-sessions/${selected}/participants`, { signal }) : Promise.resolve([]), [selected, canUpdate]))
  async function mutate(path: string, body?: unknown, method: 'POST' | 'PATCH' = 'POST') {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await apiRequest(path, { method, body }); sessions.retry(); participants.retry(); setConfirm(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được.') }
    finally { lock.current = false; setBusy(false) }
  }
  const scheduled = sessions.data?.find(s => s.guidanceSessionId === selected)?.status === 'Scheduled'
  return <Panel title="Hướng dẫn an toàn & điểm danh"><State {...sessions} />{error && !confirm && <Notice title="Chưa cập nhật được" tone="error">{error}</Notice>}
    <Field htmlFor="guidance-session" label="Buổi hướng dẫn"><select id="guidance-session" value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setError('') }}><option value="">Chọn buổi</option>{sessions.data?.map(s => <option key={s.guidanceSessionId} value={s.guidanceSessionId}>{s.sessionName} · {journeyTime(s.startAt)} · {s.status} · {s.attendedCount}/{s.totalParticipants}</option>)}</select></Field>
    {selected && canUpdate && <><State {...participants} /><Button disabled={busy || !scheduled} onClick={() => setConfirm({ path: `/checkin/guidance-sessions/${selected}/participants/auto-populate`, label: 'Ghi danh hành khách của chuyến vào buổi hướng dẫn' })}>Ghi danh hành khách</Button>{participants.data && <DataTable label="Điểm danh an toàn" headers={['Khách', 'Trạng thái', 'Thao tác']}>{participants.data.map(p => <tr key={p.bookingPassengerId}><td>{p.passengerFullName}</td><td>{p.attendanceStatus}</td><td>{['Attended', 'Absent'].map(status => <Button key={status} tone="secondary" disabled={busy || !scheduled} onClick={() => setConfirm({ path: `/checkin/guidance-sessions/${selected}/attendance`, body: { bookingPassengerId: p.bookingPassengerId, attendanceStatus: status }, label: `${p.passengerFullName}: ${status === 'Attended' ? 'đã tham gia' : 'vắng mặt'}` })}>{status === 'Attended' ? 'Có mặt' : 'Vắng'}</Button>)}</td></tr>)}</DataTable>}{scheduled && <Button disabled={busy} onClick={() => setConfirm({ path: `/checkin/guidance-sessions/${selected}/status?status=Completed`, method: 'PATCH', label: 'Hoàn tất buổi hướng dẫn an toàn' })}>Hoàn tất buổi hướng dẫn</Button>}</>}
    <Notice title={businessCopy('guidance.title')}>{businessCopy('guidance.legacyCreateRetired')}</Notice>
    {confirm && <Modal title="Xác nhận cập nhật" busy={busy} onClose={() => setConfirm(null)}><p>{confirm.label}</p>{error && <Notice title="Chưa cập nhật được" tone="error">{error}</Notice>}<Button disabled={busy || !canUpdate} onClick={() => void mutate(confirm.path, confirm.body, confirm.method)}>{confirm.label}</Button></Modal>}
  </Panel>
}
