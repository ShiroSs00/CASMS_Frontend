import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { apiRequest, ApiError, useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, DataTable, Empty, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { viewerApi } from './api'
import { ModelCanvas } from './ModelCanvas'
import { cabinDeckLabel, serviceName, serviceType, cabinTypes, selectedAreas, selectedCabins, type Area, type AssetInfo, type Cabin, type Manifest, type ShipChoice } from './model'
import styles from './Viewer.module.css'
import {BleSetup} from './BleSetup'

function Failure({error,retry}:{error:Error;retry:()=>void}) { return <Notice title="Chưa tải được dữ liệu" tone="error">{error.message}<Button tone="text" onClick={retry}>Thử lại</Button></Notice> }
function Facts({rows}:{rows:Array<[string, string | number | undefined]>}) {return <dl className={styles.facts}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value??'Chưa cung cấp'}</dd></div>)}</dl>}
function CabinDetails({cabin,manifest}:{cabin:Cabin;manifest:Manifest}) {return <><div className={styles.detailTitle}><span>PHÒNG</span><h2>{cabin.cabinNumber}</h2><Badge label={cabinTypes[cabin.cabinType]??cabin.cabinType}/></div><Facts rows={[
  ['Boong',cabinDeckLabel(manifest,cabin.deckId)],['Sức chứa',cabin.capacity!=null?`${cabin.capacity} khách`:undefined],['Hạng phòng',cabin.gradeName],['Phòng hỗ trợ người khuyết tật',cabin.isAccessible==null?undefined:cabin.isAccessible?'Có':'Không'],['Diện tích',cabin.areaSquareMetres!=null?`${cabin.areaSquareMetres} m²`:undefined]
  ]}/></>}
type AreaUsage = {
  id: string
  area_usage: string
  model_status: string
  has_services: boolean
  cabin_id?: string | null
}

function AreaActivityUsage({ship,areaId}:{ship:string;areaId:string}) {
  const access = useSessionAccess()
  const canRead = access.has('SHIP_CONFIGURATION_READ') || (access.roles.includes('CRUISE_MANAGER') && access.has('CRUISE_UPDATE_DRAFT'))
  const canUpdate = access.has('SHIP_MODEL_OBJECT_UPDATE')
  const root = '/ships/'+encodeURIComponent(ship)+'/areas'
  const query = useReadQuery('viewer-area-usage:'+access.userId+':'+ship,
    useCallback(signal=>canRead ? apiRequest<AreaUsage[]>(root+'/usages',{signal}) : Promise.resolve([]),[canRead,root]))
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const lock = useRef(false)
  const area = query.data?.find(item=>item.id===areaId)
  const eligible = area && ['DRAFT','READY'].includes(area.model_status) && !area.cabin_id && !area.has_services
  async function configure() {
    if(!canUpdate||!eligible||query.loading||query.error||lock.current)return
    lock.current=true
    setBusy(true)
    setError('')
    try {
      await apiRequest(root+'/'+encodeURIComponent(areaId)+'/usage',{method:'PUT',body:{usage:'ACTIVITY_SPACE'}})
      query.retry()
    } catch(reason) {
      setError(reason instanceof Error?reason.message:'Chưa lưu được mục đích sử dụng.')
    } finally {
      setBusy(false)
      lock.current=false
    }
  }
  if(!canRead)return null
  return <section className={styles.serviceContents}>
    <h3>Mục đích sử dụng</h3>
    {query.loading&&<Loading label="Đang kiểm tra khu vực…" />}
    {query.error&&<Notice title="Chưa đọc được mục đích sử dụng" tone="error"><Button onClick={query.retry}>Thử lại</Button></Notice>}
    {area&&<>
      <p>{area.area_usage==='ACTIVITY_SPACE' ? 'Khu vực hoạt động' : area.area_usage==='SERVICE' ? 'Khu vực phục vụ dịch vụ' : 'Chưa phân loại mục đích sử dụng'}</p>
      {area.has_services&&area.area_usage!=='ACTIVITY_SPACE'&&<p>Khu vực đang được gán dịch vụ. Quản lý tàu cần gỡ phân công dịch vụ trước khi dùng cho hoạt động.</p>}
      {canUpdate&&eligible&&area.area_usage!=='ACTIVITY_SPACE'&&
        <Button tone="secondary" busy={busy} disabled={query.loading} onClick={()=>void configure()}>Đặt làm khu vực hoạt động</Button>}
    </>}
    {query.data&&!query.loading&&!area&&<p>Chưa tìm thấy cấu hình sử dụng của khu vực này.</p>}
    {error&&<Notice title="Chưa cập nhật được khu vực" tone="error">{error}</Notice>}
  </section>
}

