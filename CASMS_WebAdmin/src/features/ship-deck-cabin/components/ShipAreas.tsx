import {useCallback,useRef,useState} from 'react'
import {apiRequest,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {Button,DataTable,Empty,Field,Loading,Notice,Panel} from '@/shared/ui'
import {readShipServiceAreas} from '../api/ship-areas-api'
import {shipDeckCabinApi} from '../api/ship-deck-cabin-api'
import {useFleetQuery} from '../hooks/useFleetQuery'
import {serviceAreaName,serviceType} from '@/shared/i18n/service-area-copy'
import {paginateFleet} from '../model/fleet-pagination'
import {FleetPagination} from './FleetPagination'
import {ShipAreaPosConfig} from './ShipAreaPosConfig'
import styles from './ShipAreas.module.css'

const areaKindLabel=(kind:string|null)=>kind?serviceType(kind):'Chưa phân loại'
const displayName=(area:{name:string|null;kind:string|null})=>serviceAreaName({name:area.name??areaKindLabel(area.kind),kind:area.kind??''})

type AreaUsage = {
 id: string
 display_name: string | null
 area_usage: string
 deck_id: string | null
 cabin_id?: string | null
 model_status: string
 has_services: boolean
}

function ActivityAreaSetup({shipId,deckId}:{shipId:string;deckId:string}) {
 const root = '/ships/'+encodeURIComponent(shipId)+'/areas'
 const query = useReadQuery('activity-areas:'+shipId,
   useCallback(signal=>apiRequest<AreaUsage[]>(root+'/usages',{signal}),[root]))
 const [areaId,setAreaId] = useState('')
 const [saving,setSaving] = useState(false)
 const [error,setError] = useState('')
 const lock = useRef(false)
 const areas = query.data?.filter(area=>area.deck_id===deckId&&['DRAFT','READY'].includes(area.model_status)) ?? []
 const candidates = areas.filter(area=>area.area_usage==='OTHER'&&!area.has_services&&!area.cabin_id)
 const configured = areas.filter(area=>area.area_usage==='ACTIVITY_SPACE')

 async function save() {
  if(lock.current||query.loading||query.error||!candidates.some(area=>area.id===areaId))return
  lock.current=true
  setSaving(true)
  setError('')
  try{
   await apiRequest(root+'/'+encodeURIComponent(areaId)+'/usage',{method:'PUT',body:{usage:'ACTIVITY_SPACE'}})
   setAreaId('')
   query.retry()
  }catch(reason){
   setError(reason instanceof Error?reason.message:'Chưa cập nhật được khu vực.')
  }finally{
   lock.current=false
   setSaving(false)
  }
 }

 return <section className={styles.stack} aria-label="Khu vực hoạt động">
   <h3>Khu vực hoạt động</h3>
   {query.loading&&<Loading label="Đang tải khu vực trên boong…" />}
   {query.error&&<Notice title="Chưa tải được khu vực" tone="error"><Button onClick={query.retry}>Thử lại</Button></Notice>}
   {configured.length>0&&<ul>{configured.map(area=><li key={area.id}>{area.display_name??'Khu vực chưa đặt tên'}</li>)}</ul>}
   {candidates.length>0&&<>
     <Field htmlFor="ship-activity-area" label="Khu vực để tổ chức hoạt động">
       <select id="ship-activity-area" value={areaId} disabled={saving} onChange={event=>setAreaId(event.target.value)}>
         <option value="">Chọn khu vực</option>
         {candidates.map(area=><option key={area.id} value={area.id}>{area.display_name??'Khu vực chưa đặt tên'}</option>)}
       </select>
     </Field>
     <div><Button busy={saving} disabled={!areaId} onClick={()=>void save()}>Đặt làm khu vực hoạt động</Button></div>
   </>}
   {query.data&&candidates.length===0&&configured.length===0&&<Empty title="Boong này chưa có khu vực phù hợp để tổ chức hoạt động" />}
   {error&&<Notice title="Chưa lưu được khu vực" tone="error">{error}</Notice>}
 </section>
}

export function ShipAreas({shipId,initialDeck=''}:{shipId:string;initialDeck?:string}) {
 const access=useSessionAccess()
 const [deck,setDeck]=useState(initialDeck),[search,setSearch]=useState(''),[kind,setKind]=useState(''),[page,setPage]=useState(1)
 const loadDecks=useCallback((signal:AbortSignal)=>shipDeckCabinApi.listShipDecks(shipId,signal),[shipId])
 const decks=useFleetQuery(`area-decks:${shipId}`,loadDecks,access.canDo('DECK_READ'))
 const selected=decks.data?.find(value=>value.id===deck)
 const loadAreas=useCallback((signal:AbortSignal)=>readShipServiceAreas(shipId,signal),[shipId])
 const areas=useFleetQuery(`service-areas:${shipId}`,loadAreas,access.canDo('SHIP_CONFIGURATION_READ'))
 const onDeck=areas.data?.filter(area=>area.deckId===selected?.id)??[]
 const term=search.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').trim()
 const rows=onDeck.filter(area=>(!kind||area.kind===kind)&&(!term||`${displayName(area)} ${area.name??''} ${areaKindLabel(area.kind)}`.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').includes(term)))
 const pagination=paginateFleet(rows,page,6)
 const kinds=[...new Set(onDeck.map(area=>area.kind).filter((value):value is string=>Boolean(value)))].sort()
 return <Panel title="Danh sách khu vực theo boong">
  <div className={styles.stack}>
   <div className={styles.deckPicker}><Field htmlFor="service-area-deck" label="Boong"><select id="service-area-deck" value={selected?.id??''} disabled={decks.loading||!decks.data?.length} onChange={event=>{setDeck(event.target.value);setSearch('');setKind('');setPage(1)}}><option value="">{decks.loading?'Đang tải boong…':'Chọn boong'}</option>{decks.data?.map(value=><option key={value.id} value={value.id}>Boong {value.number} · {value.name}</option>)}</select></Field></div>
   {access.canDo('POS_MANAGE')
    ?<ShipAreaPosConfig shipId={shipId} deckId={selected?.id??''} areasOnDeck={onDeck} allAreas={areas.data??[]}/>
    :<Notice title="Cấu hình dịch vụ theo khu vực 3D & máy POS offline">Để mở khu vực và lập định biên nhân sự trong Kế hoạch chuyến, Quản trị hệ thống cần gắn dịch vụ vào khu vực 3D và đăng ký máy POS offline cho tàu trên tài khoản Quản trị.</Notice>}
   {selected&&access.has('SHIP_MODEL_OBJECT_UPDATE')&&<ActivityAreaSetup key={selected.id} shipId={shipId} deckId={selected.id}/>}
   {decks.error&&<Notice title="Không tải được danh sách boong" tone="error">{decks.error}</Notice>}
   {!access.canDo('DECK_READ')&&<Empty title="Chưa có quyền xem boong"/>}
   {!decks.loading&&!decks.error&&decks.data?.length===0&&<Empty title="Tàu chưa có boong"/>}
   {!selected&&decks.data&&decks.data.length>0&&<Empty title="Chọn boong để xem danh sách khu vực dịch vụ" />}
   {selected&&areas.loading&&!areas.data&&<Loading label="Đang tải khu vực dịch vụ…"/>}
   {selected&&areas.error&&<Notice title="Không tải được khu vực dịch vụ" tone="error">{areas.error}</Notice>}
   {selected&&areas.data&&<>
    <div className={styles.filters}>
     <Field htmlFor="service-area-search" label="Tìm khu vực dịch vụ"><input id="service-area-search" type="search" value={search} placeholder="Tên khu vực dịch vụ" onChange={event=>{setSearch(event.target.value);setPage(1)}}/></Field>
     <Field htmlFor="service-area-kind" label="Loại khu vực dịch vụ"><select id="service-area-kind" value={kind} onChange={event=>{setKind(event.target.value);setPage(1)}}><option value="">Tất cả loại</option>{kinds.map(value=><option key={value} value={value}>{areaKindLabel(value)}</option>)}</select></Field>
    </div>
    {(search||kind)&&<div><Button tone="text" onClick={()=>{setSearch('');setKind('');setPage(1)}}>Xóa bộ lọc</Button></div>}
    {rows.length?<div className={styles.areaTable}><DataTable label="Danh sách khu vực dịch vụ" headers={['Tên khu vực dịch vụ','Loại khu vực dịch vụ']}>
      {pagination.items.map(area=><tr key={area.id}><th scope="row">{displayName(area)}</th><td>{areaKindLabel(area.kind)}</td></tr>)}
    </DataTable></div>:<Empty title={onDeck.length?'Không có khu vực dịch vụ phù hợp':'Boong chưa có khu vực dịch vụ'}/>}
    {rows.length > 0 && <FleetPagination pagination={pagination} onChange={setPage} label="khu vực"/>}
   </>}
  </div>
 </Panel>
}
