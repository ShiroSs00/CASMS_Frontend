import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Notice, PageHeader } from '@/shared/ui'

import { CruiseFilters, CruiseFrame, CruiseListContent, CruiseMetrics } from '../components/CruiseUI'
import { useCruiseList } from '../hooks/useCruiseList'
import styles from '../components/Cruises.module.css'

export function CruiseListPage() {
  const access = useSessionAccess()
  const { query, state, ships, shipsError, retryShips, updateQuery, resetQuery, retry } = useCruiseList()
  return <CruiseFrame>
    <div className={styles.content}>
      <PageHeader breadcrumb="VẬN HÀNH / CHUYẾN" title="Chuyến đi" description="Quản lý chuyến, lịch chạy, tàu được phân công và trạng thái sẵn sàng vận hành." actions={access.canDo('CRUISE_CREATE') && <ButtonLink to="/admin/cruises/new">Tạo chuyến</ButtonLink>} />
      <CruiseMetrics result={state.status === 'ready' ? state.data : null} />
      <CruiseFilters query={query} ships={ships} onChange={updateQuery} onReset={resetQuery} />
      {shipsError && <Notice title="Chưa tải được bộ lọc tàu" tone="warning"><p>{shipsError}</p><Button tone="secondary" onClick={retryShips}>Tải lại danh sách tàu</Button></Notice>}
      <p className={styles.muted}>Tìm theo tên và lọc ngày chưa khả dụng. Thống kê tính trên trang hiện tại.</p>
      <div className={styles.listTable}><CruiseListContent state={state} query={query} onPage={(page) => updateQuery({ page })} onReset={resetQuery} onRetry={retry} /></div>
    </div>
  </CruiseFrame>
}
