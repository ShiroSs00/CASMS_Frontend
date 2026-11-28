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
      <Field htmlFor="departure-source-search" label="Tìm theo tên hoặc mã chuyến"><input id="departure-source-search" type="search" value={input} disabled={disabled} onChange={e=>setInput(e.target.value)}/></Field><Button type="submit" tone="secondary" disabled={disabled||query.loading}>Tìm</Button>
    </form>
    {query.loading?<Loading label="Đang tải mẫu lịch trình…"/>:query.error?<Notice title="Chưa tải được lịch trình nguồn" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Tải lại</Button></Notice>:query.data&&<>
      {query.data.content.length > 0 && <ul className={styles.sourceOptions} aria-label="Mẫu lịch trình có thể dùng">
        {query.data.content.map(source => <li key={source.versionId}>
          <div><strong>{source.tripName}</strong><small>{source.tripCode} · {source.durationDays} ngày</small></div>
          {value === source.versionId ? <span>Đang chọn</span> : <Button tone="secondary" size="compact" disabled={disabled} aria-label={`Chọn mẫu ${source.tripName}`} onClick={() => onChange(source.versionId, source.tripName)}>Chọn mẫu này</Button>}
        </li>)}
      </ul>}
      {!query.data.content.length && (
        query.data.totalElements > 0 ? <Empty title="Trang này không còn lịch trình">
          <Button tone="secondary" autoWidth disabled={disabled} onClick={() => setFilter(old => ({...old, page:0}))}>Về trang đầu</Button>
        </Empty> : filter.keyword ? <Empty title="Không có lịch trình khớp từ khóa">
          <Button tone="secondary" autoWidth disabled={disabled} onClick={() => {setInput('');setFilter({keyword:'',page:0})}}>Xóa từ khóa</Button>
        </Empty> : <Empty title="Chưa có mẫu lịch trình">
          <p>Tạo mẫu trong mục Lập lịch trình để dùng khi tạo tour.</p>
          {!disabled && <ButtonLink to="/admin/trips" tone="secondary" autoWidth>Mở Lập lịch trình</ButtonLink>}
        </Empty>
      )}
      {query.data.totalPages>1&&<div style={{display:'flex',gap:12,alignItems:'center',marginTop:'10px'}}><Button tone="secondary" disabled={disabled||filter.page===0} onClick={()=>setFilter(old=>({...old,page:old.page-1}))}>Trang trước</Button><span>Trang {filter.page+1}/{query.data.totalPages}</span><Button tone="secondary" disabled={disabled||filter.page+1>=query.data.totalPages} onClick={()=>setFilter(old=>({...old,page:old.page+1}))}>Trang sau</Button></div>}
    </>}
  </>

  if (!asPanel) {
    return <div className={styles.sourcePickerBody}>{body}</div>
  }

  return <Panel title="Chọn mẫu lịch trình">
    {body}
  </Panel>
}
