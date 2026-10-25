import { useRef, useState, type SubmitEvent } from 'react'
import { Button, Field, Modal, Notice } from '@/shared/ui'
import { bundleLabel, validateBundle, type ImportSession } from './model'
import styles from './ShipImport.module.css'

export function ImportDialog({ session, busy, error, allowed, permissions, onPrepare, onRegister, onImport, onChooseBundle, onClose }: {
  session: ImportSession; busy: string; error: string; allowed: boolean; permissions: { upload: boolean; register: boolean; import: boolean }
  onPrepare: (draft: ImportSession, file: File | null) => Promise<void>
  onRegister: () => Promise<void>; onImport: () => Promise<void>; onChooseBundle: () => void; onClose: () => void
}) {
  const [modelKey, setModelKey] = useState(session.modelKey)
  const [assetVersion, setAssetVersion] = useState(session.assetVersion)
  const [stored, setStored] = useState(!permissions.upload && permissions.register)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const heading = useRef<HTMLDivElement>(null)
  const stage = session.registration ? 2 : session.uploaded ? 1 : 0
  async function prepare(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allowed || !(stored ? permissions.register : permissions.upload)) return
    const fields = validateBundle(modelKey.trim(), assetVersion.trim(), file, stored)
    setErrors(fields)
    if (Object.keys(fields).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#ship-import-form [aria-invalid="true"]')?.focus())
      return
    }
    await onPrepare({ modelKey: modelKey.trim(), assetVersion: assetVersion.trim(), fileName: stored ? 'Gói đã tải (chờ kiểm tra)' : file?.name ?? '', uploaded: false, registration: null, job: null }, stored ? null : file)
    heading.current?.focus()
  }
  const descriptions = ['Chọn gói mô hình và thông tin nhận diện.', 'Kiểm tra mã mô hình và phiên bản trước khi ghi nhận thông tin tàu.', 'Thông tin tàu đã được ghi nhận. Tiếp tục nhập cấu trúc boong và phòng.']
  return <Modal title="Nhập thông tin tàu" description={descriptions[stage]} wide busy={Boolean(busy)} onClose={onClose} protectChanges={stage === 0}
    footer={<>
      <Button tone="secondary" disabled={Boolean(busy)} onClick={onClose} data-overlay-dismiss>{stage === 0 ? 'Hủy' : 'Đóng và tiếp tục sau'}</Button>
      {stage === 1 && (permissions.upload || permissions.register) && <Button tone="secondary" disabled={Boolean(busy) || !allowed} onClick={() => { setStored(false); setFile(null); setErrors({}); onChooseBundle(); heading.current?.focus() }}>Chọn lại gói</Button>}
      {stage === 0 && (stored ? permissions.register : permissions.upload) && <Button type="submit" form="ship-import-form" disabled={Boolean(busy) || !allowed}>{busy || (stored ? 'Dùng gói đã tải' : 'Tải gói dữ liệu')}</Button>}
      {stage === 1 && permissions.register && <Button disabled={Boolean(busy) || !allowed} onClick={() => void onRegister()}>{busy || 'Ghi nhận thông tin tàu'}</Button>}
      {stage === 2 && permissions.import && <Button disabled={Boolean(busy) || !allowed} onClick={() => void onImport()}>{busy || 'Nhập boong và phòng'}</Button>}
    </>}>
    <div ref={heading} tabIndex={-1} className={styles.stack}>
      <ol className={styles.progress} aria-label="Các bước nhập dữ liệu">{['Chọn gói dữ liệu', 'Ghi nhận tàu', 'Nhập boong, phòng'].map((label, i) => <li key={label} aria-current={i === stage ? 'step' : undefined} data-done={i < stage}>{i + 1}. {label}</li>)}</ol>
      {error && <Notice title="Chưa thể tiếp tục" tone="error">{error}</Notice>}
      {busy && <p className={styles.status} role="status">{busy} Gói lớn có thể cần vài phút. Vui lòng giữ trang mở.</p>}
      {stage === 0 ? <form id="ship-import-form" className={styles.stack} onSubmit={event => void prepare(event)} noValidate aria-busy={Boolean(busy)}>
        <fieldset className={styles.mode} disabled={Boolean(busy)}><legend>Nguồn dữ liệu</legend>
          {permissions.upload && <label><input type="radio" name="bundle-source" checked={!stored} onChange={() => { setStored(false); setErrors({}) }} />Tải gói ZIP mới</label>}
          {permissions.register && <label><input type="radio" name="bundle-source" checked={stored} onChange={() => { setStored(true); setErrors({}) }} />Dùng gói đã tải</label>}
        </fieldset>
        <div className={styles.fields}>
          <Field htmlFor="import-model-key" label="Mã mô hình *" hint="Trùng với modelId trong manifest, ví dụ: conquest." error={errors.modelKey}><input id="import-model-key" value={modelKey} onChange={event => setModelKey(event.target.value)} placeholder="Ví dụ: conquest" autoComplete="off" maxLength={80} disabled={Boolean(busy)} required /></Field>
          <Field htmlFor="import-version" label="Phiên bản gói *" hint="Trùng phiên bản trong thư mục ZIP, ví dụ: model-assets/conquest/v10/." error={errors.assetVersion}><input id="import-version" value={assetVersion} onChange={event => setAssetVersion(event.target.value)} placeholder="Ví dụ: v10" autoComplete="off" maxLength={80} disabled={Boolean(busy)} required /></Field>
        </div>
        {!stored ? <div className={styles.file}><Field htmlFor="import-bundle" label="Gói dữ liệu mô hình *" hint="Tệp ZIP, tối đa 2 GB. Gồm manifest.json, checksums.json và các tệp GLB được khai báo." error={errors.file}><input id="import-bundle" type="file" accept=".zip,application/zip,application/x-zip-compressed" disabled={Boolean(busy)} onChange={event => { setFile(event.target.files?.[0] ?? null); setErrors(current => ({ ...current, file: '' })) }} required /></Field>{file && <span className={styles.muted}>{file.name} · {(file.size / 1024 ** 2).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB</span>}</div>
          : <p className={styles.muted}>Nhập đúng mã mô hình và phiên bản đã tải lên. Hệ thống sẽ kiểm tra gói khi ghi nhận tàu; bạn không cần tải lại ZIP.</p>}
      </form> : <>
        <dl className={styles.summary}><div><dt>Mã mô hình</dt><dd>{session.modelKey}</dd></div><div><dt>Phiên bản</dt><dd>{session.assetVersion}</dd></div><div className={styles.full}><dt>Gói dữ liệu</dt><dd>{bundleLabel(session)}</dd></div></dl>
        {stage === 1 ? <Notice title="Thông tin lấy từ gói mô hình" tone="info">Tên tàu, sức chứa, số boong, chiều dài và chiều rộng được đọc từ manifest. Hệ thống tạo tàu mới hoặc cập nhật tàu đã liên kết với cùng mã mô hình.</Notice>
          : <Notice title={session.registration?.shipCreated ? 'Đã tạo thông tin tàu' : 'Đã cập nhật thông tin tàu'} tone="success">Bước tiếp theo sẽ tạo hoặc cập nhật boong, phòng và liên kết với mô hình 3D. Boong kỹ thuật chỉ được lưu trong mô hình.</Notice>}
        {stage === 2 && <p className={styles.muted}>Với phòng đã có, hệ thống giữ sức chứa và thông tin hỗ trợ người khuyết tật; các dữ liệu hình học và loại phòng được cập nhật từ mô hình.</p>}
      </>}
    </div>
  </Modal>
}
