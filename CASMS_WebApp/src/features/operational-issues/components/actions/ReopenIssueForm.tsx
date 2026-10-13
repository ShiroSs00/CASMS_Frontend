import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  onClose: () => void
  onSubmit: () => Promise<boolean>
}

export function ReopenIssueForm({ open, pending, onClose, onSubmit }: Props) {
  return (
    <ActionDialog
      open={open}
      title="Mở lại sự cố"
      description="RESOLVED → IN_PROGRESS chỉ cập nhật current status."
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
            {pending ? 'Đang mở lại…' : 'Reopen & tiếp tục xử lý'}
          </button>
        </>
      }
    >
      <p>Không có reopen_reason, reopen_count hoặc transition history trong FOREP.sql.</p>
      <div className={styles.warningBanner}>
        Mock giữ resolution hiện tại và không tạo event/history giả.
      </div>
    </ActionDialog>
  )
}
