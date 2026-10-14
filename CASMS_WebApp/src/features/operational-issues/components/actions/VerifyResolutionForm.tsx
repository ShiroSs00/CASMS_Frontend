import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  onClose: () => void
  onSubmit: () => Promise<boolean>
}

export function VerifyResolutionForm({ open, pending, onClose, onSubmit }: Props) {
  return (
    <ActionDialog
      open={open}
      title="Xác minh resolution"
      description="Backend ghi verified_by, verified_at và chuyển IN_PROGRESS → RESOLVED."
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
            {pending ? 'Đang xác minh…' : 'Xác minh resolution'}
          </button>
        </>
      }
    >
      <ul className={styles.checklist}>
        <li>resolution có dữ liệu</li>
        <li>resolved_by có dữ liệu</li>
        <li>resolved_at có dữ liệu</li>
      </ul>
      <div className={styles.infoBanner}>Kết quả xác minh được lưu bởi backend.</div>
    </ActionDialog>
  )
}
