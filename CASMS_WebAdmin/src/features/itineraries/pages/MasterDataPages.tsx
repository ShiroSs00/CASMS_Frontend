import { EditorLayout } from '@/shared/ui'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { Badge, Button, ButtonLink, CollectionSummary, DataTable, Empty, Field, Loading, Modal, Notice, PageHeader, Panel, RecordFacts } from '@/shared/ui'
import { ApiError, useReadQuery } from '@/shared/api'
import { businessErrorMessage } from '@/shared/api/business-errors'

import { itineraryApi } from '../api/itinerary-api'
import { ItineraryFrame } from '../components/ItineraryUI'
import { DirectoryHistory } from '../components/DirectoryHistory'
import { LocationPicker } from '../components/LocationPicker'
import { portCountries, coordinateSourceOf, type PortCoordinateSource } from '../model/port-location'
import styles from '../components/Itineraries.module.css'
import { destinationStatusLabels as directoryStatusLabels, validateDestinationDraft } from '../model/itinerary'
import type { Destination, DestinationDraft, DestinationPortSummary, PageResult, Port, PortDraft } from '../model/itinerary'

type Kind = 'port' | 'destination'

const meta = {
  port: { singular: 'cảng ghé', plural: 'Cảng ghé', management:'Cảng ghé', route: 'ports' },
  destination: { singular: 'điểm đến', plural: 'Điểm đến', management:'Điểm đến', route: 'destinations' },
} as const

function message(error: unknown) { return error instanceof ApiError ? businessErrorMessage(error.code,error.message) : error instanceof Error ? error.message : 'Thao tác không thành công.' }
function destinationMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Bạn chưa có quyền xem hoặc thực hiện thao tác này.'
    if (error.status === 404) return 'Không tìm thấy thông tin được yêu cầu.'
    if (error.status === 0 || error.status >= 500) return 'Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.'
  }
  return message(error)
}

async function loadMasterList(kind: Kind, page: number, filters: {search?:string;countryCode?:string;status?:string}, signal?:AbortSignal): Promise<PageResult<Port>|PageResult<Destination>> {
  return kind === 'port' ? itineraryApi.listPorts(page,signal,filters) : itineraryApi.listDestinations(page,signal,filters)
}
function MasterList({ kind }: { kind: Kind }) {
  const access = useSessionAccess(), [params] = useSearchParams()
  const [search,setSearch]=useState(''),[countryCode,setCountryCode]=useState(''),[status,setStatus]=useState(params.get('active')==='true'?'ACTIVE':'')
  const activeOnly=Boolean(search||countryCode||status)
  const copy = meta[kind]
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PageResult<Port> | PageResult<Destination> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const load = useCallback(() => { setLoading(true);setError('');setAttempt(value=>value+1) },[])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const request = loadMasterList(kind, page, {search:search||undefined,countryCode:countryCode||undefined,status:status||undefined}, controller.signal)
    void request.then((result) => { if (active) setData(result) }).catch((reason: unknown) => { if (active) { if (kind === 'destination') setData(null); setError(kind === 'destination' ? destinationMessage(reason) : message(reason)) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [kind, page, attempt, search, countryCode, status])

  return <ItineraryFrame>
    <PageHeader breadcrumb="DANH MỤC VẬN HÀNH" title={copy.management} actions={access.roles.includes('OPERATIONS_MANAGER')&&access.canDo(`${kind.toUpperCase()}_CREATE`) ? <ButtonLink to={`/admin/${copy.route}/new`}>Thêm {copy.singular}</ButtonLink> : undefined} />
    <CollectionSummary count={loading || error ? null : data?.total ?? null} visible={data?.items.length} filtered={activeOnly} label={`${copy.plural} trong kết quả`} scope="Tổng kết quả từ hệ thống" />
    <Panel title={`Danh sách ${copy.singular}`}><div className={styles.formGrid}>
        <Field htmlFor="directory-search" label={kind==='port'?'Tìm theo tên hoặc mã cảng':'Tìm điểm đến'}><input id="directory-search" type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);setLoading(true)}}/></Field>
        <Field htmlFor="directory-country" label="Quốc gia"><input id="directory-country" placeholder="Mã quốc gia, ví dụ VN" maxLength={2} value={countryCode} onChange={e=>{setCountryCode(e.target.value.toUpperCase());setPage(1);setLoading(true)}}/></Field>
        <Field htmlFor="directory-status" label="Trạng thái"><select id="directory-status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);setLoading(true)}}><option value="">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></Field>
      </div>
      {loading && <Loading label={`Đang tải ${copy.singular}…`} />}
      {error && <Notice title="Không tải được dữ liệu" tone="error"><p>{error}</p><Button onClick={load}>Thử lại</Button></Notice>}
      {!loading && !error && data && !data.items.length && <Empty title={`Chưa có ${copy.singular}`} />}
      {!loading && !error && data?.items.length && kind === 'port' ? <DataTable label="Danh sách cảng" headers={['Mã cảng', 'Tên cảng', 'Quốc gia', 'Múi giờ cảng', 'Trạng thái', '']}>{(data.items as Port[]).map((item) => <tr key={item.portId}><td><strong>{item.portCode}</strong></td><td>{item.portName}{item.coordinateSource?.locationName&&<small className={styles.muted}> · {item.coordinateSource.locationName}</small>}</td><td>{item.countryCode}</td><td>{item.timeZoneId}</td><td><Badge label={directoryStatusLabels[item.status]} tone={item.status === 'ACTIVE' ? 'success' : 'neutral'} /></td><td><Link className={styles.link} to={`/admin/ports/${item.portId}`}>Mở →</Link></td></tr>)}</DataTable> : null}
      {!loading && !error && data?.items.length && kind === 'destination' ? <DataTable label="Danh sách điểm đến" headers={['Tên điểm đến', 'Quốc gia', 'Mô tả', 'Trạng thái', '']}>{(data.items as Destination[]).map((item) => <tr key={item.destinationId}><td><strong>{item.destinationName}</strong></td><td>{item.countryCode}</td><td>{item.description || '—'}</td><td><Badge label={directoryStatusLabels[item.status]} tone={item.status === 'ACTIVE' ? 'success' : 'neutral'} /></td><td><Link className={styles.link} to={`/admin/destinations/${item.destinationId}`}>Mở →</Link></td></tr>)}</DataTable> : null}
      {data && data.pageCount > 1 && <div className={styles.pager}><span>{data.total} bản ghi</span><div><Button tone="secondary" disabled={loading||Boolean(error)||page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1) }}>Trước</Button> <Button tone="secondary" disabled={loading||Boolean(error)||page >= data.pageCount} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Sau</Button></div></div>}
    </Panel>
  </ItineraryFrame>
}

