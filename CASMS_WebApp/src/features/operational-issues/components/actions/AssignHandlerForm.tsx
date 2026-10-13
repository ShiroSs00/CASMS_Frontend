import { useState } from 'react'

import type { PersonReference } from '../../model/issue'
import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  handlers: PersonReference[]
  pending: boolean
  onClose: () => void
  onSubmit: (handlerId: string) => Promise<boolean>
}

export function AssignHandlerForm({ open, handlers, pending, onClose, onSubmit }: Props) {
  const [handlerId, setHandlerId] = useState(handlers[0]?.id ?? '')

  return (
    <ActionDialog
      open={open}
      title="Phân công người xử lý"
      description="Issue vẫn OPEN; backend phải kiểm tra capability và người xử lý đủ điều kiện."
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
            {pending ? 'Đang cập nhật…' : 'Chỉ cập nhật assignee'}
          </button>
        </>
      }
    >
      <label className={styles.field}>
        Team / người phụ trách
        <select value={handlerId} onChange={(event) => setHandlerId(event.target.value)}>
          {handlers.map((handler) => (
            <option key={handler.id} value={handler.id}>
              {handler.name}
            </option>
          ))}
        </select>
      </label>
      <p>Mock chỉ cập nhật assigned_to. FOREP.sql không có ghi chú bàn giao, priority hoặc SLA.</p>
    </ActionDialog>
  )
}
