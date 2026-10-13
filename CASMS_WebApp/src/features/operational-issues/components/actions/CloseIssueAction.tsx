import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  onClose: () => void
  onBlocked: () => Promise<boolean>
}

export function CloseIssueAction({ open, onClose, onBlocked }: Props) {
  return (
    <ActionDialog
      open={open}
      title="Đóng sự cố"
      description="RESOLVED → CLOSED chỉ sau khi verification/criteria theo policy đạt."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} onClick={onClose} type="button">
            Hủy
          </button>
          <button className={styles.primaryButton} onClick={() => void onBlocked()} type="button">
            Đóng sự cố
          </button>
        </>
      }
    >
      <h3>Checklist trước khi đóng</h3>
      <ul className={styles.checklist}>
        <li>Resolution được ghi nhận</li>
        <li>Impact đã được rà soát</li>
        <li>Không còn action bắt buộc theo policy</li>
        <li>Audit trail đầy đủ</li>
      </ul>
      <div className={styles.warningBanner}>
        Close criteria và bằng chứng verified chưa được xác nhận; UI không báo thành công giả.
      </div>
    </ActionDialog>
  )
}
