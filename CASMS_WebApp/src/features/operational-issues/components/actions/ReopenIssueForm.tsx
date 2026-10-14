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
      description="RESOLVED/CLOSED → OPEN và xóa kết quả resolution/verification cũ."
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
            {pending ? 'Đang mở lại…' : 'Mở lại ở trạng thái OPEN'}
          </button>
        </>
      }
    >
      <p>Không có reopen_reason, reopen_count hoặc transition history trong FOREP.sql.</p>
      <div className={styles.warningBanner}>
        Resolution, resolver, resolved_at, verifier và verified_at hiện tại sẽ bị xóa.
      </div>
    </ActionDialog>
  )
}
