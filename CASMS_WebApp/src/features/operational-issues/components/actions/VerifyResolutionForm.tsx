import { useState } from 'react'

import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  onClose: () => void
  onBlocked: () => Promise<boolean>
}

export function VerifyResolutionForm({ open, onClose, onBlocked }: Props) {
  const [notes, setNotes] = useState('')
  return (
    <ActionDialog
      open={open}
      title="Xác minh resolution"
      description="UI form theo yêu cầu contract; transition, payload và quyền vẫn chưa được xác nhận."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} onClick={onClose} type="button">
            Hủy
          </button>
          <button className={styles.primaryButton} onClick={() => void onBlocked()} type="button">
            Kiểm tra điều kiện
          </button>
        </>
      }
    >
      <label className={styles.field}>
        Kết quả xác minh
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className={styles.warningBanner}>
        Chưa có nguồn xác nhận Verify giữ status, tạo event hay chuyển trạng thái. Form không gửi mutation.
      </div>
    </ActionDialog>
  )
}
