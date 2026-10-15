import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Badge, Button, ButtonLink, DataTable, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'

import { itineraryApi } from '../api/itinerary-api'
import { ItineraryFrame } from '../components/ItineraryUI'
import styles from '../components/Itineraries.module.css'
import type { Destination, DestinationDraft, PageResult, Port, PortDraft } from '../model/itinerary'

type Kind = 'port' | 'destination'

const meta = {
  port: { singular: 'cảng', plural: 'Cảng', route: 'ports' },
  destination: { singular: 'điểm đến', plural: 'Điểm đến', route: 'destinations' },
} as const

function message(error: unknown) { return error instanceof Error ? error.message : 'Thao tác không thành công.' }

function MasterList({ kind }: { kind: Kind }) {
  const copy = meta[kind]
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PageResult<Port> | PageResult<Destination> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setLoading(true); setError('')
    const request = kind === 'port' ? itineraryApi.listPorts(page) : itineraryApi.listDestinations(page)
    void request.then((result) => setData(result)).catch((reason: unknown) => setError(message(reason))).finally(() => setLoading(false))
  }, [kind, page])
  useEffect(() => {
    let active = true
    const request = kind === 'port' ? itineraryApi.listPorts(page) : itineraryApi.listDestinations(page)
    void request.then((result) => { if (active) setData(result) }).catch((reason: unknown) => { if (active) setError(message(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [kind, page])

  return <ItineraryFrame>
    <PageHeader breadcrumb="DANH MỤC VẬN HÀNH" title={copy.plural} description={kind === 'port' ? 'Quản lý mã cảng, quốc gia, múi giờ và tọa độ phục vụ lịch trình.' : 'Quản lý các điểm đến thương mại được liên kết với cảng ghé.'} actions={<ButtonLink to={`/admin/${copy.route}/new`}>Thêm {copy.singular}</ButtonLink>} />
    <Panel title={`Danh sách ${copy.singular}`}>
      {loading && <Loading label={`Đang tải ${copy.singular}…`} />}
      {error && <Notice title="Không tải được dữ liệu" tone="error"><p>{error}</p><Button onClick={load}>Thử lại</Button></Notice>}
      {!loading && data && !data.items.length && <Empty title={`Chưa có ${copy.singular}`} />}
      {!loading && data?.items.length && kind === 'port' ? <DataTable label="Danh sách cảng" headers={['Mã', 'Tên cảng', 'Quốc gia', 'Múi giờ', 'Trạng thái', '']}>{(data.items as Port[]).map((item) => <tr key={item.portId}><td><strong>{item.portCode}</strong></td><td>{item.portName}</td><td>{item.countryCode}</td><td>{item.timeZoneId}</td><td><Badge label={item.status} tone={item.status === 'ACTIVE' ? 'success' : 'neutral'} /></td><td><Link className={styles.link} to={`/admin/ports/${item.portId}`}>Mở →</Link></td></tr>)}</DataTable> : null}
      {!loading && data?.items.length && kind === 'destination' ? <DataTable label="Danh sách điểm đến" headers={['Tên điểm đến', 'Quốc gia', 'Mô tả', 'Trạng thái', '']}>{(data.items as Destination[]).map((item) => <tr key={item.destinationId}><td><strong>{item.destinationName}</strong></td><td>{item.countryCode}</td><td>{item.description || '—'}</td><td><Badge label={item.status} tone={item.status === 'ACTIVE' ? 'success' : 'neutral'} /></td><td><Link className={styles.link} to={`/admin/destinations/${item.destinationId}`}>Mở →</Link></td></tr>)}</DataTable> : null}
      {data && data.pageCount > 1 && <div className={styles.pager}><span>{data.total} bản ghi</span><div><Button tone="secondary" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1) }}>Trước</Button> <Button tone="secondary" disabled={page >= data.pageCount} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Sau</Button></div></div>}
    </Panel>
  </ItineraryFrame>
}

type MasterDraft = { code: string; name: string; countryCode: string; timeZoneId: string; latitude: string; longitude: string; description: string; status: 'ACTIVE' | 'INACTIVE' }
const EMPTY: MasterDraft = { code: '', name: '', countryCode: '', timeZoneId: '', latitude: '', longitude: '', description: '', status: 'ACTIVE' }

function MasterForm({ kind }: { kind: Kind }) {
  const params = useParams()
  const id = kind === 'port' ? params.portId : params.destinationId
  const editing = Boolean(id)
  const copy = meta[kind]
  const navigate = useNavigate()
  const [draft, setDraft] = useState(EMPTY)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const canSave = !editing || loadedId === id
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    const request = kind === 'port' ? itineraryApi.getPort(id, controller.signal) : itineraryApi.getDestination(id, controller.signal)
    void request.then((item) => {
      setLoadedId(id)
      if (kind === 'port') { const port = item as Port; setDraft({ code: port.portCode, name: port.portName, countryCode: port.countryCode, timeZoneId: port.timeZoneId, latitude: port.latitude?.toString() ?? '', longitude: port.longitude?.toString() ?? '', description: '', status: port.status }) }
      else { const destination = item as Destination; setDraft({ ...EMPTY, name: destination.destinationName, countryCode: destination.countryCode, description: destination.description ?? '', status: destination.status }) }
    }).catch((reason: unknown) => setError(message(reason))).finally(() => setLoading(false))
    return () => controller.abort()
  }, [id, kind])

  function update(key: keyof MasterDraft, value: string) { setDraft((current) => ({ ...current, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitLock.current || !canSave) return
    setError('')
    if (!draft.name.trim() || draft.countryCode.trim().length !== 2 || (kind === 'port' && (!draft.code.trim() || !draft.timeZoneId.trim()))) { setError('Vui lòng nhập đủ trường bắt buộc; mã quốc gia phải đúng 2 ký tự.'); return }
    submitLock.current = true
    setBusy(true)
    try {
      if (kind === 'port') {
        const body: PortDraft = { portCode: draft.code.trim(), portName: draft.name.trim(), countryCode: draft.countryCode.toUpperCase(), timeZoneId: draft.timeZoneId.trim(), latitude: draft.latitude ? Number(draft.latitude) : null, longitude: draft.longitude ? Number(draft.longitude) : null, status: draft.status }
        const saved = editing && id ? await itineraryApi.updatePort(id, body) : await itineraryApi.createPort(body)
        navigate(`/admin/ports/${saved.portId}`)
      } else {
        const body: DestinationDraft = { destinationName: draft.name.trim(), countryCode: draft.countryCode.toUpperCase(), description: draft.description.trim() || null, status: draft.status }
        const saved = editing && id ? await itineraryApi.updateDestination(id, body) : await itineraryApi.createDestination(body)
        navigate(`/admin/destinations/${saved.destinationId}`)
      }
    } catch (reason) { setError(message(reason)) } finally { submitLock.current = false; setBusy(false) }
  }

  return <ItineraryFrame><PageHeader breadcrumb="DANH MỤC VẬN HÀNH" title={`${editing ? 'Chỉnh sửa' : 'Thêm'} ${copy.singular}`} description="Dữ liệu này được sử dụng trực tiếp trong trình biên tập lịch trình." />{loading ? <Loading label="Đang tải biểu mẫu…" /> : <form onSubmit={submit}><Panel title="Thông tin cơ bản"><div className={styles.formGrid}>
    {kind === 'port' && <Field htmlFor="master-code" label="Mã cảng"><input id="master-code" maxLength={50} required value={draft.code} onChange={(event) => update('code', event.target.value)} /></Field>}
    <Field htmlFor="master-name" label={kind === 'port' ? 'Tên cảng' : 'Tên điểm đến'}><input id="master-name" maxLength={200} required value={draft.name} onChange={(event) => update('name', event.target.value)} /></Field>
    <Field htmlFor="master-country" label="Mã quốc gia"><input id="master-country" minLength={2} maxLength={2} required value={draft.countryCode} onChange={(event) => update('countryCode', event.target.value)} /></Field>
    {kind === 'port' && <><Field htmlFor="master-timezone" label="Múi giờ"><input id="master-timezone" maxLength={100} required value={draft.timeZoneId} onChange={(event) => update('timeZoneId', event.target.value)} /></Field><Field htmlFor="master-latitude" label="Vĩ độ"><input id="master-latitude" type="number" step="any" value={draft.latitude} onChange={(event) => update('latitude', event.target.value)} /></Field><Field htmlFor="master-longitude" label="Kinh độ"><input id="master-longitude" type="number" step="any" value={draft.longitude} onChange={(event) => update('longitude', event.target.value)} /></Field></>}
    {kind === 'destination' && <Field htmlFor="master-description" label="Mô tả"><textarea id="master-description" maxLength={1000} rows={4} value={draft.description} onChange={(event) => update('description', event.target.value)} /></Field>}
    <Field htmlFor="master-status" label="Trạng thái"><select id="master-status" value={draft.status} onChange={(event) => update('status', event.target.value)}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></Field>
  </div>{error && <Notice title="Chưa thể lưu" tone="error"><p>{error}</p></Notice>}<div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => navigate(`/admin/${copy.route}`)}>Hủy</Button><Button type="submit" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : 'Lưu'}</Button></div></Panel></form>}</ItineraryFrame>
}

