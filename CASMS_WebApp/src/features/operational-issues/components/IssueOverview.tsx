import type { OperationalIssue } from '../model/issue'
import styles from './OperationalIssues.module.css'

export function IssueOverview({ issue }: { issue: OperationalIssue }) {
  return (
    <section className={styles.panel}>
      <h2>Tóm tắt sự cố</h2>
      <p className={styles.overviewText}>{issue.description}</p>
      <h3>Phạm vi impact</h3>
      <ul className={styles.bulletList}>
        {issue.impactSummary.map((impact) => (
          <li key={impact}>{impact}</li>
        ))}
      </ul>
    </section>
  )
}
