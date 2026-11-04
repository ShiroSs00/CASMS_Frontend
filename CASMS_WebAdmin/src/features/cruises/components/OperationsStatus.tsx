import { usePlanQuery } from '../hooks/usePlanQuery'
import { operationsPlanLabel } from '../model/operations-workflow'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { useCallback } from 'react'
import { departureApi } from '../api/departure-api'
import { Button } from '@/shared/ui'
import styles from './DeparturePreparation.module.css'
export function OperationsStatus({ id, refreshKey }: { id: string; refreshKey: number }) {
  const access = useSessionAccess()
  const plan = usePlanQuery(id, String(refreshKey), access.has('CRUISE_READ'))
  const sale = useReadQuery(`ops-public-state:${access.userId}:${id}:${refreshKey}`, useCallback(signal => departureApi.publicSellability(id, signal), [id]))
  return <section aria-label="Trạng thái xử lý chuyến" className={styles.operationsStatus}>
    <div><span>Hồ sơ</span><strong>{plan.loading ? 'Đang tải…' : plan.error || !plan.data ? 'Chưa đọc được' : operationsPlanLabel(plan.data)}</strong></div>
    <div><span>Sẵn sàng vận hành</span><strong>{plan.loading ? 'Đang tải…' : plan.error || !plan.data ? 'Chưa đọc được' : plan.data.readyStatus === 'READY' ? 'Đã xác nhận' : plan.data.readyStatus === 'INVALIDATED' ? 'Cần xác nhận lại' : 'Chưa xác nhận'}</strong></div>
    <div><span>Hiển thị công khai</span><strong>{sale.loading ? 'Đang tải…' : sale.error || !sale.data ? 'Chưa đọc được' : sale.data.publicDisplayEligible === true ? 'Đủ điều kiện hiển thị' : sale.data.publicDisplayEligible === false ? 'Chưa đủ điều kiện hiển thị' : 'Chưa xác định từ Backend'}</strong></div>
    {(plan.error || sale.error) && <Button tone="text" onClick={() => { plan.retry(); sale.retry() }}>Tải lại trạng thái</Button>}
  </section>
}
