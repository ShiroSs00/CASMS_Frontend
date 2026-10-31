import { businessCopy } from '@/shared/i18n/business-copy'
import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, DataTable, Empty, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { usePlanning, useSources } from '../hooks'
import { failure } from '../api/live'
import type { TripFilters } from '../api/gateway'
import { tripLabels, versionLabels, type Trip } from '../model/plan'
import { useTripOperation } from '../useTripOperation'
import { OperationRecovery } from '../components/OperationNotice'
import styles from '../Planning.module.css'
import { versionContext, workingVersionLabel } from '../model/version-context'
import {PublishedTemplateDialog} from '../components/PublishedTemplateDialog'
import { supportedDuration } from '../model/duration'

export function TripListPage() {
  const {gateway,root,can}=usePlanning(),navigate=useNavigate(),durations=useSources('durations')
  const [archived,setArchived]=useState(false)
  const [page,setPage]=useState(0),[status,setStatus]=useState(''),[filters,setFilters]=useState<TripFilters>({search:'',durationGroup:'',plannedScope:''}),[searchText,setSearchText]=useState('')
  const [action,setAction]=useState<{kind:'clone'|'archive';trip:Trip}|null>(null),[source,setSource]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
  const [recovery,setRecovery]=useState(false)
  const lock=useRef(false),operation=useTripOperation('clone')
  const list=useReadQuery(`trips:${gateway.mode}:${page}:${archived?'ARCHIVED':status}:${JSON.stringify(filters)}`,useCallback(signal=>gateway.list(page,archived?'ARCHIVED':status,signal,filters),[gateway,page,status,archived,filters]))
  const origin=useReadQuery(`clone-origin:${action?.trip.tripId??''}:${action?.kind??''}`,useCallback(signal=>action?.kind==='clone'?gateway.getTrip(action.trip.tripId,signal):Promise.resolve(null),[gateway,action]))
  const filtered=Boolean(status||filters.search||filters.durationGroup||filters.plannedScope)
  function resetFilters(){setFilters({search:'',durationGroup:'',plannedScope:''});setSearchText('');setStatus('');setPage(0)}
  function openAction(kind:'clone'|'archive',trip:Trip){setAction({kind,trip});setError('');setSource('')}
  async function execute(){
    if(!action||lock.current||gateway.readOnly||!can(action.kind==='clone'?'TRIP_CREATE':'TRIP_DELETE'))return
    if(action.kind==='clone'&&operation.blocked){setRecovery(true);return}
    if(action.kind==='clone'&&(!source||!origin.data?.versions?.some(v=>v.versionId===source&&v.status!=='CANCELLED')))return
    lock.current=true;setBusy(true);setError('')
    try{
      if(action.kind==='clone'){
        const request=operation.begin({tripId:action.trip.tripId,sourceVersionId:source})
        const trip=await gateway.clone(request.payload.tripId,request.payload.sourceVersionId,request.key)
        operation.succeeded(trip.tripId);setAction(null);navigate(`${root}/${trip.tripId}/schedule`)
      }else{
        const result=await gateway.archive(action.trip.tripId,action.trip.revision)
        if(result.status!=='ARCHIVED')throw new Error('Chưa xác nhận được trạng thái lưu trữ. Hãy tải lại danh sách trước khi thao tác tiếp.')
        setAction(null);setMessage('Đã lưu trữ chuyến đi. Các phiên bản và lịch sử vẫn được giữ.');list.retry()
      }
    }catch(e){if(action.kind==='clone')operation.failed(e);setError(failure(e).message)}finally{lock.current=false;setBusy(false)}
  }
  return <>
    {recovery&&<OperationRecovery operation={operation} onClose={()=>{setRecovery(false);setAction(null)}}/>}<header className={styles.heading}>
      <div><h1>Chuyến đi</h1></div>
      {can('TRIP_CREATE')&&!gateway.readOnly&&<Link className={styles.primaryLink} to={`${root}/new`}>+ Tạo chuyến đi</Link>}
    </header>
    {message&&<Notice title="Đã cập nhật" tone="success">{message}</Notice>}
    <Panel className={styles.listPanel}>
      <form className={styles.filters} onSubmit={e=>{e.preventDefault();setFilters(old=>({...old,search:searchText.trim()}));setPage(0)}}>
        <Field htmlFor="trip-search" label="Tìm chuyến đi"><input id="trip-search" placeholder="Nhập mã hoặc tên chuyến" value={searchText} onChange={e=>setSearchText(e.target.value)}/></Field>
        <Field htmlFor="trip-duration-filter" label="Thời lượng"><select id="trip-duration-filter" disabled={durations.loading||Boolean(durations.error)} aria-describedby={durations.error?'trip-filter-notice':undefined} value={filters.durationGroup} onChange={e=>{setFilters(old=>({...old,durationGroup:e.target.value as TripFilters['durationGroup']}));setPage(0)}}><option value="">{durations.loading?'Đang tải…':durations.error?'Chưa tải được':'Tất cả'}</option>{durations.data.filter(item=>supportedDuration(item.id)).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        <Field htmlFor="trip-scope-filter" label="Phạm vi"><select id="trip-scope-filter" value={filters.plannedScope} onChange={e=>{setFilters(old=>({...old,plannedScope:e.target.value as TripFilters['plannedScope']}));setPage(0)}}><option value="">Tất cả</option><option value="DOMESTIC">Trong nước</option><option value="INTERNATIONAL">{businessCopy('source.scope.INTERNATIONAL')}</option></select></Field>
        {!archived&&<Field htmlFor="trip-status" label="Trạng thái lịch trình"><select id="trip-status" value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}><option value="">Tất cả</option>{Object.entries(tripLabels).filter(([value])=>value!=='ARCHIVED').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>}
        <Button type="submit" autoWidth>Tìm kiếm</Button>
      </form>
      {durations.error&&<div id="trip-filter-notice" className={styles.filterNotice} role="status"><span>Chưa tải được bộ lọc thời lượng. Bạn vẫn có thể tìm theo tên, phạm vi và trạng thái.</span><Button type="button" tone="text" size="compact" autoWidth onClick={durations.retry}>Tải lại thời lượng</Button></div>}
      <div className={styles.resultsHead}><h2>{archived?'Chuyến đi đã lưu trữ':'Danh sách chuyến đi'}{list.data&&<span className={styles.resultCount}>{list.data.totalElements}</span>}</h2><Button tone="text" size="compact" onClick={()=>{setArchived(value=>!value);setPage(0);setStatus('')}}>{archived?'Quay lại danh sách làm việc':'Xem chuyến đã lưu trữ'}</Button>{filtered&&<Button tone="text" size="compact" onClick={resetFilters}>Xóa bộ lọc</Button>}</div>
      {list.loading?<Loading label="Đang tải chuyến đi…"/>:list.error?<Notice title="Chưa tải được danh sách" tone="error">{list.error.message}<Button onClick={list.retry}>Thử lại</Button></Notice>:!list.data?.content.length?<Empty title={filtered?'Không tìm thấy chuyến phù hợp':'Chưa có chuyến đi'}><p>{filtered?'Thử đổi từ khóa hoặc xóa bộ lọc.':'Bắt đầu bằng thông tin chuyến; lịch trình sẽ được tổ chức ngay trong chuyến đó.'}</p>{filtered?<Button tone="secondary" onClick={resetFilters}>Xóa bộ lọc</Button>:can('TRIP_CREATE')&&!gateway.readOnly&&<Link className={styles.primaryLink} to={`${root}/new`}>Tạo chuyến đi</Link>}</Empty>:<DataTable label="Danh sách chuyến đi" headers={['Chuyến đi','Thời lượng / phạm vi','Trạng thái chuyến','Phiên bản lịch trình','Thao tác']}>
        {list.data.content.map(trip=><TripListRow key={trip.tripId} trip={trip} onAction={openAction}/>)}
      </DataTable>}
      {list.data&&<div className={styles.pagination}><span>{list.data.totalElements} chuyến · Trang {page+1}/{Math.max(1,list.data.totalPages)}</span><div className={styles.actions}><Button tone="secondary" size="compact" disabled={page===0||list.loading} onClick={()=>setPage(n=>n-1)}>Trang trước</Button><Button tone="secondary" size="compact" disabled={list.loading||page+1>=list.data.totalPages} onClick={()=>setPage(n=>n+1)}>Trang sau</Button></div></div>}
    </Panel>
    {action&&!recovery&&<Modal title={action.kind==='clone'?'Nhân bản chuyến đi':'Lưu trữ chuyến đi?'} busy={busy} onClose={()=>setAction(null)} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setAction(null)}>Hủy</Button><Button tone={action.kind==='archive'?'danger':'primary'} disabled={busy||(action.kind==='clone'&&(!source||origin.loading||Boolean(origin.error)))} onClick={()=>void execute()}>{action.kind==='clone'?'Nhân bản':'Xác nhận lưu trữ'}</Button></>}>
      <p>{action.trip.tripCode} · {action.trip.name}</p>
      {action.kind==='archive'?<p>Chuyến chuyển sang lưu trữ; các phiên bản và lịch sử được giữ lại.</p>:origin.loading?<Loading/>:origin.error?<Notice title="Chưa đọc được phiên bản nguồn" tone="error">{origin.error.message}<Button onClick={origin.retry}>Thử lại</Button></Notice>:<Field htmlFor="clone-source" label="Phiên bản nguồn"><select id="clone-source" value={source} onChange={e=>setSource(e.target.value)}><option value="">Chọn phiên bản thuộc chuyến</option>{origin.data?.versions?.filter(v=>v.status!=='CANCELLED').map(v=><option key={v.versionId} value={v.versionId}>Phiên bản {v.versionNumber} · {versionLabels[v.status]}</option>)}</select></Field>}
      {error&&<Notice title="Chưa thực hiện được" tone="error">{error}{action.kind==='archive'&&<Button tone="secondary" onClick={()=>{setAction(null);list.retry()}}>Đọc lại danh sách chuyến</Button>}</Notice>}
    </Modal>}
  </>
}

