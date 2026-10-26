import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { viewerApi } from './api'
import { ModelCanvas } from './ModelCanvas'
import { cabinTypes, formatTime, modelStatus, selectedCabins, type AssetInfo, type Cabin, type Job, type Manifest, type ModelVersion, type ShipChoice } from './model'
import styles from './Viewer.module.css'
import {BleSetup} from './BleSetup'

function Failure({error,retry}:{error:Error;retry:()=>void}) { return <Notice title="Chưa tải được dữ liệu" tone="error">{error.message}<Button tone="text" onClick={retry}>Thử lại</Button></Notice> }
function Facts({rows}:{rows:Array<[string, string | number | undefined]>}) {return <dl className={styles.facts}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value??'Chưa cung cấp'}</dd></div>)}</dl>}
function ImportIssues({ship,job}:{ship:string;job:Job}) {
  const load=useCallback((signal:AbortSignal)=>viewerApi.issues(ship,job.jobId,signal),[ship,job.jobId]);const query=useReadQuery(`viewer-issues:${job.jobId}`,load)
  return <div>{query.loading&&<Loading label="Đang tải chi tiết lỗi…"/>}{query.error&&<Failure error={query.error} retry={query.retry}/>}<ul className={styles.issueList}>{query.data?.map(issue=><li key={issue.issueId}><strong>{issue.objectIdentifier??issue.objectType}</strong><p>{issue.message}</p><code>{issue.errorCode}</code></li>)}</ul></div>
}
function ModelMetadata({version,info,manifest}:{version:ModelVersion;info:AssetInfo|null;manifest:Manifest|null}) {
  return <div className={styles.metadataGrid}><Panel title="Thông tin model"><Facts rows={[
    ['Phiên bản',version.version],['Trạng thái',modelStatus[version.status]??version.status],['Định dạng',version.fileFormat],['Mã model',info?.modelKey],['Phiên bản asset',info?.assetVersion],['Bản sửa đổi',info?.revision],['Hãng sản xuất tàu',info?.shipManufacturerName??version.shipManufacturerName],['Đơn vị cung cấp model',info?.modelProvider??version.modelProvider],['Ngày tạo',formatTime(version.createdAt)],['Cập nhật',formatTime(version.updatedAt)],
  ]}/></Panel><Panel title="Nguồn dữ liệu & hệ tọa độ"><Facts rows={[
    ['Tên trong manifest',manifest?.name],['Đơn vị',manifest?.units],['Trục hướng lên',manifest?.gltfAxes?.up],['Hướng mũi tàu',manifest?.gltfAxes?.bow],['Mạn trái',manifest?.gltfAxes?.port],['Chiều dài',manifest?.length!=null?`${manifest.length} ${manifest.units}`:undefined],['Chiều rộng',manifest?.beam!=null?`${manifest.beam} ${manifest.units}`:undefined],['Nguồn tham chiếu',manifest?.referenceSource],['Bản tham chiếu',manifest?.referenceVersion],
  ]}/>{manifest?.accuracy&&<Notice title="Phạm vi chính xác của model" tone="info">{manifest.accuracy}</Notice>}</Panel></div>
}
function CabinDetails({cabin,manifest}:{cabin:Cabin;manifest:Manifest}) {const vector=(value?:number[])=>value?.map(v=>v.toLocaleString('vi-VN',{maximumFractionDigits:3})).join(' · ');return <><div className={styles.detailTitle}><span>ĐỐI TƯỢNG ĐANG CHỌN</span><h2>{cabin.cabinNumber}</h2><Badge label={cabinTypes[cabin.cabinType]??cabin.cabinType}/></div><Facts rows={[
  ['Boong',`${cabin.deckNumber} · ${manifest.decks.find(d=>d.id===cabin.deckId)?.name??''}`],['Sức chứa',cabin.capacity!=null?`${cabin.capacity} khách`:undefined],['Hạng phòng',cabin.gradeName],['Hỗ trợ tiếp cận',cabin.isAccessible==null?undefined:cabin.isAccessible?'Có':'Không'],['Diện tích',cabin.areaSquareMetres!=null?`${cabin.areaSquareMetres} m²`:undefined],['Kích thước X · Y · Z',cabin.size?`${vector(cabin.size)} ${manifest.units}`:undefined],['Vị trí X · Y · Z',cabin.position?`${vector(cabin.position)} ${manifest.units}`:undefined],['Node 3D',cabin.nodeName],['Mã nguồn',cabin.id],
  ]}/>{cabin.sourceNumberVerified===false&&<p className={styles.note}>Số cabin trong model chưa được xác minh với số phòng thực tế.</p>}</>}
