import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  assigneeName: string | null
  onClose: () => void
  onSubmit: () => Promise<boolean>
}

export function StartHandlingAction({
  open,
  pending,
  assigneeName,
  onClose,
  onSubmit,
}: Props) {
  return (
    <ActionDialog
      open={open}
      title="Bắt đầu xử lý"
      description="OPEN → IN_PROGRESS chỉ khi issue đã có assigned_to."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} disabled={pending} onClick={onClose} type="button">
            Hủy
          </button>
          <button
            className={styles.primaryButton}
            disabled={pending || !assigneeName}
            onClick={() => void onSubmit().then((ok) => ok && onClose())}
            type="button"
          >
            {pending ? 'Đang bắt đầu…' : 'Bắt đầu xử lý'}
          </button>
        </>
      }
    >
      <div className={styles.infoBanner}>
        Assignee hiện tại: <strong>{assigneeName ?? 'Chưa phân công'}</strong>
      </div>
      <p>Transition sẽ được backend kiểm tra capability và current state trước khi commit.</p>
    </ActionDialog>
  )
}
