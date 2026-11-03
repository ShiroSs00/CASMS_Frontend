import { useState } from 'react'

import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  error?: string
  onClose: () => void
  onSubmit: (resolution: string) => Promise<boolean>
}

export function RecordResolutionForm({ open, pending, error, onClose, onSubmit }: Props) {
  const [resolution, setResolution] = useState('')
  const invalid = !resolution.trim()

  return (
    <ActionDialog
      open={open}
      pending={pending}
      error={error}
      title="Ghi nhận resolution"
      description="Ghi nội dung xử lý nhưng vẫn giữ IN_PROGRESS; Verify là bước riêng."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} disabled={pending} onClick={onClose} type="button">
            Quay lại issue
          </button>
          <button
            className={styles.primaryButton}
            disabled={pending || invalid}
            onClick={() => void onSubmit(resolution).then((ok) => ok && onClose())}
            type="button"
          >
            {pending ? 'Đang cập nhật…' : 'Record resolution'}
          </button>
        </>
      }
    >
      <label className={styles.field}>
        Resolution summary
        <textarea
          required
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
        />
      </label>
      {invalid ? <p className={styles.actionHint}>Resolution không được để trống.</p> : null}
      <p>Người ghi nhận là tài khoản đang đăng nhập.</p>
    </ActionDialog>
  )
}
