import styles from './OperationalIssues.module.css'

export function IssueHistory() {
  return (
    <section className={styles.panel}>
      <h2>History</h2>
      <div className={styles.warningBanner}>
        Backend hiện chưa công bố endpoint audit/event/history cho OperationalIssue. UI không dựng
        lịch sử giả từ status hoặc updated_at.
      </div>
    </section>
  )
}
