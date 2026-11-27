import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  error?: string
  onClose: () => void
  onSubmit: () => Promise<boolean>
}

export function VerifyResolutionForm({ open, pending, error, onClose, onSubmit }: Props) {
  return (
    <ActionDialog
      open={open}
      pending={pending}
      error={error}
      title="Xác minh phương án xử lý"
      description="Xác nhận kết quả xử lý sự cố."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} disabled={pending} onClick={onClose} type="button" data-overlay-dismiss>
            Hủy
          </button>
          <button
            className={styles.primaryButton}
            disabled={pending}
            onClick={() => void onSubmit().then((ok) => ok && onClose())}
            type="button"
          >
            {pending ? 'Đang xác minh…' : 'Xác nhận xác minh'}
          </button>
        </>
      }
    >
      <ul className={styles.checklist}>
        <li>Đã ghi nhận kết quả xử lý</li>
        <li>Đã ghi nhận người xử lý</li>
        <li>Đã ghi nhận thời điểm xử lý</li>
      </ul>
    </ActionDialog>
  )
}
