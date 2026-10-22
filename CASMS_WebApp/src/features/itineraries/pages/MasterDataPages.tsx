import { useSessionAccess } from '@/shared/auth'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { Badge, Button, ButtonLink, DataTable, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { ApiError } from '@/shared/api'

import { itineraryApi } from '../api/itinerary-api'
import { ItineraryFrame } from '../components/ItineraryUI'
import { LocationPicker } from '../components/LocationPicker'
import styles from '../components/Itineraries.module.css'
import { destinationStatusLabels, validateDestinationDraft } from '../model/itinerary'
import type { Destination, DestinationDraft, DestinationPortSummary, PageResult, Port, PortDraft } from '../model/itinerary'

type Kind = 'port' | 'destination'

const meta = {
  port: { singular: 'cảng', plural: 'Cảng', route: 'ports' },
  destination: { singular: 'điểm đến', plural: 'Điểm đến', route: 'destinations' },
} as const

function message(error: unknown) { return error instanceof Error ? error.message : 'Thao tác không thành công.' }
function destinationMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Bạn chưa có quyền xem hoặc thực hiện thao tác này.'
    if (error.status === 404) return 'Không tìm thấy thông tin được yêu cầu.'
    if (error.status === 0 || error.status >= 500) return 'Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.'
  }
  return message(error)
}

async function loadMasterList(kind: Kind, page: number, activeOnly: boolean, signal?: AbortSignal): Promise<PageResult<Port> | PageResult<Destination>> {
  if (!activeOnly) return kind === 'port' ? itineraryApi.listPorts(page, signal) : itineraryApi.listDestinations(page, signal)
  const rows = kind === 'port' ? await itineraryApi.activePorts(signal) : await itineraryApi.activeDestinations(signal)
  if (!Array.isArray(rows)) throw new Error('Danh sách đang hoạt động không hợp lệ.')
  return { items: rows.slice((page - 1) * 20, page * 20), page, pageSize: 20, pageCount: Math.ceil(rows.length / 20), total: rows.length } as PageResult<Port> | PageResult<Destination>
}
function MasterList({ kind }: { kind: Kind }) {
  const access = useSessionAccess(), [params] = useSearchParams()
  const [activeOnly, setActiveOnly] = useState(params.get('active') === 'true')
  const copy = meta[kind]
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PageResult<Port> | PageResult<Destination> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const load = useCallback(() => {
    setLoading(true); setError('')
    if (kind === 'destination') { setAttempt(value => value + 1); return }
    const request = loadMasterList(kind, page, activeOnly)
    void request.then((result) => setData(result)).catch((reason: unknown) => setError(message(reason))).finally(() => setLoading(false))
  }, [kind, page, activeOnly])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const request = loadMasterList(kind, page, activeOnly, controller.signal)
    void request.then((result) => { if (active) setData(result) }).catch((reason: unknown) => { if (active) { if (kind === 'destination') setData(null); setError(kind === 'destination' ? destinationMessage(reason) : message(reason)) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; if (kind === 'destination') controller.abort() }
  }, [kind, page, attempt, activeOnly])

  return <ItineraryFrame>
    <PageHeader breadcrumb="DANH MỤC VẬN HÀNH" title={copy.plural} description={kind === 'port' ? 'Quản lý mã cảng, quốc gia, múi giờ và tọa độ phục vụ lịch trình.' : 'Quản lý các điểm đến thương mại được liên kết với cảng ghé.'} actions={access.has(`${kind.toUpperCase()}_CREATE`) ? <ButtonLink to={`/admin/${copy.route}/new`}>Thêm {copy.singular}</ButtonLink> : undefined} />
    <Panel title={`Danh sách ${copy.singular}`}><label><input type="checkbox" checked={activeOnly} onChange={event => { setActiveOnly(event.target.checked); setPage(1); setLoading(true) }} /> Chỉ hiển thị đang hoạt động</label>
      {loading && <Loading label={`Đang tải ${copy.singular}…`} />}
      {error && <Notice title="Không tải được dữ liệu" tone="error"><p>{error}</p><Button onClick={load}>Thử lại</Button></Notice>}
      {!loading && (kind === 'port' || !error) && data && !data.items.length && <Empty title={`Chưa có ${copy.singular}`} />}
      {!loading && data?.items.length && kind === 'port' ? <DataTable label="Danh sách cảng" headers={['Mã', 'Tên cảng', 'Quốc gia', 'Múi giờ', 'Trạng thái', '']}>{(data.items as Port[]).map((item) => <tr key={item.portId}><td><strong>{item.portCode}</strong></td><td>{item.portName}</td><td>{item.countryCode}</td><td>{item.timeZoneId}</td><td><Badge label={item.status} tone={item.status === 'ACTIVE' ? 'success' : 'neutral'} /></td><td><Link className={styles.link} to={`/admin/ports/${item.portId}`}>Mở →</Link></td></tr>)}</DataTable> : null}
      {!loading && !error && data?.items.length && kind === 'destination' ? <DataTable label="Danh sách điểm đến" headers={['Tên điểm đến', 'Quốc gia', 'Mô tả', 'Trạng thái', '']}>{(data.items as Destination[]).map((item) => <tr key={item.destinationId}><td><strong>{item.destinationName}</strong></td><td>{item.countryCode}</td><td>{item.description || '—'}</td><td><Badge label={destinationStatusLabels[item.status]} tone={item.status === 'ACTIVE' ? 'success' : 'neutral'} /></td><td><Link className={styles.link} to={`/admin/destinations/${item.destinationId}`}>Mở →</Link></td></tr>)}</DataTable> : null}
      {data && data.pageCount > 1 && <div className={styles.pager}><span>{data.total} bản ghi</span><div><Button tone="secondary" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1) }}>Trước</Button> <Button tone="secondary" disabled={page >= data.pageCount} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Sau</Button></div></div>}
    </Panel>
  </ItineraryFrame>
}

