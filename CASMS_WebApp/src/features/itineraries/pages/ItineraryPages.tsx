import { useCallback, useState } from 'react'
import { Link } from 'react-router'

import { useReadQuery } from '@/shared/api'
import { Button, ButtonLink, DataTable, Empty, Loading, Notice, PageHeader, Panel } from '@/shared/ui'

import { itineraryApi } from '../api/itinerary-api'
import { ItineraryFrame, ItineraryStatusBadge } from '../components/ItineraryUI'
import styles from '../components/Itineraries.module.css'

export function ItineraryListPage() {
  const [page, setPage] = useState(1)
  const load = useCallback((signal: AbortSignal) => itineraryApi.list(page, signal), [page])
  const { data, error, loading, retry } = useReadQuery(`itineraries:${page}`, load)
  const cruises = useReadQuery('itinerary-cruise-names', itineraryApi.listCruises)
  const cruisesById = new Map(cruises.data?.map(cruise => [cruise.cruiseId, cruise]))

  return <ItineraryFrame>
    <PageHeader breadcrumb="VẬN HÀNH / LỊCH TRÌNH" title="Lịch trình hải trình" description="Thiết kế ngày đi biển, điểm dừng và luồng phê duyệt cho từng cruise." actions={<><ButtonLink tone="secondary" to="/admin/itinerary-history">Nhật ký điều chỉnh</ButtonLink><ButtonLink to="/admin/itineraries/new">Tạo lịch trình</ButtonLink></>} />
    <Panel title="Danh sách lịch trình" subtitle="Mỗi chuyến du lịch có một lịch trình riêng.">
      {loading && <Loading label="Đang tải lịch trình…" />}
      {error && <Notice title="Không tải được dữ liệu" tone="error"><p>{error.message}</p><Button onClick={retry}>Thử lại</Button></Notice>}
      {cruises.error && <Notice title="Chưa tải được tên chuyến du lịch" tone="warning"><p>{cruises.error.message} Bạn vẫn có thể mở lịch trình hoặc chuyến tương ứng.</p><Button tone="secondary" onClick={cruises.retry}>Tải lại tên chuyến</Button></Notice>}
      {!loading && data && !data.items.length && <Empty title="Chưa có lịch trình" />}
      {!loading && data?.items.length ? <><DataTable label="Danh sách lịch trình" headers={['Lịch trình', 'Cruise', 'Khoảng ngày', 'Loại', 'Trạng thái', '']}>
        {data.items.map((item) => {
          const cruise = cruisesById.get(item.cruiseId)
          return <tr key={item.itineraryId}><td><strong>{item.itineraryName}</strong></td><td><Link className={styles.link} to={`/admin/cruises/${encodeURIComponent(item.cruiseId)}`}>{cruise ? `${cruise.cruiseName} · ${cruise.cruiseCode}` : cruises.loading ? 'Đang tải tên chuyến…' : 'Xem chuyến du lịch'}</Link></td><td>{item.startDate} → {item.endDate}</td><td>{item.itineraryType === 'ROUND_TRIP' ? 'Khứ hồi' : 'Một chiều'}</td><td><ItineraryStatusBadge status={item.status} /></td><td><Link className={styles.link} to={`/admin/itineraries/${item.itineraryId}`}>Mở →</Link></td></tr>
        })}
      </DataTable><div className={styles.pager}><span>{data.total} lịch trình</span><div><Button tone="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trước</Button> <Button tone="secondary" disabled={page >= data.pageCount} onClick={() => setPage((value) => value + 1)}>Sau</Button></div></div></> : null}
    </Panel>
  </ItineraryFrame>
}

export { ItineraryFormPage } from './ItineraryFormPage'
export { ItineraryDetailPage } from './ItineraryDetailPage'
