import { useState } from 'react'
import { Link } from 'react-router'

import { AdminFrame } from '../components/AdminFrame'
import { IssueListState } from '../components/IssueListState'
import { IssueMetrics } from '../components/IssueMetrics'
import { IssueSearchFilters } from '../components/IssueSearchFilters'
import { IssueTable } from '../components/IssueTable'
import { ReportIssueDialog } from '../components/ReportIssueDialog'
import styles from '../components/OperationalIssues.module.css'
import { useIssueList } from '../hooks/useIssueList'
import { hasActiveIssueFilters } from '../model/issue-query'

export function IssueListPage() {
  const [reportOpen, setReportOpen] = useState(false)
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
          <p className={styles.pageDescription}>Triage nhanh theo mức độ, trạng thái và ngữ cảnh tàu/chuyến.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className={styles.secondaryButton} onClick={() => setReportOpen(true)}>Báo cáo nhanh</button>
          <Link className={styles.primaryButton} to="/admin/issues/new">Báo cáo sự cố</Link>
        </div>
      </header>

      <IssueMetrics totals={state.data?.statusTotals ?? null} />
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
          <div className={styles.pagination}><span>{total} kết quả · phân trang chưa khả dụng</span></div>
        </>
      ) : null}

      <ReportIssueDialog open={reportOpen} onClose={() => setReportOpen(false)} onCreated={retry} />
    </AdminFrame>
  )
}
