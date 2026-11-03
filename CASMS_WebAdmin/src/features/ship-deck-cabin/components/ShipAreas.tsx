import {useCallback,useState} from 'react'
import {useSessionAccess} from '@/shared/auth'
import {Badge,Button,Empty,Field,Loading,Notice,Panel} from '@/shared/ui'
import {readShipServiceAreas} from '../api/ship-areas-api'
import {shipDeckCabinApi} from '../api/ship-deck-cabin-api'
import {useFleetQuery} from '../hooks/useFleetQuery'
import {serviceAreaName,serviceType} from '../model/service-area-copy'
import {paginateFleet} from '../model/fleet-pagination'
import {FleetPagination} from './FleetPagination'
import styles from './ShipAreas.module.css'

const areaKindLabel=(kind:string|null)=>kind?serviceType(kind):'Chưa phân loại'
const displayName=(area:{name:string|null;kind:string|null})=>serviceAreaName({name:area.name??areaKindLabel(area.kind),kind:area.kind??''})

export function ShipAreas({shipId,initialDeck=''}:{shipId:string;initialDeck?:string}) {
 const access=useSessionAccess()
 const [deck,setDeck]=useState(initialDeck),[search,setSearch]=useState(''),[kind,setKind]=useState(''),[page,setPage]=useState(1)
 const loadDecks=useCallback((signal:AbortSignal)=>shipDeckCabinApi.listShipDecks(shipId,signal),[shipId])
 const decks=useFleetQuery(`area-decks:${shipId}`,loadDecks,access.canDo('DECK_READ'))
 const selected=decks.data?.find(value=>value.id===deck)
 const loadAreas=useCallback((signal:AbortSignal)=>readShipServiceAreas(shipId,signal),[shipId])
 const areas=useFleetQuery(`service-areas:${shipId}`,loadAreas,access.canDo('SHIP_CONFIGURATION_READ')&&Boolean(selected))
 const onDeck=areas.data?.filter(area=>area.deckId===selected?.id)??[]
 const term=search.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').trim()
 const rows=onDeck.filter(area=>(!kind||area.kind===kind)&&(!term||`${displayName(area)} ${area.name??''} ${areaKindLabel(area.kind)}`.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').includes(term)))
 const pagination=paginateFleet(rows,page,6)
 const kinds=[...new Set(onDeck.map(area=>area.kind).filter((value):value is string=>Boolean(value)))].sort()
 return <Panel title="Khu vực dịch vụ">
  <div className={styles.stack}>
   <div className={styles.deckPicker}><Field htmlFor="service-area-deck" label="Boong"><select id="service-area-deck" value={selected?.id??''} disabled={decks.loading||!decks.data?.length} onChange={event=>{setDeck(event.target.value);setSearch('');setKind('');setPage(1)}}><option value="">{decks.loading?'Đang tải boong…':'Chọn boong'}</option>{decks.data?.map(value=><option key={value.id} value={value.id}>Boong {value.number} · {value.name}</option>)}</select></Field></div>
   {decks.error&&<Notice title="Không tải được danh sách boong" tone="error">{decks.error}</Notice>}
   {!access.canDo('DECK_READ')&&<Empty title="Chưa có quyền xem boong"/>}
   {!decks.loading&&!decks.error&&decks.data?.length===0&&<Empty title="Tàu chưa có boong"/>}
   {selected&&areas.loading&&!areas.data&&<Loading label="Đang tải khu vực dịch vụ…"/>}
   {selected&&areas.error&&<Notice title="Không tải được khu vực dịch vụ" tone="error">{areas.error}</Notice>}
   {selected&&areas.data&&<>
    <div className={styles.filters}>
     <Field htmlFor="service-area-search" label="Tìm khu vực dịch vụ"><input id="service-area-search" type="search" value={search} placeholder="Tên khu vực dịch vụ" onChange={event=>{setSearch(event.target.value);setPage(1)}}/></Field>
     <Field htmlFor="service-area-kind" label="Loại khu vực dịch vụ"><select id="service-area-kind" value={kind} onChange={event=>{setKind(event.target.value);setPage(1)}}><option value="">Tất cả loại</option>{kinds.map(value=><option key={value} value={value}>{areaKindLabel(value)}</option>)}</select></Field>
    </div>
    {(search||kind)&&<div><Button tone="text" onClick={()=>{setSearch('');setKind('');setPage(1)}}>Xóa bộ lọc</Button></div>}
    {rows.length?<ul className={styles.list}>{pagination.items.map(area=><li key={area.id}><h3>{displayName(area)}</h3><Badge label={areaKindLabel(area.kind)}/></li>)}</ul>:<Empty title={onDeck.length?'Không có khu vực dịch vụ phù hợp':'Boong chưa có khu vực dịch vụ'}/>}
    <FleetPagination pagination={pagination} onChange={setPage}/>
   </>}
  </div>
 </Panel>
}
