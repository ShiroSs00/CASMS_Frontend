import type { OperationalIssue } from '../model/issue'
import { issueEventLabels } from '../model/issue'
import styles from './OperationalIssues.module.css'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function IssueTimeline({ issue }: { issue: OperationalIssue }) {
  return (
    <section className={styles.panel}>
      <h2>Timeline</h2>
      <ol className={styles.timeline}>
        {[...issue.events].reverse().map((event) => (
          <li className={styles.timelineItem} key={event.id}>
            <strong>{issueEventLabels[event.kind]}</strong>
            <p>{event.description}</p>
            <span className={styles.metadata}>
              {event.actor.name} · {formatDate(event.occurredAt)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
