import { useState } from 'react'

import { ActionDialog } from '../ActionDialog'
import styles from '../OperationalIssues.module.css'

type Props = {
  open: boolean
  onClose: () => void
  onBlocked: () => Promise<boolean>
}

type ResolutionDraft = {
  summary: string
  rootCauseStatus: string
  residualImpact: string
  evidenceReference: string
}

const initialValue: ResolutionDraft = {
  summary: '',
  rootCauseStatus: '',
  residualImpact: '',
  evidenceReference: '',
}

export function RecordResolutionForm({ open, onClose, onBlocked }: Props) {
  const [value, setValue] = useState(initialValue)

  return (
    <ActionDialog
      open={open}
      title="Đánh dấu đã giải quyết"
      description="UI form theo design; field bắt buộc và status sau thành công vẫn chưa được xác nhận."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} onClick={onClose} type="button">
            Quay lại issue
          </button>
          <button className={styles.primaryButton} onClick={() => void onBlocked()} type="button">
            Kiểm tra contract
          </button>
        </>
      }
    >
      {(
        [
          ['summary', 'Resolution summary'],
          ['rootCauseStatus', 'Root cause status'],
          ['residualImpact', 'Residual impact'],
          ['evidenceReference', 'Evidence / reference'],
        ] as const
      ).map(([key, label]) => (
        <label className={styles.field} key={key}>
          {label}
          <textarea
            value={value[key]}
            onChange={(event) => setValue((current) => ({ ...current, [key]: event.target.value }))}
          />
        </label>
      ))}
      <div className={styles.warningBanner}>
        Contract chưa chốt Record Resolution là lưu nháp hay chuyển RESOLVED. Form không gửi mutation.
      </div>
      <p>Resolve không xóa issue, linked ServiceRequest hoặc tự trigger refund/payment.</p>
    </ActionDialog>
  )
}