function TripListRow({trip,onAction}:{trip:Trip;onAction:(kind:'clone'|'archive',trip:Trip)=>void}){
  const {gateway,root,can}=usePlanning()
  const [preview,setPreview]=useState(false)
  // Only older published trips with a newer working version need the detail endpoint.
  // Read the current server page; never load the entire trip catalog or infer a version number.
  const needsContext=Boolean(trip.structuralLockedAt||trip.status==='READY')&&trip.latestVersionStatus!=='PUBLISHED'&&!trip.versions
  const detail=useReadQuery(`trip-list-context:${gateway.mode}:${trip.tripId}:${trip.revision}`,useCallback(signal=>needsContext?gateway.getTrip(trip.tripId,signal):Promise.resolve(null),[gateway,needsContext,trip.tripId]))
  const versions=versionContext(detail.data?.versions??trip.versions)
  const published=versions.published?.versionNumber??(trip.latestVersionStatus==='PUBLISHED'?trip.latestVersionNumber:undefined)
  const working=versions.working?.versionNumber??(['DRAFT','IN_REVIEW'].includes(trip.latestVersionStatus??'')?trip.latestVersionNumber:undefined)
  const workingStatus=versions.working?.status??trip.latestVersionStatus??''
  return <tr>
    <th scope="row"><Link className={styles.tripName} to={`${root}/${trip.tripId}/schedule`}>{trip.name}</Link><span className={styles.cellMeta}>{trip.tripCode}{trip.updatedAt?` · Cập nhật ${new Date(trip.updatedAt).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}`:''}</span></th>
    <td>{trip.durationDays} ngày<span className={styles.cellMeta}>{trip.info.scope==='DOMESTIC'?'Trong nước':trip.info.scope==='INTERNATIONAL'?businessCopy('source.scope.INTERNATIONAL'):'Chưa xác định phạm vi'}</span></td>
    <td><Badge tone={trip.status==='READY'?'success':'neutral'} label={tripLabels[trip.status]}/></td>
    <td><div className={styles.versionCell}>
      {published!==undefined&&<span className={styles.publishedVersion}>Mẫu đã chốt: V{published}</span>}
      {working!==undefined&&<span>{workingVersionLabel(workingStatus)}: V{working}</span>}
      {detail.loading&&needsContext&&<span className={styles.cellMeta}>Đang tải mẫu đã chốt…</span>}
      {detail.error&&<Button tone="text" size="compact" onClick={detail.retry}>Tải lại thông tin phiên bản</Button>}
      {!published&&!working&&!detail.loading&&!detail.error&&<span className={styles.muted}>Chưa có phiên bản</span>}
    </div></td>
    <td>{preview&&<PublishedTemplateDialog trip={trip} onClose={()=>setPreview(false)}/>}<div className={styles.listRowActions}>
      {trip.latestVersionStatus==='PUBLISHED'?<Button tone="secondary" onClick={()=>setPreview(true)}>Xem lịch trình đã chốt</Button>:<Link className={styles.secondaryLink} to={`${root}/${trip.tripId}/schedule`}>{trip.latestVersionStatus==='DRAFT'?'Mở bản nháp':'Mở lịch trình'}</Link>}
      {published!==undefined&&working!==undefined&&<Button tone="text" size="compact" onClick={()=>setPreview(true)}>Xem lịch trình đã chốt · V{published}</Button>}
      <details className={styles.rowMenu}><summary aria-label={`Thao tác khác cho ${trip.name}`}>Thao tác khác</summary><div><Link to={`${root}/${trip.tripId}/info`}>Thông tin chuyến</Link>{can('TRIP_CREATE')&&!gateway.readOnly&&<Button tone="text" size="compact" onClick={()=>onAction('clone',trip)}>Nhân bản chuyến</Button>}{can('TRIP_DELETE')&&!gateway.readOnly&&trip.status!=='ARCHIVED'&&<Button tone="text" size="compact" onClick={()=>onAction('archive',trip)}>Lưu trữ chuyến</Button>}</div></details>
    </div></td>
  </tr>
}
