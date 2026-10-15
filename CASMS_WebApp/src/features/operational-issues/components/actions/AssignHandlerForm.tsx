import { useState } from 'react'

import { useAssignableHandlers } from '../../hooks/useAssignableHandlers'
import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  currentHandlerId?: string
  pending: boolean
  error?: string
  onClose: () => void
  onSubmit: (handlerId: string) => Promise<boolean>
}

export function AssignHandlerForm({ open, currentHandlerId, pending, error, onClose, onSubmit }: Props) {
  const [handlerId, setHandlerId] = useState(currentHandlerId ?? '')
  const handlers = useAssignableHandlers()
  const selected = handlers.options.find((handler) => handler.id === handlerId)

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
            disabled={pending || handlers.loading || !selected}
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
        <select value={selected ? handlerId : ''} disabled={pending || handlers.loading || !!handlers.error} onChange={(event) => setHandlerId(event.target.value)}>
          <option value="">{handlers.loading ? 'Đang tải người xử lý…' : 'Chọn người xử lý'}</option>
          {handlers.options.map((handler) => <option key={handler.id} value={handler.id}>{handler.label}{handler.capability ? ` — ${handler.capability}` : ''}</option>)}
        </select>
      </label>
      {handlers.error ? <div role="alert"><p>{handlers.error}</p><button className={styles.secondaryButton} onClick={handlers.retry} disabled={pending} type="button">Thử lại</button></div> : null}
      {!handlers.loading && !handlers.error && !handlers.options.length ? <p role="status">Chưa có tài khoản đang hoạt động có thể được phân công.</p> : null}
    </ActionDialog>
  )
}
