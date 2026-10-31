import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Notice, PageHeader } from '@/shared/ui'

import { CruiseFilters, CruiseFrame, CruiseListContent } from '../components/CruiseUI'
import { useCruiseList } from '../hooks/useCruiseList'
import styles from '../components/Cruises.module.css'
import { bookingCruiseView } from '../model/cruise-visibility'

export function CruiseListPage() {
  const access = useSessionAccess()
  const booking = bookingCruiseView(access.roles)
  const { query, state, ships, shipsError, retryShips, updateQuery, resetQuery, retry } = useCruiseList()
  return <CruiseFrame>
    <div className={styles.content}>
      <PageHeader breadcrumb={booking?'Đặt chỗ':'Quản lý chuyến'} title="Chuyến khởi hành" actions={access.canDo('CRUISE_CREATE') && <ButtonLink to="/admin/cruises/new">Tạo chuyến khởi hành</ButtonLink>} />
      {(query.sourceTripId||query.sourceVersionId)&&<Notice title="Đang lọc theo lịch trình nguồn">Danh sách chỉ gồm các chuyến khởi hành của nguồn đã chọn.<Button tone="text" onClick={()=>updateQuery({sourceTripId:'',sourceVersionId:''})}>Bỏ lọc nguồn</Button></Notice>}
      <CruiseFilters query={query} ships={ships} onChange={updateQuery} onReset={resetQuery} bookingOnly={booking} />
      {shipsError && <Notice title="Chưa tải được bộ lọc tàu" tone="warning"><p>{shipsError}</p><Button tone="secondary" onClick={retryShips}>Tải lại danh sách tàu</Button></Notice>}
      <div className={styles.listTable}><CruiseListContent state={state} query={query} onPage={(page) => updateQuery({ page })} onReset={resetQuery} onRetry={retry} bookingOnly={booking} /></div>
    </div>
  </CruiseFrame>
}
