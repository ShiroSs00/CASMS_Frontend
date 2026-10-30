import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { viewerApi } from './api'
import { ModelCanvas } from './ModelCanvas'
import { serviceName, serviceType, cabinTypes, selectedAreas, selectedCabins, type Area, type Cabin, type Manifest, type ModelVersion, type ShipChoice } from './model'
import styles from './Viewer.module.css'
import {BleSetup} from './BleSetup'

function Failure({error,retry}:{error:Error;retry:()=>void}) { return <Notice title="Chưa tải được dữ liệu" tone="error">{error.message}<Button tone="text" onClick={retry}>Thử lại</Button></Notice> }
function Facts({rows}:{rows:Array<[string, string | number | undefined]>}) {return <dl className={styles.facts}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value??'Chưa cung cấp'}</dd></div>)}</dl>}
function CabinDetails({cabin,manifest}:{cabin:Cabin;manifest:Manifest}) {return <><div className={styles.detailTitle}><span>PHÒNG</span><h2>{cabin.cabinNumber}</h2><Badge label={cabinTypes[cabin.cabinType]??cabin.cabinType}/></div><Facts rows={[
  ['Boong',`${cabin.deckNumber} · ${manifest.decks.find(d=>d.id===cabin.deckId)?.name??''}`],['Sức chứa',cabin.capacity!=null?`${cabin.capacity} khách`:undefined],['Hạng phòng',cabin.gradeName],['Phòng hỗ trợ người khuyết tật',cabin.isAccessible==null?undefined:cabin.isAccessible?'Có':'Không'],['Diện tích',cabin.areaSquareMetres!=null?`${cabin.areaSquareMetres} m²`:undefined]
  ]}/></>}
