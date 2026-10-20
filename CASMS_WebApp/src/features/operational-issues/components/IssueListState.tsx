import styles from './OperationalIssues.module.css'

type Props = {
  kind: 'loading' | 'empty' | 'no-results' | 'error'
  message?: string
  onRetry?: () => void
  onReset?: () => void
}

const copy = {
  loading: ['Đang tải', 'Đang tải danh sách sự cố…'],
  empty: ['Chưa có sự cố', 'Chưa có sự cố trong phạm vi này.'],
  'no-results': ['Không có kết quả', 'Không có kết quả phù hợp bộ lọc.'],
  error: ['Không tải được sự cố', 'Chưa tải được dữ liệu. Bộ lọc được giữ lại để bạn thử lại.'],
} as const

export function IssueListState({ kind, message, onRetry, onReset }: Props) {
  const [title, description] = copy[kind]
  return (
    <section className={styles.statePanel} role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'}>
      <h2>{title}</h2>
      <p>{message === 'Internal server error' ? 'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại hoặc liên hệ quản trị viên.' : message ?? description}</p>
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
