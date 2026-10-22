import { useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'

import { operationalIssuesApi } from '../api/operational-issues-api'
import { issueLocationApi, validateIssueLocation } from '../api/location-lookup-api'
import { ISSUE_SEVERITIES, ISSUE_TYPES, type IssueSeverity, type IssueType } from '../model/issue'
import { ActionDialog } from './ActionDialog'
import styles from './OperationalIssues.module.css'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function ReportIssueDialog(props: Props) {
  return props.open ? <ReportIssueDialogContent {...props} /> : null
}

function ReportIssueDialogContent({ open, onClose, onCreated }: Props) {
  const access = useSessionAccess()
  const ships = useReadQuery('report-issue-ships', issueLocationApi.ships)
  const cruises = useReadQuery('report-issue-cruises', issueLocationApi.cruises)
  const cabins = useReadQuery('report-issue-cabins', issueLocationApi.cabins)
  const contextReady = !ships.loading && !cruises.loading && !cabins.loading && !ships.error && !cruises.error && !cabins.error
  const lookupError = ships.error || cruises.error || cabins.error
  const [shipId, setShipId] = useState('')
  const [cruiseId, setCruiseId] = useState('')
  const [cabinId, setCabinId] = useState('')
  const [issueType, setIssueType] = useState<IssueType>('OPERATIONAL')
  const [severity, setSeverity] = useState<IssueSeverity>('MEDIUM')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const locationError = validateIssueLocation(shipId, cruiseId, cabinId, contextReady ? { ships: ships.data ?? [], cruises: cruises.data ?? [], cabins: cabins.data ?? [] } : null)
  const allowed = access.has('OPERATIONAL_ISSUE_CREATE')
  const invalid = !allowed || !description.trim() || Boolean(locationError)

  async function submit() {
    if (invalid || lock.current) return
    lock.current = true
    setPending(true); setError('')
    try {
      await operationalIssuesApi.create({
        issueCode: '',
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
    title="Báo cáo sự cố vận hành"
    description="Ghi nhận mức độ, vị trí và nội dung sự cố. Sự cố mới bắt đầu ở trạng thái OPEN."
    onClose={() => { if (!pending) onClose() }}
    footer={<>
      <button className={styles.secondaryButton} disabled={pending} onClick={onClose} data-overlay-dismiss>Hủy</button>
      <button className={styles.primaryButton} disabled={invalid || pending} onClick={() => void submit()}>
        {pending ? 'Đang gửi…' : 'Gửi issue'}
      </button>
    </>}
  >
    <div className={styles.formGrid}>
      <label className={styles.field}>Loại sự cố<select value={issueType} disabled={pending} onChange={(event) => setIssueType(event.target.value as IssueType)}>{ISSUE_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className={styles.field}>Mức độ nghiêm trọng<select value={severity} disabled={pending} onChange={(event) => setSeverity(event.target.value as IssueSeverity)}>{ISSUE_SEVERITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className={styles.field}>Tàu *<select value={shipId} disabled={pending || !contextReady} onChange={(event) => { setShipId(event.target.value); setCruiseId(''); setCabinId(''); setError('') }} required><option value="">Chọn tàu</option>{ships.data?.map(ship => <option key={ship.shipId} value={ship.shipId}>{ship.shipName} · {ship.shipCode}</option>)}</select></label>
      <label className={styles.field}>Chuyến liên quan (không bắt buộc)<select value={cruiseId} disabled={pending || !contextReady || !shipId} onChange={(event) => setCruiseId(event.target.value)}><option value="">Không gắn chuyến</option>{cruises.data?.filter(cruise => cruise.shipId === shipId).map(cruise => <option key={cruise.cruiseId} value={cruise.cruiseId}>{cruise.cruiseName} · {cruise.cruiseCode}</option>)}</select></label>
      <label className={styles.field}>Cabin liên quan (không bắt buộc)<select value={cabinId} disabled={pending || !contextReady || !shipId} onChange={(event) => setCabinId(event.target.value)}><option value="">Không gắn cabin</option>{cabins.data?.filter(cabin => cabin.shipId === shipId).map(cabin => <option key={cabin.cabinId} value={cabin.cabinId}>Cabin {cabin.cabinNumber}</option>)}</select></label>
      <label className={`${styles.field} ${styles.fullWidth}`}>Mô tả *<textarea value={description} disabled={pending} required onChange={(event) => setDescription(event.target.value)} /></label>
    </div>
    {!allowed && <p role="status">{access.status === 'loading' ? 'Đang tải quyền tài khoản…' : access.error || 'Tài khoản chưa có quyền báo cáo sự cố.'}</p>}
    {!contextReady && !lookupError && <p role="status">Đang tải tàu, chuyến và cabin…</p>}
    {lookupError && <div className={styles.errorBanner} role="alert">{lookupError.message} <button type="button" className={styles.secondaryButton} onClick={() => { ships.retry(); cruises.retry(); cabins.retry() }}>Thử lại</button></div>}
    {contextReady && !ships.data?.length && <p role="status">Chưa có tàu. Hãy tạo tàu trước khi báo cáo sự cố.</p>}
    {contextReady && shipId && locationError && <div className={styles.errorBanner} role="alert">{locationError}</div>}
    <aside className={styles.permissionNote}>Người báo cáo được ghi nhận theo tài khoản đang đăng nhập.</aside>
    {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}
  </ActionDialog>
}
