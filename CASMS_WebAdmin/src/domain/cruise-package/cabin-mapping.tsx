import styles from './Workspace.module.css'
import {useCallback,useRef,useState} from 'react'
import {apiRequestRaw,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {Button,ButtonLink,Empty,Field,Notice,Panel,RecordFacts,UnsavedForms,useFormChanges} from '@/shared/ui'
import {fareObject,fareText,fareUuid} from './purchase-contract'
import {QueryState} from './Workspace'

type Assignment={logicalCategoryId:string;cabinIds:string[]}
type MappingView={shipId:string;structureFingerprint:string;confirmation:{id:string;revision:number;confirmedBy:string;confirmedAt:string;status:'CURRENT'|'STALE'}|null;categories:{id:string;templateVersionId:string;name:string;packageName:string;cabinType:string|null}[];cabins:{id:string;name:string;deck:string;capacity:number;status:string;type:string|null}[];assignments:Assignment[]}
const path=(shipId:string)=>`/ships/${encodeURIComponent(shipId)}/cruise-package-cabin-mapping`
function decode(value:unknown,shipId:string):MappingView {
  const envelope=fareObject(value);if(envelope.success!==true)throw new Error('Máy chủ chưa xác nhận kết quả mapping.')
  const v=fareObject(envelope.data)
  if(v.shipId!==shipId||!Array.isArray(v.categories)||!Array.isArray(v.cabins)||!Array.isArray(v.assignments))throw new Error('Mapping không khớp tàu hoặc thiếu dữ liệu cấu trúc.')
  const categoryRows=v.categories.map(value=>{const c=fareObject(value);return{id:fareUuid(c.id),templateVersionId:fareUuid(c.templateVersionId),name:fareText(c.name),packageName:fareText(c.packageName),cabinType:c.cabinType==null?null:fareText(c.cabinType)}})
  const categories=Array.from(new Map(categoryRows.map(c=>[c.id,c])).values())
  const cabins=v.cabins.map(value=>{const c=fareObject(value);if(typeof c.capacity!=='number'||!Number.isSafeInteger(c.capacity)||c.capacity<1)throw new Error('Sức chứa cabin của tàu chưa hợp lệ.');return{id:fareUuid(c.cabin_id),name:fareText(c.cabin_number),deck:c.deck_name==null?'Boong chưa đặt tên':fareText(c.deck_name),capacity:c.capacity,status:fareText(c.status),type:c.cabin_type==null?null:fareText(c.cabin_type)}})
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
  const compatibleCabins = (categoryId: string) => {
    const type = data?.categories.find(item => item.id === categoryId)?.cabinType
    return data?.cabins.filter(cabin => type == null || cabin.type === type) ?? []
  }
  const choices = compatibleCabins(category)
  async function confirm(){
    if(!data||!canConfirm||lock.current||uncertain||query.loading||query.error||!rows.length)return
    lock.current=true;setBusy(true);setError('');setSuccess('')
    try{
      const saved=await apiRequestRaw(path(shipId)+'/confirm',v=>decode(v,shipId),{method:'POST',body:{expectedMappingId:data.confirmation?.id??null,expectedStructureFingerprint:data.structureFingerprint,assignments:rows}})
      const actual=await apiRequestRaw(path(shipId),v=>decode(v,shipId))
      if(!saved.confirmation||saved.confirmation.status!=='CURRENT'||actual.confirmation?.id!==saved.confirmation.id||actual.structureFingerprint!==saved.structureFingerprint)throw new Error('Chưa đối chiếu được revision mapping đã xác nhận.')
      setDraft(null);setSelected([]);setCategory('');setSuccess('Đã xác nhận cabin cho các hạng đã chọn.');query.retry()
    }catch(reason){setError(reason instanceof Error?reason.message:'Chưa xác nhận được cabin.');setUncertain(true)}finally{lock.current=false;setBusy(false)}
  }
  return <Panel title="Xác nhận cabin cho gói du thuyền">
    <QueryState loading={query.loading} error={query.error}/>
    {query.error&&<Button onClick={query.retry}>Tải lại danh sách cabin</Button>}
    {data&&<>
      {data.confirmation&&<p>{data.confirmation.status==='CURRENT'?'Xác nhận lúc':'Cấu trúc tàu đã đổi. Lần xác nhận trước'} {new Date(data.confirmation.confirmedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</p>}
      {rows.length>0&&<ul>{rows.map(row=>{const cabinList=row.cabinIds.map(id=>data.cabins.find(cabin=>cabin.id===id)?.name??'Cabin đã thay đổi').filter(Boolean).join(', ');return <li key={row.logicalCategoryId}>
        <strong>{data.categories.find(item=>item.id===row.logicalCategoryId)?.name??'Hạng cabin cần kiểm tra'}</strong>
        {cabinList ? `: ${cabinList}` : ''}
        {canConfirm&&<Button tone="text" disabled={busy||uncertain} onClick={()=>setDraft(rows.filter(item=>item.logicalCategoryId!==row.logicalCategoryId))}>Bỏ nhóm cabin</Button>}
      </li>})}</ul>}
      {!rows.length&&<Empty title="Chưa có cabin được chọn cho gói"/>}
      {canConfirm&&<>
        <Field htmlFor="mapping-category" label="Hạng cabin trong mẫu gói">
          <select id="mapping-category" value={category} disabled={busy||uncertain} onChange={event=>{
            const next = event.target.value
            const allowed = new Set(compatibleCabins(next).map(cabin=>cabin.id))
            setCategory(next)
            setSelected(rows.find(row=>row.logicalCategoryId===next)?.cabinIds.filter(id=>allowed.has(id))??[])
          }}>
            <option value="">Chọn hạng cabin</option>
            {data.categories.map(item=><option key={item.id} value={item.id}>{item.cabinType?item.name:`${item.name} (${item.packageName})`}</option>)}
          </select>
        </Field>
        {category&&<fieldset className={styles.mappingCabins} disabled={busy||uncertain||query.loading}>
          <legend>Cabin trên tàu</legend>
          {choices.length===0&&<p>Không còn cabin thuộc hạng này trên tàu.</p>}
          {choices.map(cabin=>{
            const used=rows.some(row=>row.logicalCategoryId!==category&&row.cabinIds.includes(cabin.id))
            return <label key={cabin.id}>
              <input type="checkbox" checked={selected.includes(cabin.id)} disabled={used} onChange={event=>setSelected(previous=>event.target.checked?[...previous,cabin.id]:previous.filter(id=>id!==cabin.id))}/>
              {cabin.name}, {cabin.deck}, {cabin.capacity} khách{used?' (đã chọn cho hạng khác)':cabin.status==='AVAILABLE'?'':' (cần kiểm tra tình trạng)'}
            </label>
          })}
        </fieldset>}
        {category&&<Button tone="secondary" disabled={!selected.length||busy||uncertain} onClick={()=>{
          setDraft([...rows.filter(row=>row.logicalCategoryId!==category),{logicalCategoryId:category,cabinIds:[...selected]}])
          setCategory('');setSelected([])
        }}>Lưu lựa chọn hạng này</Button>}
        <Button disabled={busy||uncertain||Boolean(category)||query.loading||Boolean(query.error)||(!draft&&data.confirmation?.status!=='STALE')||!rows.length} onClick={()=>void confirm()}>Xác nhận cabin</Button>
      </>}
    </>}
    {error&&<Notice title="Chưa xác nhận được cabin" tone="error">{error}</Notice>}
    {uncertain&&<Notice title="Kiểm tra lại danh sách cabin"><Button disabled={busy} onClick={()=>{
      setDraft(null);setCategory('');setSelected([]);setError('');setUncertain(false);query.retry()
    }}>Tải lại danh sách</Button></Notice>}
    {success&&<Notice title="Đã lưu xác nhận" tone="success">{success}</Notice>}
  </Panel>
}

export function CruisePackageCabinMapping(props:{shipId:string}){return <UnsavedForms><ShipCabinMappingWorkspace {...props}/></UnsavedForms>}

export function CruisePackageMappingEvidence({shipName,mapping}:{shipName?:string|null;mapping:{mappingId:string|null;cabinIds:string[];confirmedAt:string|null;blockers:{code:string;message:string}[]}}){
  const access=useSessionAccess()
  return <section aria-label="Xác nhận cabin">
    <RecordFacts entries={[
      ['Tàu',shipName??'Chưa đọc được tên tàu'],
      ['Xác nhận cabin',mapping.mappingId?(mapping.blockers.length?'Cần kiểm tra lại':'Đã xác nhận'):'Chưa xác nhận'],
      ...(mapping.confirmedAt?[['Xác nhận lúc',new Date(mapping.confirmedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})] as const]:[]),
    ]}/>
    {access.has('CABIN_READ')&&mapping.cabinIds.length>0&&<details>
      <summary>Xem cabin đã xác nhận</summary>
      <ul>{mapping.cabinIds.map((id,index)=><li key={id}><ButtonLink tone="secondary" to={`/admin/cabins/${encodeURIComponent(id)}`}>Xem cabin {index+1}</ButtonLink></li>)}</ul>
    </details>}
  </section>
}


