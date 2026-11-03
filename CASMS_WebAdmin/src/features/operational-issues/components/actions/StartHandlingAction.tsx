import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  error?: string
  assigneeName: string | null
  onClose: () => void
  onSubmit: () => Promise<boolean>
}

export function StartHandlingAction({
  open,
  pending,
  error,
  assigneeName,
  onClose,
  onSubmit,
}: Props) {
  return (
    <ActionDialog
      open={open}
      pending={pending}
      error={error}
      title="Bắt đầu xử lý"
      description="Bắt đầu xử lý sự cố sau khi đã phân công người phụ trách."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} disabled={pending} onClick={onClose} type="button" data-overlay-dismiss>
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
      <p>
        Người phụ trách: <strong>{assigneeName ?? 'Chưa phân công'}</strong>
      </p>
      <p>Hệ thống sẽ kiểm tra người được phân công và trạng thái hiện tại trước khi bắt đầu.</p>
    </ActionDialog>
  )
}