function CoordinateSourceInfo({source,embedded=false}:{source:PortCoordinateSource|null;embedded?:boolean}) {
  if (!source) return null
  const content=<dl>
    <dt>Địa danh được chọn</dt><dd>{source.locationName}</dd>
    <dt>Nguồn dữ liệu</dt><dd>Open-Meteo / GeoNames</dd>
    {source.countryCode&&<><dt>Quốc gia theo nguồn</dt><dd>{source.countryCode}</dd></>}
    {source.featureCode&&<><dt>Mã loại địa danh theo nguồn</dt><dd>{source.featureCode}</dd></>}
    {source.admin1&&<><dt>Khu vực theo nguồn</dt><dd>{source.admin1}</dd></>}
    {source.timezone&&<><dt>Múi giờ địa danh theo nguồn</dt><dd>{source.timezone}</dd></>}
    {source.recordedAt&&<><dt>Thời điểm ghi nhận</dt><dd>{new Date(source.recordedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</dd></>}
  </dl>
  return embedded?<section aria-label="Nguồn tọa độ địa danh"><h3>Nguồn tọa độ địa danh</h3>{content}</section>:<Panel title="Nguồn tọa độ địa danh">{content}</Panel>
}

type MasterDraft = { domesticRegion?:string|null; coordinateSource?:PortCoordinateSource|null; code: string; name: string; city: string; countryCode: string; timeZoneId: string; latitude: string; longitude: string; description: string; status: 'ACTIVE' | 'INACTIVE' }
const EMPTY: MasterDraft = { code: '', name: '', city: '', countryCode: '', timeZoneId: '', latitude: '', longitude: '', description: '', status: 'ACTIVE' }

function MasterForm({ kind }: { kind: Kind }) {
  const access = useSessionAccess()
  const params = useParams()
  const id = kind === 'port' ? params.portId : params.destinationId
  const editing = Boolean(id)
  const copy = meta[kind]
  const navigate = useNavigate()
  const [draft, setDraft] = useState(EMPTY)
  const [newCoordinatesSelected,setNewCoordinatesSelected]=useState(false)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const canSave = !editing || loadedId === id
  const permitted = access.roles.includes('OPERATIONS_MANAGER')&&access.canDo(`${kind.toUpperCase()}_${editing ? 'UPDATE' : 'CREATE'}`)
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loadAttempt, setLoadAttempt] = useState(0)
  const form = useRef<HTMLFormElement>(null)
  const timeZones=useReadQuery('port-timezones:'+draft.countryCode,useCallback(signal=>kind==='port'?itineraryApi.portTimeZones(draft.countryCode,signal):Promise.resolve([]),[kind,draft.countryCode]))

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    const request = kind === 'port' ? itineraryApi.getPort(id, controller.signal) : itineraryApi.getDestination(id, controller.signal)
    void request.then((item) => {
      if (controller.signal.aborted) return
      setError('')
      setLoadedId(id)
      if (kind === 'port') { const port = item as Port; setDraft({ code: port.portCode, name: port.portName, city: '', countryCode: port.countryCode, timeZoneId: port.timeZoneId, latitude: port.latitude?.toString() ?? '', longitude: port.longitude?.toString() ?? '', description: port.description??'', status: port.status, coordinateSource:port.coordinateSource??null }) }
      else { const destination = item as Destination; setDraft({ ...EMPTY, name: destination.destinationName, countryCode: destination.countryCode, description: destination.description ?? '', domesticRegion:destination.domesticRegion??null,status: destination.status }) }
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(kind === 'destination' ? destinationMessage(reason) : message(reason)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, kind, loadAttempt])

  function update(key: Exclude<keyof MasterDraft,'coordinateSource'>, value: string) { setDraft((current) => ({ ...current, [key]: value })); if (kind === 'destination') setFieldErrors(current => ({ ...current, [key === 'name' ? 'destinationName' : key]: '' })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!permitted || submitLock.current || !canSave) return
    setError('')
    if(kind==='port'&&!editing&&(!newCoordinatesSelected||!draft.coordinateSource)){setError('Tra cứu và chọn địa danh để lấy tọa độ cùng thông tin nguồn trước khi tạo cảng.');return}
    if (kind === 'port' && ((draft.latitude === '') !== (draft.longitude === '') || (draft.latitude !== '' && (!Number.isFinite(Number(draft.latitude)) || Math.abs(Number(draft.latitude)) > 90)) || (draft.longitude !== '' && (!Number.isFinite(Number(draft.longitude)) || Math.abs(Number(draft.longitude)) > 180)))) { setError('Nhập đủ cặp tọa độ hợp lệ: vĩ độ -90 đến 90, kinh độ -180 đến 180.'); return }
    const destinationBody: DestinationDraft = { destinationName: draft.name.trim(), countryCode: draft.countryCode.trim().toUpperCase(), description: editing ? draft.description.trim() : draft.description.trim() || null,domesticRegion:draft.domesticRegion??undefined,status: draft.status }
    if (kind === 'destination') {
      const errors = validateDestinationDraft(destinationBody, editing)
      setFieldErrors(errors)
      if (Object.keys(errors).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return }
    } else if (!draft.name.trim() || draft.countryCode.trim().length !== 2 || !draft.code.trim() || !draft.timeZoneId.trim()) { setError('Vui lòng nhập đủ trường bắt buộc; mã quốc gia phải đúng 2 ký tự.'); return }
    if(kind==='port'&&(timeZones.loading||timeZones.error)){setError('Chưa tải được danh mục múi giờ cảng. Tải lại trước khi lưu.');return}
    submitLock.current = true
    setBusy(true)
    try {
      if (kind === 'port') {
        const body: PortDraft = { portCode: draft.code.trim(), portName: draft.name.trim(), countryCode: draft.countryCode.toUpperCase(), timeZoneId: draft.timeZoneId.trim(), latitude: draft.latitude ? Number(draft.latitude) : null, longitude: draft.longitude ? Number(draft.longitude) : null, status: draft.status, description:draft.description, coordinateSource:draft.coordinateSource }
        const saved = editing && id ? await itineraryApi.updatePort(id, body,newCoordinatesSelected) : await itineraryApi.createPort(body)
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
  return <ItineraryFrame>
    <PageHeader breadcrumb="DANH MỤC VẬN HÀNH" title={`${editing ? 'Chỉnh sửa' : 'Thêm'} ${copy.singular}`} />
    {loading ? <Loading label="Đang tải biểu mẫu…" /> : kind === 'destination' && editing && !canSave ? <Notice title="Không tải được điểm đến" tone="error"><p>{error}</p><Button onClick={retryDestination}>Thử lại</Button></Notice> : <EditorLayout ><form ref={form} noValidate={kind === 'destination'} onSubmit={submit}>
      <Panel title={kind === 'destination' ? 'Thông tin điểm đến' : 'Thông tin cơ bản'}>
        <div className={`${styles.formGrid} ${kind === 'destination' ? styles.destinationGrid : ''}`}>
          {kind === 'port' && <Field htmlFor="port-country" label="Quốc gia / vùng lãnh thổ *"><select id="port-country" required disabled={busy||editing} value={draft.countryCode} onChange={e=>{setNewCoordinatesSelected(false);setDraft(current=>({...current,countryCode:e.target.value,city:'',latitude:'',longitude:'',timeZoneId:'',coordinateSource:null}))}}><option value="">Chọn quốc gia</option>{draft.countryCode&&!portCountries.some(c=>c.code===draft.countryCode)&&<option value={draft.countryCode}>{draft.countryCode}</option>}{portCountries.map(c=><option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select></Field>}
          {kind === 'port' && <Field htmlFor="master-code" label="Mã cảng"><input id="master-code" disabled={busy||editing} maxLength={50} required value={draft.code} onChange={event => update('code', event.target.value)} /></Field>}
          <Field htmlFor="master-name" label={kind === 'port' ? 'Tên cảng' : 'Tên điểm đến *'} error={kind === 'destination' ? fieldErrors.destinationName : undefined}>
            <input id="master-name" aria-invalid={kind === 'destination' && Boolean(fieldErrors.destinationName)} disabled={busy} maxLength={200} required placeholder={kind === 'destination' ? 'Ví dụ: Hạ Long' : undefined} value={draft.name} onChange={event => update('name', event.target.value)} />
          </Field>
          {kind === 'destination' && <Field htmlFor="master-country" label="Quốc gia / vùng lãnh thổ *" error={fieldErrors.countryCode}>
            <select id="master-country" required disabled={busy || editing} value={draft.countryCode} onChange={event => update('countryCode', event.target.value)}>
              <option value="">Chọn quốc gia</option>
              {draft.countryCode && !portCountries.some(item => item.code === draft.countryCode) && <option value={draft.countryCode}>{draft.countryCode}</option>}
              {portCountries.map(item => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
            </select>
          </Field>}
          {kind === 'port' && <>
            <Field htmlFor="master-timezone" label="Múi giờ cảng *" error={timeZones.error?.message}><select id="master-timezone" required disabled={busy||timeZones.loading||Boolean(timeZones.error)} value={draft.timeZoneId} onChange={event=>update('timeZoneId',event.target.value)}><option value="">{timeZones.loading?'Đang tải múi giờ…':'Chọn múi giờ cảng'}</option>{draft.timeZoneId&&!timeZones.data?.some(zone=>zone.timeZoneId===draft.timeZoneId)&&<option value={draft.timeZoneId}>{draft.timeZoneId}</option>}{timeZones.data?.map(zone=><option key={zone.timeZoneId} value={zone.timeZoneId}>{zone.displayName}</option>)}</select>{timeZones.error&&<Button type="button" tone="text" onClick={timeZones.retry}>Tải lại múi giờ</Button>}</Field>
          </>}
          {kind==='destination'&&draft.countryCode==='VN'&&<Field htmlFor="destination-region" label="Miền nội địa"><select id="destination-region" disabled={busy} value={draft.domesticRegion??''} onChange={e=>update('domesticRegion',e.target.value)}><option value="">Chưa xác định</option><option value="BAC_BO">Miền Bắc</option><option value="TRUNG_BO">Miền Trung</option><option value="NAM_BO">Miền Nam</option></select></Field>}
          <Field htmlFor="master-status" label="Trạng thái" error={kind === 'destination' ? fieldErrors.status : undefined}>
            <select id="master-status" aria-invalid={kind === 'destination' && Boolean(fieldErrors.status)} disabled={busy || editing} value={draft.status} onChange={event => update('status', event.target.value)}>
              <option value="ACTIVE">{directoryStatusLabels.ACTIVE}</option><option value="INACTIVE">{directoryStatusLabels.INACTIVE}</option>
            </select>
          </Field>
          <div className={styles.destinationDescription}>
            <Field htmlFor="master-description" label={kind==='port'?'Mô tả cảng':'Mô tả điểm đến'} error={fieldErrors.description}>
              <textarea id="master-description" aria-invalid={Boolean(fieldErrors.description)} aria-describedby="destination-description-count" disabled={busy} maxLength={1000} rows={5} placeholder={kind==='destination'?'Ví dụ: Vịnh Hạ Long - Di sản thế giới':undefined} value={draft.description} onChange={event => update('description', event.target.value)} />
            </Field>
            <p id="destination-description-count" className={styles.descriptionCount}>{draft.description.length.toLocaleString('vi-VN')} / 1.000 ký tự</p>
          </div>
        </div>
      </Panel>
      {kind==='port'&&<Panel title="Vị trí địa lý tham chiếu">
        <LocationPicker showCountry={false} key={draft.countryCode} country={draft.countryCode} city={draft.city} disabled={busy} countryLocked={editing} countryError={fieldErrors.countryCode}
          onCountry={()=>undefined} onCity={city=>setDraft(current=>({...current,city}))}
          onApply={place=>{setNewCoordinatesSelected(true);setDraft(current=>({...current,latitude:String(place.latitude),longitude:String(place.longitude),coordinateSource:coordinateSourceOf(place)}))}}/>
        <div className={styles.formGrid}>
          <Field htmlFor="master-latitude" label="Vĩ độ"><input id="master-latitude" type="number" min={-90} max={90} step="any" disabled={busy} readOnly value={draft.latitude} /></Field>
          <Field htmlFor="master-longitude" label="Kinh độ"><input id="master-longitude" type="number" min={-180} max={180} step="any" disabled={busy} readOnly value={draft.longitude} /></Field>
        </div>
        <CoordinateSourceInfo embedded source={draft.coordinateSource??null}/>
      </Panel>}
      {error && <Notice title="Chưa thể lưu" tone="error"><p>{error}</p></Notice>}
      <div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => navigate(`/admin/${copy.route}`)}>Hủy</Button><Button type="submit" disabled={busy || !canSave || !permitted}>{busy ? 'Đang lưu…' : kind === 'destination' ? editing ? 'Lưu thay đổi' : 'Thêm điểm đến' : 'Lưu'}</Button></div>
    </form></EditorLayout>}
  </ItineraryFrame>
}
function MasterDetail({ kind }: { kind: Kind }) {
  const access = useSessionAccess()
  const can = (action: string) => access.roles.includes('OPERATIONS_MANAGER')&&access.canDo(`${kind.toUpperCase()}_${action}`)
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
    return () => { active = false; controller.abort() }
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
  return <ItineraryFrame><PageHeader breadcrumb="DANH MỤC VẬN HÀNH" title={title} actions={record ? <div className={styles.detailActions} role="group" aria-label={`Thao tác ${copy.singular}`}>
    <Badge label={status ? directoryStatusLabels[status] : 'Chưa xác định'} tone={status === 'ACTIVE' ? 'success' : 'neutral'} />
    {can('UPDATE') && <Button tone="secondary" disabled={busy} onClick={() => navigate(`/admin/${copy.route}/${id}/edit`)}>Chỉnh sửa</Button>}
    {can(kind === 'destination' ? 'UPDATE' : status === 'ACTIVE' ? 'DEACTIVATE' : 'ACTIVATE') && <Button disabled={busy} onClick={() => setStatusOpen(true)}>{status === 'ACTIVE' ? 'Ngừng kích hoạt' : 'Kích hoạt'}</Button>}
    {can('DELETE_UNUSED') && <Button tone="danger" disabled={busy} onClick={() => setRemoveOpen(true)}>Xóa khi chưa sử dụng</Button>}
  </div> : undefined} />
    {loading && <Loading label={`Đang tải ${copy.singular}…`} />}{error && <Notice title="Không thể thực hiện" tone="error"><p>{error}</p>{kind === 'destination' && !record && <Button onClick={() => void load()}>Thử lại</Button>}</Notice>}{success && <Notice title="Đã cập nhật" tone="success"><p>{success}</p></Notice>}
    {record && <><Panel title={kind==='port'?'Thông tin cảng':'Thông tin điểm đến'}>
      {kind==='port'?<RecordFacts entries={[
        ['Mã cảng',(record as Port).portCode],['Quốc gia',record.countryCode],['Múi giờ cảng',(record as Port).timeZoneId],
        ['Loại vị trí',({PORT:'Cảng',PIER:'Cầu cảng',ANCHORAGE:'Khu neo đậu'} as Record<string,string>)[(record as Port).locationType??'']??'Chưa có thông tin'],
        ['Tọa độ tham chiếu',(record as Port).latitude!=null&&(record as Port).longitude!=null?`${(record as Port).latitude}, ${(record as Port).longitude}`:'Chưa có thông tin'],
        ['Mô tả',(record as Port).description||'Chưa có mô tả'],
      ]}/>:<RecordFacts entries={[
        ['Quốc gia',record.countryCode],['Mô tả',(record as Destination).description||'Chưa có mô tả'],
        ['Miền nội địa',({BAC_BO:'Miền Bắc',TRUNG_BO:'Miền Trung',NAM_BO:'Miền Nam'} as Record<string,string>)[(record as Destination).domesticRegion??'']??'Chưa có thông tin'],
      ]}/>}
      <RecordFacts entries={[
        ['Ngày tạo',record.createdAt?new Date(record.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa có thông tin'],
        ['Cập nhật gần nhất',record.updatedAt?new Date(record.updatedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa có thông tin'],
      ]}/>
    </Panel>
      {kind === 'destination' && <Panel title={`Cảng liên kết${!portsLoading && !portsError ? ` · ${linkedPorts.length}` : ''}`}>
        {portsLoading ? <Loading label="Đang tải cảng liên kết…" /> : portsError ? <Notice title="Không tải được cảng liên kết" tone="error"><p>{portsError}</p><Button onClick={retryPorts}>Thử lại</Button></Notice>
          : linkedPorts.length ? <DataTable label="Cảng thuộc điểm đến" headers={['Mã', 'Tên cảng', '']}>
            {linkedPorts.map(port => <tr key={port.portId}><td>{port.portCode}</td><td>{port.portName}</td><td><Link className={styles.link} to={`/admin/ports/${port.portId}`}>Mở cảng →</Link></td></tr>)}
          </DataTable> : <Empty title="Chưa có cảng liên kết" />}
      </Panel>}
    </>}
    {record&&access.roles.includes('OPERATIONS_MANAGER')&&access.has(`${kind.toUpperCase()}_READ`)&&<DirectoryHistory kind={kind} id={id}/>}
    {statusOpen && can(kind === 'destination' ? 'UPDATE' : status === 'ACTIVE' ? 'DEACTIVATE' : 'ACTIVATE') && <Modal title={status === 'ACTIVE' ? 'Ngừng kích hoạt' : 'Kích hoạt'} busy={busy} onClose={() => setStatusOpen(false)}><p>Xác nhận thay đổi trạng thái của {title}? Các điều kiện đang sử dụng sẽ được kiểm tra trước khi cập nhật.</p>{error && <Notice title="Chưa đổi được trạng thái" tone="error">{error}</Notice>}<Button disabled={busy} onClick={() => void togglePort()}>Xác nhận thay đổi trạng thái</Button></Modal>}
    {removeOpen && can('DELETE_UNUSED') && <Modal title={`Xóa ${copy.singular}?`} onClose={() => { if (!busy) setRemoveOpen(false) }} footer={<div className={styles.modalActions}><Button tone="secondary" disabled={busy} onClick={() => setRemoveOpen(false)} data-overlay-dismiss>Quay lại</Button><Button tone="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button></div>}><p>{kind === 'destination' ? 'Chỉ xóa điểm đến khi bạn đã xác nhận không còn được sử dụng. Thao tác này không thể hoàn tác.' : 'Chỉ có thể xóa bản ghi chưa được sử dụng.'}</p></Modal>}
  </ItineraryFrame>
}

export const PortListPage = () => <MasterList kind="port" />
export const PortFormPage = () => { const { portId } = useParams(); return <MasterForm key={portId ?? 'new'} kind="port" /> }
export const PortDetailPage = () => <MasterDetail kind="port" />
export const DestinationListPage = () => <MasterList kind="destination" />
export const DestinationFormPage = () => { const { destinationId } = useParams(); return <MasterForm key={destinationId ?? 'new'} kind="destination" /> }
export const DestinationDetailPage = () => { const { destinationId } = useParams(); return <MasterDetail key={destinationId} kind="destination" /> }
