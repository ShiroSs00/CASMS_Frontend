import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Button, DataTable, Empty, Loading, Notice, Panel } from '@/shared/ui'
import { usePlanning } from '../hooks'
import styles from '../Planning.module.css'

export function TripReviewPage(){
  const {gateway,root,can}=usePlanning(),[page,setPage]=useState(0)
  const allowed=can('TRIP_PLAN_REVIEW')
  const query=useReadQuery(`trip-review:${page}:${allowed}`,useCallback(signal=>allowed&&gateway.reviewQueue?gateway.reviewQueue(page,signal):Promise.resolve(null),[allowed,gateway,page]))
  if(!allowed)return <Notice title="Không có quyền duyệt lịch trình"><Link to={root}>Về danh sách chuyến</Link></Notice>
  return <>
    <header className={styles.heading}><div><span className={styles.eyebrow}>DUYỆT LỊCH TRÌNH</span><h1>Lịch trình chờ duyệt</h1><p className={styles.muted}>Mở đúng phiên bản đã gửi để xem nội dung, trả lại chỉnh sửa hoặc phát hành.</p></div><Link to={root}>Danh sách chuyến đi</Link></header>
    <Panel>{!gateway.reviewQueue?<Notice title="Chế độ này chưa có hàng đợi duyệt">Mở phân hệ kết nối API để xem các phiên bản đã gửi.</Notice>:query.loading?<Loading label="Đang tải các phiên bản chờ duyệt…"/>:query.error?<Notice title="Chưa tải được hàng đợi" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>:!query.data?.content.length?<Empty title="Không có lịch trình chờ duyệt"/>:<DataTable label="Phiên bản chờ duyệt" headers={['Chuyến đi','Phiên bản','Người gửi','Thời điểm gửi','Thao tác']}>
      {query.data.content.map(row=><tr key={row.versionId}><th scope="row">{row.tripName}<span className={styles.cellMeta}>{row.tripCode}</span></th><td>Phiên bản {row.versionNumber}</td><td>{row.submitterName||'Chưa có thông tin'}</td><td>{row.submittedAt?new Date(row.submittedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa có thông tin'}</td><td><Link className={styles.secondaryLink} to={`${root}/${row.tripId}/schedule?versionId=${encodeURIComponent(row.versionId)}`}>Xem và duyệt</Link></td></tr>)}
    </DataTable>}{query.data&&<div className={styles.pagination}><span>{query.data.totalElements} phiên bản · Trang {page+1}/{Math.max(1,query.data.totalPages)}</span><div className={styles.actions}><Button tone="secondary" disabled={!page||query.loading} onClick={()=>setPage(n=>n-1)}>Trang trước</Button><Button tone="secondary" disabled={query.loading||page+1>=query.data.totalPages} onClick={()=>setPage(n=>n+1)}>Trang sau</Button></div></div>}</Panel>
  </>
}
