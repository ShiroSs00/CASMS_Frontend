import { Link } from 'react-router'

import { AdminFrame, ButtonLink, Notice, PageHeader, Panel } from '@/shared/ui'

import { CruiseFilters, CruiseListContent, CruiseMetrics, CruiseTopbar } from '../components/CruiseUI'
import { useCruiseList } from '../hooks/useCruiseList'
import styles from '../components/Cruises.module.css'

export function CruiseListPage() {
  const { query, state, ships, updateQuery, resetQuery, retry } = useCruiseList()
  return <AdminFrame className={styles.cruiseShell} topbar={<CruiseTopbar />}>
    <div className={styles.content}>
      <PageHeader breadcrumb="VẬN HÀNH / CRUISE" title="Cruise & hải trình" description="Quản lý chuyến, lịch chạy, tàu được phân công và trạng thái sẵn sàng vận hành." actions={<ButtonLink to="/admin/cruises/new">Tạo cruise</ButtonLink>} />
      {state.status === 'ready' && <CruiseMetrics result={state.data} />}
      <Panel title="Tìm và lọc cruise"><CruiseFilters query={query} ships={ships} onChange={updateQuery} onReset={resetQuery} /></Panel>
      <Panel title="Danh sách cruise"><CruiseListContent state={state} query={query} onPage={(page) => updateQuery({ page })} onReset={resetQuery} onRetry={retry} /></Panel>
      <Notice title="Cruise state ≠ itinerary state"><p>UI hiển thị đúng domain backend chốt; không dùng một status duy nhất để suy ra cruise, itinerary, sale và operations.</p></Notice>
      <p className={styles.hiddenHelp}>Quản lý quy định theo cruise tại <Link to="/admin/regulations">Quy định vận hành</Link>.</p>
    </div>
  </AdminFrame>
}
