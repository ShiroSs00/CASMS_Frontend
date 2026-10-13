import { useState } from 'react'

import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  pending: boolean
  onClose: () => void
  onSubmit: (resolution: string) => Promise<boolean>
}

export function RecordResolutionForm({ open, pending, onClose, onSubmit }: Props) {
  const [resolution, setResolution] = useState('')
  const invalid = !resolution.trim()

  return (
    <ActionDialog
      open={open}
      title="Đánh dấu đã giải quyết"
      description="IN_PROGRESS → RESOLVED; mock cập nhật đúng resolution, resolved_by và resolved_at."
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
            {pending ? 'Đang cập nhật…' : 'Mark Resolved'}
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
      <p>Không tạo evidence, root cause, linked request hoặc impact record ngoài FOREP.sql.</p>
    </ActionDialog>
  )
}
