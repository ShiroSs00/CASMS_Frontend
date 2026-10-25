import { PageHeader } from '@/shared/ui'
import { PermissionLink as Link } from '@/shared/ui'
import { useLocation, useParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'

import { AdminFrame } from '../components/AdminFrame'
import { IssueActions } from '../components/IssueActions'
import { IssueHistory } from '../components/IssueHistory'
import { IssueListState } from '../components/IssueListState'
import { IssueOverview } from '../components/IssueOverview'
import { IssueResolution } from '../components/IssueResolution'
import { IssueSeverityBadge, IssueStatusBadge } from '../components/IssueStatusBadge'
import { IssueTimeline } from '../components/IssueTimeline'
import styles from '../components/OperationalIssues.module.css'
import { useIssueDetail } from '../hooks/useIssueDetail'

type DetailLocationState = {
  returnTo?: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function IssueDetailPage() {
  const access = useSessionAccess()
  const { issueId } = useParams()
  const location = useLocation()
  const { state, reload } = useIssueDetail(issueId)
  const returnTo = (location.state as DetailLocationState | null)?.returnTo ?? '/admin/issues'
  return (
    <AdminFrame>
      {state.status === 'loading' ? <IssueListState kind="loading" /> : null}
      {state.status === 'not-found' ? (
        <section className={styles.statePanel}>
          <h1>Không tìm thấy sự cố</h1>
          <p>{state.error}</p>
          <Link className={styles.secondaryButton} to="/admin/issues">
            Về danh sách
          </Link>
        </section>
      ) : null}
      {state.status === 'forbidden' ? (
        <section className={styles.statePanel}>
          <h1>Bạn chưa có quyền truy cập</h1>
          <p>{state.error}</p>
          <Link className={styles.secondaryButton} to="/admin/issues">
            Về danh sách
          </Link>
        </section>
      ) : null}
      {state.status === 'error' ? (
        <IssueListState kind="error" message={state.error} onRetry={reload} />
      ) : null}
      {state.status === 'ready' ? (
        <>
          <PageHeader breadcrumb="VẬN HÀNH / SỰ CỐ" title={`${state.issue.code} · ${state.issue.displayTitle}`}
            description={`${state.issue.cruise ? `${state.issue.cruise.code} · ${state.issue.cruise.name}` : state.issue.ship.name} · tạo ${formatDate(state.issue.reportedAt)}`}
            actions={<>

              {state.issue.status === 'OPEN' && access.has('OPERATIONAL_ISSUE_UPDATE') && (
                <Link className={styles.secondaryButton} to={`/admin/issues/${state.issue.id}/edit`}>
                  Chỉnh sửa sự cố
                </Link>
              )}
              <Link className={styles.secondaryButton} to={`/admin/ships/${state.issue.ship.id}`}>Xem tàu liên quan</Link>
              {state.issue.cruise && <Link className={styles.secondaryButton} to={`/admin/cruises/${state.issue.cruise.id}`}>Xem chuyến liên quan</Link>}
              <Link className={styles.primaryButton} to={returnTo}>Quay lại danh sách</Link>
                        </>} />
          <div className={styles.detailGrid}>
            <div className={styles.detailMain}>
              <IssueTimeline issue={state.issue} />
              <IssueOverview issue={state.issue} />
              <IssueResolution issue={state.issue} />
              <IssueHistory />
            </div>
            <div className={styles.actionRail}>
              <IssueStatusBadge status={state.issue.status} />
              <IssueSeverityBadge severity={state.issue.severity} />
              <IssueActions issue={state.issue} onChanged={reload} />
            </div>
          </div>
        </>
      ) : null}
    </AdminFrame>
  )
}
