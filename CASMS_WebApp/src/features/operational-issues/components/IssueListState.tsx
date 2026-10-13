import styles from './OperationalIssues.module.css'

type Props = {
  kind: 'loading' | 'empty' | 'no-results' | 'error'
  message?: string
  onRetry?: () => void
  onReset?: () => void
}

const copy = {
  loading: ['Loading', 'Đang tải danh sách sự cố…'],
  empty: ['Empty', 'Chưa có sự cố trong phạm vi này.'],
  'no-results': ['No results', 'Không có kết quả phù hợp bộ lọc.'],
  error: ['Error', 'Không tải được dữ liệu. Giữ filter và cho phép thử lại.'],
} as const

export function IssueListState({ kind, message, onRetry, onReset }: Props) {
  const [title, description] = copy[kind]
  return (
    <section className={styles.statePanel} aria-live="polite">
      <h2>{title}</h2>
      <p>{message ?? description}</p>
      {kind === 'error' && onRetry ? (
        <button className={styles.secondaryButton} onClick={onRetry} type="button">
          Thử lại
        </button>
      ) : null}
      {kind === 'no-results' && onReset ? (
        <button className={styles.secondaryButton} onClick={onReset} type="button">
          Đặt lại bộ lọc
        </button>
      ) : null}
    </section>
  )
}
