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
      <PageHeader breadcrumb="VẬN HÀNH" title="Lần khởi hành" description="Ngày khởi hành, tàu và công việc chuẩn bị cho từng lần tổ chức." actions={access.canDo('CRUISE_CREATE') && <ButtonLink to="/admin/cruises/new">Tạo lần khởi hành</ButtonLink>} />
      <CruiseMetrics result={state.status === 'ready' ? state.data : null} />
      <CruiseFilters query={query} ships={ships} onChange={updateQuery} onReset={resetQuery} />
      {shipsError && <Notice title="Chưa tải được bộ lọc tàu" tone="warning"><p>{shipsError}</p><Button tone="secondary" onClick={retryShips}>Tải lại danh sách tàu</Button></Notice>}
      <p className={styles.muted}>Thống kê trên trang hiện tại; bộ lọc trạng thái, loại và tàu được xử lý tại hệ thống.</p>
      <div className={styles.listTable}><CruiseListContent state={state} query={query} onPage={(page) => updateQuery({ page })} onReset={resetQuery} onRetry={retry} /></div>
    </div>
  </CruiseFrame>
}
