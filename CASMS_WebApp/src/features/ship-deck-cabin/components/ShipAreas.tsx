import {useCallback,useState} from 'react'
import {ApiError,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {Badge,Button,ButtonLink,Empty,Field,Loading,Notice,Panel,RecordFacts} from '@/shared/ui'
import {readShipAreas} from '../api/ship-areas-api'
import {areaKindLabel,filterShipAreas,type AreaVector} from '../model/ship-areas'
import styles from './ShipAreas.module.css'

const showVector=(value:AreaVector|null)=>value?[value.x,value.y,value.z].map(n=>n.toLocaleString('vi-VN',{maximumFractionDigits:3})).join(' · '):'Chưa có dữ liệu'
export function ShipAreas({shipId,initialDeck=''}:{shipId:string;initialDeck?:string}){
 const access=useSessionAccess(),allowed=access.canDo('SHIP_CONFIGURATION_READ')
 const query=useReadQuery(`ship-areas:${access.userId}:${shipId}:${allowed}`,useCallback(signal=>allowed?readShipAreas(shipId,signal):Promise.resolve(null),[allowed,shipId]))
 const [search,setSearch]=useState(''),[deck,setDeck]=useState(initialDeck),[kind,setKind]=useState(''),[limit,setLimit]=useState(50)
 if(!allowed)return null
 const data=query.data,unready=query.error instanceof ApiError&&query.error.code==='SHIP_MODEL_NOT_READY'
 const forbidden=query.error instanceof ApiError&&query.error.status===403
 const rows=data?filterShipAreas(data.areas,search,deck,kind):[]
 const kinds=data?[...new Set(data.areas.map(area=>area.kind).filter((value):value is string=>Boolean(value)))].sort():[]
 const reset=()=>{setSearch('');setDeck('');setKind('');setLimit(50)}
 return <Panel title="Khu vực trên tàu (Areas)" subtitle="Các khu vực vật lý được nhập từ mô hình tàu và gắn với từng boong, như phòng tập, nhà hàng hoặc khu thư giãn.">
  <p className={styles.help}>Dữ liệu dưới đây là khu vực vật lý của mô hình đã công bố. Việc gán dịch vụ thương mại được thực hiện trong chức năng dịch vụ.</p>
  {query.loading&&<Loading label="Đang tải khu vực của tàu…"/>}
  {unready?<Empty title="Chưa có mô hình tàu sẵn sàng"><p>Công bố mô hình đã nhập để hệ thống trả về các khu vực trên tàu.</p>{access.canDo('SHIP_MODEL_READ')&&<ButtonLink tone="secondary" to={'/admin/ship-models?'+new URLSearchParams({ship:shipId})}>Xem mô hình tàu</ButtonLink>}</Empty>:query.error&&<Notice title={forbidden?'Chưa có quyền đọc cấu hình khu vực':'Chưa tải được khu vực'} tone="error">{query.error.message}{!forbidden&&<Button tone="secondary" onClick={query.retry}>Thử lại</Button>}</Notice>}
  {data&&<>
   {!data.supported&&<Notice title="Chưa có dữ liệu khu vực đầy đủ" tone="warning">Phiên bản hệ thống đang trả cấu hình thiếu khu vực ở một số boong. Cần cập nhật hệ thống rồi tải lại để đối chiếu đầy đủ.</Notice>}
   <div className={styles.filters}>
    <Field htmlFor="area-search" label="Tìm khu vực"><input id="area-search" type="search" value={search} placeholder="Tên khu vực hoặc mã mô hình" onChange={event=>{setSearch(event.target.value);setLimit(50)}}/></Field>
    <Field htmlFor="area-deck" label="Boong"><select id="area-deck" value={deck} onChange={event=>{setDeck(event.target.value);setLimit(50)}}><option value="">Tất cả boong</option>{data.decks.filter(d=>d.id).map(d=><option key={d.key} value={d.id!}>{d.number} · {d.name}</option>)}</select></Field>
    <Field htmlFor="area-kind" label="Loại khu vực"><select id="area-kind" value={kind} onChange={event=>{setKind(event.target.value);setLimit(50)}}><option value="">Tất cả loại</option>{kinds.map(value=><option key={value} value={value}>{areaKindLabel(value)}</option>)}</select></Field>
   </div>
   <div className={styles.toolbar}><p role="status">{rows.length} / {data.areas.length} khu vực{!data.supported?' đã nhận':''}</p><Button tone="text" onClick={reset} disabled={!search&&!deck&&!kind}>Xóa bộ lọc</Button><Button tone="secondary" disabled={query.loading} onClick={query.retry}>Tải lại khu vực</Button></div>
   {rows.length>0?<ul className={styles.list}>{rows.slice(0,limit).map(area=><li key={area.objectId}>
    <div className={styles.heading}><h3>{area.name||area.modelNodeKey}</h3><Badge label={areaKindLabel(area.kind)}/></div>
    <p className={styles.help}>Boong {area.deckNumber} · {area.deckName}</p>
    <p>Kích thước X · Y · Z: {showVector(area.dimensions)}{area.dimensions&&data.unit?' '+data.unit:''}</p>
    <details><summary>Xem chi tiết khu vực {area.name||area.modelNodeKey}</summary><RecordFacts entries={[
     ['Loại boong',area.serviceLevel?'Tầng kỹ thuật':'Boong thông thường'],['Mã khu vực',area.objectId],['Node mô hình',area.modelNodeKey],['Vị trí X · Y · Z',showVector(area.position)],['Góc xoay X · Y · Z',showVector(area.rotation)],['Tỷ lệ X · Y · Z',showVector(area.scale)],['Đơn vị mô hình',data.unit??'Chưa xác định'],
    ]}/></details>
   </li>)}</ul>:data.areas.length||search||deck||kind?<Empty title="Không có khu vực khớp bộ lọc"><Button tone="secondary" onClick={reset}>Xem tất cả khu vực</Button></Empty>:data.supported?<Empty title="Mô hình chưa có khu vực"><p>Chưa có khu vực được ghi nhận. Kiểm tra danh sách khu vực trong gói mô hình và kết quả nhập.</p></Empty>:null}
   {rows.length>limit&&<Button tone="secondary" onClick={()=>setLimit(value=>value+50)}>Xem thêm khu vực ({Math.min(limit,rows.length)}/{rows.length})</Button>}
  </>}
 </Panel>
}
