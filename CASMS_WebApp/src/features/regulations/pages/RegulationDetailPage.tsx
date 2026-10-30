import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'

import { regulationsApi } from '../api/regulations-api'
import { formatDateTime, regulationValue, getEffectiveStatus, scopeLabels, typeLabels, type ConflictResult, type RegulationStatus } from '../model/regulation'
import { AdminFrame, Button, ConflictCard, LoadingPanel, Modal, Notice, PageHeader, Panel, StatusBadge } from '../components/RegulationUI'
import styles from '../components/Regulations.module.css'

export function RegulationDetailPage() {
  const access = useSessionAccess()
  const canStatus = (status: RegulationStatus) => status === 'ACTIVE' ? access.canDo('REGULATION_ACTIVATE') && access.canDo('REGULATION_VALIDATE') : access.canDo('REGULATION_DEACTIVATE')
  const { regulationId = '' } = useParams()
  const navigate = useNavigate()
  const [loadedData, setData] = useState<Awaited<ReturnType<typeof regulationsApi.get>>>(null)
  const data=loadedData?.regulation.id===regulationId?loadedData:null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [nextStatus, setNextStatus] = useState<RegulationStatus | null>(null)
  const [precheck, setPrecheck] = useState<ConflictResult | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    void regulationsApi.get(regulationId).then((result) => { if (active) setData(result) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Không tải được quy định.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [regulationId])

  async function check(kind: 'validate' | 'conflicts') {
    if (lock.current || !access.canDo('REGULATION_VALIDATE')) return
    lock.current = true; setBusy(true); setError(''); setSuccess(''); setPrecheck(null)
    try {
      if (kind === 'validate') { await regulationsApi.validate(regulationId); setSuccess('Dữ liệu quy định hợp lệ.') }
      else setPrecheck(await regulationsApi.conflicts(regulationId))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không kiểm tra được quy định.') }
    finally { lock.current = false; setBusy(false) }
  }

  async function openStatus(status: RegulationStatus) {
    if (lock.current || !canStatus(status)) return
    setNextStatus(status); setPrecheck(null); setError(''); setSuccess('')
    if (status !== 'ACTIVE') return
    lock.current = true; setBusy(true)
    try { setPrecheck(await regulationsApi.precheckStatus(regulationId, status)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không kiểm tra được xung đột.') }
    finally { lock.current = false; setBusy(false) }
  }

  async function confirmStatus() {
    if (!nextStatus || lock.current || !canStatus(nextStatus) || (nextStatus === 'ACTIVE' && !precheck?.canProceed)) return
    lock.current = true; setBusy(true); setError('')
    try {
      if (nextStatus === 'ACTIVE') {
        const latestPrecheck = await regulationsApi.precheckStatus(regulationId, nextStatus)
        setPrecheck(latestPrecheck)
        if (!latestPrecheck.canProceed) return
      }
      await regulationsApi.changeStatus(regulationId, nextStatus)
      setData(await regulationsApi.get(regulationId)); setNextStatus(null)
      setSuccess('Đã cập nhật trạng thái quy định.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được quy định.') }
    finally { lock.current = false; setBusy(false) }
  }

  async function handleDelete() {
    if (lock.current || !access.canDo('REGULATION_DELETE')) return
    lock.current = true; setBusy(true); setError('')
    try {
      await regulationsApi.deleteUnused(regulationId)
      navigate('/admin/regulations')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xóa quy định.')
      setDeleteOpen(false)
    } finally {
      lock.current = false; setBusy(false)
    }
  }

  return <AdminFrame>
    {loading && <LoadingPanel />}
    {!loading && !data && <><PageHeader title={error ? 'Không tải được quy định' : 'Không tìm thấy quy định'} description={error || 'Quy định không tồn tại hoặc đã được xóa.'} /><Button tone="secondary" onClick={() => navigate('/admin/regulations')}>Về danh sách</Button></>}
    {data && <>
      <PageHeader title={`${data.regulation.code} · ${data.regulation.name}`} description={typeLabels[data.regulation.type]} actions={(access.canDo("REGULATION_UPDATE") ? <Button disabled={!access.canDo("REGULATION_UPDATE")} onClick={() => navigate(`/admin/regulations/${regulationId}/edit`)}>Chỉnh sửa quy định</Button> : null)} />
      <div className={styles.summaryBadges}><StatusBadge status={data.regulation.status} /><span className={styles.scopeBadge}>{scopeLabels[data.regulation.scope]}</span><StatusBadge status={getEffectiveStatus(data.regulation,new Date().toISOString())}/></div>
      {error && !nextStatus && !deleteOpen && <Notice title="Chưa thể thực hiện" tone="error">{error}</Notice>}
      {success && <Notice title="Đã cập nhật" tone="success">{success}</Notice>}
      <div className={styles.regulationColumns}>
        <Panel title="Thông tin quy định">
          <dl className={styles.regulationFacts}>
            <dt>Thời gian hiệu lực · Giờ Việt Nam</dt><dd>{formatDateTime(data.regulation.effectiveFrom)} → {formatDateTime(data.regulation.effectiveTo)}</dd>
            <dt>Phạm vi áp dụng</dt><dd>{scopeLabels[data.regulation.scope]}{data.regulation.scope==='GLOBAL'?<p className={styles.muted}>Tự động áp dụng khi có hiệu lực; không cần gán riêng.</p>:<p className={styles.muted}>Quản lý liên kết tại phần quy định của tàu hoặc lần khởi hành.</p>}</dd>
            <dt>Giá trị quy định</dt><dd>{typeLabels[data.regulation.type]} = {regulationValue(data.regulation)}</dd>
            {data.regulation.description && <><dt>Mô tả</dt><dd>{data.regulation.description}</dd></>}
          </dl>
        </Panel>
        <aside className={styles.validationRail}>
          {access.canDo("REGULATION_VALIDATE") && <Button tone="secondary" disabled={busy || !access.canDo("REGULATION_VALIDATE")} onClick={() => void check('validate')}>Kiểm tra dữ liệu</Button>}
          {access.canDo("REGULATION_VALIDATE") && <Button tone="secondary" disabled={busy || !access.canDo("REGULATION_VALIDATE")} onClick={() => void check('conflicts')}>Kiểm tra xung đột</Button>}
          {data.regulation.status === 'ACTIVE'
            ? canStatus("INACTIVE") && <Button disabled={busy || !canStatus("INACTIVE") || !data.capabilities.canDeactivate.allowed} onClick={() => void openStatus('INACTIVE')}>Ngừng kích hoạt</Button>
            : canStatus("ACTIVE") && <Button disabled={busy || !canStatus("ACTIVE") || !data.capabilities.canActivate.allowed} onClick={() => void openStatus('ACTIVE')}>Kích hoạt</Button>}
          {data.regulation.status !== 'ACTIVE' && !data.capabilities.canActivate.allowed && <Notice title="Chưa thể kích hoạt" tone="warning">{data.capabilities.canActivate.reason}</Notice>}
          {access.canDo("REGULATION_DELETE") && <Button tone="danger" disabled={busy || !access.canDo("REGULATION_DELETE")} onClick={() => { setError(''); setDeleteOpen(true) }}>Xóa quy định</Button>}
          {busy && <p role="status">Đang kiểm tra…</p>}
          {precheck && !nextStatus && <ConflictCard result={precheck} />}
        </aside>
      </div>
    </>}
    {nextStatus && canStatus(nextStatus) && data && <Modal busy={busy} title={nextStatus === 'ACTIVE' ? 'Kích hoạt quy định?' : 'Ngừng kích hoạt quy định?'} description={`${data.regulation.code} · ${data.regulation.name}`} onClose={() => { if (!busy) setNextStatus(null) }} footer={<div className={styles.modalActions}><Button tone="secondary" disabled={busy} onClick={() => setNextStatus(null)} data-overlay-dismiss>Quay lại</Button><Button disabled={busy || (nextStatus === 'ACTIVE' && !precheck?.canProceed)} onClick={() => void confirmStatus()}>{nextStatus === 'ACTIVE' ? 'Kích hoạt quy định' : 'Ngừng kích hoạt quy định'}</Button></div>}>
      {nextStatus==='INACTIVE'&&<p>Quy định sẽ không còn được tính vào các kiểm tra hiệu lực. Các liên kết đã gán vẫn được giữ.</p>}
      {busy && <LoadingPanel label="Đang xử lý…" />}
      {precheck && <ConflictCard result={precheck} />}
      {error && <Notice title="Không thể cập nhật" tone="error">{error}</Notice>}

    </Modal>}
    {deleteOpen && access.canDo("REGULATION_DELETE") && data && <Modal busy={busy} title="Xóa quy định?" description={`${data.regulation.code} · ${data.regulation.name}`} onClose={() => { if (!busy) setDeleteOpen(false) }} footer={<div className={styles.modalActions}>
        <Button tone="secondary" disabled={busy} onClick={() => setDeleteOpen(false)} data-overlay-dismiss>Quay lại</Button>
        <Button tone="danger" disabled={busy} onClick={() => void handleDelete()}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button>
      </div>}>
      <p>Chỉ có thể xóa quy định chưa có liên kết với tàu hoặc lần khởi hành.</p>
      {error && <Notice title="Không thể xóa" tone="error">{error}</Notice>}

    </Modal>}
  </AdminFrame>
}
