import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { Badge, Button, DataTable, Empty, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { portWindowApi, validateWindow, windowDays, type PortWindow, type WindowDraft } from '../api/port-window-api'
import type { Port } from '../model/itinerary'
import styles from './Itineraries.module.css'

const movement = { ARRIVAL: 'Tàu đến', DEPARTURE: 'Tàu rời' } as const

function WindowHistory({ port, window, onClose }: { port: string; window: PortWindow; onClose: () => void }) {
  const access = useSessionAccess()
  const [page, setPage] = useState(0)
  const query = useReadQuery(JSON.stringify(['window-history', access.userId, port, window.windowId, page]),
    useCallback(signal => portWindowApi.history(port, window, page, signal), [port, window, page]))
  const labels: Record<string, string> = { CREATE: 'Tạo khung giờ', UPDATE: 'Cập nhật khung giờ', VERIFY: 'Xác minh' }
  return <Modal title="Lịch sử khung giờ" onClose={onClose}>
    {query.loading ? <Loading/> : query.error ? <Notice tone="error" title="Chưa đọc được lịch sử"><Button onClick={query.retry}>Thử lại</Button></Notice>
      : query.data?.content.length ? <DataTable label="Thay đổi khung giờ" headers={['Thời điểm', 'Thao tác']}>
        {query.data.content.map(event => <tr key={event.auditId}><td>{new Date(event.occurredAt).toLocaleString('vi-VN')}</td><td>{labels[event.action] ?? 'Thay đổi'}</td></tr>)}
      </DataTable> : <Empty title="Chưa ghi nhận thay đổi"/>}
    <div className={styles.actions}>
      <Button tone="secondary" disabled={page === 0 || query.loading} onClick={() => setPage(page - 1)}>Trang trước</Button>
      <Button tone="secondary" disabled={!query.data || query.data.last || query.loading} onClick={() => setPage(page + 1)}>Trang sau</Button>
    </div>
  </Modal>
}

function WindowEditor({ row, busy, blocked, error, onSave, onClose }: {
  row: PortWindow | null; busy: boolean; blocked: boolean; error: string
  onSave: (draft: WindowDraft) => void; onClose: () => void
}) {
  const [localError, setLocalError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const value = (key: string) => String(data.get(key) ?? '').trim()
    const draft: WindowDraft = {
      windowType: value('windowType') as WindowDraft['windowType'],
      validFrom: value('validFrom'), validTo: value('validTo') || null,
      daysOfWeek: windowDays.filter(([day]) => data.getAll('days').includes(day)).map(([day]) => day),
      localStartTime: value('start'), localEndTime: value('end'),
      sourceType: value('sourceType') as WindowDraft['sourceType'],
      sourceReference: value('reference'), sourceEffectiveDate: value('sourceDate') || null,
      overnightAllowed: data.has('overnight') ? true : row?.overnightAllowed == null ? null : false,
      maxStayMinutes: value('maxStay') ? Number(value('maxStay')) : null,
    }
    const issue = validateWindow(draft)
    setLocalError(issue)
    if (!issue) onSave(draft)
  }
  return <Modal variant="drawer" title={row ? 'Sửa khung giờ' : 'Thêm khung giờ'} onClose={onClose} busy={busy}
    footer={<><Button tone="secondary" data-overlay-dismiss onClick={onClose}>Quay lại</Button><Button type="submit" form="port-window-form" disabled={blocked} busy={busy}>Lưu khung giờ</Button></>}>
    {row && <Notice title="Xác minh lại sau khi sửa">Khi lưu, khung giờ ngừng hoạt động và cần được xác minh lại trước khi kích hoạt.</Notice>}
    {(localError || error) && <Notice role="alert" tone="error" title="Chưa lưu được khung giờ">{localError || error}</Notice>}
    <form id="port-window-form" className={styles.formGrid} onSubmit={submit}>
      <Field htmlFor="window-movement" label="Loại khung giờ"><select id="window-movement" name="windowType" defaultValue={row?.windowType ?? ''} required><option value="">Chọn loại</option>{Object.entries(movement).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field htmlFor="window-from" label="Hiệu lực từ ngày"><input id="window-from" name="validFrom" type="date" defaultValue={row?.validFrom} required/></Field>
      <Field htmlFor="window-to" label="Hiệu lực đến ngày"><input id="window-to" name="validTo" type="date" defaultValue={row?.validTo ?? ''}/></Field>
      <fieldset><legend>Ngày áp dụng</legend>{windowDays.map(([day,label]) => <div key={day}><label><input type="checkbox" name="days" value={day} defaultChecked={row?.daysOfWeek.includes(day)}/>{label}</label></div>)}</fieldset>
      <Field htmlFor="window-start" label="Giờ bắt đầu tại cảng"><input id="window-start" name="start" type="time" step="1" defaultValue={row?.localStartTime} required/></Field>
      <Field htmlFor="window-end" label="Giờ kết thúc tại cảng"><input id="window-end" name="end" type="time" step="1" defaultValue={row?.localEndTime} required/></Field>
      <Field htmlFor="window-source" label="Nguồn xác nhận"><select id="window-source" name="sourceType" defaultValue={row?.sourceType ?? ''} required><option value="">Chọn nguồn</option><option value="PORT_AUTHORITY">Cơ quan quản lý cảng</option><option value="PORT_AGENT">Đại lý cảng</option></select></Field>
      <Field htmlFor="window-reference" label="Thông tin tham chiếu"><textarea id="window-reference" name="reference" defaultValue={row?.sourceReference} required maxLength={2000}/></Field>
      <Field htmlFor="window-source-date" label="Ngày hiệu lực của nguồn"><input id="window-source-date" name="sourceDate" type="date" defaultValue={row?.sourceEffectiveDate ?? ''}/></Field>
      <Field htmlFor="window-max-stay" label="Thời gian lưu tối đa (phút)"><input id="window-max-stay" name="maxStay" type="number" min="1" defaultValue={row?.maxStayMinutes ?? ''}/></Field>
      <label><input name="overnight" type="checkbox" defaultChecked={row?.overnightAllowed === true}/> Cho phép tàu lưu qua đêm</label>
    </form>
  </Modal>
}

export function PortCallWindows({ port }: { port: Port }) {
  const access = useSessionAccess()
  const isOps = access.roles.includes('OPERATIONS_MANAGER')
  const can = (action: string) => isOps && access.canDo('PORT_CALL_WINDOW_' + action)
  const canRead = ['PORT_CALL_WINDOW_READ', 'PORT_READ', 'TRIP_READ'].some(access.has)
  const id = port.portId
  const query = useReadQuery(JSON.stringify(['port-windows', access.userId, id, canRead]),
    useCallback(signal => canRead ? portWindowApi.list(id, signal) : Promise.resolve(null), [id, canRead]))
  const [edit, setEdit] = useState<PortWindow | null | undefined>()
  const [history, setHistory] = useState<PortWindow | null>(null)
  const [decision, setDecision] = useState<{ row: PortWindow; action: 'verify' | 'lifecycle' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const lock = useRef(false)

  async function mutate(action: () => Promise<PortWindow>) {
    if (busy || blocked || lock.current || query.loading || query.error) return
    lock.current = true
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const saved = await action()
      const actual = await portWindowApi.list(id)
      if (actual.portId !== id || !actual.windows.some(row => row.windowId === saved.windowId && row.revision === saved.revision &&
        row.verificationStatus === saved.verificationStatus && row.lifecycleStatus === saved.lifecycleStatus)) {
        throw new ApiError('Chưa đối chiếu được khung giờ đã lưu.', 502)
      }
      setSuccess('Đã cập nhật và đối chiếu khung giờ.')
      setEdit(undefined)
      setDecision(null)
      query.retry()
    } catch (reason) {
      const unknown = mutationOutcomeUnknown(reason)
      const stale = reason instanceof ApiError && reason.status === 409
      setBlocked(unknown || stale)
      setError(unknown ? 'Chưa xác định kết quả. Đóng biểu mẫu và tải lại danh sách để đối chiếu trước khi thao tác tiếp.'
        : reason instanceof ApiError ? businessErrorMessage(reason.code, reason.message) : 'Chưa thể cập nhật khung giờ.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (!canRead) return null
  const directory = query.data?.portId === id ? query.data : null
  const timeZone = directory?.portTimeZoneId ?? port.timeZoneId
  const available = Boolean(directory && !query.loading && !query.error && !blocked)
  const refresh = () => { setError(''); setSuccess(''); setBlocked(false); query.retry() }
  const prepare = () => { setError(''); setSuccess('') }
  return <Panel title="Khung giờ tàu đến và rời cảng" subtitle={`Giờ địa phương tại cảng · ${timeZone}`}>
    {query.loading && <Loading label="Đang tải khung giờ…"/>}
    {query.error && <Notice tone="error" title="Chưa đọc được khung giờ">{query.error.message}</Notice>}
    {success && <Notice role="status" tone="success" title="Đã lưu">{success}</Notice>}
    {error && edit === undefined && !decision && <Notice role="alert" tone="error" title="Chưa hoàn tất thao tác">{error}</Notice>}
    <div className={styles.actions}>
      {can('CREATE') && <Button disabled={!available || busy} onClick={() => { prepare(); setEdit(null) }}>Thêm khung giờ</Button>}
      {(blocked || query.error) && <Button tone="secondary" onClick={refresh}>Tải lại để đối chiếu</Button>}
    </div>
    {available && !directory?.windows.length && <Empty title="Chưa có khung giờ"><p>{can('CREATE') ? 'Thêm khung giờ theo thông tin được cảng xác nhận.' : 'Quản lý vận hành sẽ cập nhật khung giờ khi có thông tin xác nhận.'}</p></Empty>}
    {directory?.windows.length ? <DataTable label="Khung giờ theo cảng" headers={['Loại và giờ', 'Hiệu lực', 'Nguồn', 'Xác minh và hoạt động', 'Lần cập nhật', 'Thao tác']}>
      {directory.windows.map(row => {
        const verified = row.verificationStatus === 'VERIFIED' && row.verifiedTimeZoneId === timeZone
        return <tr key={row.windowId}>
          <td>{movement[row.windowType]}<br/>{row.localStartTime} – {row.localEndTime}</td>
          <td>{row.validFrom} – {row.validTo ?? 'Không ghi ngày kết thúc'}<br/>{windowDays.filter(([day]) => row.daysOfWeek.includes(day)).map(([, label]) => label).join(', ')}</td>
          <td>{row.sourceType === 'PORT_AUTHORITY' ? 'Cơ quan quản lý cảng' : 'Đại lý cảng'}<br/>{row.sourceReference}</td>
          <td><Badge label={verified ? 'Đã xác minh' : 'Cần xác minh'} tone={verified ? 'success' : 'warning'}/><br/>{row.lifecycleStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Chưa hoạt động'}</td>
          <td>{row.revision}</td>
          <td><div className={styles.actions}>
            {can('UPDATE') && <Button tone="secondary" disabled={!available || busy} onClick={() => { prepare(); setEdit(row) }}>Sửa</Button>}
            {can('VERIFY') && !verified && <Button tone="secondary" disabled={!available || busy} onClick={() => { prepare(); setDecision({row, action: 'verify'}) }}>Xác minh</Button>}
            {can('UPDATE') && (verified || row.lifecycleStatus === 'ACTIVE') && <Button tone="secondary" disabled={!available || busy} onClick={() => { prepare(); setDecision({row, action: 'lifecycle'}) }}>{row.lifecycleStatus === 'ACTIVE' ? 'Ngừng hoạt động' : 'Kích hoạt'}</Button>}
            {can('READ') && <Button tone="text" onClick={() => setHistory(row)}>Lịch sử</Button>}
          </div></td>
        </tr>
      })}
    </DataTable> : null}
    {edit !== undefined && <WindowEditor row={edit} busy={busy} blocked={blocked} error={error} onClose={() => setEdit(undefined)}
      onSave={draft => { if (can(edit ? 'UPDATE' : 'CREATE')) void mutate(() => portWindowApi.save(id, draft, edit)) }}/>}
    {history && <WindowHistory port={id} window={history} onClose={() => setHistory(null)}/>}
    {decision && <Modal title={decision.action === 'verify' ? 'Xác minh khung giờ' : 'Đổi trạng thái khung giờ'} onClose={() => setDecision(null)} busy={busy}
      footer={<><Button tone="secondary" data-overlay-dismiss onClick={() => setDecision(null)}>Quay lại</Button><Button disabled={blocked} busy={busy} onClick={() => {
        if (can(decision.action === 'verify' ? 'VERIFY' : 'UPDATE')) void mutate(() => portWindowApi[decision.action](id, decision.row))
      }}>Xác nhận</Button></>}>
      <p>{movement[decision.row.windowType]} · {decision.row.localStartTime} – {decision.row.localEndTime} · {timeZone}</p>
      <p>{decision.action === 'verify' ? 'Đối chiếu nguồn và giờ địa phương của cảng trước khi xác minh.' : decision.row.lifecycleStatus === 'ACTIVE' ? 'Khung giờ sẽ ngừng hoạt động.' : 'Khung giờ đã xác minh sẽ được kích hoạt.'}</p>
      {error && <Notice role="alert" tone="error" title="Chưa hoàn tất thao tác">{error}</Notice>}
    </Modal>}
  </Panel>
}
