import type { OperationalIssue } from '../model/issue'
import styles from './OperationalIssues.module.css'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function IssueResolution({ issue }: { issue: OperationalIssue }) {
  return (
    <section className={styles.panel}>
      <h2>Resolution</h2>
      {issue.resolution ? (
        <dl className={styles.resolutionList}>
          <div>
            <dt>Nội dung giải quyết</dt>
            <dd>{issue.resolution}</dd>
          </div>
          <div>
            <dt>Người / thời điểm</dt>
            <dd>
              {issue.resolvedBy?.name ?? 'Không xác định'} ·{' '}
              {issue.resolvedAt ? formatDate(issue.resolvedAt) : 'Không xác định'}
            </dd>
          </div>
        </dl>
      ) : (
        <p>Chưa có resolution được ghi nhận.</p>
      )}
    </section>
  )
}
