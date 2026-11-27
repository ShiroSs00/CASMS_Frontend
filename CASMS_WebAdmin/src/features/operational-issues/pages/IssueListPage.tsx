import { CancellationQueue } from '@/shared/cancellation'
import { useSessionAccess } from '@/shared/auth'
import { useState } from 'react'
import { Button, ButtonLink, ListFooter, PageHeader, Panel } from '@/shared/ui'

import { AdminFrame } from '../components/AdminFrame'
import { IssueListState } from '../components/IssueListState'
import { IssueMetrics } from '../components/IssueMetrics'
import { IssueSearchFilters } from '../components/IssueSearchFilters'
import { IssueTable } from '../components/IssueTable'
import { ReportIssueDialog } from '../components/ReportIssueDialog'
import { useIssueList } from '../hooks/useIssueList'
import { hasActiveIssueFilters } from '../model/issue-query'

export function IssueListPage() {
  const access = useSessionAccess()
  const canCreate = access.canDo('OPERATIONAL_ISSUE_CREATE')
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
  const pageSize = Math.max(1, query.pageSize || 20)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, query.page || 1), totalPages)
  const startIndex = (safePage - 1) * pageSize + 1
  const endIndex = Math.min(safePage * pageSize, total)

  return (
    <AdminFrame>
      <PageHeader
        title="Sự cố vận hành"
        breadcrumb="VẬN HÀNH / SỰ CỐ"
        actions={
          canCreate ? (
            <>
              <Button tone="secondary" onClick={() => setReportOpen(true)}>Báo cáo nhanh</Button>
              <ButtonLink to="/admin/issues/new">Báo cáo sự cố</ButtonLink>
            </>
          ) : undefined
        }
      />

      <CancellationQueue operations />
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

      <Panel title="Danh sách sự cố">
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
            <ListFooter
              summary={
                totalPages > 1
                  ? `Hiển thị ${startIndex}–${endIndex} trong tổng số ${total} sự cố`
                  : `${total} sự cố`
              }
            >
              {totalPages > 1 ? (
                <>
                  <Button
                    tone="secondary"
                    size="compact"
                    autoWidth
                    disabled={safePage <= 1}
                    onClick={() => updateQuery({ page: safePage - 1 })}
                  >
                    Trang trước
                  </Button>
                  <span>Trang {safePage} / {totalPages}</span>
                  <Button
                    tone="secondary"
                    size="compact"
                    autoWidth
                    disabled={safePage >= totalPages}
                    onClick={() => updateQuery({ page: safePage + 1 })}
                  >
                    Trang sau
                  </Button>
                </>
              ) : null}
            </ListFooter>
          </>
        ) : null}
      </Panel>

      {canCreate && <ReportIssueDialog open={reportOpen} onClose={() => setReportOpen(false)} onCreated={retry} />}
    </AdminFrame>
  )
}
