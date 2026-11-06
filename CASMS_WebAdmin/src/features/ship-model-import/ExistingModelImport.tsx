import { useEffect, useId, useRef, useState } from 'react'
import { getSessionAccess, useSessionAccess } from '@/shared/auth'
import { Button, Field, Modal, Notice } from '@/shared/ui'
import { viewerApi } from '../ship-model-viewer/api'
import { modelStatus, type ShipModel } from '../ship-model-viewer/model'
import { shipImportApi } from './api'
import { readBundleManifest, type LocalManifest } from './bundle-manifest'
import { ImportIssueList, ImportJobDetails } from './ImportJobDetails'
import { importErrorText, importOutcomeUnknown, rejectedImportIssues, type ImportJob } from './model'
import styles from './ShipImport.module.css'

type PendingImport = { modelKey: string; modelId: string | null; previousJobs: string[]; jobId?: string }
type Preview = { file: File; manifest: LocalManifest; stale: string[] | null }
type Props = {
  shipId: string; shipName: string; manifestModelId?: string | null
  models: ShipModel[]; onClose: () => void; onResult: (job: ImportJob, fromHistory?: boolean) => void
}

function matchModels(models: ShipModel[], key: string) {
  const matches = models.filter(row => row.modelKey === key)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return { matches, target: matches.find(row => row.status === 'READY') ?? matches.find(row => row.status === 'DRAFT') }
}

