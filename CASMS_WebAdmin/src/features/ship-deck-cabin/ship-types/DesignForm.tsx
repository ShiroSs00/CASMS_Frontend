import { useCallback, useContext, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Loading, Notice, PageHeader, Panel, PermissionLink } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { ShipViewerContext } from './viewer-context'
import { shipTypesApi, shipError, unknownOutcome, type DesignManifest, type StoredDesign } from './api'
import { DesignPreviewContent } from './DesignPreview'
import { metadataIssues } from './design-metadata'
import { loadAttempt, saveAttempt } from './attempt-storage'
import styles from './ShipWork.module.css'

function ExistingDesign({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => shipTypesApi.detail(id, signal), [id])
  const query = useReadQuery('design-form:' + id, load)
  if (query.loading) return <Loading />
  if (query.error) return <Notice title="Chưa tải được loại tàu" tone="error">{shipError(query.error)} <Button tone="text" onClick={query.retry}>Thử lại</Button></Notice>
  return query.data && <DesignForm id={id} originalKey={query.data.modelKey} />
}

function DesignForm({ id, originalKey }: { id?: string; originalKey?: string }) {
  const access = useSessionAccess()
  const viewer = useContext(ShipViewerContext)
  const navigate = useNavigate()
  const storageKey = 'ship-design-attempt:' + access.userId + ':' + (id ?? 'new')
  const [pending, setPending] = useState(() => loadAttempt<StoredDesign>(storageKey))
  const [checked, setChecked] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [design, setDesign] = useState<StoredDesign | null>(null)
  const [preview, setPreview] = useState<{ manifest: DesignManifest; fingerprint: string } | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState('')
  const locked = useRef(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const canUpload = Boolean(viewer) && access.roles.includes('ADMIN') && ['SHIP_CREATE', 'SHIP_MODEL_CREATE', 'SHIP_MODEL_READ'].every(access.canDo)
  const returnPath = id ? '/admin/ship-types/' + id : '/admin/ship-types'
  const actionLabel = id ? 'Áp dụng phiên bản' : 'Lưu loại tàu'

  async function run(label: string, action: () => Promise<void>) {
    if (locked.current || !canUpload) return
    locked.current = true
    setBusy(label)
    setError('')
    setStatus('')
    try {
      await action()
    } catch (failure) {
      setError(shipError(failure))
    } finally {
      locked.current = false
      setBusy('')
    }
  }

  async function loadPreview(candidate: StoredDesign) {
    if (!viewer) return
    const manifest = await shipTypesApi.preview(candidate)
    setPreview({ manifest, fingerprint: await viewer.fingerprint(manifest) })
    requestAnimationFrame(() => stepHeading.current?.focus())
  }

  function upload() {
    if (!viewer) return
    if (!file) {
      setFileError('Chọn một tệp ZIP mô hình.')
      return
    }
    void run('Đang xác minh ZIP…', async () => {
      let modelKey: string
      try {
        modelKey = (await viewer.readBundle(file)).modelKey
        if (originalKey && modelKey !== originalKey) throw new Error('Gói thay thế phải có cùng mã thiết kế ' + originalKey + '.')
      } catch (failure) {
        setFileError(shipError(failure))
        document.getElementById('ship-bundle')?.focus()
        return
      }
      const uploaded = await shipTypesApi.upload(modelKey, file)
      setDesign(uploaded)
      await loadPreview(uploaded)
    })
  }

  function confirm(candidate: StoredDesign) {
    void run(id ? 'Đang áp dụng phiên bản…' : 'Đang lưu loại tàu…', async () => {
      saveAttempt(storageKey, candidate)
      setPending(candidate)
      setChecked(false)
      try {
        const result = id ? await shipTypesApi.replace(id, candidate) : await shipTypesApi.create(candidate)
        saveAttempt(storageKey, null)
        navigate('/admin/ship-types/' + result.shipTypeId, { replace: true })
      } catch (failure) {
        if (!unknownOutcome(failure)) {
          saveAttempt(storageKey, null)
          setPending(null)
        }
        throw failure
      }
    })
  }

  function checkResult(candidate: StoredDesign) {
    void run('Đang kiểm tra kết quả…', async () => {
      const record = id ? await shipTypesApi.detail(id) :
        (await shipTypesApi.list(0, candidate.modelKey, undefined)).content.find(row => row.code === candidate.modelKey)
      if (record?.modelKey === candidate.modelKey && record.assetVersion === candidate.assetVersion) {
        saveAttempt(storageKey, null)
        navigate('/admin/ship-types/' + record.shipTypeId, { replace: true })
      } else if (!id && record) {
        setStatus('Mã loại đang gắn phiên bản khác. Mở danh sách loại tàu để đối chiếu.')
      } else {
        setChecked(true)
        setStatus('Chưa thấy phiên bản này được xác nhận. Có thể gửi lại cùng bản đã kiểm tra.')
      }
    })
  }

  return <div className={styles.stack}>
    <PageHeader title={id ? 'Thay phiên bản mô hình' : 'Tạo loại tàu từ mô hình 3D'} breadcrumb="Cấu hình tàu / Loại tàu / Mô hình 3D" />
    <PermissionLink to={returnPath}>{id ? 'Về chi tiết loại tàu' : 'Về danh sách loại tàu'}</PermissionLink>
    {!canUpload && <Notice title="Chưa có quyền tải và xem mô hình" tone="warning">Tài khoản cần quyền tạo loại tàu và đọc mô hình.</Notice>}
    {error && <Notice title="Chưa thực hiện được thao tác" tone="error">{error}</Notice>}
    {status && <Notice title="Kết quả kiểm tra" tone="info">{status}</Notice>}
    {pending ? <Panel title="Xác minh trạng thái lưu">
      <p>Mã {pending.modelKey}. Hệ thống sẽ kiểm tra phiên bản đã gửi.</p>
      <div className={styles.actions}>
        <Button busy={Boolean(busy)} onClick={() => checkResult(pending)}>Kiểm tra kết quả</Button>
        {checked && <Button tone="secondary" disabled={Boolean(busy)} onClick={() => confirm(pending)}>{actionLabel}</Button>}
      </div>
    </Panel> : <>
      <ol className={styles.stepper} aria-label="Tiến độ tạo loại tàu">
        <li aria-current={design ? undefined : 'step'}>1. Tải ZIP</li>
        <li aria-current={design && !preview ? 'step' : undefined}>2. Đọc manifest</li>
        <li aria-current={preview ? 'step' : undefined}>3. Xem và xác nhận</li>
      </ol>
      {!design && <Panel title="Gói mô hình">
        <form onSubmit={event => { event.preventDefault(); upload() }}>
          <Field htmlFor="ship-bundle" label="Tệp ZIP mô hình *" error={fileError} hint="Dùng ZIP chứa manifest.json, checksums.json và các tệp GLB được tham chiếu.">
            <input id="ship-bundle" type="file" accept=".zip,application/zip" disabled={Boolean(busy) || !canUpload}
              onChange={event => { setFile(event.target.files?.[0] ?? null); setFileError('') }} />
          </Field>
          <div className={styles.actions}><Button type="submit" busy={Boolean(busy)} disabled={!canUpload}>{busy || 'Tải lên và xác minh'}</Button></div>
        </form>
      </Panel>}
      {design && <Panel>
        <h2 ref={stepHeading} tabIndex={-1}>Bản xem trước thiết kế</h2>
        <dl className={styles.facts}><div><dt>Mã thiết kế</dt><dd>{design.modelKey}</dd></div><div><dt>Phiên bản đã xác minh</dt><dd>{design.assetVersion}</dd></div></dl>
        {preview && <DesignPreviewContent design={design} manifest={preview.manifest} />}
        <div className={styles.actions}>
          {preview ? <Button busy={Boolean(busy)} disabled={!canUpload || metadataIssues(preview.manifest).length > 0}
            onClick={() => void viewer?.fingerprint(preview.manifest).then(fingerprint => {
              if (fingerprint === preview.fingerprint) confirm(design)
              else setError('Bản xem trước đã thay đổi. Vui lòng tải lại.')
            }).catch(() => setError('Chưa xác minh được bản xem trước. Vui lòng tải lại.'))}>{actionLabel}</Button>
            : <Button busy={Boolean(busy)} onClick={() => void run('Đang đọc manifest…', () => loadPreview(design))}>Đọc lại manifest</Button>}
          <Button tone="secondary" disabled={Boolean(busy)} onClick={() => { setFile(null); setDesign(null); setPreview(null); setError('') }}>Chọn ZIP khác</Button>
        </div>
      </Panel>}
    </>}
  </div>
}

export function ShipTypeDesignPage() {
  const { typeId } = useParams()
  return <AdminShell>{typeId ? <ExistingDesign key={typeId} id={typeId} /> : <DesignForm />}</AdminShell>
}
