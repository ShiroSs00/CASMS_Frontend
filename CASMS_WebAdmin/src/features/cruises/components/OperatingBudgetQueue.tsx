import { useCallback, useState } from 'react'
import { useReadQuery, apiRequest } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Loading, Notice } from '@/shared/ui'
import { preparationApi, formatOperatingBudget } from '../api/preparation-api'
import { OperatingBudget } from './OperatingBudget'
import { OperatingBudgetHistory } from './OperatingBudgetHistory'
import { decodeSubmittedBudgets, type SubmittedBudget } from '../model/operations-queue'
import styles from './Cruises.module.css'

const statuses = { SUBMITTED: 'Chờ xét duyệt', APPROVED: 'Đã duyệt ngân sách', REJECTED: 'Đã trả lại ngân sách' }
export function OperatingBudgetQueue() {
  const access = useSessionAccess()
  const query = useReadQuery(`ops-budget-queue:${access.userId}`, useCallback(async signal => decodeSubmittedBudgets(await apiRequest<unknown>('/cruise-preparation-reviews/operating-budgets', { signal })), []))
  const [status, setStatus] = useState('SUBMITTED'), [search, setSearch] = useState(''), [picked, setSelected] = useState<SubmittedBudget | null>(null)
  const selected = query.data?.find(row => row.cruiseId === picked?.cruiseId) ?? picked
  const selectedId = selected?.cruiseId ?? ''
  const [historyVersion, setHistoryVersion] = useState(0)
  const detail = useReadQuery(`ops-budget:${access.userId}:${selectedId}`, useCallback(signal => selectedId ? preparationApi.operatingBudget(selectedId, signal) : Promise.resolve(null), [selectedId]))
  const rows = query.data?.filter(row => (!status || row.status === status) && `${row.cruiseName} ${row.cruiseCode} ${row.submittedByName ?? ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
  return <section aria-label="Xét duyệt ngân sách vận hành">
    <h2>Ngân sách vận hành</h2>
    <p className={styles.queueConditionText}>Tiếp nhận ngân sách đã được gửi riêng, kể cả khi kế hoạch chuyến chưa nộp.</p>
    {selected && <section className={styles.opsBudgetReview} aria-label={`Ngân sách ${selected.cruiseCode}`}>
      <div className={styles.queueSummaryBar}><h3>{selected.cruiseCode} · {selected.cruiseName}</h3><Button tone="text" onClick={() => setSelected(null)}>Đóng chi tiết ngân sách</Button></div>
      <p>Người nộp: {selected.submittedByName ?? 'Chưa có dữ liệu người nộp'} · Phiên bản xét duyệt {selected.reviewRevision}</p>
      <OperatingBudget key={selectedId} cruiseId={selectedId} budget={detail.data} loading={detail.loading} loadError={detail.error} retry={detail.retry} reviewAllowed={selected.canReview} onSaved={() => { detail.retry(); query.retry(); setHistoryVersion(value => value + 1) }} />
      {detail.data?.status === 'SUBMITTED' && !selected.canReview && <Notice title="Chưa được phép duyệt ngân sách này">Ngân sách chỉ được xét duyệt khi chuyến còn đang chuẩn bị và người xét duyệt khác người nộp.</Notice>}
      <OperatingBudgetHistory key={selectedId} cruiseId={selectedId} refreshKey={historyVersion}/>
    </section>}
    <div className={styles.queueFilterGrid}>
      <Field htmlFor="ops-budget-search" label="Tìm chuyến hoặc người nộp"><input id="ops-budget-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>
      <Field htmlFor="ops-budget-status" label="Tiến độ ngân sách"><select id="ops-budget-status" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả ngân sách đã gửi</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Button tone="secondary" onClick={query.retry}>Tải lại ngân sách</Button>
    </div>
    {query.loading && <Loading label="Đang tải ngân sách đã gửi…" />}
    {query.error && <Notice title="Chưa tải được ngân sách" tone="error"><p>{query.error.message}</p><Button onClick={query.retry}>Thử lại</Button></Notice>}
    {rows && !query.loading && !query.error && (rows.length ? <DataTable label="Ngân sách đã gửi xét duyệt" headers={['Chuyến khởi hành', 'Ngân sách đề xuất', 'Người nộp', 'Tiến độ', 'Quyết định ngân sách']}>
      {rows.map(row => <tr key={row.cruiseId}><th scope="row">{row.cruiseName}<small>{row.cruiseCode}</small></th><td className={styles.opsBudgetAmount}>{row.amountVnd === null ? 'Chưa có số tiền' : formatOperatingBudget(row.amountVnd)}</td><td>{row.submittedByName ?? 'Chưa có dữ liệu'}</td><td>{statuses[row.status]}{row.reason && <small>{row.reason}</small>}</td><td><Button tone={row.canReview ? 'primary' : 'secondary'} size="compact" autoWidth onClick={() => setSelected(row)}>{row.canReview ? 'Xét duyệt ngân sách' : 'Xem ngân sách'}</Button></td></tr>)}
    </DataTable> : <Empty title="Không có ngân sách phù hợp bộ lọc" />)}
  </section>
}
