import type { IssueStatusTotals } from '../api/operational-issues-api'
import styles from './OperationalIssues.module.css'

export function IssueMetrics({ totals }: { totals: IssueStatusTotals | null }) {
  const metrics = [
    { label: 'Chờ xử lý', value: totals?.OPEN, hint: 'Cần xử lý', className: styles.statusOpen },
    { label: 'Đang xử lý', value: totals?.IN_PROGRESS, hint: 'Đang xử lý', className: styles.statusProgress },
    { label: 'Đã xác minh xử lý', value: totals?.RESOLVED, hint: 'Chờ đóng', className: styles.statusResolved },
    { label: 'Nghiêm trọng', value: totals?.critical, hint: 'Ưu tiên cao nhất', className: styles.statusReview },
  ]

  return (
    <section className={styles.metricsGrid} aria-label="Tóm tắt trạng thái sự cố">
      {metrics.map((metric) => (
        <article className={styles.metricCard} key={metric.label}>
          <span className={styles.eyebrow}>{metric.label}</span>
          <span className={`${styles.metricValue} ${metric.className}`}>{metric.value === undefined ? '—' : String(metric.value).padStart(2, '0')}</span>
          <span className={styles.metricHint}>{metric.hint}</span>
        </article>
      ))}
    </section>
  )
}
