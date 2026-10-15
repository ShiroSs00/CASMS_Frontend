import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  error?: string
  onClose: () => void
  onSubmit: () => Promise<boolean>
}

export function ReopenIssueForm({ open, pending, error, onClose, onSubmit }: Props) {
  return (
    <ActionDialog
      open={open}
      pending={pending}
      error={error}
      title="Mở lại sự cố"
      description="Mở lại sự cố để tiếp tục xử lý. Kết quả xử lý và xác minh cũ sẽ được xóa."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} disabled={pending} onClick={onClose} type="button">
            Hủy
          </button>
          <button
            className={styles.primaryButton}
            disabled={pending}
            onClick={() => void onSubmit().then((ok) => ok && onClose())}
            type="button"
          >
            {pending ? 'Đang mở lại…' : 'Reopen issue'}
          </button>
        </>
      }
    >
      <p>Sự cố sẽ trở về trạng thái OPEN.</p>
      <div className={styles.warningBanner}>
        Kết quả xử lý, thông tin người xử lý và xác minh trước đó sẽ bị xóa.
      </div>
    </ActionDialog>
  )
}
