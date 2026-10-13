import type { OperationalIssue } from '../model/issue'
import styles from './OperationalIssues.module.css'

export function IssueOverview({ issue }: { issue: OperationalIssue }) {
  return (
    <section className={styles.panel}>
      <h2>Tóm tắt sự cố</h2>
      <p className={styles.overviewText}>{issue.description}</p>
      <h3>Phạm vi impact</h3>
      <ul className={styles.bulletList}>
        <li>Ship: {issue.ship.name}</li>
        <li>
          Cruise:{' '}
          {issue.cruise ? `${issue.cruise.code} · ${issue.cruise.name}` : 'Không áp dụng'}
        </li>
        <li>Cabin: {issue.cabin ?? 'Không áp dụng'}</li>
        <li>Không có link CruiseStop/Excursion/ServiceRequest trong SQL</li>
      </ul>
    </section>
  )
}
