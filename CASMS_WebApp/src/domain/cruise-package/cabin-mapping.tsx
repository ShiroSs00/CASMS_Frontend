import styles from './Workspace.module.css'
import {useCallback,useRef,useState} from 'react'
import {apiRequestRaw,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {Button,ButtonLink,Empty,Field,Notice,Panel,RecordFacts,TechnicalDetails,UnsavedForms,useFormChanges} from '@/shared/ui'
import {fareObject,fareText,fareUuid} from './purchase-contract'
import {QueryState} from './Workspace'

type Assignment={logicalCategoryId:string;cabinIds:string[]}
type MappingView={shipId:string;structureFingerprint:string;confirmation:{id:string;revision:number;confirmedBy:string;confirmedAt:string;status:'CURRENT'|'STALE'}|null;categories:{id:string;templateVersionId:string;name:string;packageName:string}[];cabins:{id:string;name:string;deck:string;capacity:number;status:string}[];assignments:Assignment[]}
const path=(shipId:string)=>`/ships/${encodeURIComponent(shipId)}/cruise-package-cabin-mapping`
function decode(value:unknown,shipId:string):MappingView {
  const envelope=fareObject(value);if(envelope.success!==true)throw new Error('Máy chủ chưa xác nhận kết quả mapping.')
  const v=fareObject(envelope.data)
  if(v.shipId!==shipId||!Array.isArray(v.categories)||!Array.isArray(v.cabins)||!Array.isArray(v.assignments))throw new Error('Mapping không khớp tàu hoặc thiếu dữ liệu cấu trúc.')
  const categoryRows=v.categories.map(value=>{const c=fareObject(value);return{id:fareUuid(c.id),templateVersionId:fareUuid(c.templateVersionId),name:fareText(c.name),packageName:fareText(c.packageName)}})
  const categories=Array.from(new Map(categoryRows.map(c=>[c.id,c])).values())
  const cabins=v.cabins.map(value=>{const c=fareObject(value);if(typeof c.capacity!=='number'||!Number.isSafeInteger(c.capacity)||c.capacity<1)throw new Error('Sức chứa cabin nguồn chưa hợp lệ.');return{id:fareUuid(c.cabin_id),name:fareText(c.cabin_number),deck:fareText(c.deck_name),capacity:c.capacity,status:fareText(c.status)}})
  const assignments:Assignment[]=[]
  for(const value of v.assignments){const a=fareObject(value),id=fareUuid(a.logical_category_id);const existing=assignments.find(x=>x.logicalCategoryId===id);const cabinId=fareUuid(a.cabin_id_snapshot);if(existing)existing.cabinIds.push(cabinId);else assignments.push({logicalCategoryId:id,cabinIds:[cabinId]})}
  let confirmation:MappingView['confirmation']=null
  if(v.confirmation!=null){const c=fareObject(v.confirmation);if(!Number.isSafeInteger(c.revision)||Number(c.revision)<1||!['CURRENT','STALE'].includes(String(c.status))||!Number.isFinite(Date.parse(String(c.confirmedAt))))throw new Error('Bằng chứng xác nhận mapping không hợp lệ.');confirmation={id:fareUuid(c.id),revision:Number(c.revision),confirmedBy:fareUuid(c.confirmedBy),confirmedAt:fareText(c.confirmedAt),status:c.status as 'CURRENT'|'STALE'}}
  return{shipId,structureFingerprint:fareText(v.structureFingerprint),confirmation,categories,cabins,assignments}
}
function ShipCabinMappingWorkspace({shipId}:{shipId:string}) {
  const access=useSessionAccess(),canRead=access.roles.includes('SHIP_MANAGER')&&access.has('SHIP_READ')
  const canConfirm=canRead&&access.canDo('SHIP_CABIN_CATEGORY_MAPPING_CONFIRM')
  const query=useReadQuery(`cruise-package-mapping:${shipId}:${canRead}`,useCallback(signal=>canRead?apiRequestRaw(path(shipId),v=>decode(v,shipId),{signal}):Promise.resolve(null),[shipId,canRead]))
  const [draft,setDraft]=useState<Assignment[]|null>(null),[category,setCategory]=useState(''),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[success,setSuccess]=useState('')
  const lock=useRef(false),data=query.data
  useFormChanges(draft!==null||Boolean(category||selected.length),busy)
  if(!canRead)return null
  const rows=draft??data?.assignments??[]
  async function confirm(){
    if(!data||!canConfirm||lock.current||uncertain||query.loading||query.error||!rows.length)return
    lock.current=true;setBusy(true);setError('');setSuccess('')
    try{
      const saved=await apiRequestRaw(path(shipId)+'/confirm',v=>decode(v,shipId),{method:'POST',body:{expectedMappingId:data.confirmation?.id??null,expectedStructureFingerprint:data.structureFingerprint,assignments:rows}})
      const actual=await apiRequestRaw(path(shipId),v=>decode(v,shipId))
      if(!saved.confirmation||saved.confirmation.status!=='CURRENT'||actual.confirmation?.id!==saved.confirmation.id||actual.structureFingerprint!==saved.structureFingerprint)throw new Error('Chưa đối chiếu được revision mapping đã xác nhận.')
      setDraft(null);setSelected([]);setCategory('');setSuccess('Đã xác nhận mapping cabin của tàu. Điều kiện mở bán được đánh giá lại riêng.');query.retry()
    }catch(reason){setError(reason instanceof Error?reason.message:'Chưa xác nhận được mapping.');setUncertain(true)}finally{lock.current=false;setBusy(false)}
  }
  return <Panel title="Ánh xạ hạng cabin thương mại"><QueryState loading={query.loading} error={query.error}/>{query.error&&<Button onClick={query.retry}>Tải lại mapping</Button>}
    {data&&<><p>Tàu: {shipId}. {data.confirmation?`Revision ${data.confirmation.revision} · ${data.confirmation.status==='CURRENT'?'Xác nhận còn hiện hành':'Cần xác nhận lại do cấu trúc thay đổi'} · ${new Date(data.confirmation.confirmedAt).toLocaleString('vi-VN')} · Tài khoản xác nhận: ${data.confirmation.confirmedBy}`:'Chưa có mapping được xác nhận.'}</p>
      <ul>{rows.map(row=><li key={row.logicalCategoryId}>{data.categories.find(c=>c.id===row.logicalCategoryId)?.name??'Hạng thương mại cần đối chiếu'} · ID {row.logicalCategoryId}: {row.cabinIds.map(id=>data.cabins.find(c=>c.id===id)?.name??`Cabin không còn trong cấu trúc hiện tại (${id})`).join(', ')} {canConfirm&&<Button tone="text" disabled={busy||uncertain} onClick={()=>setDraft(rows.filter(r=>r.logicalCategoryId!==row.logicalCategoryId))}>Bỏ khỏi bản mapping tiếp theo</Button>}</li>)}</ul>
      {!rows.length&&<Empty title="Chưa có hạng thương mại được ánh xạ"/>}
      {canConfirm&&<><Field htmlFor="mapping-category" label="Hạng cabin thương mại"><select id="mapping-category" value={category} disabled={busy||uncertain} onChange={e=>{setCategory(e.target.value);setSelected(rows.find(r=>r.logicalCategoryId===e.target.value)?.cabinIds??[])}}><option value="">Chọn hạng từ phiên bản mẫu</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.packageName} · {c.name} · {c.id}</option>)}</select></Field>
        <fieldset className={styles.mappingCabins} disabled={!category||busy||uncertain||query.loading}><legend>Cabin vật lý trên tàu</legend>{data.cabins.map(c=>{const used=rows.some(r=>r.logicalCategoryId!==category&&r.cabinIds.includes(c.id));return <label key={c.id}><input type="checkbox" checked={selected.includes(c.id)} disabled={used} onChange={e=>setSelected(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/>{c.name} · {c.deck} · Sức chứa {c.capacity} · {c.status==='AVAILABLE'?'Khả dụng':'Trạng thái cần đối chiếu'} · {c.id}</label>})}</fieldset>
        <Button tone="secondary" disabled={!category||!selected.length||busy||uncertain} onClick={()=>{setDraft([...rows.filter(r=>r.logicalCategoryId!==category),{logicalCategoryId:category,cabinIds:[...selected]}]);setCategory('');setSelected([])}}>Lưu vào bản mapping tiếp theo</Button>
        <Button disabled={busy||uncertain||!rows.length} onClick={()=>void confirm()}>Xác nhận mapping của tàu</Button></>}
      <p>Mapping xác nhận tương thích; tồn cabin được Backend kiểm tra riêng khi mở bán. Không suy luận từ tên hoặc hạng cabin cũ.</p></>}
    {error&&<Notice title="Chưa xác nhận được mapping" tone="error">{error}</Notice>}{uncertain&&<Notice title="Cần đối chiếu dữ liệu trước khi gửi lại"><Button disabled={busy} onClick={()=>{query.retry();setUncertain(false)}}>Tải lại mapping để đối chiếu</Button></Notice>}{success&&<Notice title="Đã lưu xác nhận" tone="success">{success}</Notice>}
  </Panel>
}

