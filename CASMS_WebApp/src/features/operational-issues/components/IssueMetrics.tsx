import type { IssueStatusTotals } from '../model/issue-adapter'
import styles from './OperationalIssues.module.css'

export function IssueMetrics({ totals }: { totals: IssueStatusTotals }) {
  const metrics = [
    { label: 'OPEN', value: totals.OPEN, className: styles.statusOpen },
    { label: 'IN PROGRESS', value: totals.IN_PROGRESS, className: styles.statusProgress },
    { label: 'RESOLVED', value: totals.RESOLVED, className: styles.statusResolved },
    {
      label: 'CẦN RÀ SOÁT',
      value: totals.review,
      className: styles.statusReview,
    },
  ]

  return (
    <section className={styles.metricsGrid} aria-label="Tóm tắt trạng thái sự cố">
      {metrics.map((metric) => (
        <article className={styles.metricCard} key={metric.label}>
          <span className={styles.eyebrow}>{metric.label}</span>
          <span className={`${styles.metricValue} ${metric.className}`}>{metric.value}</span>
        </article>
      ))}
    </section>
  )
}
