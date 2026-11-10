import {useCallback,useState} from 'react'
import {useReadQuery} from '@/shared/api'
import {Button,ButtonLink,Empty,Field,Loading,Notice,Panel} from '@/shared/ui'
import {eligibleSources} from '../api/source-version'
import styles from './ManagerWorkspace.module.css'

export function DepartureSourcePicker({
  value,
  disabled,
  onChange,
  asPanel = true
}:{
  value:string|null;
  disabled:boolean;
  onChange:(id:string,name?:string)=>void;
  hidePreviewButton?:boolean;
  asPanel?:boolean;
}){
  const [input,setInput]=useState(''),[filter,setFilter]=useState({keyword:'',page:0})
  const query=useReadQuery(`eligible-sources:${filter.keyword}:${filter.page}`,useCallback(signal=>eligibleSources(filter.keyword,filter.page,signal),[filter]))

  const body = <>
    <form className={styles.sourceSearch} onSubmit={event=>{event.preventDefault();setFilter({keyword:input.trim(),page:0})}}>
      <Field htmlFor="departure-source-search" label="Tìm theo tên hoặc mã chuyến"><input id="departure-source-search" type="search" value={input} disabled={disabled} onChange={e=>setInput(e.target.value)}/></Field><Button type="submit" tone="secondary" disabled={disabled||query.loading}>Tìm lịch trình</Button>
    </form>
    {query.loading?<Loading label="Đang tải lịch trình đã chốt…"/>:query.error?<Notice title="Chưa tải được lịch trình nguồn" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Tải lại</Button></Notice>:query.data&&<>
      {(query.data.content.length > 0 || value) && <Field htmlFor="departure-source" label="Lịch trình mẫu *"><select id="departure-source" value={value??''} disabled={disabled} onChange={e=>onChange(e.target.value,query.data?.content.find(v=>v.versionId===e.target.value)?.tripName)}><option value="">Chọn chuyến đi và lịch trình đã chốt</option>{value&&!query.data.content.some(v=>v.versionId===value)&&<option value={value}>Phiên bản đang chọn · xem thông tin bên dưới</option>}{query.data.content.map(v=><option key={v.versionId} value={v.versionId}>{v.tripCode} · {v.tripName} · Phiên bản {v.versionNumber} · {v.durationDays} ngày</option>)}</select></Field>}
      {!query.data.content.length && (
        query.data.totalElements > 0 ? <Empty title="Trang này không còn lịch trình">
          <Button tone="secondary" autoWidth disabled={disabled} onClick={() => setFilter(old => ({...old, page:0}))}>Về trang đầu</Button>
        </Empty> : filter.keyword ? <Empty title="Không có lịch trình khớp từ khóa">
          <Button tone="secondary" autoWidth disabled={disabled} onClick={() => {setInput('');setFilter({keyword:'',page:0})}}>Xóa từ khóa</Button>
        </Empty> : <Empty title="Chưa có lịch trình đã chốt">
          <p>Chốt lịch trình trong mục Chuyến đi để dùng làm nguồn mở chuyến khởi hành.</p>
          {!disabled && <ButtonLink to="/admin/trips" tone="secondary" autoWidth>Mở mục Chuyến đi</ButtonLink>}
        </Empty>
      )}
      {query.data.totalPages>1&&<div style={{display:'flex',gap:12,alignItems:'center',marginTop:'10px'}}><Button tone="secondary" disabled={disabled||filter.page===0} onClick={()=>setFilter(old=>({...old,page:old.page-1}))}>Trang trước</Button><span>Trang {filter.page+1}/{query.data.totalPages}</span><Button tone="secondary" disabled={disabled||filter.page+1>=query.data.totalPages} onClick={()=>setFilter(old=>({...old,page:old.page+1}))}>Trang sau</Button></div>}
    </>}
  </>

  if (!asPanel) {
    return <div className={styles.sourcePickerBody}>{body}</div>
  }

  return <Panel title="Chọn lịch trình đã chốt">
    {body}
  </Panel>
}
