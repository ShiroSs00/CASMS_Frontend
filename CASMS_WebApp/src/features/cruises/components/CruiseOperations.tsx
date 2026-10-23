import { useCallback, useRef, useState, type FormEvent } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import styles from './Cruises.module.css'
type Staff = { userId: string; username: string; roleInCruise: string; status: string }
type Guest = { bookingPassengerId: string; fullName: string; bookingCode: string; cabinNumber: string; deckName: string }
type Session = { guidanceSessionId: string; sessionName: string; startAt: string; status: string; attendedCount: number; totalParticipants: number }
type Attendee = { bookingPassengerId: string; passengerFullName: string; attendanceStatus: string }
type User = { id: string; username: string; status: string }
function State({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) { return loading ? <Loading /> : error ? <Notice title="Chưa tải được" tone="error">{error.message}<Button onClick={retry}>Thử lại</Button></Notice> : null }
export function CruiseOperations({ cruiseId }: { cruiseId: string }) {
  const access = useSessionAccess(), canStaff = access.has('CRUISE_STAFF_READ'), canManifest = access.has('CRUISE_MANIFEST_READ')
  const canLookup = ['USER_READ', 'OPERATIONAL_ISSUE_ASSIGN', 'OPERATIONAL_ISSUE_CREATE', 'OPERATIONAL_ISSUE_UPDATE'].some(p => access.has(p))
  const staff = useReadQuery(`staff:${cruiseId}:${canStaff}`, useCallback(signal => canStaff ? apiRequest<Staff[]>(`/cruise/${cruiseId}/staff`, { signal }) : Promise.resolve([]), [cruiseId, canStaff]))
  const manifest = useReadQuery(`manifest:${cruiseId}:${canManifest}`, useCallback(signal => canManifest ? apiRequest<{ passengerList: Guest[] }>(`/cruise/${cruiseId}/manifest`, { signal }) : Promise.resolve(null), [cruiseId, canManifest]))
  const users = useReadQuery(`staff-users:${canLookup}`, useCallback(signal => canLookup ? apiRequest<User[]>('/identity/users', { query: { status: 'ACTIVE' }, signal }) : Promise.resolve([]), [canLookup]))
  const [userId, setUserId] = useState(''), [role, setRole] = useState('ONBOARD_STAFF'), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function assign(e: FormEvent) {
    e.preventDefault()
    if (lock.current || !access.has('CRUISE_STAFF_ASSIGN') || !users.data?.some(u => u.id === userId && u.status === 'ACTIVE')) return
    lock.current = true; setBusy(true); setError('')
    try { await apiRequest(`/cruise/${cruiseId}/staff`, { method: 'POST', body: { userId, roleInCruise: role } }); setUserId(''); staff.retry(); manifest.retry() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa phân công được.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <>
    {canStaff && <Panel title="Nhân sự trên chuyến"><State {...staff} />{staff.data && <DataTable label="Nhân sự chuyến" headers={['Tài khoản', 'Vai trò', 'Trạng thái']}>{staff.data.map(s => <tr key={s.userId}><td>{s.username}</td><td>{s.roleInCruise}</td><td>{s.status}</td></tr>)}</DataTable>}
      {access.has('CRUISE_STAFF_ASSIGN') && canLookup && <form className={styles.operationForm} onSubmit={assign}><State {...users} /><Field htmlFor="staff-user" label="Nhân viên"><select id="staff-user" required disabled={busy} value={userId} onChange={e => setUserId(e.target.value)}><option value="">Chọn nhân viên</option>{users.data?.filter(u => u.status === 'ACTIVE' && !staff.data?.some(s => s.userId === u.id && s.status === 'ACTIVE')).map(u => <option key={u.id} value={u.id}>{u.username}</option>)}</select></Field><Field htmlFor="staff-role" label="Vai trò trên chuyến"><select id="staff-role" disabled={busy} value={role} onChange={e => setRole(e.target.value)}>{['CAPTAIN', 'DECK_OFFICER', 'ONBOARD_STAFF', 'CHECKIN_STAFF', 'ACTIVITY_SERVICE_MANAGER', 'TOUR_GUIDE', 'PORT_COORDINATOR', 'BOOKING_AGENT', 'FINANCE_OFFICER', 'CUSTOMER_SERVICE'].map(r => <option key={r}>{r}</option>)}</select></Field>{error && <Notice title="Chưa phân công được" tone="error">{error}</Notice>}<Button type="submit" disabled={busy || !userId || staff.loading}>Phân công nhân viên</Button></form>}
    </Panel>}
    {canManifest && <Panel title="Danh sách hành khách"><State {...manifest} />{manifest.data && <DataTable label="Hành khách chuyến" headers={['Khách', 'Đặt chỗ', 'Cabin', 'Boong']}>{manifest.data.passengerList.map(p => <tr key={p.bookingPassengerId}><td>{p.fullName}</td><td>{p.bookingCode}</td><td>{p.cabinNumber === 'ASSIGNED' ? 'Đã gán phòng' : p.cabinNumber}</td><td>{p.deckName === 'MAIN' ? 'Chưa có tên boong từ máy chủ' : p.deckName}</td></tr>)}</DataTable>}<p>Danh sách đặt chỗ không đồng nghĩa khách đã thanh toán hoặc lên tàu.</p></Panel>}
    {(access.has('CHECKIN_CREATE') || access.has('CHECKIN_UPDATE') || canStaff) && <Guidance key={cruiseId} cruiseId={cruiseId} staff={staff.data ?? []} />}
  </>
}
function Guidance({ cruiseId, staff }: { cruiseId: string; staff: Staff[] }) {
  const access = useSessionAccess(), canUpdate = access.has('CHECKIN_UPDATE')
  const instructors = [...staff.filter(s => s.status === 'ACTIVE'), ...(access.userId && !staff.some(s => s.userId === access.userId) ? [{ userId: access.userId, username: 'Tài khoản của tôi', status: 'ACTIVE', roleInCruise: '' }] : [])]
  const sessions = useReadQuery(`guidance:${cruiseId}`, useCallback(signal => apiRequest<Session[]>(`/checkin/guidance-sessions/cruise/${cruiseId}`, { signal }), [cruiseId]))
  const [selected, setSelected] = useState(''), [name, setName] = useState(''), [location, setLocation] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState(''), [instructor, setInstructor] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState<{ path: string; body?: unknown; label: string; method?: 'POST' | 'PATCH' } | null>(null), lock = useRef(false)
  const participants = useReadQuery(`guidance-participants:${selected}:${canUpdate}`, useCallback(signal => selected && canUpdate ? apiRequest<Attendee[]>(`/checkin/guidance-sessions/${selected}/participants`, { signal }) : Promise.resolve([]), [selected, canUpdate]))
  async function mutate(path: string, body?: unknown, method: 'POST' | 'PATCH' = 'POST') {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await apiRequest(path, { method, body }); sessions.retry(); participants.retry(); setConfirm(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được.') }
    finally { lock.current = false; setBusy(false) }
  }
  function create(e: FormEvent) {
    e.preventDefault()
    if (!access.has('CHECKIN_CREATE') || !instructors.some(s => s.userId === instructor) || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) { setError('Chọn giảng viên và giờ kết thúc sau giờ bắt đầu.'); return }
    void mutate('/checkin/guidance-sessions', { cruiseId, sessionName: name.trim(), location: location.trim(), startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), instructorUserId: instructor })
  }
  const scheduled = sessions.data?.find(s => s.guidanceSessionId === selected)?.status === 'Scheduled'
  return <Panel title="Hướng dẫn an toàn & điểm danh"><State {...sessions} />{error && !confirm && <Notice title="Chưa cập nhật được" tone="error">{error}</Notice>}
    <Field htmlFor="guidance-session" label="Buổi hướng dẫn"><select id="guidance-session" value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setError('') }}><option value="">Chọn buổi</option>{sessions.data?.map(s => <option key={s.guidanceSessionId} value={s.guidanceSessionId}>{s.sessionName} · {new Date(s.startAt).toLocaleString('vi-VN')} · {s.status} · {s.attendedCount}/{s.totalParticipants}</option>)}</select></Field>
    {selected && canUpdate && <><State {...participants} /><Button disabled={busy || !scheduled} onClick={() => setConfirm({ path: `/checkin/guidance-sessions/${selected}/participants/auto-populate`, label: 'Ghi danh hành khách của chuyến vào buổi hướng dẫn' })}>Ghi danh hành khách</Button>{participants.data && <DataTable label="Điểm danh an toàn" headers={['Khách', 'Trạng thái', 'Thao tác']}>{participants.data.map(p => <tr key={p.bookingPassengerId}><td>{p.passengerFullName}</td><td>{p.attendanceStatus}</td><td>{['Attended', 'Absent'].map(status => <Button key={status} tone="secondary" disabled={busy || !scheduled} onClick={() => setConfirm({ path: `/checkin/guidance-sessions/${selected}/attendance`, body: { bookingPassengerId: p.bookingPassengerId, attendanceStatus: status }, label: `${p.passengerFullName}: ${status === 'Attended' ? 'đã tham gia' : 'vắng mặt'}` })}>{status === 'Attended' ? 'Có mặt' : 'Vắng'}</Button>)}</td></tr>)}</DataTable>}{scheduled && <Button disabled={busy} onClick={() => setConfirm({ path: `/checkin/guidance-sessions/${selected}/status?status=Completed`, method: 'PATCH', label: 'Hoàn tất buổi hướng dẫn an toàn' })}>Hoàn tất buổi hướng dẫn</Button>}</>}
    {access.has('CHECKIN_CREATE') && instructors.length > 0 && <details><summary>Lên lịch buổi hướng dẫn</summary><form onSubmit={create} className={styles.operationForm}>
      <Field htmlFor="guidance-name" label="Tên buổi"><input id="guidance-name" required value={name} disabled={busy} onChange={e => setName(e.target.value)} /></Field><Field htmlFor="guidance-location" label="Địa điểm"><input id="guidance-location" required value={location} disabled={busy} onChange={e => setLocation(e.target.value)} /></Field><Field htmlFor="guidance-start" label="Bắt đầu (giờ máy)"><input id="guidance-start" type="datetime-local" required value={start} disabled={busy} onChange={e => setStart(e.target.value)} /></Field><Field htmlFor="guidance-end" label="Kết thúc"><input id="guidance-end" type="datetime-local" required value={end} disabled={busy} onChange={e => setEnd(e.target.value)} /></Field><Field htmlFor="guidance-instructor" label="Giảng viên"><select id="guidance-instructor" value={instructor} required disabled={busy} onChange={e => setInstructor(e.target.value)}><option value="">Chọn nhân viên</option>{instructors.map(s => <option key={s.userId} value={s.userId}>{s.username}</option>)}</select></Field><Button type="submit" disabled={busy}>Tạo buổi hướng dẫn</Button>
    </form></details>}
    {confirm && <Modal title="Xác nhận cập nhật" busy={busy} onClose={() => setConfirm(null)}><p>{confirm.label}</p>{error && <Notice title="Chưa cập nhật được" tone="error">{error}</Notice>}<Button disabled={busy || !canUpdate} onClick={() => void mutate(confirm.path, confirm.body, confirm.method)}>Xác nhận</Button></Modal>}
  </Panel>
}
