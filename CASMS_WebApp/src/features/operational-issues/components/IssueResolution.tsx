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
            <dd>{issue.resolution.summary}</dd>
          </div>
          <div>
            <dt>Root cause</dt>
            <dd>{issue.resolution.rootCauseStatus}</dd>
          </div>
          <div>
            <dt>Residual impact</dt>
            <dd>{issue.resolution.residualImpact}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{issue.resolution.evidenceReference}</dd>
          </div>
          <div>
            <dt>Người / thời điểm</dt>
            <dd>
              {issue.resolution.resolvedBy.name} · {formatDate(issue.resolution.resolvedAt)}
            </dd>
          </div>
        </dl>
      ) : (
        <p>Chưa có resolution được ghi nhận.</p>
      )}
    </section>
  )
}