function AreaDetails({area,manifest}:{area:Area;manifest:Manifest}) {
  return <><div className={styles.detailTitle}><span>KHU VỰC DỊCH VỤ</span><h2>{serviceName(area)}</h2><Badge label={serviceType(area.kind)}/></div><Facts rows={[
    ['Loại dịch vụ',serviceType(area.kind)],['Boong',`${area.deckNumber} · ${[...manifest.decks,...manifest.serviceDecks??[]].find(d=>d.id===area.deckId)?.name??''}`]
  ]}/>{Boolean(area.interiorDetails?.length)&&<section className={styles.serviceContents}><h3>Tiện ích</h3><ul>{area.interiorDetails?.map(detail=><li key={detail}>{detail}</li>)}</ul></section>}</>
}
function Explore({ship,model,manifest}:{ship:string;model:string;manifest:Manifest}) {
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
      {deck&&<><div className={styles.listSwitch} aria-label="Danh sách trên tàu"><button aria-pressed={list==='rooms'} onClick={()=>setList('rooms')}>Phòng</button><button aria-pressed={list==='services'} onClick={()=>setList('services')}>Khu vực dịch vụ</button></div>
      {list==='services'&&<>      <div className={styles.cabinHeading}><h3>Khu vực dịch vụ</h3><input type="search" aria-label="Tìm khu vực dịch vụ trên tàu" value={areaSearch} placeholder="Tên hoặc loại khu vực dịch vụ" onChange={event=>setAreaSearch(event.target.value)}/></div>
      <div className={`${styles.cabinList} ${styles.areaList}`} aria-label="Khu vực dịch vụ trên tàu">{areas.map(value=><button key={value.id} aria-pressed={areaId===value.id} onClick={()=>chooseArea(value)}><strong>{serviceName(value)}</strong></button>)}{!areas.length&&<p className={styles.note}>{manifest.areas===undefined?'Chưa có khu vực dịch vụ.':areaSearch?'Không có khu vực dịch vụ khớp tìm kiếm.':'Chưa có khu vực dịch vụ.'}</p>}</div>
</>}
      {list==='rooms'&&<>      <div className={styles.cabinHeading}><h3>Phòng</h3><input type="search" aria-label="Tìm phòng" value={search} placeholder="Số phòng hoặc loại phòng" onChange={event=>setSearch(event.target.value)}/></div>
      <div className={styles.cabinList}>{cabins.map(value=><button key={value.id} aria-pressed={cabinId===value.id} onClick={()=>chooseCabin(value)}><strong>{value.cabinNumber}</strong></button>)}{!cabins.length&&<p className={styles.note}>Không tìm thấy phòng.</p>}</div></>}
      </>}
    </aside>
    <div className={styles.sceneColumn}><div className={styles.sceneHeading}><div><span>{deck?`${deck.number<=0?'TẦNG KỸ THUẬT':'BOONG'} ${deck.number}`:'TỔNG THỂ'}</span><h2>{deck?.name??manifest.name}</h2></div>{!deck&&<label className={styles.toggle}><input type="checkbox" checked={full} onChange={event=>setFull(event.target.checked)}/>Toàn bộ cấu trúc</label>}</div>

      {file?<ModelCanvas key={`${model}:${file}`} ship={ship} model={model} file={file} autoFocusSelection selectionLabel={(area?serviceName(area):undefined)??(cabin?`Phòng ${cabin.cabinNumber}`:deck?.name)} selectionContext={deck?`Boong ${deck.number} · ${deck.name}`:undefined} selected={area?.nodeName??cabin?.nodeName??deck?.nodeName??''} onPick={pick}/>:<Notice title="Chưa có sơ đồ 3D" tone="warning">Không có dữ liệu hiển thị.</Notice>}
      <div className={styles.sceneLegend}><span><i/> {area?'Khu vực dịch vụ được chọn':cabin?'Phòng được chọn':'Đối tượng được chọn'}</span></div>
    </div>
    <aside className={styles.inspector} aria-label="Chi tiết đối tượng">{area?<><button className={styles.clearSelection} onClick={()=>setArea('')}>← Thông tin boong</button><AreaDetails area={area} manifest={manifest}/></>:cabin?<><button className={styles.clearSelection} onClick={()=>setCabin('')}>← Thông tin boong</button><CabinDetails cabin={cabin} manifest={manifest}/></>:<><div className={styles.detailTitle}><span>{deck?'BOONG ĐANG XEM':'THÔNG TIN TỔNG THỂ'}</span><h2>{deck?.name??manifest.name}</h2></div><Facts rows={deck?[
      ['Boong số',deck.number],['Cao độ',deck.elevationMetres!=null?`${deck.elevationMetres} m`:undefined],['Số khu vực dịch vụ',manifest.areas?.filter(a=>a.deckId===deck.id).length],['Số phòng',manifest.cabins.filter(c=>c.deckId===deck.id).length],
    ]:[['Số boong',decks.length],['Số khu vực dịch vụ',manifest.areas?.length],['Số phòng',manifest.cabins.length]]}/></>}</aside>
  </div>
}
function VersionDetail({ship,version}:{ship:string;version:ModelVersion}) {
  const access=useSessionAccess(),[tab,setTab]=useState('scene'),id=version.shipModelId
  const load=useCallback((signal:AbortSignal)=>viewerApi.manifest(ship,id,signal),[ship,id])
  const manifest=useReadQuery(`viewer-manifest:${ship}:${id}`,load)
  return <>{access.canDo('BLE_ANCHOR_READ')&&<nav className={styles.tabs} aria-label="Nội dung sơ đồ tàu">{[['scene','Sơ đồ tàu'],['ble','Thiết bị định vị']].map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</nav>}
    {manifest.loading&&<Loading label="Đang tải sơ đồ tàu…"/>}{manifest.error&&<Failure error={manifest.error} retry={manifest.retry}/>}
    {manifest.data&&(tab==='ble'?<BleSetup ship={ship} model={id} manifest={manifest.data}/>:<Explore ship={ship} model={id} manifest={manifest.data}/>)}</>
}
function ShipModels({ship,requested,onShip}:{ship:ShipChoice;requested:string;onShip:(id:string)=>void}) {
  const load=useCallback((signal:AbortSignal)=>viewerApi.versions(ship.shipId,signal),[ship.shipId]),query=useReadQuery(`viewer-versions:${ship.shipId}`,load)
  const versions=query.data?[...query.data].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)):[]
  const selected=requested?versions.find(v=>v.shipModelId===requested):versions[0]
  return <>
    {query.loading&&<Loading label="Đang tải sơ đồ tàu…"/>}{query.error&&<Failure error={query.error} retry={query.retry}/>} {query.data?.length===0&&<Panel><Empty title="Tàu chưa có sơ đồ 3D"><Link to="/admin/ship-import">Tải mô hình</Link></Empty></Panel>}
    {requested&&!selected&&!query.loading&&versions.length>0&&<Notice title="Không tìm thấy sơ đồ đã chọn" tone="warning"><Button tone="text" onClick={()=>onShip(ship.shipId)}>Tải lại sơ đồ tàu</Button></Notice>}
    {selected&&<VersionDetail key={`${ship.shipId}:${selected.shipModelId}`} ship={ship.shipId} version={selected}/>}
  </>
}
export function ModelViewerPage() {
  const access=useSessionAccess(),[params,setParams]=useSearchParams()
  const canRead=access.canDo('SHIP_READ')
  const load=useCallback((signal:AbortSignal)=>canRead?viewerApi.ships(signal):Promise.resolve([]),[canRead])
  const query=useReadQuery('viewer-ships',load),shipId=params.get('ship')??'',ship=query.data?.find(s=>s.shipId===shipId)
  return <AdminShell><div className={styles.page}><header className={styles.pageHeader}><div><h1>Sơ đồ tàu 3D</h1></div><Field htmlFor="viewer-ship" label="Mã tàu"><select id="viewer-ship" value={shipId} disabled={query.loading||!query.data?.length} onChange={event=>setParams(event.target.value?{ship:event.target.value}:{})}><option value="">Chọn mã tàu</option>{query.data?.map(s=><option key={s.shipId} value={s.shipId}>{s.shipCode}</option>)}</select></Field><Link className={styles.secondaryLink} to="/admin/ship-import">Thêm tàu</Link></header>

    {query.loading&&<Loading label="Đang tải tàu…"/>}{query.error&&<Failure error={query.error} retry={query.retry}/>}
    {!access.canDo('SHIP_READ')&&<Notice title="Chưa có quyền đọc tàu" tone="warning">Cần quyền SHIP_READ để xem mô hình thuộc tàu.</Notice>}
    {ship?<ShipModels key={shipId} ship={ship} requested={params.get('model')??''} onShip={id=>setParams(id?{ship:id}:{})}/>:query.data&&<Panel title="Danh sách mã tàu"><div className={styles.shipCards}>{query.data.map(s=><button key={s.shipId} onClick={()=>setParams({ship:s.shipId})} aria-label={`Xem sơ đồ tàu ${s.shipCode} · ${s.shipName}`}><div className={styles.shipIdentity}><strong>{s.shipCode}</strong><span>{s.shipName}</span></div><span className={styles.shipArrow} aria-hidden="true">↗</span></button>)}</div>{!query.data.length&&<Empty title="Chưa có tàu"/>}</Panel>}
  </div></AdminShell>
}