function MasterDetail({ kind }: { kind: Kind }) {
  const params = useParams()
  const id = (kind === 'port' ? params.portId : params.destinationId) ?? ''
  const copy = meta[kind]
  const navigate = useNavigate()
  const [record, setRecord] = useState<Port | Destination | null>(null)
  const [linkedPorts, setLinkedPorts] = useState<Port[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [removeOpen, setRemoveOpen] = useState(false)
  const mutationLock = useRef(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (kind === 'port') setRecord(await itineraryApi.getPort(id))
      else { const [destination, ports] = await Promise.all([itineraryApi.getDestination(id), itineraryApi.destinationPorts(id)]); setRecord(destination); setLinkedPorts(ports) }
    } catch (reason) { setError(message(reason)) } finally { setLoading(false) }
  }, [id, kind])
  useEffect(() => {
    let active = true
    const request = kind === 'port'
      ? itineraryApi.getPort(id).then((port) => ({ record: port as Port | Destination, ports: [] as Port[] }))
      : Promise.all([itineraryApi.getDestination(id), itineraryApi.destinationPorts(id)]).then(([destination, ports]) => ({ record: destination as Port | Destination, ports }))
    void request.then((result) => { if (active) { setRecord(result.record); setLinkedPorts(result.ports); setLoading(false) } }).catch((reason: unknown) => { if (active) { setError(message(reason)); setLoading(false) } })
    return () => { active = false }
  }, [id, kind])
  async function validate() { if (mutationLock.current) return; mutationLock.current = true; setBusy(true); setError(''); setSuccess(''); try { if (kind === 'port') await itineraryApi.validatePort(id); else await itineraryApi.validateDestination(id); setSuccess('Backend xác nhận dữ liệu hợp lệ.') } catch (reason) { setError(message(reason)) } finally { mutationLock.current = false; setBusy(false) } }
  async function togglePort() { if (kind !== 'port' || !record || mutationLock.current) return; mutationLock.current = true; setBusy(true); setError(''); try { const port = record as Port; await (port.status === 'ACTIVE' ? itineraryApi.deactivatePort(id) : itineraryApi.activatePort(id)); setSuccess('Đã cập nhật trạng thái cảng.'); await load() } catch (reason) { setError(message(reason)) } finally { mutationLock.current = false; setBusy(false) } }
  async function remove() { if (mutationLock.current) return; mutationLock.current = true; setBusy(true); setError(''); try { if (kind === 'port') await itineraryApi.removePort(id); else await itineraryApi.removeDestination(id); navigate(`/admin/${copy.route}`) } catch (reason) { setError(message(reason)); setRemoveOpen(false) } finally { mutationLock.current = false; setBusy(false) } }

  const title = record ? (kind === 'port' ? (record as Port).portName : (record as Destination).destinationName) : copy.plural
  const status = record?.status
  return <ItineraryFrame><PageHeader breadcrumb="DANH MỤC VẬN HÀNH" title={title} description={`Chi tiết ${copy.singular} và các liên kết đang áp dụng.`} actions={record ? <><Badge label={status ?? '—'} tone={status === 'ACTIVE' ? 'success' : 'neutral'} /><ButtonLink tone="secondary" to={`/admin/${copy.route}/${id}/edit`}>Chỉnh sửa</ButtonLink></> : undefined} />
    {loading && <Loading label={`Đang tải ${copy.singular}…`} />}{error && <Notice title="Không thể thực hiện" tone="error"><p>{error}</p></Notice>}{success && <Notice title="Đã cập nhật" tone="success"><p>{success}</p></Notice>}
    {record && <><Panel title="Thông tin danh mục">{kind === 'port' ? <DataTable label="Thông tin cảng" headers={['Thuộc tính', 'Giá trị']}><tr><td>Mã cảng</td><td>{(record as Port).portCode}</td></tr><tr><td>Quốc gia / múi giờ</td><td>{record.countryCode} · {(record as Port).timeZoneId}</td></tr><tr><td>Tọa độ</td><td>{(record as Port).latitude ?? '—'}, {(record as Port).longitude ?? '—'}</td></tr></DataTable> : <DataTable label="Thông tin điểm đến" headers={['Thuộc tính', 'Giá trị']}><tr><td>Quốc gia</td><td>{record.countryCode}</td></tr><tr><td>Mô tả</td><td>{(record as Destination).description || '—'}</td></tr></DataTable>}</Panel>
      {kind === 'destination' && <Panel title={`Cảng liên kết · ${linkedPorts.length}`}>{linkedPorts.length ? <DataTable label="Cảng thuộc điểm đến" headers={['Mã', 'Tên cảng', 'Múi giờ']}>{linkedPorts.map((port) => <tr key={port.portId}><td>{port.portCode}</td><td>{port.portName}</td><td>{port.timeZoneId}</td></tr>)}</DataTable> : <Empty title="Chưa có cảng liên kết" />}</Panel>}
      <Panel title="Thao tác"><div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => void validate()}>Kiểm tra dữ liệu</Button>{kind === 'port' && <Button disabled={busy} onClick={() => void togglePort()}>{status === 'ACTIVE' ? 'Ngừng kích hoạt' : 'Kích hoạt'}</Button>}<Button tone="danger" disabled={busy} onClick={() => setRemoveOpen(true)}>Xóa khi chưa sử dụng</Button></div></Panel></>}
    {removeOpen && <Modal title={`Xóa ${copy.singular}?`} onClose={() => { if (!busy) setRemoveOpen(false) }}><p>Backend chỉ cho phép xóa khi bản ghi chưa được tham chiếu.</p><div className={styles.modalActions}><Button tone="secondary" disabled={busy} onClick={() => setRemoveOpen(false)}>Quay lại</Button><Button tone="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button></div></Modal>}
  </ItineraryFrame>
}

export const PortListPage = () => <MasterList kind="port" />
export const PortFormPage = () => <MasterForm kind="port" />
export const PortDetailPage = () => <MasterDetail kind="port" />
export const DestinationListPage = () => <MasterList kind="destination" />
export const DestinationFormPage = () => <MasterForm kind="destination" />
export const DestinationDetailPage = () => <MasterDetail kind="destination" />
