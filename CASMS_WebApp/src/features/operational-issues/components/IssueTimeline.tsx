import type { OperationalIssue } from '../model/issue'
import timelineComplete from '../assets/timeline-complete.svg'
import timelinePending from '../assets/timeline-pending.svg'
import styles from './OperationalIssues.module.css'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function IssueTimeline({ issue }: { issue: OperationalIssue }) {
  const timestamps = [
    ['Báo cáo', issue.reportedAt, issue.reportedBy.name],
    ...(issue.resolvedAt ? [['Ghi nhận xử lý', issue.resolvedAt, issue.resolvedBy?.name ?? 'Chưa có tên người thực hiện']] : []),
    ...(issue.verifiedAt ? [['Xác minh', issue.verifiedAt, issue.verifiedBy?.name ?? 'Chưa có tên người thực hiện']] : []),
  ]

  return (
    <section className={styles.panel}>
      <h2>Tiến trình xử lý</h2>
      <p className={styles.actionHint}>
        Các mốc báo cáo, xử lý và xác minh được ghi nhận trên sự cố.
      </p>
      <ol className={styles.timeline}>
        {timestamps.map(([label, value, detail]) => (
          <li className={styles.timelineItem} key={label}>
            <img className={styles.timelineDot} src={timelineComplete} alt="" />
            <strong>{label}</strong>
            <span className={styles.metadata}>{formatDate(value)} · {detail}</span>
          </li>
        ))}
        {issue.status === 'RESOLVED' && <li className={styles.timelineItem}><img className={styles.timelineDot} src={timelinePending} alt="" /><strong>Đóng sự cố</strong><span className={styles.metadata}>Chờ xác nhận</span></li>}
      </ol>
    </section>
  )
}
