import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  onClose: () => void
  onSubmit: () => Promise<boolean>
}

export function CloseIssueAction({ open, pending, onClose, onSubmit }: Props) {
  return (
    <ActionDialog
      open={open}
      title="Đóng sự cố"
      description="RESOLVED → CLOSED sau khi resolution đã được ghi và xác minh."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} disabled={pending} onClick={onClose} type="button">
            Mở lại để xử lý
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
        <li>resolution có dữ liệu</li>
        <li>resolved_by có dữ liệu</li>
        <li>resolved_at có dữ liệu</li>
        <li>verified_by và verified_at có dữ liệu</li>
        <li>status chuyển sang CLOSED</li>
      </ul>
      <div className={styles.infoBanner}>CLOSED là current status; không giả audit snapshot.</div>
    </ActionDialog>
  )
}
