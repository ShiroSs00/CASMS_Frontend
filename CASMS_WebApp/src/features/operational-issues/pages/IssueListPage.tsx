import { AdminFrame } from '../components/AdminFrame'
import { IssueListState } from '../components/IssueListState'
import { IssueMetrics } from '../components/IssueMetrics'
import { IssuePagination } from '../components/IssuePagination'
import { IssueSearchFilters } from '../components/IssueSearchFilters'
import { IssueTable } from '../components/IssueTable'
import styles from '../components/OperationalIssues.module.css'
import { useIssueList } from '../hooks/useIssueList'
import { hasActiveIssueFilters } from '../model/issue-query'

export function IssueListPage() {
  const {
    query,
    state,
    updateQuery,
    resetQuery,
    retry,
    handlers,
    ships,
    cruises,
  } = useIssueList()

  const items = state.data?.items ?? []
  const total = state.data?.total ?? 0

  return (
    <AdminFrame>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Sự cố vận hành</h1>
          <p className={styles.pageDescription}>
            Quản lý OperationalIssue theo đúng FOREP.sql; không suy diễn quan hệ với
            ServiceRequest hoặc thực thể impact khác.
          </p>
          <span className={styles.mockBadge}>
            Chế độ API backend · không dùng dữ liệu demo
          </span>
        </div>
      </header>

      <IssueMetrics
        totals={
          state.data?.statusTotals ?? {
            OPEN: 0,
            IN_PROGRESS: 0,
            RESOLVED: 0,
            CLOSED: 0,
            review: 0,
          }
        }
      />
      {state.data?.sourceNotice ? (
        <aside className={styles.warningBanner} role="status">
          <strong className={styles.bannerTitle}>Một phần dữ liệu tham chiếu chưa tải được</strong>
          {state.data.sourceNotice}
        </aside>
      ) : null}
      <IssueSearchFilters
        cruises={cruises}
        handlers={handlers}
        key={[
          query.search,
          query.severity,
          query.status,
          query.shipId,
          query.cruiseId,
          query.handlerId,
        ].join('|')}
        query={query}
        ships={ships}
        onChange={updateQuery}
        onReset={resetQuery}
      />

      {state.status === 'loading' && !state.data ? <IssueListState kind="loading" /> : null}
      {state.status === 'error' ? (
        <IssueListState kind="error" message={state.error} onRetry={retry} />
      ) : null}
      {state.status === 'ready' && total === 0 ? (
        <IssueListState
          kind={hasActiveIssueFilters(query) ? 'no-results' : 'empty'}
          onReset={resetQuery}
        />
      ) : null}
      {items.length ? (
        <>
          <IssueTable issues={items} />
          <IssuePagination
            query={query}
            total={total}
            onPageChange={(page) => updateQuery({ page })}
            onPageSizeChange={(pageSize) => updateQuery({ pageSize })}
          />
        </>
      ) : null}

      <aside className={styles.infoBanner}>
        <strong className={styles.bannerTitle}>OperationalIssue ≠ ServiceRequest</strong>
        Backend không công bố quan hệ ServiceRequest ↔ OperationalIssue. UI không hiển thị hoặc
        thay đổi liên kết không có trong contract.
      </aside>
    </AdminFrame>
  )
}