function Explore({ship,model,manifest,info}:{ship:string;model:string;manifest:Manifest;info:AssetInfo|null}) {
  const [deckId,setDeck]=useState(''),[cabinId,setCabin]=useState(''),[search,setSearch]=useState(''),[full,setFull]=useState(false)
  const decks=[...manifest.decks,...manifest.serviceDecks??[]]
  const deck=decks.find(d=>d.id===deckId),cabin=manifest.cabins.find(c=>c.id===cabinId)
  const cabins=selectedCabins(manifest,deckId,search)
  const file=deck?.asset??(full?manifest.assets.full:manifest.assets.exterior??manifest.assets.full)
  const chooseDeck=(id:string)=>{setDeck(id);setCabin('');setSearch('')}
  const chooseCabin=(value:Cabin)=>{setCabin(value.id);setDeck(value.deckId)}
  const pick=(name:string)=>{const found=manifest.cabins.find(c=>c.nodeName===name);if(found)chooseCabin(found)}
  return <div className={styles.workspace}>
    <aside className={styles.structure} aria-label="Cấu trúc model"><div className={styles.panelLabel}><h2>Cấu trúc tàu</h2><span>{manifest.decks.length} boong</span></div>
      <button className={styles.deckButton} aria-pressed={!deckId} onClick={()=>chooseDeck('')}><span>Tổng thể tàu</span><span>◈</span></button>
      <div className={styles.deckList}>{[...decks].sort((a,b)=>a.number-b.number).map(value=><button key={value.id} className={styles.deckButton} aria-pressed={deckId===value.id} onClick={()=>chooseDeck(value.id)}><span><strong>{value.number}</strong> {value.name}</span><small>{value.number<=0?'KT':manifest.cabins.filter(c=>c.deckId===value.id).length}</small></button>)}</div>
      <div className={styles.cabinHeading}><h3>Cabin <span>{cabins.length}</span></h3><input type="search" aria-label="Tìm cabin trong model" value={search} placeholder="Số cabin hoặc loại phòng" onChange={event=>setSearch(event.target.value)}/></div>
      <div className={styles.cabinList}>{cabins.slice(0,300).map(value=><button key={value.id} aria-pressed={cabinId===value.id} onClick={()=>chooseCabin(value)}><strong>{value.cabinNumber}</strong><small>{cabinTypes[value.cabinType]??value.cabinType}</small></button>)}{!cabins.length&&<p className={styles.note}>Không có cabin phù hợp.</p>}{cabins.length>300&&<p className={styles.note}>Hiển thị 300/{cabins.length} cabin. Tìm kiếm để thu hẹp danh sách.</p>}</div>
    </aside>
    <div className={styles.sceneColumn}><div className={styles.sceneHeading}><div><span>{deck?`${deck.number<=0?'TẦNG KỸ THUẬT':'BOONG'} ${deck.number}`:'TỔNG THỂ'}</span><h2>{deck?.name??manifest.name}</h2></div>{!deck&&<label className={styles.toggle}><input type="checkbox" checked={full} onChange={event=>setFull(event.target.checked)}/>Toàn bộ cấu trúc</label>}</div>
      <select className={styles.mobileDeck} aria-label="Boong đang hiển thị" value={deckId} onChange={event=>chooseDeck(event.target.value)}><option value="">Tổng thể tàu</option>{[...decks].sort((a,b)=>a.number-b.number).map(d=><option key={d.id} value={d.id}>{d.number<=0?'Tầng kỹ thuật':'Boong'} {d.number} · {d.name}</option>)}</select>
      {file?<ModelCanvas key={`${model}:${file}`} ship={ship} model={model} file={file} selected={cabin?.nodeName??''} onPick={pick}/>:<Notice title="Không có asset 3D" tone="warning">Manifest chưa cung cấp file GLB để hiển thị.</Notice>}
      <div className={styles.sceneLegend}><span><i/> Cabin được chọn</span><span>{deck?`${cabins.length} cabin trên boong`:'Chọn boong để xem nội thất'} · {manifest.units}</span></div>
    </div>
    <aside className={styles.inspector} aria-label="Chi tiết đối tượng">{cabin?<><button className={styles.clearSelection} onClick={()=>setCabin('')}>← Thông tin boong</button><CabinDetails cabin={cabin} manifest={manifest}/></>:<><div className={styles.detailTitle}><span>{deck?'BOONG ĐANG XEM':'THÔNG TIN TỔNG THỂ'}</span><h2>{deck?.name??manifest.name}</h2></div><Facts rows={deck?[
      ['Số boong',deck.number],['Cabin trong model',manifest.cabins.filter(c=>c.deckId===deck.id).length],['Cao độ',deck.elevationMetres!=null?`${deck.elevationMetres} m`:undefined],['Node 3D',deck.nodeName],['Asset',deck.asset],
    ]:[['Boong hành khách',manifest.decks.length],['Tầng kỹ thuật',manifest.serviceDecks?.length??0],['Tổng cabin',manifest.cabins.length],['Tầng đã ánh xạ',info?`${info.mappedDeckCount}/${info.deckCount}`:undefined],['Cabin đã ánh xạ',info?`${info.mappedCabinCount}/${info.cabinCount}`:undefined],['Bản sửa đổi',manifest.revision],['Đơn vị',manifest.units]]}/><div className={styles.inspectorHint}>Chọn cabin trên mô hình hoặc trong danh sách để xem thông tin chi tiết.</div></>}</aside>
  </div>
}
function VersionDetail({ship,version}:{ship:string;version:ModelVersion}) {
  const access=useSessionAccess()
  const id=version.shipModelId,[tab,setTab]=useState('scene'),[issueJob,setIssueJob]=useState<Job|null>(null)
  const loadInfo=useCallback((signal:AbortSignal)=>viewerApi.info(ship,id,signal),[ship,id]),loadManifest=useCallback((signal:AbortSignal)=>viewerApi.manifest(ship,id,signal),[ship,id]),loadHistory=useCallback((signal:AbortSignal)=>viewerApi.history(ship,id,signal),[ship,id])
  const info=useReadQuery(`viewer-info:${ship}:${id}`,loadInfo),manifest=useReadQuery(`viewer-manifest:${ship}:${id}`,loadManifest),history=useReadQuery(`viewer-history:${ship}:${id}`,loadHistory)
  return <><nav className={styles.tabs} aria-label="Nội dung model">{[['scene','Khám phá 3D'],['details','Thông tin model'],['history','Lịch sử nhập'],...(access.canDo('BLE_ANCHOR_READ')?[['ble','Setup BLE']]:[])].map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}<Badge label={modelStatus[version.status]??version.status} tone={version.status==='READY'?'success':'info'}/></nav>
    {info.error&&<Failure error={info.error} retry={info.retry}/>}
    {tab==='scene'&&<>{manifest.loading&&<Loading label="Đang đọc cấu trúc model…"/>}{manifest.error&&<Failure error={manifest.error} retry={manifest.retry}/>} {manifest.data&&<Explore key={id} ship={ship} model={id} manifest={manifest.data} info={info.data}/>}</>}
    {tab==='details'&&<ModelMetadata version={version} info={info.data} manifest={manifest.data}/>}
    {tab==='ble'&&<>{manifest.loading&&<Loading label="Đang đọc cấu trúc model…"/>}{manifest.error&&<Failure error={manifest.error} retry={manifest.retry}/>} {manifest.data&&<BleSetup key={`${ship}:${id}`} ship={ship} model={id} manifest={manifest.data}/>}</>}
    {tab==='history'&&<Panel title="Lịch sử nhập cấu trúc">{history.loading&&<Loading/>}{history.error&&<Failure error={history.error} retry={history.retry}/>} {history.data?.length===0&&<Empty title="Phiên bản này chưa có lượt nhập"/>}<div className={styles.jobs}>{history.data?.map(job=><article key={job.jobId}><div><Badge label={({SUCCEEDED:'Thành công',PARTIAL:'Thành công một phần',FAILED:'Thất bại',RUNNING:'Đang xử lý'} as Record<string,string>)[job.status]??job.status} tone={job.status==='SUCCEEDED'?'success':job.status==='FAILED'?'error':'warning'}/><time>{formatTime(job.startedAt)}</time></div><Facts rows={[
      ['Boong đã nhập',job.decksImported],['Cabin đã nhập',job.cabinsImported],['Mục lỗi',job.objectsFailed],['Người thực hiện',job.requestedBy],['Hoàn tất',formatTime(job.finishedAt)],
    ]}/>{job.objectsFailed>0&&<Button tone="secondary" onClick={()=>setIssueJob(issueJob?.jobId===job.jobId?null:job)}>{issueJob?.jobId===job.jobId?'Đóng chi tiết lỗi':'Xem chi tiết lỗi'}</Button>}{issueJob?.jobId===job.jobId&&<ImportIssues ship={ship} job={job}/>}</article>)}</div></Panel>}
  </>
}
function ShipModels({ship,ships,requested,onVersion,onShip}:{ship:ShipChoice;ships:ShipChoice[];requested:string;onVersion:(id:string)=>void;onShip:(id:string)=>void}) {
  const load=useCallback((signal:AbortSignal)=>viewerApi.versions(ship.shipId,signal),[ship.shipId]),query=useReadQuery(`viewer-versions:${ship.shipId}`,load)
  const versions=query.data?[...query.data].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)):[]
  const selected=requested?versions.find(v=>v.shipModelId===requested):versions[0]
  return <><div className={styles.versionBar}><Field htmlFor="viewer-ship" label="Tàu"><select id="viewer-ship" value={ship.shipId} onChange={event=>onShip(event.target.value)}><option value="">Tất cả tàu</option>{ships.map(s=><option key={s.shipId} value={s.shipId}>{s.shipName} · {s.shipCode}</option>)}</select></Field><Field htmlFor="viewer-version" label="Phiên bản model"><select id="viewer-version" disabled={!versions.length} value={selected?.shipModelId??''} onChange={event=>onVersion(event.target.value)}>{!selected&&<option value="">{query.loading?'Đang tải…':'Chọn phiên bản hợp lệ'}</option>}{versions.map(v=><option key={v.shipModelId} value={v.shipModelId}>{v.version} · {modelStatus[v.status]??v.status}</option>)}</select></Field><span className={styles.readOnly}>◉ Chế độ xem</span></div>
    {query.loading&&<Loading label="Đang tải phiên bản model…"/>}{query.error&&<Failure error={query.error} retry={query.retry}/>} {query.data?.length===0&&<Panel><Empty title="Tàu chưa có model 3D"><Link to="/admin/ship-import">Nhập gói mô hình</Link></Empty></Panel>}
    {requested&&!selected&&!query.loading&&versions.length>0&&<Notice title="Không tìm thấy phiên bản đã chọn" tone="warning">Chọn lại phiên bản thuộc tàu này để tiếp tục.</Notice>}
    {selected&&<VersionDetail key={`${ship.shipId}:${selected.shipModelId}`} ship={ship.shipId} version={selected}/>}
  </>
}
export function ModelViewerPage() {
  const access=useSessionAccess(),[params,setParams]=useSearchParams()
  const canRead=access.canDo('SHIP_READ')
  const load=useCallback((signal:AbortSignal)=>canRead?viewerApi.ships(signal):Promise.resolve([]),[canRead])
  const query=useReadQuery('viewer-ships',load),shipId=params.get('ship')??'',ship=query.data?.find(s=>s.shipId===shipId)
  return <AdminShell><div className={styles.page}><header className={styles.pageHeader}><div><span className={styles.eyebrow}>MODEL 3D</span><h1>Không gian mô hình tàu</h1></div><Link className={styles.secondaryLink} to="/admin/ship-import">Nhập mô hình ↗</Link></header>
    {!ship&&<div className={styles.shipBar}><Field htmlFor="viewer-ship" label="Tàu"><select id="viewer-ship" value={shipId} disabled={query.loading||!query.data?.length} onChange={event=>setParams(event.target.value?{ship:event.target.value}:{})}><option value="">Chọn tàu để khám phá</option>{query.data?.map(s=><option key={s.shipId} value={s.shipId}>{s.shipName} · {s.shipCode}</option>)}</select></Field><span className={styles.readOnly}>◉ Chế độ xem</span></div>}
    {query.loading&&<Loading label="Đang tải tàu…"/>}{query.error&&<Failure error={query.error} retry={query.retry}/>}
    {!access.canDo('SHIP_READ')&&<Notice title="Chưa có quyền đọc tàu" tone="warning">Cần quyền SHIP_READ để xem mô hình thuộc tàu.</Notice>}
    {ship?<ShipModels key={shipId} ship={ship} ships={query.data??[]} requested={params.get('model')??''} onVersion={model=>setParams({ship:shipId,model})} onShip={id=>setParams(id?{ship:id}:{})}/>:query.data&&<Panel title="Chọn tàu"><div className={styles.shipCards}>{query.data.map(s=><button key={s.shipId} onClick={()=>setParams({ship:s.shipId})}><span>◈</span><strong>{s.shipName}</strong><small>{s.shipCode}</small><span>Xem các phiên bản →</span></button>)}</div>{!query.data.length&&<Empty title="Chưa có tàu"/>}</Panel>}
  </div></AdminShell>
}
