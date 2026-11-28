import { useCallback } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Loading, Notice } from '@/shared/ui'
import { journeyTime } from '@/shared/lib/journey-time'
import { formatOperatingBudget } from '../api/preparation-api'
import styles from './Cruises.module.css'

type BudgetEvent = { eventId: string; action: string; occurredAt: string; actorName: string | null; reason: string | null; amountVnd: string | null; status: string | null }
const actions: Record<string,string> = { BUDGET_SAVE: 'Lưu dự toán', BUDGET_SUBMIT: 'Gửi xét duyệt', BUDGET_APPROVE: 'Phê duyệt ngân sách', BUDGET_REJECT: 'Trả lại ngân sách' }
export function OperatingBudgetHistory({ cruiseId, refreshKey }: { cruiseId: string; refreshKey: number }) {
  const access=useSessionAccess()
  const query=useReadQuery(`ops-budget-history:${access.userId}:${cruiseId}:${refreshKey}`,useCallback(signal=>apiRequest<BudgetEvent[]>(`/cruise-preparation-reviews/operating-budgets/${encodeURIComponent(cruiseId)}/history`,{signal}),[cruiseId]))
  return <section aria-label="Lịch sử ngân sách vận hành">
    <h4>Lịch sử dự toán và xét duyệt</h4>
    {query.loading&&<Loading label="Đang tải lịch sử ngân sách…"/>}
    {query.error&&<Notice title="Chưa tải được lịch sử ngân sách" tone="error"><p>{query.error.message}</p><Button tone="secondary" onClick={query.retry}>Tải lại lịch sử</Button></Notice>}
    {query.data&&!query.loading&&!query.error&&(query.data.length?<DataTable label="Lịch sử ngân sách" headers={['Thời gian · giờ Việt Nam','Người thực hiện','Thao tác','Số tiền dự toán','Phản hồi']}>
      {query.data.map(event=><tr key={event.eventId}><td>{journeyTime(event.occurredAt)}</td><td>{event.actorName??'Chưa có tên người thực hiện'}</td><td>{actions[event.action]??'Thay đổi ngân sách được ghi nhận'}</td><td className={styles.opsBudgetAmount}>{event.amountVnd==null?'Chưa có số tiền trong bản ghi':formatOperatingBudget(event.amountVnd)}</td><td>{event.reason||'—'}</td></tr>)}
    </DataTable>:<p>Chưa có bản ghi lịch sử ngân sách.</p>)}
  </section>
}