type MasterDraft = { code: string; name: string; city: string; countryCode: string; timeZoneId: string; latitude: string; longitude: string; description: string; status: 'ACTIVE' | 'INACTIVE' }
const EMPTY: MasterDraft = { code: '', name: '', city: '', countryCode: '', timeZoneId: '', latitude: '', longitude: '', description: '', status: 'ACTIVE' }

function MasterForm({ kind }: { kind: Kind }) {
  const access = useSessionAccess()
  const params = useParams()
  const id = kind === 'port' ? params.portId : params.destinationId
  const editing = Boolean(id)
  const copy = meta[kind]
  const navigate = useNavigate()
  const [draft, setDraft] = useState(EMPTY)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const autoLocationName = useRef('')
  const canSave = !editing || loadedId === id
  const permitted = access.has(`${kind.toUpperCase()}_${editing ? 'UPDATE' : 'CREATE'}`)
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loadAttempt, setLoadAttempt] = useState(0)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    const request = kind === 'port' ? itineraryApi.getPort(id, controller.signal) : itineraryApi.getDestination(id, controller.signal)
    void request.then((item) => {
      if (kind === 'destination' && controller.signal.aborted) return
      setLoadedId(id)
      if (kind === 'port') { const port = item as Port; setDraft({ code: port.portCode, name: port.portName, city: '', countryCode: port.countryCode, timeZoneId: port.timeZoneId, latitude: port.latitude?.toString() ?? '', longitude: port.longitude?.toString() ?? '', description: '', status: port.status }) }
      else { const destination = item as Destination; setDraft({ ...EMPTY, name: destination.destinationName, countryCode: destination.countryCode, latitude: destination.latitude?.toString() ?? '', longitude: destination.longitude?.toString() ?? '', description: destination.description ?? '', status: destination.status }) }
    }).catch((reason: unknown) => { if (kind !== 'destination' || !controller.signal.aborted) setError(kind === 'destination' ? destinationMessage(reason) : message(reason)) }).finally(() => { if (kind !== 'destination' || !controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, kind, loadAttempt])

  function update(key: keyof MasterDraft, value: string) { setDraft((current) => ({ ...current, [key]: value })); if (kind === 'destination') setFieldErrors(current => ({ ...current, [key === 'name' ? 'destinationName' : key]: '' })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!permitted || submitLock.current || !canSave) return
    setError('')
    if ((draft.latitude === '') !== (draft.longitude === '') || (draft.latitude !== '' && (!Number.isFinite(Number(draft.latitude)) || Math.abs(Number(draft.latitude)) > 90)) || (draft.longitude !== '' && (!Number.isFinite(Number(draft.longitude)) || Math.abs(Number(draft.longitude)) > 180))) { setError('Nhập đủ cặp tọa độ hợp lệ: vĩ độ -90 đến 90, kinh độ -180 đến 180.'); return }
    const destinationBody: DestinationDraft = { destinationName: draft.name.trim(), countryCode: draft.countryCode.trim().toUpperCase(), description: editing ? draft.description.trim() : draft.description.trim() || null, status: draft.status, latitude: draft.latitude === '' ? null : Number(draft.latitude), longitude: draft.longitude === '' ? null : Number(draft.longitude) }
    if (kind === 'destination') {
      const errors = validateDestinationDraft(destinationBody, editing)
      setFieldErrors(errors)
      if (Object.keys(errors).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return }
    } else if (!draft.name.trim() || draft.countryCode.trim().length !== 2 || !draft.code.trim() || !draft.timeZoneId.trim()) { setError('Vui lòng nhập đủ trường bắt buộc; mã quốc gia phải đúng 2 ký tự.'); return }
    submitLock.current = true
    setBusy(true)
    try {
      if (kind === 'port') {
        const body: PortDraft = { portCode: draft.code.trim(), portName: draft.name.trim(), countryCode: draft.countryCode.toUpperCase(), timeZoneId: draft.timeZoneId.trim(), latitude: draft.latitude ? Number(draft.latitude) : null, longitude: draft.longitude ? Number(draft.longitude) : null, status: draft.status }
        const saved = editing && id ? await itineraryApi.updatePort(id, body) : await itineraryApi.createPort(body)
        navigate(`/admin/ports/${saved.portId}`)
      } else {
        const saved = editing && id ? await itineraryApi.updateDestination(id, destinationBody) : await itineraryApi.createDestination(destinationBody)
        navigate(`/admin/destinations/${saved.destinationId}`)
      }
    } catch (reason) {
      if (kind === 'destination' && reason instanceof ApiError && reason.code === 'DESTINATION_NAME_EXISTS') {
        setFieldErrors({ destinationName: 'Tên điểm đến này đã tồn tại. Vui lòng chọn tên khác.' })
        requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      } else setError(kind === 'destination' ? destinationMessage(reason) : message(reason))
    } finally { submitLock.current = false; setBusy(false) }
  }

  const retryDestination = () => { setLoading(true); setError(''); setLoadAttempt(value => value + 1) }
  return <ItineraryFrame><PageHeader breadcrumb="DANH MỤC VẬN HÀNH" title={`${editing ? 'Chỉnh sửa' : 'Thêm'} ${copy.singular}`} description={kind === 'destination' ? 'Điểm đến giúp nhóm các cảng liên kết khi lập lịch trình. Thêm điểm đến không tự tạo cảng.' : 'Dữ liệu này được sử dụng trực tiếp trong trình biên tập lịch trình.'} />{loading ? <Loading label="Đang tải biểu mẫu…" /> : kind === 'destination' && editing && !canSave ? <Notice title="Không tải được điểm đến" tone="error"><p>{error}</p><Button onClick={retryDestination}>Thử lại</Button></Notice> : <form ref={form} noValidate={kind === 'destination'} onSubmit={submit}><Panel title="Thông tin cơ bản">
    {kind === 'destination' && editing && <Notice title="Thông tin được phép chỉnh sửa">Bạn có thể đổi tên và mô tả. Quốc gia được giữ nguyên; trạng thái được quản lý qua thao tác kích hoạt hoặc ngừng kích hoạt.</Notice>}
    <LocationPicker country={draft.countryCode} city={draft.city} disabled={busy} countryLocked={editing} countryError={fieldErrors.countryCode}
      onCountry={countryCode => { const previousName = autoLocationName.current; autoLocationName.current = ''; setDraft(current => ({ ...current, countryCode, city: '', latitude: '', longitude: '', timeZoneId: '', name: kind === 'destination' && current.name === previousName ? '' : current.name })); setFieldErrors(current => ({ ...current, countryCode: '' })) }}
      onCity={city => setDraft(current => ({ ...current, city, latitude: '', longitude: '' }))}
      onApply={place => { const previousName = autoLocationName.current; autoLocationName.current = place.name; setDraft(current => ({ ...current, latitude: String(place.latitude), longitude: String(place.longitude), timeZoneId: place.timeZoneId, name: kind === 'destination' && (!current.name.trim() || current.name === previousName) ? place.name : current.name })) }} />
    <div className={styles.formGrid}>
    {kind === 'port' && <Field htmlFor="master-code" label="Mã cảng"><input id="master-code" maxLength={50} required value={draft.code} onChange={(event) => update('code', event.target.value)} /></Field>}
    <Field htmlFor="master-name" label={kind === 'port' ? 'Tên cảng' : 'Tên điểm đến'} error={kind === 'destination' ? fieldErrors.destinationName : undefined}><input id="master-name" aria-invalid={kind === 'destination' && Boolean(fieldErrors.destinationName)} disabled={kind === 'destination' && busy} maxLength={200} required value={draft.name} onChange={(event) => update('name', event.target.value)} /></Field>
    {kind === 'port' && <Field htmlFor="master-timezone" label="Múi giờ"><input id="master-timezone" maxLength={100} required disabled={busy} value={draft.timeZoneId} onChange={(event) => update('timeZoneId', event.target.value)} /></Field>}
    <Field htmlFor="master-latitude" label="Vĩ độ" hint="Điền từ kết quả tra cứu; có thể chỉnh lại vị trí chính xác."><input id="master-latitude" type="number" min={-90} max={90} step="any" disabled={busy} value={draft.latitude} onChange={(event) => update('latitude', event.target.value)} /></Field><Field htmlFor="master-longitude" label="Kinh độ"><input id="master-longitude" type="number" min={-180} max={180} step="any" disabled={busy} value={draft.longitude} onChange={(event) => update('longitude', event.target.value)} /></Field>
    {kind === 'destination' && <Field htmlFor="master-description" label="Mô tả" error={fieldErrors.description}><textarea id="master-description" aria-invalid={Boolean(fieldErrors.description)} disabled={busy} maxLength={1000} rows={4} value={draft.description} onChange={(event) => update('description', event.target.value)} /></Field>}
    <Field htmlFor="master-status" label="Trạng thái" error={kind === 'destination' ? fieldErrors.status : undefined}><select id="master-status" aria-invalid={kind === 'destination' && Boolean(fieldErrors.status)} disabled={kind === 'destination' && (busy || editing)} value={draft.status} onChange={(event) => update('status', event.target.value)}><option value="ACTIVE">{kind === 'destination' ? destinationStatusLabels.ACTIVE : 'ACTIVE'}</option><option value="INACTIVE">{kind === 'destination' ? destinationStatusLabels.INACTIVE : 'INACTIVE'}</option></select></Field>
  </div>{error && <Notice title="Chưa thể lưu" tone="error"><p>{error}</p></Notice>}<div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => navigate(`/admin/${copy.route}`)}>Hủy</Button><Button type="submit" disabled={busy || !canSave || !permitted}>{busy ? 'Đang lưu…' : 'Lưu'}</Button></div></Panel></form>}</ItineraryFrame>
}

