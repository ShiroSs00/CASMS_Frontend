import { ImportPreviewDetails } from './ImportPreviewDetails'
import { useCallback } from 'react'
import { useReadQuery } from '@/shared/api'
import { shipImportApi } from './api'
import { useRef, useState, type SubmitEvent } from 'react'
import { Button, Field, Modal, Notice } from '@/shared/ui'
import { validateBundle, type ImportSession } from './model'
import styles from './ShipImport.module.css'

type ImportDialogProps = {
  embedded?: boolean
  session: ImportSession
  busy: string
  error: string
  allowed: boolean
  permissions: { upload: boolean; register: boolean; import: boolean }
  onPrepare: (draft: ImportSession, file: File | null) => Promise<void>
  onRegister: (supplements?:Record<string,string|number>) => Promise<void>
  onImport: () => Promise<void>
  onChooseBundle: () => void
  onClose: () => void
}

const stages = ['Tải mô hình 3D', 'Lưu thông tin tàu', 'Tạo boong và phòng']

export function ImportDialog({ embedded=false, session, busy, error, allowed, permissions, onPrepare, onRegister, onImport, onChooseBundle, onClose }: ImportDialogProps) {
  const [modelKey, setModelKey] = useState(session.modelKey)
  const [assetVersion, setAssetVersion] = useState(session.assetVersion)
  const [stored, setStored] = useState(!permissions.upload && permissions.register)
  const [file, setFile] = useState<File | null>(null)
  const [supplements,setSupplements]=useState<Record<string,string|number>>({})
  const loadStored=useCallback((signal:AbortSignal)=>stored&&permissions.register?shipImportApi.stored(signal):Promise.resolve([]),[stored,permissions.register])
  const models=useReadQuery(`stored-models:${stored}`,loadStored)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const heading = useRef<HTMLDivElement>(null)
  const stage = session.registration ? 2 : session.uploaded ? 1 : 0

  async function prepare(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allowed || !(stored ? permissions.register : permissions.upload)) return
    if(stored&&!models.data?.some(row=>row.modelKey===modelKey&&row.assetVersion===assetVersion)){setErrors({modelKey:'Chọn một mô hình đã tải lên.'});return}
    const fields = validateBundle(modelKey.trim(), assetVersion.trim(), file, stored)
    setErrors(fields)
    if (Object.keys(fields).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#ship-import-form [aria-invalid="true"]')?.focus())
      return
    }
    await onPrepare({
      modelKey: modelKey.trim(),
      assetVersion: assetVersion.trim(),
      fileName: stored ? 'Gói đã tải (chờ kiểm tra)' : file?.name ?? '',
      uploaded: false,
      registration: null,
      job: null,
    }, stored ? null : file)
    heading.current?.focus()
  }

  const footer = <>
      {!embedded&&<Button tone="secondary" disabled={Boolean(busy)} onClick={onClose} data-overlay-dismiss>
        {stage === 0 ? 'Hủy' : 'Đóng'}
      </Button>}
      {stage === 1 && (permissions.upload || permissions.register) && <Button
        tone="secondary" disabled={Boolean(busy) || !allowed}
        onClick={() => { setStored(false); setFile(null); setErrors({}); onChooseBundle(); heading.current?.focus() }}>
        Chọn mô hình khác
      </Button>}
      {stage === 0 && (stored ? permissions.register : permissions.upload) && <Button
        type="submit" form="ship-import-form" disabled={Boolean(busy) || !allowed}>
        {busy || (stored ? 'Tiếp tục với mô hình đã tải' : 'Tải mô hình')}
      </Button>}
      {stage === 1 && permissions.register && <Button disabled={Boolean(busy) || !allowed} onClick={() => void onRegister(supplements)}>
        {busy || 'Lưu thông tin tàu'}
      </Button>}
      {stage === 2 && permissions.import && <Button disabled={Boolean(busy) || !allowed} onClick={() => void onImport()}>
        {busy || 'Tạo boong và phòng'}
      </Button>}
    </>
  const content = (
    <div ref={heading} tabIndex={-1} className={styles.stack}>
      {!embedded&&<ol className={styles.progress} aria-label="Các bước thiết lập mô hình tàu">
        {stages.map((label, i) => <li key={label} aria-current={i === stage ? 'step' : undefined} data-done={i < stage}>
          <span className={styles.progressNumber} aria-hidden="true">{i < stage ? '✓' : `0${i + 1}`}</span>
          <span>{label}</span>
        </li>)}
      </ol>}

      {error && <Notice title="Không thể tiếp tục" tone="error">{error}</Notice>}
      {busy && <p role="status" className={styles.status}>{busy}</p>}

      {stage === 0 ? <form id="ship-import-form" className={styles.stack} onSubmit={event => void prepare(event)} noValidate aria-busy={Boolean(busy)}>
        <fieldset className={styles.mode} disabled={Boolean(busy)}>
          <legend>Chọn nguồn mô hình</legend>
          {permissions.upload && <label data-active={!stored}>
            <input type="radio" name="bundle-source" checked={!stored} onChange={() => { setStored(false); setErrors({}) }} />
            <span><strong>Tải mô hình mới</strong></span>
          </label>}
          {permissions.register && <label data-active={stored}>
            <input type="radio" name="bundle-source" checked={stored} onChange={() => { setStored(true); setErrors({}) }} />
            <span><strong>Sử dụng mô hình đã tải lên</strong></span>
          </label>}
        </fieldset>

        {stored?<Field htmlFor="stored-model" label="Mô hình đã tải lên" error={errors.modelKey||errors.assetVersion}>
          <select id="stored-model" disabled={Boolean(busy)||models.loading||!models.data?.length} value={JSON.stringify([modelKey,assetVersion])} onChange={event=>{const [key,version]=JSON.parse(event.target.value);setModelKey(key);setAssetVersion(version);setErrors({})}}>
            <option value={JSON.stringify(['',''])}>{models.loading?'Đang tải mô hình…':'Chọn mô hình'}</option>
            {models.data?.map(row=><option key={JSON.stringify([row.modelKey,row.assetVersion])} value={JSON.stringify([row.modelKey,row.assetVersion])}>{row.modelKey} · {row.assetVersion}</option>)}
          </select>
          {models.error&&<Notice title="Không tải được danh sách mô hình" tone="error">{models.error.message}<Button tone="text" onClick={models.retry}>Thử lại</Button></Notice>}
          {!models.loading&&!models.error&&models.data?.length===0&&<p role="status">Chưa có mô hình đã tải lên.</p>}
        </Field>:<div className={styles.fields}>
          <Field htmlFor="import-model-key" label="Mã mô hình *" error={errors.modelKey}>
            <input id="import-model-key" value={modelKey} onChange={event => setModelKey(event.target.value)} placeholder="conquest" autoComplete="off" maxLength={80} disabled={Boolean(busy)} required />
          </Field>
          <Field htmlFor="import-version" label="Phiên bản mô hình *" error={errors.assetVersion}>
            <input id="import-version" value={assetVersion} onChange={event => setAssetVersion(event.target.value)} placeholder="v10" autoComplete="off" maxLength={80} disabled={Boolean(busy)} required />
          </Field>
        </div>}

        {!stored ? <div className={styles.file} data-selected={Boolean(file)}>
          <div className={styles.fileIntro}>
            <span className={styles.fileIcon} aria-hidden="true">ZIP</span>
            <div><strong>Tệp mô hình 3D</strong></div>
          </div>
          <Field htmlFor="import-bundle" label="Chọn tệp ZIP *" error={errors.file ? 'Vui lòng chọn tệp ZIP hợp lệ, có dữ liệu và không vượt quá 2 GB.' : undefined}>
            <input id="import-bundle" type="file" accept=".zip,application/zip,application/x-zip-compressed" disabled={Boolean(busy)} onChange={event => {
              setFile(event.target.files?.[0] ?? null)
              setErrors(current => ({ ...current, file: '' }))
            }} required />
          </Field>
          {file && <div className={styles.fileSelected} role="status">
            <span aria-hidden="true">✓</span>
            <span><strong>{file.name}</strong><small>{(file.size / 1024 ** 2).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB · Chưa tải lên</small></span>
          </div>}
        </div> : null}
      </form> : <>
        <ImportPreviewDetails session={session}/>
        {stage===1&&<div className={styles.fields}>{([['shipName','Tên tàu','ship name'],['totalCapacity','Sức chứa hành khách','passengerCapacity'],['totalDecks','Số boong hành khách','deckCount']] as const).filter(([key,label,match])=>error.includes(key)||error.includes(match)||error.toLocaleLowerCase('vi').includes(label.toLocaleLowerCase('vi'))||key in supplements).map(([key,label])=><Field key={key} htmlFor={`supplement-${key}`} label={label}><input id={`supplement-${key}`} type={key==='shipName'?'text':'number'} min={1} maxLength={key==='shipName'?100:undefined} disabled={Boolean(busy)} value={supplements[key]??''} onChange={event=>setSupplements(current=>({...current,[key]:key==='shipName'?event.target.value:Number(event.target.value)}))}/></Field>)}</div>}
        {stage === 2 && <div className={styles.inlineConfirmation} role="status">
          {session.registration?.shipCreated ? 'Đã tạo hồ sơ tàu' : 'Đã cập nhật liên kết mô hình'}
        </div>}
      </>}
    </div>
  )
  return embedded ? <section className={styles.editor} aria-labelledby="setup-step-title"><header className={styles.editorHeader}><span className={styles.stepTag}>BƯỚC {stage+1}</span><h2 id="setup-step-title">{stages[stage]}</h2></header><div key={stage} className={styles.stepBody}>{content}</div><footer className={styles.editorFooter}>{footer}</footer></section> : <Modal title="Thiết lập cấu trúc tàu" wide busy={Boolean(busy)} onClose={onClose} protectChanges={stage===0} footer={footer}>{content}</Modal>
}
