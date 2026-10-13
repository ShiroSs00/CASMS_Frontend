import type { OperationalIssue } from '../model/issue'
import { issueEventLabels, issueStatusLabels } from '../model/issue'
import styles from './OperationalIssues.module.css'

export function IssueHistory({ issue }: { issue: OperationalIssue }) {
  const transitions = issue.events.filter((event) => event.fromStatus || event.toStatus)

  return (
    <section className={styles.panel}>
      <h2>History</h2>
      {transitions.length ? (
        <ul className={styles.historyList}>
          {[...transitions].reverse().map((event) => (
            <li className={styles.historyItem} key={event.id}>
              <strong>{issueEventLabels[event.kind]}</strong>
              <span>
                {event.fromStatus ? issueStatusLabels[event.fromStatus] : 'Khởi tạo'} →{' '}
                {event.toStatus ? issueStatusLabels[event.toStatus] : 'Không đổi status'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Chưa có transition trạng thái.</p>
      )}
    </section>
  )
}
