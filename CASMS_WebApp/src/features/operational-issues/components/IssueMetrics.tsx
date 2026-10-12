import type { OperationalIssue } from '../model/issue'
import styles from './OperationalIssues.module.css'

export function IssueMetrics({ issues }: { issues: OperationalIssue[] }) {
  const count = (status: OperationalIssue['status']) =>
    issues.filter((issue) => issue.status === status).length

  const metrics = [
    { label: 'OPEN', value: count('OPEN'), className: styles.statusOpen },
    { label: 'IN PROGRESS', value: count('IN_PROGRESS'), className: styles.statusProgress },
    { label: 'RESOLVED', value: count('RESOLVED'), className: styles.statusResolved },
    {
      label: 'CẦN RÀ SOÁT',
      value: issues.filter((issue) => issue.severity === 'CRITICAL').length,
      className: styles.statusReview,
    },
  ]

  return (
    <section className={styles.metricsGrid} aria-label="Tóm tắt trạng thái trong dữ liệu mock">
      {metrics.map((metric) => (
        <article className={styles.metricCard} key={metric.label}>
          <span className={styles.eyebrow}>{metric.label}</span>
          <span className={`${styles.metricValue} ${metric.className}`}>{metric.value}</span>
        </article>
      ))}
    </section>
  )
}