function AreaDetails({area,manifest}:{area:Area;manifest:Manifest}) {
  return <><div className={styles.detailTitle}><span>KHU VỰC DỊCH VỤ</span><h2>{serviceName(area)}</h2><Badge label={serviceType(area.kind)}/></div><Facts rows={[
    ['Loại dịch vụ',serviceType(area.kind)],['Boong',`${area.deckNumber} · ${[...manifest.decks,...manifest.serviceDecks??[]].find(d=>d.id===area.deckId)?.name??''}`]
  ]}/>{Boolean(area.interiorDetails?.length)&&<section className={styles.serviceContents}><h3>Tiện ích</h3><ul>{area.interiorDetails?.map(detail=><li key={detail}>{detail}</li>)}</ul></section>}</>
}
type ShipMappings = { decks: ReadonlySet<string>; cabins: ReadonlySet<string> }
function Explore({ ship, model, manifest, mappings }: {
  ship: string; model: string; manifest: Manifest; mappings?: ShipMappings
}) {
  const [deckId,setDeck]=useState(''),[cabinId,setCabin]=useState(''),[areaId,setArea]=useState(''),[areaSearch,setAreaSearch]=useState(''),[search,setSearch]=useState(''),[full,setFull]=useState(false),[list,setList]=useState<'rooms'|'services'>('rooms')
  const decks=[...manifest.decks,...manifest.serviceDecks??[]]
  const deck=decks.find(d=>d.id===deckId),cabin=manifest.cabins.find(c=>c.id===cabinId)
  const cabins=selectedCabins(manifest,deckId,search)
  const areas=selectedAreas(manifest,deckId,areaSearch),area=manifest.areas?.find(a=>a.id===areaId)
  const file=deck?.asset??(full?manifest.assets.full:manifest.assets.exterior??manifest.assets.full)
  const chooseDeck=(id:string)=>{setDeck(id);setCabin('');setArea('');setSearch('');setAreaSearch('');setList('rooms')}
  const chooseCabin=(value:Cabin)=>{setCabin(value.id);setArea('');setList('rooms');setDeck(value.deckId)}
  const chooseArea=(value:Area)=>{setArea(value.id);setCabin('');setList('services');setDeck(value.deckId)}
  const pick=(name:string)=>{const found=manifest.cabins.find(c=>c.nodeName===name);if(found){chooseCabin(found);return}const foundArea=manifest.areas?.find(a=>a.nodeName===name);if(foundArea)chooseArea(foundArea)}
  return <div className={styles.workspace}>
    <aside className={styles.structure} aria-label="Cấu trúc tàu"><div className={styles.panelLabel}><h2>Cấu trúc tàu</h2></div>
      <Field htmlFor="structure-deck" label="Boong"><select id="structure-deck" value={deckId} onChange={event=>chooseDeck(event.target.value)}><option value="">Toàn tàu</option>{[...decks].sort((a,b)=>a.number-b.number).map(d=><option key={d.id} value={d.id}>Boong {d.number} · {d.name}</option>)}</select></Field>
      {deck&&<><div className={styles.listSwitch} aria-label="Danh sách trên tàu"><button type="button" aria-pressed={list==='rooms'} onClick={()=>setList('rooms')}>Phòng</button><button type="button" aria-pressed={list==='services'} onClick={()=>setList('services')}>Khu vực dịch vụ</button></div>
      {list==='services'&&<>      <div className={styles.cabinHeading}><h3>Khu vực dịch vụ</h3><input type="search" aria-label="Tìm khu vực dịch vụ trên tàu" value={areaSearch} placeholder="Tên hoặc loại khu vực dịch vụ" onChange={event=>setAreaSearch(event.target.value)}/></div>
      <div className={`${styles.cabinList} ${styles.areaList}`} aria-label="Khu vực dịch vụ trên tàu">{areas.map(value=><button type="button" key={value.id} aria-pressed={areaId===value.id} onClick={()=>chooseArea(value)}><strong>{serviceName(value)}</strong></button>)}{!areas.length&&<p className={styles.note}>{manifest.areas===undefined?'Chưa có khu vực dịch vụ.':areaSearch?'Không có khu vực dịch vụ khớp tìm kiếm.':'Chưa có khu vực dịch vụ.'}</p>}</div>
</>}
      {list==='rooms'&&<>      <div className={styles.cabinHeading}><h3>Phòng</h3><input type="search" aria-label="Tìm phòng" value={search} placeholder="Số phòng hoặc loại phòng" onChange={event=>setSearch(event.target.value)}/></div>
      <div className={styles.cabinList}>{cabins.map(value=><button type="button" key={value.id} aria-pressed={cabinId===value.id} onClick={()=>chooseCabin(value)}><strong>{value.cabinNumber}</strong></button>)}{!cabins.length&&<p className={styles.note}>Không tìm thấy phòng.</p>}</div></>}
      </>}
    </aside>
    <div className={styles.sceneColumn}><div className={styles.sceneHeading}><div><span>{deck?`${deck.number<=0?'BOONG KỸ THUẬT':'BOONG'} ${deck.number}`:'TỔNG THỂ'}</span><h2>{deck?.name??manifest.name}</h2></div>{!deck&&<label className={styles.toggle}><input type="checkbox" checked={full} onChange={event=>setFull(event.target.checked)}/>Toàn bộ cấu trúc</label>}</div>

      {file?<ModelCanvas key={`${model}:${file}`} ship={ship} model={model} file={file} autoFocusSelection selectionLabel={(area?serviceName(area):undefined)??(cabin?`Phòng ${cabin.cabinNumber}`:deck?.name)} selectionContext={deck?`Boong ${deck.number} · ${deck.name}`:undefined} selected={area?.nodeName??cabin?.nodeName??deck?.nodeName??''} onPick={pick}/>:<Notice title="Chưa có sơ đồ 3D" tone="warning">Không có dữ liệu hiển thị.</Notice>}
      <div className={styles.sceneLegend}><span><i/> {area?'Khu vực dịch vụ được chọn':cabin?'Phòng được chọn':'Đối tượng được chọn'}</span></div>
    </div>
    <aside className={styles.inspector} aria-label="Chi tiết đối tượng">{area?<><button type="button" className={styles.clearSelection} onClick={()=>setArea('')}>← Thông tin boong</button><AreaDetails area={area} manifest={manifest}/><AreaActivityUsage key={area.id} ship={ship} areaId={area.id}/></>:cabin?<><button type="button" className={styles.clearSelection} onClick={()=>setCabin('')}>← Thông tin boong</button><CabinDetails cabin={cabin} manifest={manifest}/></>:<><div className={styles.detailTitle}><span>{deck?'BOONG ĐANG XEM':'THÔNG TIN TỔNG THỂ'}</span><h2>{deck?.name??manifest.name}</h2></div><Facts rows={deck?[
      ['Boong số',deck.number],['Cao độ',deck.elevationMetres!=null?`${deck.elevationMetres} m`:undefined],['Số khu vực dịch vụ',manifest.areas?.filter(a=>a.deckId===deck.id).length],['Số phòng',manifest.cabins.filter(c=>c.deckId===deck.id).length],
    ]:[['Số boong',decks.length],['Số khu vực dịch vụ',manifest.areas?.length],['Số phòng',manifest.cabins.length]]}/></>}
    {mappings && (cabin || deck) && <p role="status" className={styles.note}>
      {(cabin ? mappings.cabins.has(cabin.id) : deck && mappings.decks.has(deck.id)) ? 'Đã liên kết với cấu trúc của tàu' : 'Chưa có liên kết với cấu trúc của tàu'}
    </p>}</aside>
  </div>
}
export function ShipRecordViewer({ ship }: { ship: string }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const shipPath = '/ships/' + encodeURIComponent(ship)
    let active: AssetInfo
    try {
      active = await apiRequest<AssetInfo>(shipPath + '/model', { signal })
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404 && failure.serverMessage === 'No active model on this ship') return null
      throw failure
    }
    if (!active?.id) return null
    const path = shipPath + '/models/' + encodeURIComponent(active.id)
    const [manifest, decks, cabins] = await Promise.all([
      viewerApi.manifest(ship, active.id, signal),
      apiRequest<Array<{ modelDeckId: string }>>(path + '/deck-mappings', { signal }),
      apiRequest<Array<{ modelId: string }>>(path + '/cabin-mappings', { signal }),
    ])
    return {
      id: active.id, manifest,
      mappings: { decks: new Set(decks.map(deck => deck.modelDeckId)), cabins: new Set(cabins.map(cabin => cabin.modelId)) },
    }
  }, [ship])
  const result = useReadQuery('ship-record-viewer:' + ship, load)
  return <div className={styles.page}>
    {result.loading && <Loading label="Đang tải mô hình của tàu…" />}
    {result.error && <Failure error={result.error} retry={result.retry} />}
    {!result.loading && !result.error && (result.data ? <>
      <p>{result.data.mappings.decks.size} boong và {result.data.mappings.cabins.size} cabin đã liên kết với tàu.</p>
      <Explore key={ship + ':' + result.data.id} ship={ship} model={result.data.id} manifest={result.data.manifest}
        mappings={result.data.mappings} />
    </> : <Panel><Empty title="Tàu chưa có mô hình 3D" /></Panel>)}
  </div>
}

