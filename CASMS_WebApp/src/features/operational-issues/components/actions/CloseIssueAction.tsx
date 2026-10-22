import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  error?: string
  onClose: () => void
  onSubmit: () => Promise<boolean>
}

export function CloseIssueAction({ open, pending, error, onClose, onSubmit }: Props) {
  return (
    <ActionDialog
      open={open}
      pending={pending}
      error={error}
      title="Đóng sự cố"
      description="Xác nhận đóng sự cố đã được xử lý và xác minh."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} disabled={pending} onClick={onClose} type="button" data-overlay-dismiss>
            Quay lại
          </button>
          <button
            className={styles.primaryButton}
            disabled={pending}
            onClick={() => void onSubmit().then((ok) => ok && onClose())}
            type="button"
          >
            {pending ? 'Đang đóng…' : 'Đóng sự cố'}
          </button>
        </>
      }
    >
      <h3>Checklist trước khi đóng</h3>
      <ul className={styles.checklist}>
        <li>Đã ghi nhận kết quả xử lý</li>
        <li>Đã ghi nhận người xử lý</li>
        <li>Đã ghi nhận thời điểm xử lý</li>
        <li>Sự cố chuyển sang CLOSED sau khi đóng</li>
      </ul>
      <div className={styles.infoBanner}>Sự cố đã đóng có thể được mở lại khi cần tiếp tục xử lý.</div>
    </ActionDialog>
  )
}
