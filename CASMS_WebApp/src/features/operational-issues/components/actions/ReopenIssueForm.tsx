import { useState } from 'react'

import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  onClose: () => void
  onBlocked: () => Promise<boolean>
}

export function ReopenIssueForm({ open, onClose, onBlocked }: Props) {
  const [reason, setReason] = useState('')

  return (
    <ActionDialog
      open={open}
      title="Mở lại sự cố"
      description="UI form theo design; transition, reason và quyền Reopen vẫn chưa được xác nhận."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} onClick={onClose} type="button">
            Hủy
          </button>
          <button className={styles.primaryButton} onClick={() => void onBlocked()} type="button">
            Kiểm tra contract
          </button>
        </>
      }
    >
      <label className={styles.field}>
        Lý do reopen (chưa xác nhận bắt buộc)
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className={styles.warningBanner}>
        RESOLVED → IN_PROGRESS mới là đề xuất; form không gửi mutation hoặc tạo event giả.
      </div>
    </ActionDialog>
  )
}
