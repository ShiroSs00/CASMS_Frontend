import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Notice, PageHeader } from '@/shared/ui'

import { CruiseFilters, CruiseFrame, CruiseListContent } from '../components/CruiseUI'
import { useCruiseList } from '../hooks/useCruiseList'
import styles from '../components/Cruises.module.css'
import { bookingCruiseView } from '../model/cruise-visibility'

export function CruiseListPage() {
  const access = useSessionAccess()
  const booking = bookingCruiseView(access.roles)
  const serviceWorkspace = access.roles.includes('ACTIVITY_SERVICE_MANAGER') &&
    !access.roles.some(role => ['ADMIN', 'CRUISE_MANAGER', 'OPERATIONS_MANAGER'].includes(role)) &&
    access.has('TOUR_PACKAGE_MANAGE')
  const { query, state, ships, shipsError, retryShips, updateQuery, resetQuery, retry } = useCruiseList()
  return <CruiseFrame>
    <div className={styles.content}>
      <PageHeader breadcrumb={serviceWorkspace ? 'Hoạt động và dịch vụ' : booking ? 'Đặt chỗ' : 'Quản lý chuyến'} title={serviceWorkspace ? 'Gói và dịch vụ theo chuyến' : 'Chuyến khởi hành'} description={serviceWorkspace ? 'Chọn chuyến để tạo gói du thuyền hoặc cấu hình dịch vụ mua thêm.' : undefined} actions={access.canDo('CRUISE_CREATE') && <ButtonLink to="/admin/cruises/new">Tạo chuyến khởi hành</ButtonLink>} />
      {(query.sourceTripId||query.sourceVersionId)&&<Notice title="Đang lọc theo lịch trình nguồn">Danh sách chỉ gồm các chuyến khởi hành của nguồn đã chọn.<Button tone="text" onClick={()=>updateQuery({sourceTripId:'',sourceVersionId:''})}>Bỏ lọc nguồn</Button></Notice>}
      <CruiseFilters query={query} ships={ships} onChange={updateQuery} onReset={resetQuery} bookingOnly={booking} />
      {shipsError && <Notice title="Chưa tải được bộ lọc tàu" tone="warning"><p>{shipsError}</p><Button tone="secondary" onClick={retryShips}>Tải lại danh sách tàu</Button></Notice>}
      <div className={styles.listTable}><CruiseListContent state={state} query={query} onPage={(page) => updateQuery({ page })} onReset={resetQuery} onRetry={retry} bookingOnly={booking} /></div>
    </div>
  </CruiseFrame>
}
