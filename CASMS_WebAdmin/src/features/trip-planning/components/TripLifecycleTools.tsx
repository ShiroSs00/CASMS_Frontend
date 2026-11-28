import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Field, Modal, Notice } from '@/shared/ui'
import { usePlanning } from '../hooks'
import { type Trip, versionLabels } from '../model/plan'
import { failure } from '../api/live'
import { useTripOperation } from '../useTripOperation'
import { OperationRecovery } from './OperationNotice'
import styles from '../Planning.module.css'

export function TripLifecycleTools({ trip, disabled, onChanged }: { trip: Trip; disabled: boolean; onChanged: (trip: Trip) => void }) {
  const { gateway, root, can } = usePlanning(), navigate = useNavigate(), operation = useTripOperation('clone')
  const [open, setOpen] = useState<'reuse' | 'archive' | null>(null)
  const [source, setSource] = useState(''), [reason, setReason] = useState(''), [error, setError] = useState('')
  const [busy, setBusy] = useState(false), [unknown, setUnknown] = useState(false), [recovery, setRecovery] = useState(false)
  const lock = useRef(false)
  const versions = (trip.versions ?? []).filter(version => version.status !== 'CANCELLED')
  const reviewing = versions.some(version => version.status === 'IN_REVIEW')
  if (gateway.readOnly || !can('TRIP_CREATE') && !can('TRIP_UPDATE')) return null
  async function execute() {
    if (lock.current || disabled || !open || unknown) return
    lock.current = true; setBusy(true); setError('')
    try {
      if (open === 'reuse') {
        if (!can('TRIP_CREATE') || versions.length && !versions.some(version => version.versionId === source)) return
        if (operation.blocked) { setRecovery(true); return }
        const request = operation.begin({ sourceVersionId: source || undefined })
        try {
          const created = await gateway.clone(trip.tripId, request.payload.sourceVersionId, request.key)
          operation.succeeded(created.tripId); navigate(`${root}/${created.tripId}/info`)
        } catch (cause) { operation.failed(cause); throw cause }
      } else {
        if (!can('TRIP_UPDATE') || reviewing || trip.status === 'ARCHIVED') return
        onChanged(await gateway.archive(trip.tripId, trip.revision, reason.trim() || undefined)); setOpen(null)
      }
    } catch (cause) {
      const fault = failure(cause); setError(fault.message)
      if (open === 'archive' && (fault.status === 0 || fault.status === 409 || fault.status >= 500)) setUnknown(true)
    } finally { lock.current = false; setBusy(false) }
  }
  async function reconcile() {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try { onChanged(await gateway.getTrip(trip.tripId)); setUnknown(false); setError(''); setOpen(null) }
    catch (cause) { setError(failure(cause).message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className={styles.tripLifecycle} aria-label="Tái sử dụng và vòng đời khung chuyến">
    <h2>Tái sử dụng và vòng đời</h2>
    {disabled && <p>Lưu hoặc hủy nội dung đang chỉnh sửa trước khi thực hiện các thao tác này.</p>}
    {can('TRIP_CREATE') && <div><div><h3>Lập khung chuyến tương tự</h3><p>Tạo khung chuyến riêng từ phiên bản bạn chọn. Nội dung nguồn được giữ nguyên.</p></div><Button tone="secondary" autoWidth disabled={disabled || busy} onClick={() => { setSource(''); setError(''); setOpen('reuse') }}>Chọn phiên bản nguồn</Button></div>}
    {can('TRIP_UPDATE') && trip.status !== 'ARCHIVED' && <div><div><h3>Ngừng sử dụng khung chuyến</h3><p>{reviewing ? 'Cần xử lý phiên bản đang chờ duyệt trước.' : 'Dừng dùng khung này cho chuyến mới; giữ các chuyến đã tạo.'}</p></div><Button tone="secondary" autoWidth disabled={disabled || busy || reviewing} onClick={() => { setReason(''); setError(''); setOpen('archive') }}>Ngừng sử dụng</Button></div>}
    {open && <Modal title={open === 'reuse' ? 'Lập khung chuyến từ lịch trình hiện có' : 'Ngừng sử dụng khung chuyến'} busy={busy} onClose={() => { if (!busy) setOpen(null) }} footer={<><Button tone="secondary" disabled={busy} onClick={() => setOpen(null)}>Hủy</Button><Button tone={open === 'archive' ? 'danger' : 'primary'} busy={busy} disabled={disabled || unknown || open === 'reuse' && versions.length > 0 && !source} onClick={() => void execute()}>{open === 'reuse' ? 'Tạo khung chuyến riêng' : 'Xác nhận ngừng sử dụng'}</Button></>}>
      <p>{trip.tripCode} · {trip.name}</p>
      {open === 'reuse' ? <><Field htmlFor="reuse-trip-version" label="Lịch trình nguồn"><select id="reuse-trip-version" value={source} disabled={busy} onChange={event => setSource(event.target.value)}><option value="">{versions.length ? 'Chọn phiên bản đã đối chiếu' : 'Chỉ có thông tin khung chuyến, chưa có lịch trình'}</option>{versions.map(version => <option key={version.versionId} value={version.versionId}>Bản {version.versionNumber} · {versionLabels[version.status]}</option>)}</select></Field><p>Hệ thống tạo mã mới và bản lịch trình nháp. Tiếp theo, kiểm tra tên và phạm vi của khung chuyến mới.</p></> : <><p>Khung sẽ chuyển sang Ngừng sử dụng. Các lịch trình và chuyến đã tạo vẫn được lưu.</p><Field htmlFor="archive-trip-reason" label="Lý do (không bắt buộc)"><textarea id="archive-trip-reason" value={reason} maxLength={500} disabled={busy} onChange={event => setReason(event.target.value)} /></Field></>}
      {error && <Notice title="Chưa xác nhận được kết quả" tone="error">{error}</Notice>}
      {unknown && <Button tone="secondary" disabled={busy} onClick={() => void reconcile()}>Đọc lại khung chuyến</Button>}
    </Modal>}
    {recovery && <OperationRecovery operation={operation} onClose={() => setRecovery(false)} />}
  </section>
}