export function CruisePackageCabinMapping(props:{shipId:string}){return <UnsavedForms><ShipCabinMappingWorkspace {...props}/></UnsavedForms>}

export function CruisePackageMappingEvidence({shipId,shipName,categoryId,categoryName,mapping}:{shipId:string;shipName?:string|null;categoryId:string|null;categoryName:string;mapping:{mappingId:string|null;cabinIds:string[];revision:number|null;confirmedBy:string|null;confirmedAt:string|null;blockers:{code:string;message:string}[]}}){
  const access=useSessionAccess()
  return <section aria-label="Bằng chứng ánh xạ cabin"><h4>Ánh xạ cabin của gói du thuyền</h4>
    <RecordFacts entries={[
      ['Hạng cabin thương mại',categoryName],['Tàu',shipName??'Chưa đọc được tên tàu'],
      ['Xác nhận mapping',mapping.mappingId?(mapping.blockers.length?'Cần đối chiếu':'Xác nhận còn hiện hành'):'Chưa có xác nhận'],
      ['Lần cập nhật',mapping.revision??'Chưa xác định'],
      ['Thời điểm xác nhận',mapping.confirmedAt?new Date(mapping.confirmedAt).toLocaleString('vi-VN'):'Chưa có thông tin'],
    ]}/>
    {access.has('CABIN_READ')&&mapping.cabinIds.length>0&&<ul>{mapping.cabinIds.map((id,index)=><li key={id}><ButtonLink tone="secondary" to={`/admin/cabins/${encodeURIComponent(id)}`}>Xem thông tin cabin {index+1}</ButtonLink></li>)}</ul>}
    <TechnicalDetails label="Định danh đối chiếu mapping" entries={[
      ['Hạng cabin',categoryId],['Tàu',shipId],['Mapping',mapping.mappingId],['Tài khoản xác nhận',mapping.confirmedBy],
      ...mapping.cabinIds.map((id,index)=>[`Cabin ${index+1}`,id] as const),
    ]}/>
    {mapping.blockers.map((b,i)=><Notice key={`${b.code}:${i}`} tone="warning" title="Quản lý tàu cần đối chiếu mapping">{b.message}</Notice>)}
  </section>
}


