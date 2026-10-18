import { ButtonLink, PageHeader } from '@/shared/ui'

import { CruiseFilters, CruiseFrame, CruiseListContent, CruiseMetrics } from '../components/CruiseUI'
import { useCruiseList } from '../hooks/useCruiseList'
import styles from '../components/Cruises.module.css'

export function CruiseListPage() {
  const { query, state, ships, updateQuery, resetQuery, retry } = useCruiseList()
  return <CruiseFrame>
    <div className={styles.content}>
      <PageHeader breadcrumb="VẬN HÀNH / CHUYẾN" title="Chuyến du thuyền" description="Quản lý chuyến, lịch chạy, tàu được phân công và trạng thái sẵn sàng vận hành." actions={<ButtonLink to="/admin/cruises/new">Tạo chuyến</ButtonLink>} />
      <CruiseMetrics result={state.status === 'ready' ? state.data : null} />
      <CruiseFilters query={query} ships={ships} onChange={updateQuery} onReset={resetQuery} />
      <p className={styles.muted}>Tìm theo tên và lọc ngày chưa khả dụng. Thống kê tính trên trang hiện tại.</p>
      <div className={styles.listTable}><CruiseListContent state={state} query={query} onPage={(page) => updateQuery({ page })} onReset={resetQuery} onRetry={retry} /></div>
    </div>
  </CruiseFrame>
}
