import { useState } from 'react'

import type { PersonReference } from '../../model/issue'
import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  handlers: PersonReference[]
  pending: boolean
  error?: string
  onClose: () => void
  onSubmit: (handlerId: string) => Promise<boolean>
}

export function AssignHandlerForm({ open, handlers, pending, error, onClose, onSubmit }: Props) {
  const [handlerId, setHandlerId] = useState(handlers[0]?.id ?? '')

  return (
    <ActionDialog
      open={open}
      pending={pending}
      error={error}
      title="Phân công người xử lý"
      description="Phân công người chịu trách nhiệm; trạng thái xử lý hiện tại được giữ nguyên."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} disabled={pending} onClick={onClose} type="button">
            Hủy
          </button>
          <button
            className={styles.primaryButton}
            disabled={pending || !handlerId}
            onClick={() => void onSubmit(handlerId).then((ok) => ok && onClose())}
            type="button"
          >
            {pending ? 'Đang cập nhật…' : 'Assign handler'}
          </button>
        </>
      }
    >
      <label className={styles.field}>
        Team / người phụ trách
        <input value={handlerId} onChange={(event) => setHandlerId(event.target.value)} placeholder="User UUID" />
      </label>
      <p>Nhập mã người phụ trách được cung cấp bởi bộ phận vận hành.</p>
    </ActionDialog>
  )
}