function MasterDetail({ kind }: { kind: Kind }) {
  const access = useSessionAccess()
  const can = (action: string) => access.has(`${kind.toUpperCase()}_${action}`)
  const params = useParams()
  const id = (kind === 'port' ? params.portId : params.destinationId) ?? ''
  const copy = meta[kind]
  const navigate = useNavigate()
  const [record, setRecord] = useState<Port | Destination | null>(null)
  const [linkedPorts, setLinkedPorts] = useState<DestinationPortSummary[]>([])
  const [portsLoading, setPortsLoading] = useState(true)
  const [portsError, setPortsError] = useState('')
  const [portsAttempt, setPortsAttempt] = useState(0)
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [removeOpen, setRemoveOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const mutationLock = useRef(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    if (kind === 'destination') { setDetailAttempt(value => value + 1); return }
    try {
      setRecord(await itineraryApi.getPort(id))
    } catch (reason) { setError(message(reason)) } finally { setLoading(false) }
  }, [id, kind])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const request = kind === 'port'
      ? itineraryApi.getPort(id).then((port) => ({ record: port as Port | Destination, ports: [] as Port[] }))
      : itineraryApi.getDestination(id, controller.signal).then(destination => ({ record: destination as Port | Destination, ports: [] }))
    void request.then((result) => { if (active) { setRecord(result.record); if (kind === 'port') setLinkedPorts(result.ports); setLoading(false) } }).catch((reason: unknown) => { if (active) { setError(kind === 'destination' ? destinationMessage(reason) : message(reason)); setLoading(false) } })
    return () => { active = false; if (kind === 'destination') controller.abort() }
  }, [id, kind, detailAttempt])
  useEffect(() => {
    if (kind !== 'destination') return
    let active = true
    const controller = new AbortController()
    void itineraryApi.destinationPorts(id, controller.signal).then(ports => {
      if (!Array.isArray(ports)) throw new Error('Chưa nhận được danh sách cảng liên kết hợp lệ.')
      if (active) setLinkedPorts(ports)
    }).catch((reason: unknown) => { if (active) setPortsError(destinationMessage(reason)) }).finally(() => { if (active) setPortsLoading(false) })
    return () => { active = false; controller.abort() }
  }, [id, kind, portsAttempt])
  const retryPorts = () => { setPortsLoading(true); setPortsError(''); setPortsAttempt(value => value + 1) }
  async function validate() { if (!can('VALIDATE') || mutationLock.current) return; mutationLock.current = true; setBusy(true); setError(''); setSuccess(''); try { if (kind === 'port') await itineraryApi.validatePort(id); else await itineraryApi.validateDestination(id); setSuccess(kind === 'destination' ? 'Đã kiểm tra thông tin điểm đến.' : 'Dữ liệu hợp lệ.') } catch (reason) { setError(message(reason)) } finally { mutationLock.current = false; setBusy(false) } }
  async function checkAvailability() { if (kind !== 'port' || mutationLock.current) return; mutationLock.current = true; setBusy(true); setError(''); setSuccess(''); try { const isAvailable = await itineraryApi.checkPortAvailability(id); setSuccess(isAvailable ? 'Cảng đang hoạt động và sẵn sàng vận hành.' : 'Cảng hiện không khả dụng cho vận hành.') } catch (reason) { setError(message(reason)) } finally { mutationLock.current = false; setBusy(false) } }
  async function togglePort() {
    if (!record || !can(kind === 'destination' ? 'UPDATE' : record.status === 'ACTIVE' ? 'DEACTIVATE' : 'ACTIVATE') || mutationLock.current) return
    mutationLock.current = true; setBusy(true); setError('')
    try { const active = record.status === 'ACTIVE'; if (kind === 'port') await (active ? itineraryApi.deactivatePort(id) : itineraryApi.activatePort(id)); else await (active ? itineraryApi.deactivateDestination(id) : itineraryApi.activateDestination(id)); setStatusOpen(false); setSuccess('Đã cập nhật trạng thái.'); await load() }
    catch (reason) { setError(message(reason)) }
    finally { mutationLock.current = false; setBusy(false) }
  }
  async function remove() { if (!can('DELETE_UNUSED') || mutationLock.current) return; mutationLock.current = true; setBusy(true); setError(''); try { if (kind === 'port') await itineraryApi.removePort(id); else await itineraryApi.removeDestination(id); navigate(`/admin/${copy.route}`) } catch (reason) { setError(message(reason)); setRemoveOpen(false) } finally { mutationLock.current = false; setBusy(false) } }

  const title = record ? (kind === 'port' ? (record as Port).portName : (record as Destination).destinationName) : copy.plural
  const status = record?.status
  return <ItineraryFrame><PageHeader breadcrumb="DANH MỤC VẬN HÀNH" title={title} description={`Chi tiết ${copy.singular} và các liên kết đang áp dụng.`} actions={record ? <><Badge label={kind === 'destination' && status ? destinationStatusLabels[status] : status ?? '—'} tone={status === 'ACTIVE' ? 'success' : 'neutral'} /><ButtonLink tone="secondary" to={`/admin/${copy.route}/${id}/edit`}>Chỉnh sửa</ButtonLink></> : undefined} />
    {loading && <Loading label={`Đang tải ${copy.singular}…`} />}{error && <Notice title="Không thể thực hiện" tone="error"><p>{error}</p>{kind === 'destination' && !record && <Button onClick={() => void load()}>Thử lại</Button>}</Notice>}{success && <Notice title="Đã cập nhật" tone="success"><p>{success}</p></Notice>}
    {record && <><Panel title="Thông tin danh mục">{kind === 'port' ? <DataTable label="Thông tin cảng" headers={['Thuộc tính', 'Giá trị']}><tr><td>Mã cảng</td><td>{(record as Port).portCode}</td></tr><tr><td>Quốc gia / múi giờ</td><td>{record.countryCode} · {(record as Port).timeZoneId}</td></tr><tr><td>Tọa độ</td><td>{(record as Port).latitude ?? '—'}, {(record as Port).longitude ?? '—'}</td></tr></DataTable> : <DataTable label="Thông tin điểm đến" headers={['Thuộc tính', 'Giá trị']}><tr><td>Quốc gia</td><td>{record.countryCode}</td></tr><tr><td>Mô tả</td><td>{(record as Destination).description || '—'}</td></tr></DataTable>}</Panel>
      {kind === 'destination' && <Panel title={`Cảng liên kết${!portsLoading && !portsError ? ` · ${linkedPorts.length}` : ''}`}>
        <p>Các cảng hiện được liên kết với điểm đến này. Mở cảng để xem thông tin chi tiết.</p>
        {portsLoading ? <Loading label="Đang tải cảng liên kết…" /> : portsError ? <Notice title="Không tải được cảng liên kết" tone="error"><p>{portsError}</p><Button onClick={retryPorts}>Thử lại</Button></Notice>
          : linkedPorts.length ? <DataTable label="Cảng thuộc điểm đến" headers={['Mã', 'Tên cảng', '']}>
            {linkedPorts.map(port => <tr key={port.portId}><td>{port.portCode}</td><td>{port.portName}</td><td><Link className={styles.link} to={`/admin/ports/${port.portId}`}>Mở cảng →</Link></td></tr>)}
          </DataTable> : <Empty title="Chưa có cảng liên kết" />}
      </Panel>}
      <Panel title="Thao tác"><div className={styles.actions}>{can('VALIDATE') && <Button tone="secondary" disabled={busy || !can('VALIDATE')} onClick={() => void validate()}>Kiểm tra dữ liệu</Button>}{kind === 'port' && <Button tone="secondary" disabled={busy} onClick={() => void checkAvailability()}>Kiểm tra khả dụng</Button>}{can(kind === 'destination' ? 'UPDATE' : status === 'ACTIVE' ? 'DEACTIVATE' : 'ACTIVATE') && <Button disabled={busy} onClick={() => setStatusOpen(true)}>{status === 'ACTIVE' ? 'Ngừng kích hoạt' : 'Kích hoạt'}</Button>}{can('DELETE_UNUSED') && <Button tone="danger" disabled={busy || !can('DELETE_UNUSED')} onClick={() => setRemoveOpen(true)}>Xóa khi chưa sử dụng</Button>}</div></Panel></>}
    {statusOpen && can(kind === 'destination' ? 'UPDATE' : status === 'ACTIVE' ? 'DEACTIVATE' : 'ACTIVATE') && <Modal title={status === 'ACTIVE' ? 'Ngừng kích hoạt' : 'Kích hoạt'} busy={busy} onClose={() => setStatusOpen(false)}><p>Xác nhận thay đổi trạng thái của {title}? Các điều kiện đang sử dụng sẽ được kiểm tra trước khi cập nhật.</p>{error && <Notice title="Chưa đổi được trạng thái" tone="error">{error}</Notice>}<Button disabled={busy} onClick={() => void togglePort()}>Xác nhận thay đổi trạng thái</Button></Modal>}
    {removeOpen && can('DELETE_UNUSED') && <Modal title={`Xóa ${copy.singular}?`} onClose={() => { if (!busy) setRemoveOpen(false) }} footer={<div className={styles.modalActions}><Button tone="secondary" disabled={busy} onClick={() => setRemoveOpen(false)} data-overlay-dismiss>Quay lại</Button><Button tone="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button></div>}><p>{kind === 'destination' ? 'Chỉ xóa điểm đến khi bạn đã xác nhận không còn được sử dụng. Thao tác này không thể hoàn tác.' : 'Chỉ có thể xóa bản ghi chưa được sử dụng.'}</p></Modal>}
  </ItineraryFrame>
}

export const PortListPage = () => <MasterList kind="port" />
export const PortFormPage = () => <MasterForm kind="port" />
export const PortDetailPage = () => <MasterDetail kind="port" />
export const DestinationListPage = () => <MasterList kind="destination" />
export const DestinationFormPage = () => { const { destinationId } = useParams(); return <MasterForm key={destinationId ?? 'new'} kind="destination" /> }
export const DestinationDetailPage = () => { const { destinationId } = useParams(); return <MasterDetail key={destinationId} kind="destination" /> }
