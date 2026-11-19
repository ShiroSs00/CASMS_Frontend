import { useCallback, useContext, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
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
  const fileInput = useRef<HTMLInputElement>(null)
  const canUpload = Boolean(viewer) && access.roles.includes('ADMIN') && ['SHIP_CREATE', 'SHIP_MODEL_CREATE', 'SHIP_MODEL_READ'].every(access.canDo)
  const returnPath = id ? '/admin/ship-types/' + id : '/admin/ship-types'
  const actionLabel = id ? 'Áp dụng thiết kế' : 'Tạo loại tàu'

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
      setFileError('Chọn tệp thiết kế để tiếp tục.')
      document.getElementById('ship-bundle-picker')?.focus()
      return
    }
    void run('Đang kiểm tra thiết kế…', async () => {
      let modelKey: string
      try {
        modelKey = (await viewer.readBundle(file)).modelKey
        if (originalKey && modelKey !== originalKey) throw new Error('Gói thay thế phải có cùng mã thiết kế ' + originalKey + '.')
      } catch (failure) {
        setFileError(shipError(failure))
        document.getElementById('ship-bundle-picker')?.focus()
        return
      }
      const uploaded = await shipTypesApi.upload(modelKey, file)
      setDesign(uploaded)
      await loadPreview(uploaded)
    })
  }

  function confirm(candidate: StoredDesign, reviewed?: NonNullable<typeof preview>) {
    void run(id ? 'Đang áp dụng thiết kế…' : 'Đang tạo loại tàu…', async () => {
      if (reviewed && await viewer?.fingerprint(reviewed.manifest) !== reviewed.fingerprint) {
        throw new Error('Bản xem trước đã thay đổi. Vui lòng tải lại.')
      }
      if (!saveAttempt(storageKey, candidate)) {
        throw new Error('Trình duyệt chưa lưu được thiết kế đang xác nhận. Bật lưu trữ cho trang này rồi thử lại.')
      }
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
        setStatus('Mã loại đang dùng thiết kế khác. Mở danh sách loại tàu để đối chiếu.')
      } else {
        setChecked(true)
        setStatus('Chưa thấy thiết kế này được xác nhận. Có thể gửi lại cùng bản đã kiểm tra.')
      }
    })
  }

  return <div className={`${styles.stack} ${styles.designPage}`}>
    <PageHeader title={id ? 'Cập nhật thiết kế loại tàu' : 'Tạo loại tàu'}
      breadcrumb={'Cấu hình tàu / Loại tàu / ' + (id ? 'Cập nhật thiết kế' : 'Tạo mới')}
      description={id ? 'Chọn thiết kế thay thế và kiểm tra thông tin trước khi áp dụng.' : 'Chọn thiết kế và kiểm tra thông tin trước khi tạo loại tàu.'}
      actions={<ButtonLink to={returnPath} tone="secondary" autoWidth><span aria-hidden="true">←</span> {id ? 'Về chi tiết loại tàu' : 'Về danh sách loại tàu'}</ButtonLink>} />
    {!canUpload && <Notice title="Chưa có quyền nhập thiết kế" tone="warning">Tài khoản cần quyền tạo loại tàu và đọc mô hình.</Notice>}
    {error && <Notice title="Chưa thực hiện được thao tác" tone="error">{error}</Notice>}
    {status && <Notice title="Kết quả kiểm tra" tone="info">{status}</Notice>}
    {pending ? <Panel title="Xác minh trạng thái lưu">
      <p>Mã {pending.modelKey}. Hệ thống sẽ kiểm tra thiết kế đã gửi.</p>
      <div className={styles.actions}>
        <Button busy={Boolean(busy)} onClick={() => checkResult(pending)}>Kiểm tra kết quả</Button>
        {checked && <Button tone="secondary" disabled={Boolean(busy)} onClick={() => confirm(pending)}>{actionLabel}</Button>}
      </div>
    </Panel> : <>
      <ol className={styles.designSteps} aria-label={id ? 'Tiến độ thay phiên bản thiết kế' : 'Tiến độ tạo loại tàu'}>
        <li aria-current={design ? undefined : 'step'}><span aria-hidden="true">1</span> Chọn thiết kế</li>
        <li aria-current={design && !preview ? 'step' : undefined}><span aria-hidden="true">2</span> Kiểm tra thông tin</li>
        <li aria-current={preview ? 'step' : undefined}><span aria-hidden="true">3</span> {id ? 'Xác nhận cập nhật' : 'Xác nhận tạo'}</li>
      </ol>
      {!design && <Panel title="Thiết kế loại tàu" subtitle="Thông tin và cấu trúc loại tàu sẽ được đọc từ tệp thiết kế.">
        <form onSubmit={event => { event.preventDefault(); upload() }}>
          <Field htmlFor="ship-bundle" label="Tệp thiết kế *" error={fileError} hint="Sử dụng gói thiết kế định dạng .zip.">
            <input ref={fileInput} hidden id="ship-bundle" type="file" accept=".zip,application/zip" disabled={Boolean(busy) || !canUpload}
              onChange={event => { setFile(event.target.files?.[0] ?? null); setFileError('') }} />
            <div className={styles.designFilePicker}>
              <Button id="ship-bundle-picker" tone="secondary" autoWidth disabled={Boolean(busy) || !canUpload}
                aria-describedby="ship-bundle-hint" aria-invalid={Boolean(fileError)} onClick={() => fileInput.current?.click()}>
                {file ? 'Đổi tệp thiết kế' : 'Chọn tệp thiết kế'}
              </Button>
              <p role="status">{file ? file.name : 'Chưa chọn tệp thiết kế'}</p>
            </div>
          </Field>
          <div className={styles.designFormActions}>
            <p>Bạn sẽ xác nhận thông tin ở bước cuối.</p>
            <Button type="submit" busy={Boolean(busy)} disabled={!canUpload}>{busy || 'Kiểm tra thiết kế'}</Button>
          </div>
        </form>
      </Panel>}
      {design && <Panel>
        <h2 ref={stepHeading} tabIndex={-1}>Thông tin loại tàu</h2>
        <p>Mã loại: {design.modelKey}</p>
        {preview && <DesignPreviewContent manifest={preview.manifest} />}
        <div className={styles.actions}>
          {preview ? <Button busy={Boolean(busy)} disabled={!canUpload || metadataIssues(preview.manifest).length > 0}
            onClick={() => confirm(design, preview)}>{actionLabel}</Button>
            : <Button busy={Boolean(busy)} onClick={() => void run('Đang đọc thông tin thiết kế…', () => loadPreview(design))}>Kiểm tra lại thiết kế</Button>}
          <Button tone="secondary" disabled={Boolean(busy)} onClick={() => { setFile(null); setDesign(null); setPreview(null); setError('') }}>Chọn thiết kế khác</Button>
        </div>
      </Panel>}
    </>}
  </div>
}

export function ShipTypeDesignPage() {
  const { typeId } = useParams()
  return <AdminShell>{typeId ? <ExistingDesign key={typeId} id={typeId} /> : <DesignForm />}</AdminShell>
}
