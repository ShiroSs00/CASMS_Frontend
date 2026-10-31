import {useCallback,useState} from 'react'
import {useReadQuery} from '@/shared/api'
import {Button,Field,Loading,Notice,Panel} from '@/shared/ui'
import {eligibleSources} from '../api/source-version'
import {SourceScheduleDialog} from './InheritedSourcePlan'
import styles from './ManagerWorkspace.module.css'

export function DepartureSourcePicker({value,disabled,onChange}:{value:string|null;disabled:boolean;onChange:(id:string,name?:string)=>void}){
  const [preview,setPreview]=useState(false)
  const [input,setInput]=useState(''),[filter,setFilter]=useState({keyword:'',page:0})
  const query=useReadQuery(`eligible-sources:${filter.keyword}:${filter.page}`,useCallback(signal=>eligibleSources(filter.keyword,filter.page,signal),[filter]))
  const selected=query.data?.content.find(item=>item.versionId===value)
  return <Panel title="Chọn lịch trình đã chốt" >
    <form className={styles.sourceSearch} onSubmit={event=>{event.preventDefault();setFilter({keyword:input,page:0})}}>
      <Field htmlFor="departure-source-search" label="Tìm theo tên hoặc mã chuyến"><input id="departure-source-search" type="search" value={input} disabled={disabled} onChange={e=>setInput(e.target.value)}/></Field><Button type="submit" tone="secondary" disabled={disabled||query.loading}>Tìm lịch trình</Button>
    </form>
    {query.loading?<Loading label="Đang tải lịch trình đã chốt…"/>:query.error?<Notice title="Chưa tải được lịch trình nguồn" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Tải lại</Button></Notice>:query.data&&<>
      <Field htmlFor="departure-source" label="Lịch trình mẫu *"><select id="departure-source" value={value??''} disabled={disabled} onChange={e=>onChange(e.target.value,query.data?.content.find(v=>v.versionId===e.target.value)?.tripName)}><option value="">Chọn chuyến đi và lịch trình đã chốt</option>{value&&!query.data.content.some(v=>v.versionId===value)&&<option value={value}>Phiên bản đang chọn · xem thông tin bên dưới</option>}{query.data.content.map(v=><option key={v.versionId} value={v.versionId}>{v.tripCode} · {v.tripName} · Phiên bản {v.versionNumber} · {v.durationDays} ngày</option>)}</select></Field>
      {!query.data.content.length&&<p>{filter.keyword?'Không có lịch trình khớp từ khóa.':'Chưa có phiên bản lịch trình được phép sử dụng. Chốt một lịch trình trong mục Chuyến đi trước khi tạo chuyến khởi hành.'}</p>}
      {selected&&<Button tone="secondary" disabled={disabled} onClick={()=>setPreview(true)}>Xem lịch trình đã chốt</Button>}
      {preview&&value&&<SourceScheduleDialog versionId={value} onClose={()=>setPreview(false)}/>}
      {query.data.totalPages>1&&<div style={{display:'flex',gap:12,alignItems:'center'}}><Button tone="secondary" disabled={disabled||filter.page===0} onClick={()=>setFilter(old=>({...old,page:old.page-1}))}>Trang trước</Button><span>Trang {filter.page+1}/{query.data.totalPages}</span><Button tone="secondary" disabled={disabled||filter.page+1>=query.data.totalPages} onClick={()=>setFilter(old=>({...old,page:old.page+1}))}>Trang sau</Button></div>}
    </>}
  </Panel>
}
