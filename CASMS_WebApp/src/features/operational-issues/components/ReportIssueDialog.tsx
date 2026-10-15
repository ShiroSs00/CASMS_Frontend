import { useRef, useState } from 'react'

import { operationalIssuesApi } from '../api/operational-issues-api'
import { ISSUE_SEVERITIES, ISSUE_TYPES, type IssueSeverity, type IssueType } from '../model/issue'
import { ActionDialog } from './ActionDialog'
import styles from './OperationalIssues.module.css'

export function ReportIssueDialog({ open, onClose, onCreated }: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [shipId, setShipId] = useState('')
  const [cruiseId, setCruiseId] = useState('')
  const [cabinId, setCabinId] = useState('')
  const [issueType, setIssueType] = useState<IssueType>('OPERATIONAL')
  const [severity, setSeverity] = useState<IssueSeverity>('MEDIUM')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const invalid = !shipId.trim() || !description.trim()

  async function submit() {
    if (invalid || lock.current) return
    lock.current = true
    setPending(true); setError('')
    try {
      await operationalIssuesApi.create({
        shipId: shipId.trim(),
        ...(cruiseId.trim() ? { cruiseId: cruiseId.trim() } : {}),
        ...(cabinId.trim() ? { cabinId: cabinId.trim() } : {}),
        issueType,
        severity,
        description: description.trim(),
      })
      onCreated(); onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể báo cáo sự cố.')
    } finally { lock.current = false; setPending(false) }
  }

  return <ActionDialog
    open={open}
    pending={pending}
    title="Report operational issue"
    description="Ghi nhận mức độ, vị trí và nội dung sự cố. Sự cố mới bắt đầu ở trạng thái OPEN."
    onClose={() => { if (!pending) onClose() }}
    footer={<>
      <button className={styles.secondaryButton} disabled={pending} onClick={onClose}>Hủy</button>
      <button className={styles.primaryButton} disabled={invalid || pending} onClick={() => void submit()}>
        {pending ? 'Đang gửi…' : 'Gửi issue'}
      </button>
    </>}
  >
    <div className={styles.formGrid}>
      <label className={styles.field}>Issue type<select value={issueType} onChange={(event) => setIssueType(event.target.value as IssueType)}>{ISSUE_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className={styles.field}>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as IssueSeverity)}>{ISSUE_SEVERITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className={styles.field}>Ship ID<input value={shipId} onChange={(event) => setShipId(event.target.value)} placeholder="Ship UUID" /></label>
      <label className={styles.field}>Cruise ID<input value={cruiseId} onChange={(event) => setCruiseId(event.target.value)} placeholder="Không bắt buộc" /></label>
      <label className={styles.field}>Cabin ID<input value={cabinId} onChange={(event) => setCabinId(event.target.value)} placeholder="Không bắt buộc" /></label>
      <label className={`${styles.field} ${styles.fullWidth}`}>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    </div>
    <aside className={styles.permissionNote}>Người báo cáo được ghi nhận theo tài khoản đang đăng nhập.</aside>
    {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}
  </ActionDialog>
}
