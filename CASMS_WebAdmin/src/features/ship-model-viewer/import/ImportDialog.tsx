import { ImportPreviewDetails } from './ImportPreviewDetails'
import { useCallback, useId, useRef, useState, type ReactNode, type SubmitEvent } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { shipProfilePayload, validateShipProfile, type ShipProfile } from '@/shared/lib/ship-profile'
import { shipImportApi, type ImportPreview, type ShipProvisionFields } from './api'
import { Button, Field, FormSection, Modal, Notice } from '@/shared/ui'
import { ShipProfileFields } from '@/shared/ui/ShipProfileFields'
import { importSteps, validateBundle, validateZip, type ImportSession } from './model'
import styles from './ShipImport.module.css'

type ImportDialogProps = {
  embedded?: boolean
  session: ImportSession
  busy: string
  error: string
  allowed: boolean
  verifying?: boolean
  importStatus?: ReactNode
  permissions: { upload: boolean; register: boolean; import: boolean }
  onPrepare: (draft: ImportSession, file: File | null) => Promise<void>
  onRegister: (supplements: ShipProvisionFields, preview: ImportPreview) => Promise<void>
  onImport: () => Promise<void>
  onChooseBundle: () => void
  onClose: () => void
}

const fileSize = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

export function ImportDialog({ embedded=false, session, busy, error, allowed, verifying=false, importStatus, permissions, onPrepare, onRegister, onImport, onChooseBundle, onClose }: ImportDialogProps) {
  const canReadShip = useSessionAccess().canDo('SHIP_READ')
  const [modelKey, setModelKey] = useState(session.modelKey)
  const [storedSelection, setStoredSelection] = useState(session.modelKey)
  const [stored, setStored] = useState(!permissions.upload && permissions.register)
  const [file, setFile] = useState<File | null>(null)
  const [supplements,setSupplements]=useState<Record<string,string|number>>({})
  const [profile, setProfile] = useState<ShipProfile>({})
  const profileErrors = validateShipProfile(profile)
  const changeProfile = <K extends keyof ShipProfile>(key: K, value: ShipProfile[K]) => {
    setProfile(current => ({ ...current, [key]: value }))
  }
  const loadStored=useCallback((signal:AbortSignal)=>stored&&permissions.register?shipImportApi.stored(signal):Promise.resolve([]),[stored,permissions.register])
  const models=useReadQuery(`stored-models:${stored}`,loadStored)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const zipError = file ? '' : errors.file
  const formId = useId()
  const titleId = `${formId}-title`
  const fileHelpId = `${formId}-file-help`
  const fileErrorId = `${formId}-file-error`
  const fileInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLDivElement>(null)
  const stage = session.registration ? 2 : session.uploaded ? 1 : 0
  const { modelKey: preparedKey, registration, uploaded } = session
  const loadPreview = useCallback((signal: AbortSignal) => {
    if (verifying) return Promise.resolve(null)
    if (registration) return canReadShip ? shipImportApi.registeredPreview(registration, signal) : Promise.resolve(null)
    return uploaded && permissions.register ? shipImportApi.preview(preparedKey, signal) : Promise.resolve(null)
  }, [canReadShip, permissions.register, preparedKey, registration, uploaded, verifying])
  const preview = useReadQuery(`import-preview:${session.attemptId}:${preparedKey}:${uploaded}:${registration?.shipModelId ?? ''}:${verifying}`, loadPreview)
  const missing = preview.data ? ([
    ['shipName', 'Tên tàu', !preview.data.name?.trim()],
    ['totalCapacity', 'Sức chứa hành khách', !(Number(preview.data.passengerCapacity) > 0)],
    ['totalDecks', 'Số boong hành khách', !(Number(preview.data.deckCount) > 0 || preview.data.decks.length)],
  ] as const).filter(([, , needed]) => needed) : []
  const supplementReady = missing.every(([key]) => key === 'shipName' ? !!String(supplements[key] ?? '').trim()
    : Number.isSafeInteger(supplements[key]) && Number(supplements[key]) > 0)

  async function prepare(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !allowed || !(stored ? permissions.register : permissions.upload)) return
    const form = event.currentTarget
    const key = stored ? storedSelection : modelKey.trim()
    const selectedFile = stored ? null : fileInput.current?.files?.[0] ?? file
    const fields = stored && !models.data?.some(row => row.modelKey === key)
      ? { modelKey: 'Chọn một mô hình đã tải lên.' }
      : validateBundle(key, selectedFile, stored)
    setErrors(fields)
    if (Object.keys(fields).length) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')?.focus())
      return
    }
    await onPrepare({
      modelKey: key,
      fileName: stored ? 'Gói đã tải (chờ kiểm tra)' : selectedFile?.name ?? '',
      uploaded: false,
      registration: null,
      job: null,
    }, selectedFile)
    requestAnimationFrame(() => heading.current?.focus())
  }

  const footer = <>
      {!embedded&&<Button tone="secondary" disabled={Boolean(busy)} onClick={onClose} data-overlay-dismiss>
        {stage === 0 ? 'Hủy' : 'Đóng'}
      </Button>}
      {stage === 1 && (permissions.upload || permissions.register) && <Button
        tone="secondary" disabled={Boolean(busy) || !allowed}
        onClick={() => { setStored(!permissions.upload); setFile(null); setErrors({}); setSupplements({}); setProfile({}); onChooseBundle(); heading.current?.focus() }}>
        Chọn mô hình khác
      </Button>}
      {stage === 0 && (stored ? permissions.register : permissions.upload) && <Button
        type="submit" form={formId} disabled={Boolean(busy) || !allowed}>
        {busy || (stored ? 'Dùng mô hình đã tải' : 'Tải mô hình lên')}
      </Button>}
      {stage === 1 && permissions.register && <Button disabled={Boolean(busy) || !allowed || preview.loading || !preview.data || !supplementReady || Object.keys(profileErrors).length > 0}
        onClick={() => preview.data && void onRegister({
          ...Object.fromEntries(missing.map(([key]) => [key, key === 'shipName' ? String(supplements[key]).trim() : supplements[key]])),
          ...shipProfilePayload(profile),
        }, preview.data)}>
        {busy || 'Xác nhận tạo tàu'}
      </Button>}
      {stage === 1 && !verifying && <Button tone="text" disabled={Boolean(busy) || !allowed || preview.loading} onClick={preview.retry}>
        Tải lại bản xem trước
      </Button>}
      {stage === 2 && permissions.import && <Button disabled={Boolean(busy) || !allowed} onClick={() => void onImport()}>
        {busy || 'Import cấu trúc tàu'}
      </Button>}
    </>
  const content = (
    <div ref={heading} tabIndex={-1} className={styles.stack}>
      {!embedded&&<ol className={styles.progress} aria-label="Các bước thiết lập mô hình tàu">
        {importSteps.map((label, i) => <li key={label} aria-current={i === stage ? 'step' : undefined} data-done={i < stage}>
          <span className={styles.progressNumber} aria-hidden="true">{i < stage ? '✓' : i + 1}</span>
          <span>{label}</span>
        </li>)}
      </ol>}

      {error && <Notice title="Không thể tiếp tục" tone="error">{error}</Notice>}
      {busy && <p role="status" className={styles.status}>{busy}</p>}

      {stage === 0 ? <form id={formId} className={styles.setupForm} onSubmit={event => void prepare(event)} noValidate aria-busy={Boolean(busy)}>
        <fieldset className={styles.mode} disabled={Boolean(busy)}>
          <legend>Chọn nguồn mô hình</legend>
          {permissions.upload && <label data-active={!stored}>
            <input type="radio" name="bundle-source" checked={!stored} onChange={() => { setStored(false); setErrors({}) }} />
            <span><strong>Tải tệp ZIP mới</strong></span>
          </label>}
          {permissions.register && <label data-active={stored}>
            <input type="radio" name="bundle-source" checked={stored} onChange={() => { setStored(true); setErrors({}) }} />
            <span><strong>Dùng mô hình đã tải</strong></span>
          </label>}
        </fieldset>

        {stored?<Field htmlFor="stored-model" label="Mô hình đã tải lên" error={errors.modelKey}>
          <select id="stored-model" name="stored-model" disabled={Boolean(busy)||models.loading||!models.data?.length} value={storedSelection} onChange={event=>{setStoredSelection(event.target.value);setErrors({})}}>
            <option value="">{models.loading?'Đang tải mô hình…':'Chọn mô hình'}</option>
            {models.data?.map(({ modelKey }) => <option key={modelKey} value={modelKey}>{modelKey}</option>)}
          </select>
          {models.error&&<Notice title="Không tải được danh sách mô hình" tone="error">{models.error.message}<Button tone="text" onClick={models.retry}>Thử lại</Button></Notice>}
          {!models.loading&&!models.error&&models.data?.length===0&&<p role="status">Chưa có mô hình đã tải lên.</p>}
        </Field>:<div className={styles.modelKeyField}>
          <Field htmlFor="import-model-key" label="Mã mô hình *" error={errors.modelKey}>
            <input id="import-model-key" name="modelKey" value={modelKey} onChange={event => setModelKey(event.target.value)} autoComplete="off" spellCheck={false} maxLength={80} disabled={Boolean(busy)} required />
          </Field>
        </div>}

        {!stored && <div className={styles.zipField}>
          <div className={styles.zipPicker} data-selected={!!file} data-invalid={!!zipError}>
            <svg className={styles.zipIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 3h7l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
              <path d="M14 3v5h4M10 11h2m-2 3h2m-2 3h2" />
            </svg>
            <div className={styles.zipCopy} aria-live="polite">
              <strong translate={file ? 'no' : undefined}>{file?.name ?? 'Tệp mô hình 3D'}</strong>
              <span id={fileHelpId}>{file ? `${fileSize.format(file.size / 1024 ** 2)} MB · Chưa tải lên` : 'Định dạng ZIP · Tối đa 2 GB'}</span>
            </div>
            <input ref={fileInput} type="file" name="bundle" accept=".zip,application/zip,application/x-zip-compressed" hidden disabled={Boolean(busy)}
              onChange={event => {
                const selectedFile = event.target.files?.[0]
                if (!selectedFile) return
                const message = validateZip(selectedFile)
                if (message) event.target.value = ''
                setFile(message ? null : selectedFile)
                setErrors(current => ({ ...current, file: message }))
              }} />
            <Button tone="secondary" autoWidth disabled={Boolean(busy)} aria-invalid={!!zipError || undefined}
              aria-describedby={zipError ? `${fileHelpId} ${fileErrorId}` : fileHelpId}
              onClick={() => fileInput.current?.click()}>
              {file ? 'Đổi tệp ZIP' : 'Chọn tệp ZIP'}
            </Button>
          </div>
          {zipError && <p className={styles.zipError} id={fileErrorId} role="alert">{zipError}</p>}
        </div>}
      </form> : <>
        <ImportPreviewDetails session={session} preview={preview}/>
        {stage===1&&missing.length>0&&<div className={styles.fields}>{missing.map(([key,label])=><Field key={key} htmlFor={`supplement-${key}`} label={`${label} *`}><input id={`supplement-${key}`} name={key} autoComplete="off" type={key==='shipName'?'text':'number'} min={1} maxLength={key==='shipName'?100:undefined} disabled={Boolean(busy)} value={supplements[key]??''} onChange={event=>setSupplements(current=>({...current,[key]:key==='shipName'||!event.target.value?event.target.value:Number(event.target.value)}))} required/></Field>)}</div>}
        {stage === 1 && permissions.register && preview.data && <FormSection title="Thông tin hồ sơ tàu (tùy chọn)">
          <ShipProfileFields profile={profile} errors={profileErrors} disabled={Boolean(busy)} onChange={changeProfile} />
        </FormSection>}
        {stage === 2 && <div className={styles.inlineConfirmation} role="status">
          {session.registration?.shipCreated ? 'Đã tạo hồ sơ tàu' : 'Đã cập nhật liên kết mô hình'}
        </div>}
        {stage === 2 && importStatus}
      </>}
    </div>
  )
  return embedded ? <section className={styles.editor} aria-labelledby={titleId}>
    <header className={styles.editorHeader}><h2 id={titleId}>{importSteps[stage]}</h2></header>
    <div key={stage} className={styles.stepBody}>{content}</div>
    <footer className={styles.editorFooter}>{footer}</footer>
  </section> : <Modal title="Thiết lập cấu trúc tàu" wide busy={Boolean(busy)} onClose={onClose} protectChanges={stage===0} footer={footer}>{content}</Modal>
}
