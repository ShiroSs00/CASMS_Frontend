import { Link, useLocation, useParams } from 'react-router'

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
  const { issueId } = useParams()
  const location = useLocation()
  const { state, reload } = useIssueDetail(issueId)
  const returnTo = (location.state as DetailLocationState | null)?.returnTo ?? '/admin/issues'
  const directSqlLinks = state.status === 'ready'
    ? 1 + Number(Boolean(state.issue.cruise)) + Number(Boolean(state.issue.cabin))
    : 0

  return (
    <AdminFrame>
      <Link className={styles.backLink} to={returnTo}>
        ← Quay lại danh sách sự cố
      </Link>
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
          <header className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>
                {state.issue.code} · {state.issue.displayTitle}
              </h1>
              <p className={styles.pageDescription}>
                {state.issue.cruise
                  ? `${state.issue.cruise.code} · ${state.issue.cruise.name}`
                  : state.issue.ship.name}{' '}
                · tạo {formatDate(state.issue.reportedAt)}
              </p>
              <span className={styles.mockBadge}>Dữ liệu minh họa · mock adapter</span>
            </div>
          </header>

          <section className={styles.metricsGrid} aria-label="Trạng thái sự cố">
            <article className={styles.metricCard}>
              <span className={styles.eyebrow}>Trạng thái</span>
              <IssueStatusBadge status={state.issue.status} />
            </article>
            <article className={styles.metricCard}>
              <span className={styles.eyebrow}>Ảnh hưởng</span>
              <IssueSeverityBadge severity={state.issue.severity} />
            </article>
            <article className={styles.metricCard}>
              <span className={styles.eyebrow}>Assignee</span>
              <span className={`${styles.metricValue} ${styles.statusProgress}`}>
                {state.issue.assignedTo?.name ?? 'Chưa phân công'}
              </span>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.eyebrow}>Direct SQL links</span>
              <span className={styles.metricValue}>{directSqlLinks}</span>
            </article>
          </section>

          <div className={styles.detailGrid}>
            <IssueOverview issue={state.issue} />
            <IssueActions issue={state.issue} onChanged={reload} />
          </div>

          <aside className={styles.warningBanner}>
            <strong className={styles.bannerTitle}>CASMS không có authority điều khiển tàu</strong>
            UI chỉ ghi nhận và điều phối issue; không cho phép ra lệnh rời cảng, điều khiển propulsion
            hoặc thay thế quyết định an toàn hàng hải.
          </aside>

          <div className={styles.sectionGrid}>
            <IssueTimeline issue={state.issue} />
            <IssueHistory />
            <IssueResolution issue={state.issue} />
          </div>
        </>
      ) : null}
    </AdminFrame>
  )
}
