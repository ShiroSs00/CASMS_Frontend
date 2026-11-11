import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { domainStatus } from '@/shared/i18n/business-copy'
import { journeyTime } from '@/shared/lib/journey-time'
import { Button, ButtonLink, DataTable, Empty, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { mainflowApi } from '../api/mainflow-api'
import { saleTermsApi, type SaleTermsSetup } from '../api/sale-terms'
import { CruiseFrame } from '../components/CruiseUI'
import { DepartureSaleTerms } from '../components/DepartureSaleTerms'
import styles from '../components/Cruises.module.css'

export function CruisePlanQueuePage() {
  const access = useSessionAccess()
  const allowed = access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_READ')
  const canSetFees = allowed && access.has('CRUISE_PRICING_APPROVE')
  const query = useReadQuery(`received-plans:${access.userId}:${allowed}`,
    useCallback(signal => allowed ? mainflowApi.queue(signal, true) : Promise.resolve(null), [allowed]))
  const requests = useReadQuery(`sale-terms-requests:${access.userId}:${canSetFees}`,
    useCallback(signal => canSetFees ? saleTermsApi.setupRequests(signal) : Promise.resolve(null), [canSetFees]))
  const [selected, setSelected] = useState<SaleTermsSetup | null>(null)
  const [saved, setSaved] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const rows = query.data?.filter(plan => reviewed ? plan.planStatus !== 'SUBMITTED' : plan.planStatus === 'SUBMITTED') ?? []

  return <CruiseFrame><div className={styles.content}>
    <PageHeader breadcrumb="Vận hành" title="Hồ sơ chuyến khởi hành" />
    {!allowed ? <Notice title="Bạn không có quyền xem hồ sơ">{null}</Notice> : <>
      {saved && <Notice tone="success" title={`Đã lưu thuế và phí cảng cho ${saved}`}>{null}</Notice>}
      {canSetFees && (requests.loading || requests.error || Boolean(requests.data?.length)) &&
        <Panel title="Yêu cầu cấu hình thuế và phí cảng">
          {requests.loading && <Loading label="Đang tải yêu cầu…" />}
          {requests.error && <Notice tone="error" title="Chưa tải được yêu cầu">
            <Button tone="secondary" onClick={requests.retry}>Thử lại</Button>
          </Notice>}
          {Boolean(requests.data?.length) && <DataTable label="Yêu cầu cấu hình thuế và phí cảng" headers={['Chuyến khởi hành', 'Cảng đi và cảng về', 'Thao tác']}>
            {requests.data?.map(item => <tr key={item.cruiseId}>
              <td><strong>{item.cruiseName}</strong><br />{item.cruiseCode}</td>
              <td>{item.departurePort} · {item.returnPort}</td>
              <td><Button tone="secondary" autoWidth onClick={() => setSelected(item)}>Cấu hình thuế và phí</Button></td>
            </tr>)}
          </DataTable>}
        </Panel>}
      <Panel title="Hồ sơ đã tiếp nhận">
        <div className={styles.lifecycleActions} role="group" aria-label="Lọc theo tiến độ xét duyệt">
          <Button autoWidth tone={reviewed ? 'secondary' : 'primary'} aria-pressed={!reviewed} onClick={() => setReviewed(false)}>Chờ xét duyệt</Button>
          <Button autoWidth tone={reviewed ? 'primary' : 'secondary'} aria-pressed={reviewed} onClick={() => setReviewed(true)}>Đã xét duyệt</Button>
        </div>
        {query.loading && <Loading />}
        {query.error && <Notice tone="error" title="Chưa tải được hồ sơ">
          <Button tone="secondary" onClick={query.retry}>Thử lại</Button>
        </Notice>}
        {!query.loading && !query.error && rows.length === 0 && <Empty title={reviewed ? 'Chưa có hồ sơ đã xét duyệt' : 'Chưa có hồ sơ chờ xét duyệt'} />}
        {rows.length > 0 && <DataTable label="Hồ sơ chuyến khởi hành" headers={['Chuyến khởi hành', 'Người gửi', 'Thời điểm gửi', 'Trạng thái', 'Thao tác']}>
          {rows.map(plan => <tr key={plan.cruiseId}>
            <td>{plan.cruiseCode}</td>
            <td>{plan.submittedByName ?? '—'}</td>
            <td>{plan.submittedAt ? journeyTime(plan.submittedAt) : '—'}</td>
            <td>{domainStatus('cruise.plan', plan.planStatus)}</td>
            <td><ButtonLink tone="secondary" to={`/admin/cruises/${encodeURIComponent(plan.cruiseId)}?step=review&section=overview`}>
              {reviewed ? 'Mở hồ sơ' : 'Xét duyệt'}
            </ButtonLink></td>
          </tr>)}
        </DataTable>}
      </Panel>
    </>}
    {selected && canSetFees && <Modal variant="drawer" title="Thuế và phí cảng" description={`${selected.cruiseName} · ${selected.cruiseCode}`} onClose={() => setSelected(null)}>
      <div>
        <p><strong>Cảng đi</strong> · {selected.departurePort}</p>
        <p><strong>Cảng về</strong> · {selected.returnPort}</p>
        {selected.ports.length > 0 && <p><strong>Cảng ghé</strong> · {selected.ports.join(', ')}</p>}
      </div>
      <DepartureSaleTerms cruiseId={selected.cruiseId} refreshKey={0} setupOnly unified onChanged={() => {
        setSaved(selected.cruiseCode)
        setSelected(null)
        requests.retry()
      }} />
    </Modal>}
  </div></CruiseFrame>
}
