import styles from './OperationalIssues.module.css'

export function IssueHistory() {
  return (
    <section className={styles.panel}>
      <h2>Lịch sử xử lý</h2>
      <div className={styles.warningBanner}>
        Các mốc báo cáo, xử lý và xác minh được hiển thị trong tiến trình phía trên.
        Chưa có lịch sử đầy đủ cho các lần phân công, đóng hoặc mở lại sự cố.
      </div>
    </section>
  )
}
