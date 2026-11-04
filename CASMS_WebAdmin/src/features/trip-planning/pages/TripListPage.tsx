import { businessCopy } from '@/shared/i18n/business-copy'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, DataTable, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
import { usePlanning, useSources } from '../hooks'
import type { TripFilters } from '../api/gateway'
import { tripLabels, type Trip } from '../model/plan'
import styles from '../Planning.module.css'
import { versionContext, workingVersionLabel } from '../model/version-context'
import {PublishedTemplateDialog} from '../components/PublishedTemplateDialog'
import { supportedDuration } from '../model/duration'

export function TripListPage() {
  const {gateway,root,can}=usePlanning(),durations=useSources('durations')
  const [page,setPage]=useState(0),[status,setStatus]=useState(''),[filters,setFilters]=useState<TripFilters>({search:'',durationGroup:'',plannedScope:''}),[searchText,setSearchText]=useState('')
  const list=useReadQuery(`trips:${gateway.mode}:${page}:${status}:${JSON.stringify(filters)}`,useCallback(signal=>gateway.list(page,status,signal,filters),[gateway,page,status,filters]))
  const filtered=Boolean(status||filters.search||filters.durationGroup||filters.plannedScope)
  function resetFilters(){setFilters({search:'',durationGroup:'',plannedScope:''});setSearchText('');setStatus('');setPage(0)}
  return <>
    <header className={styles.heading}>
      <div><h1>Chuyến đi</h1></div>
      {can('TRIP_CREATE')&&!gateway.readOnly&&<Link className={styles.primaryLink} to={`${root}/new`}>+ Tạo chuyến đi</Link>}
    </header>
    <Panel className={styles.listPanel}>
      <form className={styles.filters} onSubmit={e=>{e.preventDefault();setFilters(old=>({...old,search:searchText.trim()}));setPage(0)}}>
        <Field htmlFor="trip-search" label="Tìm chuyến đi"><input id="trip-search" placeholder="Nhập mã hoặc tên chuyến" value={searchText} onChange={e=>setSearchText(e.target.value)}/></Field>
        <Field htmlFor="trip-duration-filter" label="Thời lượng"><select id="trip-duration-filter" disabled={durations.loading||Boolean(durations.error)} aria-describedby={durations.error?'trip-filter-notice':undefined} value={filters.durationGroup} onChange={e=>{setFilters(old=>({...old,durationGroup:e.target.value as TripFilters['durationGroup']}));setPage(0)}}><option value="">{durations.loading?'Đang tải…':durations.error?'Chưa tải được':'Tất cả'}</option>{durations.data.filter(item=>supportedDuration(item.id)).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        <Field htmlFor="trip-scope-filter" label="Phạm vi"><select id="trip-scope-filter" value={filters.plannedScope} onChange={e=>{setFilters(old=>({...old,plannedScope:e.target.value as TripFilters['plannedScope']}));setPage(0)}}><option value="">Tất cả</option><option value="DOMESTIC">Trong nước</option><option value="INTERNATIONAL">{businessCopy('source.scope.INTERNATIONAL')}</option></select></Field>
        {<Field htmlFor="trip-status" label="Trạng thái lịch trình"><select id="trip-status" value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}><option value="">Tất cả</option>{Object.entries(tripLabels).filter(([value])=>value!=='ARCHIVED').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>}
        <Button type="submit" autoWidth>Tìm kiếm</Button>
      </form>
      {durations.error&&<div id="trip-filter-notice" className={styles.filterNotice} role="status"><span>Chưa tải được bộ lọc thời lượng. Bạn vẫn có thể tìm theo tên, phạm vi và trạng thái.</span><Button type="button" tone="text" size="compact" autoWidth onClick={durations.retry}>Tải lại thời lượng</Button></div>}
      <div className={styles.resultsHead}><h2>Danh sách chuyến đi{list.data&&<span className={styles.resultCount}>{list.data.totalElements}</span>}</h2>{filtered&&<Button tone="text" size="compact" onClick={resetFilters}>Xóa bộ lọc</Button>}</div>
      {list.loading?<Loading label="Đang tải chuyến đi…"/>:list.error?<Notice title="Chưa tải được danh sách" tone="error">{list.error.message}<Button onClick={list.retry}>Thử lại</Button></Notice>:!list.data?.content.length?<Empty title={filtered?'Không tìm thấy chuyến phù hợp':'Chưa có chuyến đi'}><p>{filtered?'Thử đổi từ khóa hoặc xóa bộ lọc.':'Bắt đầu bằng thông tin chuyến; lịch trình sẽ được tổ chức ngay trong chuyến đó.'}</p>{filtered?<Button tone="secondary" onClick={resetFilters}>Xóa bộ lọc</Button>:can('TRIP_CREATE')&&!gateway.readOnly&&<Link className={styles.primaryLink} to={`${root}/new`}>Tạo chuyến đi</Link>}</Empty>:<DataTable label="Danh sách chuyến đi" headers={['Chuyến đi','Thời lượng / phạm vi','Trạng thái chuyến','Phiên bản lịch trình','Thao tác']}>
        {list.data.content.map(trip=><TripListRow key={trip.tripId} trip={trip}/>)}
      </DataTable>}
      {list.data&&<div className={styles.pagination}><span>{list.data.totalElements} chuyến · Trang {page+1}/{Math.max(1,list.data.totalPages)}</span><div className={styles.actions}><Button tone="secondary" size="compact" disabled={page===0||list.loading} onClick={()=>setPage(n=>n-1)}>Trang trước</Button><Button tone="secondary" size="compact" disabled={list.loading||page+1>=list.data.totalPages} onClick={()=>setPage(n=>n+1)}>Trang sau</Button></div></div>}
    </Panel>

  </>
}

function TripListRow({trip}:{trip:Trip}){
  const {gateway,root}=usePlanning()
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
      {published!==undefined&&<span className={styles.publishedVersion}>Phiên bản lịch trình nguồn: V{published}</span>}
      {working!==undefined&&<span>{workingVersionLabel(workingStatus)}: V{working}</span>}
      {detail.loading&&needsContext&&<span className={styles.cellMeta}>Đang tải mẫu đã chốt…</span>}
      {detail.error&&<Button tone="text" size="compact" onClick={detail.retry}>Tải lại thông tin phiên bản</Button>}
      {!published&&!working&&!detail.loading&&!detail.error&&<span className={styles.muted}>Chưa có phiên bản</span>}
    </div></td>
    <td>{preview&&<PublishedTemplateDialog trip={trip} onClose={()=>setPreview(false)}/>}<div className={styles.listRowActions}>
      {trip.latestVersionStatus==='PUBLISHED'?<Button tone="secondary" onClick={()=>setPreview(true)}>Xem lịch trình đã chốt</Button>:<Link className={styles.secondaryLink} to={`${root}/${trip.tripId}/schedule`}>{trip.latestVersionStatus==='DRAFT'?'Mở bản nháp':'Mở lịch trình'}</Link>}
      {published!==undefined&&working!==undefined&&<Button tone="text" size="compact" onClick={()=>setPreview(true)}>Xem lịch trình đã chốt · V{published}</Button>}
    </div></td>
  </tr>
}