function ModelDetail({ship,id}:{ship:string;id:string}) {
  const access = useSessionAccess()
  const canManage = (access.inWorkScope('ship-models') || access.inWorkScope('ship-import')) && access.canDo('BLE_ANCHOR_READ')
  const load = useCallback((signal:AbortSignal) => canManage ? viewerApi.manifest(ship,id,signal) : Promise.resolve(null), [canManage,ship,id])
  const manifest = useReadQuery(`positioning-manifest:${access.userId}:${ship}:${id}`,load)
  if (!canManage) return <Notice title="Chưa có quyền xem cấu hình thiết bị định vị" tone="warning">Tài khoản chưa được cấp quyền thiết lập định vị cho tàu.</Notice>
  return <>
    {manifest.loading && <Loading label="Đang tải dữ liệu bố trí thiết bị…" />}
    {manifest.error && <Failure error={manifest.error} retry={manifest.retry} />}
    {manifest.data && <BleSetup ship={ship} model={id} manifest={manifest.data} />}
  </>
}
function ShipModels({ ship, requested, onModel, renderHeader }: {
  ship: ShipChoice; requested: string; onModel: (id: string) => void; renderHeader: () => ReactNode
}) {
  const access = useSessionAccess()
  const load = useCallback((signal:AbortSignal) => viewerApi.models(ship.shipId,signal), [ship.shipId])
  const query = useReadQuery(`positioning-models:${access.userId}:${ship.shipId}`,load)
  const models = query.data ? [...query.data].sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt)) : []
  const selected = requested ? models.find(model => model.shipModelId===requested) : models[0]
  return <>
    {renderHeader()}
    {query.loading && <Loading label="Đang tải dữ liệu tàu…" />}
    {query.error && <Failure error={query.error} retry={query.retry} />}
    {query.data?.length===0 && <Empty title="Tàu chưa có sơ đồ boong 3D">
      <p>Tàu này chưa có sơ đồ boong 3D để gắn thiết bị định vị.</p>
      <ButtonLink to={`/admin/ships/${ship.shipId}?tab=decks`} tone="secondary" size="compact" autoWidth>Xem cấu trúc boong tàu</ButtonLink>
    </Empty>}
    {requested && !selected && !query.loading && models.length>0 && <Notice title="Không tìm thấy dữ liệu bố trí đã chọn" tone="warning"><Button tone="text" onClick={() => onModel('')}>Dùng dữ liệu hiện hành</Button></Notice>}
    {selected && <ModelDetail key={`${ship.shipId}:${selected.shipModelId}:${selected.updatedAt}`} ship={ship.shipId} id={selected.shipModelId} />}
  </>
}
export function ModelViewerPage() {
  const access = useSessionAccess(), [params,setParams] = useSearchParams()
  const canRead = access.canDo('SHIP_READ')
  const canReadTypes = access.roles.some(role => role==='ADMIN' || role==='SHIP_MANAGER')
  const load = useCallback((signal:AbortSignal) => canRead ? viewerApi.ships(signal) : Promise.resolve([]), [canRead])
  const loadTypes = useCallback((signal:AbortSignal) => canReadTypes ? viewerApi.shipTypes(signal) : Promise.resolve([]), [canReadTypes])
  const query = useReadQuery('positioning-ships:'+access.userId,load)
  const types = useReadQuery('positioning-types:'+access.userId,loadTypes)
  const typeFilter = params.get('legacy')==='true' ? 'legacy' : params.get('shipTypeId') ?? ''
  const shipId = params.get('ship') ?? ''
  const typeOptions = new Map((types.data ?? []).map(type => [type.shipTypeId, `${type.name} (${type.code})${type.status==='INACTIVE' ? ' · Ngừng sử dụng' : ''}`]))
  for (const row of query.data ?? []) {
    if (row.shipTypeId && !typeOptions.has(row.shipTypeId)) typeOptions.set(row.shipTypeId,row.shipTypeName || row.shipTypeCode || 'Loại tàu đã gắn')
  }
  const ships = (query.data ?? []).filter(row => !typeFilter || (typeFilter==='legacy' ? !row.shipTypeId : row.shipTypeId===typeFilter))
  const ship = ships.find(row => row.shipId===shipId)
  function listParams() {
    const next = new URLSearchParams(params)
    next.delete('ship'); next.delete('model')
    return next
  }
  const listQuery = listParams().toString()
  const listPath = '/admin/ship-models'+(listQuery ? '?'+listQuery : '')
  function selectShip(id:string) {
    const next = listParams()
    if (id) next.set('ship',id)
    return next
  }
  function changeType(value:string) {
    const next = listParams()
    next.delete('shipTypeId'); next.delete('legacy')
    if (value==='legacy') next.set('legacy','true')
    else if (value) next.set('shipTypeId',value)
    setParams(next)
  }
  const renderHeader = () => <div className={styles.lookupHeader}>
    <PageHeader title="Thiết lập thiết bị định vị" breadcrumb="Cấu hình tàu / Thiết lập thiết bị định vị"
      description="" />
    <div className={styles.shipSelector}>
      {typeOptions.size > 0 && (
        <Field htmlFor="positioning-type" label="Loại tàu">
          <select id="positioning-type" value={typeFilter} disabled={query.loading || types.loading} onChange={event => changeType(event.target.value)}>
            <option value="">Tất cả loại tàu</option>
            {[...typeOptions].sort((a,b) => a[1].localeCompare(b[1],'vi')).map(([id,label]) => <option key={id} value={id}>{label}</option>)}
            {typeFilter && typeFilter!=='legacy' && !typeOptions.has(typeFilter) && <option value={typeFilter}>Loại tàu không có trong danh mục</option>}
          </select>
        </Field>
      )}
      <Field htmlFor="viewer-ship" label="Chọn tàu">
        <select id="viewer-ship" value={ship?.shipId ?? ''} disabled={query.loading || !ships.length} onChange={event => setParams(selectShip(event.target.value))}>
          <option value="">Xem danh sách tàu</option>
          {ships.map(row => <option key={row.shipId} value={row.shipId}>{row.shipCode} · {row.shipName}</option>)}
        </select>
      </Field>
    </div>
  </div>
  return <AdminShell><div className={styles.page}>
    {!ship && renderHeader()}
    {query.loading && <Loading label="Đang tải tàu…" />}
    {query.error && <Failure error={query.error} retry={query.retry} />}
    {types.error && <Notice title="Chưa tải được danh mục loại tàu" tone="warning">Các loại đã gắn với tàu vẫn có thể tra cứu. <Button tone="text" onClick={types.retry}>Tải lại danh mục</Button></Notice>}
    {shipId && !ship && !query.loading && !query.error && <Notice title="Không tìm thấy tàu trong danh sách đang lọc" tone="warning">Tàu đã chọn không thuộc loại đang lọc hoặc phạm vi truy cập. <Link to={listPath}>Về danh sách tàu</Link></Notice>}
    {!canRead && <Notice title="Chưa có quyền đọc tàu" tone="warning">Tài khoản cần quyền đọc tàu để truy cập cấu hình định vị.</Notice>}
    {ship ? <ShipModels key={shipId} ship={ship} renderHeader={renderHeader} requested={params.get('model') ?? ''}
      onModel={model => { const next = selectShip(shipId); if (model) next.set('model',model); setParams(next) }} />
      : query.data && <section className={styles.shipList} aria-labelledby="viewer-ship-list-heading">
        <div className={styles.shipListHeading}><h2 id="viewer-ship-list-heading">Danh sách tàu{typeFilter ? ' theo loại' : ''}</h2><p>{ships.length} tàu</p></div>
        {ships.length ? <DataTable label="Danh sách tàu" headers={['Mã tàu','Tên tàu','Thao tác']}>
          {ships.map(row => <tr key={row.shipId}>
            <th scope="row" className={styles.shipCode}>{row.shipCode}</th>
            <td>{row.shipName}{row.shipTypeId && <span className={styles.shipTypeHint}>Loại tàu: {row.shipTypeName || typeOptions.get(row.shipTypeId) || row.shipTypeCode || '—'}</span>}</td>
            <td><Link className={styles.designLink} to={'/admin/ship-models?'+selectShip(row.shipId)} aria-label={'Thiết lập định vị tàu '+row.shipCode}>Thiết lập định vị</Link></td>
          </tr>)}
        </DataTable> : <Empty title={typeFilter ? 'Chưa có tàu thuộc loại đang chọn' : 'Chưa có tàu trong phạm vi truy cập'}>
          <p>{typeFilter ? 'Chọn loại tàu khác hoặc xóa bộ lọc để xem toàn bộ tàu.' : 'Hiện chưa có tàu nào trong phạm vi quản lý.'}</p>
          {typeFilter && <Button tone="secondary" size="compact" autoWidth onClick={() => changeType('')}>Xóa bộ lọc loại tàu</Button>}
        </Empty>}
      </section>}
  </div></AdminShell>
}
