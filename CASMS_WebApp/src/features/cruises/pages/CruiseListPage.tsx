import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Notice, PageHeader } from '@/shared/ui'

import { CruiseFilters, CruiseFrame, CruiseListContent, CruiseMetrics } from '../components/CruiseUI'
import { useCruiseList } from '../hooks/useCruiseList'
import styles from '../components/Cruises.module.css'
import { bookingCruiseView } from '../model/cruise-visibility'

export function CruiseListPage() {
  const access = useSessionAccess()
  const booking = bookingCruiseView(access.roles)
  const { query, state, ships, shipsError, retryShips, updateQuery, resetQuery, retry } = useCruiseList()
  return <CruiseFrame>
    <div className={styles.content}>
      <PageHeader breadcrumb={booking?'ĐẶT CHỖ':'VẬN HÀNH'} title="Lần khởi hành" description={booking?'Chọn lần khởi hành đang mở bán để tư vấn và đặt chỗ.':'Ngày khởi hành, tàu và công việc chuẩn bị cho từng lần tổ chức.'} actions={access.canDo('CRUISE_CREATE') && <ButtonLink to="/admin/cruises/new">Tạo lần khởi hành</ButtonLink>} />
      {booking ? <Notice title="Lần khởi hành đang mở bán">Chỉ hiển thị các lần khởi hành đang mở bán theo kiểm tra của hệ thống.</Notice> : <Notice title="Từ lịch mẫu đến lần khởi hành">Chọn phiên bản lịch mẫu đã phát hành để tạo lần khởi hành nháp. Có thể xem hồ sơ và chuẩn bị các phần việc trước khi phân công tàu. Phát hành lần khởi hành chưa đồng nghĩa mở bán.</Notice>}
      {(query.sourceTripId||query.sourceVersionId)&&<Notice title="Đang lọc theo lịch trình nguồn">Danh sách chỉ gồm các lần khởi hành của nguồn đã chọn.<Button tone="text" onClick={()=>updateQuery({sourceTripId:'',sourceVersionId:''})}>Bỏ lọc nguồn</Button></Notice>}
      {!booking && <CruiseMetrics result={state.status === 'ready' ? state.data : null} />}
      <CruiseFilters query={query} ships={ships} onChange={updateQuery} onReset={resetQuery} bookingOnly={booking} />
      {shipsError && <Notice title="Chưa tải được bộ lọc tàu" tone="warning"><p>{shipsError}</p><Button tone="secondary" onClick={retryShips}>Tải lại danh sách tàu</Button></Notice>}
      <p className={styles.muted}>{booking?'Trạng thái mở bán được kiểm tra lại khi đặt chỗ.':'Thống kê trên trang hiện tại; bộ lọc trạng thái, loại và tàu được xử lý tại hệ thống.'}</p>
      <div className={styles.listTable}><CruiseListContent state={state} query={query} onPage={(page) => updateQuery({ page })} onReset={resetQuery} onRetry={retry} bookingOnly={booking} /></div>
    </div>
  </CruiseFrame>
}
