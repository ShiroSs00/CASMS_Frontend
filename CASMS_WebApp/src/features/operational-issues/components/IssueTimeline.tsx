import type { OperationalIssue } from '../model/issue'
import styles from './OperationalIssues.module.css'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function IssueTimeline({ issue }: { issue: OperationalIssue }) {
  const timestamps = [
    ['Reported at', issue.reportedAt],
    ['Created at', issue.createdAt],
    ['Updated at', issue.updatedAt],
    ...(issue.resolvedAt ? [['Resolved at', issue.resolvedAt]] : []),
  ]

  return (
    <section className={styles.panel}>
      <h2>Timeline</h2>
      <p className={styles.actionHint}>
        Đây là timestamp của bản ghi hiện tại, không phải audit timeline.
      </p>
      <ol className={styles.timeline}>
        {timestamps.map(([label, value]) => (
          <li className={styles.timelineItem} key={label}>
            <strong>{label}</strong>
            <span className={styles.metadata}>{formatDate(value)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