export function ExistingModelImport({ shipId, shipName, manifestModelId, models, onClose, onResult }: Props) {
  const access = useSessionAccess()
  const fileId = useId()
  const storageKey = `ocevie:ship-model-update:v1:${access.userId}:${shipId}`
  const [pending, setPending] = useState<PendingImport | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as PendingImport | null
      return value && typeof value.modelKey === 'string'
        && (value.modelId === null || typeof value.modelId === 'string')
        && Array.isArray(value.previousJobs) && value.previousJobs.every(id => typeof id === 'string') ? value : null
    }
    catch { return null }
  })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [failure, setFailure] = useState<unknown>(null)
  const [observed, setObserved] = useState<ImportJob | null>(null)
  const lock = useRef(false)
  const fileRequest = useRef(0)
  const summary = useRef<HTMLDivElement>(null)
  const key = preview?.manifest.modelKey ?? ''

  function permissionError(current: ShipModel[]) {
    if (!access.inWorkScope('ship-import') || !access.canDo('SHIP_MODEL_UPDATE')) return 'Bạn chưa có quyền cập nhật mô hình.'
    if (manifestModelId && key !== manifestModelId) return 'Mã trong manifest khác mã mô hình đã liên kết với tàu này.'
    const { matches, target } = matchModels(current, key)
    if (!target && matches.length) return 'Mô hình có mã này đang ở trạng thái không thể chỉnh sửa.'
    if (!target && !access.canDo('SHIP_MODEL_CREATE')) return 'Bạn chưa có quyền đăng ký model mới.'
    if (target?.status === 'READY' && !access.canDo('SHIP_MODEL_PUBLISH')) return 'Bạn chưa có quyền cập nhật model đang READY.'
    return ''
  }

  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  async function chooseFile(file?: File) {
    const request = ++fileRequest.current
    setPreview(null)
    setError('')
    setFailure(null)
    if (!file) return
    setBusy('Đang đọc thông tin trong ZIP…')
    try {
      const manifest = await readBundleManifest(file)
      const target = matchModels(models, manifest.modelKey).target
      const objects = target ? await viewerApi.objects(shipId, target.shipModelId).catch(() => null) : []
      const oldKeys = objects?.flatMap(row => row.nodeKey && ['DECK', 'CABIN', 'FACILITY'].includes(row.objectType) ? [row.nodeKey] : [])
      if (request === fileRequest.current) setPreview({ file, manifest,
        stale: oldKeys?.filter(nodeKey => !manifest.nodeKeys.has(nodeKey)) ?? null })
    } catch (cause) {
      if (request === fileRequest.current) setError(cause instanceof Error && cause.message.startsWith('Chọn gói')
        ? cause.message : 'Không đọc được manifest.json. Chọn gói ZIP chuẩn có mã mô hình hợp lệ.')
    } finally { if (request === fileRequest.current) setBusy('') }
  }

  async function upload() {
    if (lock.current || busy || !preview || pending || permissionError(models)) return
    lock.current = true
    setError('')
    setFailure(null)
    setBusy('Đang đối chiếu mô hình hiện tại…')
    let submitted = false
    try {
      if (localStorage.getItem(storageKey)) throw new Error('Tàu đang có yêu cầu cần đối chiếu. Mở lại hộp thoại để kiểm tra.')
      const latest = await viewerApi.models(shipId)
      const denied = permissionError(latest)
      if (denied) { setError(denied); return }
      const { target } = matchModels(latest, key)
      const previousTarget = matchModels(models, key).target
      if (target?.shipModelId !== previousTarget?.shipModelId || target?.status !== previousTarget?.status || target?.updatedAt !== previousTarget?.updatedAt) {
        setError('Mô hình đã thay đổi. Đóng hộp thoại và tải lại danh sách mô hình trước khi xác nhận.')
        return
      }
      const scope = target ? { shipId, shipModelId: target.shipModelId } : null
      const history = scope ? await shipImportApi.history(scope) : []
      if (getSessionAccess().userId !== access.userId) return
      if (history.some(job => job.status === 'RUNNING')) { setError('Model đang có lần import chưa hoàn tất.'); return }
      const operation = { modelKey: key, modelId: target?.shipModelId ?? null, previousJobs: history.map(job => job.jobId) }
      if (localStorage.getItem(storageKey)) throw new Error('Tàu đang có yêu cầu cần đối chiếu. Mở lại hộp thoại để kiểm tra.')
      localStorage.setItem(storageKey, JSON.stringify(operation))
      setPending(operation)
      submitted = true
      setBusy('Đang tải ZIP và import cấu trúc…')
      const job = await shipImportApi.importByCode(shipId, key, preview.file)
      if (target && target.shipModelId !== job.modelId) throw new Error('Kết quả trả về thuộc mô hình khác dự kiến.')
      if (job.status === 'RUNNING') {
        const running = { ...operation, modelId: job.modelId, jobId: job.jobId }
        localStorage.setItem(storageKey, JSON.stringify(running))
        setPending(running)
        return
      }
      localStorage.removeItem(storageKey)
      setPending(null)
      if (getSessionAccess().userId === access.userId) onResult(job)
    } catch (cause) {
      if (submitted && !importOutcomeUnknown(cause)) {
        try { localStorage.removeItem(storageKey); setPending(null) }
        catch { /* Keep the intent if the browser will not clear it. */ }
      }
      setFailure(cause)
      setError(submitted ? importErrorText(cause) : cause instanceof Error ? cause.message : 'Chưa thể chuẩn bị yêu cầu import.')
      requestAnimationFrame(() => summary.current?.focus())
    } finally { setBusy(''); lock.current = false }
  }

  async function reconcile() {
    if (!pending || lock.current) return
    lock.current = true
    setError('')
    setBusy('Đang đối chiếu lịch sử import…')
    try {
      const modelId = pending.modelId ?? matchModels(await viewerApi.models(shipId), pending.modelKey).target?.shipModelId
      if (!modelId) { setError('Chưa tìm thấy mô hình tương ứng. Kiểm tra lại sau.'); return }
      const jobs = await shipImportApi.history({ shipId, shipModelId: modelId })
      const candidates = jobs.filter(job => pending.jobId ? job.jobId === pending.jobId : !pending.previousJobs.includes(job.jobId))
      if (candidates.length !== 1) {
        setError(candidates.length ? 'Có nhiều lần import mới. Cần đối chiếu lịch sử trước khi tiếp tục.' : 'Chưa tìm thấy lần import mới. Yêu cầu có thể vẫn đang xử lý.')
        return
      }
      const job = await shipImportApi.job(shipId, candidates[0].jobId)
      if (getSessionAccess().userId !== access.userId) return
      if (job.modelId !== modelId || job.status === 'RUNNING') { setError('Chưa có kết quả cuối cùng cho lần import này.'); return }
      if (!pending.jobId) {
        setObserved(job)
        return
      }
      localStorage.removeItem(storageKey)
      setPending(null)
      onResult(job)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đọc được lịch sử import.') }
    finally { setBusy(''); lock.current = false }
  }

  function acceptObserved() {
    if (!observed || lock.current || getSessionAccess().userId !== access.userId) return
    try {
      localStorage.removeItem(storageKey)
      setPending(null)
      onResult(observed, true)
    } catch { setError('Không lưu được kết quả đối chiếu trên thiết bị.') }
  }

  const denied = preview ? permissionError(models) : ''
  const target = preview ? matchModels(models, key).target : undefined
  const issues = rejectedImportIssues(failure)
  return <Modal title="Cập nhật mô hình 3D" description={shipName} wide busy={!!busy} onClose={onClose} footer={<>
    <Button tone="secondary" disabled={!!busy} onClick={onClose} data-overlay-dismiss>Đóng</Button>
    {pending ? observed ? <Button disabled={!!busy} onClick={acceptObserved}>Đã đối chiếu lịch sử</Button>
      : <Button disabled={!!busy} onClick={() => void reconcile()}>Đối chiếu lịch sử</Button>
      : <Button disabled={!!busy || !preview || !!denied} onClick={() => void upload()}>Xác nhận cập nhật</Button>}
  </>}>
    <div className={styles.stack}>
      {busy && <p className={styles.status} role="status">{busy}</p>}
      {error && <div ref={summary} tabIndex={-1}><Notice title="Chưa thể tiếp tục" tone="error">{error}</Notice></div>}
      {issues.length > 0 && <ImportIssueList issues={issues} />}
      {observed && <>
        <Notice title="Tìm thấy lần import mới trong lịch sử" tone="warning">Đối chiếu thời điểm và kết quả trước khi xác nhận. Máy chủ chưa cung cấp mã để liên kết trực tiếp lần import này với yêu cầu đã mất kết nối.</Notice>
        <ImportJobDetails job={observed} canRead={access.canDo('SHIP_READ')} />
      </>}
      {pending ? <Notice title="Có yêu cầu cần đối chiếu" tone="warning">Kiểm tra lịch sử của mã <strong translate="no">{pending.modelKey}</strong> trước khi gửi yêu cầu khác.</Notice> : <>
        <Field htmlFor={fileId} label="Tệp ZIP mô hình" error={!preview && !busy && error ? error : undefined}>
          <input id={fileId} name="bundle" type="file" accept=".zip,application/zip" disabled={!!busy} onChange={event => void chooseFile(event.target.files?.[0])} />
        </Field>
        {preview && <section className={styles.bundlePreview} aria-label="Dữ liệu đọc từ tệp ZIP">
          <dl className={styles.previewFacts}>
            <div><dt>Mã mô hình</dt><dd translate="no">{key}</dd></div>
            <div><dt>Đích import</dt><dd>{target ? modelStatus[target.status] ?? target.status : 'Mô hình mới cho tàu này'}</dd></div>
          </dl>
          <p>{preview.manifest.deckCount} boong · {preview.manifest.cabinCount} phòng · {preview.manifest.areaCount} mục khu vực trong manifest</p>
          <p>Thông tin được đọc từ ZIP. Máy chủ sẽ kiểm tra GLB và liên kết khi import.</p>
        </section>}
        {target?.status === 'READY' && <Notice title="Model đang được sử dụng" tone="warning">Lần import có thể thay thế gói asset của model READY hiện tại.</Notice>}
        {preview?.stale?.length ? <Notice title="Có liên kết cũ cần kiểm tra" tone="warning">
          {preview.stale.length} mã liên kết hiện tại không có trong manifest mới. Các liên kết này có thể vẫn tồn tại sau khi import.
          <details><summary>Xem mã đối tượng</summary><p translate="no">{preview.stale.slice(0, 20).join(', ')}{preview.stale.length > 20 ? '…' : ''}</p></details>
        </Notice> : target && preview?.stale === null ? <p>Chưa đối chiếu được các liên kết đối tượng hiện tại.</p> : null}
        {denied && <Notice title="Chưa thể import mô hình này" tone="warning">{denied}</Notice>}
      </>}
    </div>
  </Modal>
}
