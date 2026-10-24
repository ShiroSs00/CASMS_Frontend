import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { ApiError, useReadQuery } from '@/shared/api'
import { Badge, Button, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipImportApi } from './api'
import { bundleLabel, emptySession, importPermissions, issueMessage, jobLabel, restoreSession, type ImportJob, type ImportSession } from './model'
import { ImportDialog } from './ImportDialog'
import styles from './ShipImport.module.css'

function ImportIssues({ job }: { job: ImportJob }) {
  const load = useCallback((signal: AbortSignal) => shipImportApi.issues(job, signal), [job])
  const query = useReadQuery(`import-issues:${job.jobId}`, load)
  return <details className={styles.issues} open><summary>Các mục cần xử lý ({job.objectsFailed})</summary>
    {query.loading && <p role="status">Đang tải chi tiết…</p>}
    {query.error && <Notice title="Chưa tải được chi tiết lỗi" tone="error">{query.error.message}<Button tone="text" onClick={query.retry}>Tải lại</Button></Notice>}
    {query.data && (query.data.length ? <ul className={styles.issueList}>{query.data.map(issue => <li key={issue.issueId}><strong>{issue.objectType === 'CABIN' ? 'Phòng' : issue.objectType === 'DECK' ? 'Boong' : 'Đối tượng'} · {issue.objectIdentifier ?? 'Chưa xác định'}</strong><p>{issueMessage(issue.errorCode, issue.message)}</p><details><summary>Chi tiết kỹ thuật</summary><code>{issue.errorCode}</code><p>{issue.message}</p></details></li>)}</ul> : <p className={styles.muted}>Chưa có lỗi riêng cho từng mục. Kiểm tra thông báo của lượt nhập ở trên.</p>)}
  </details>
}

function ShipImportContent({ userId }: { userId: string }) {
  const access = useSessionAccess()
  const storageKey = `ocevie:ship-import:${userId}`
  const [session, setSession] = useState<ImportSession>(() => {
    try { return restoreSession(sessionStorage.getItem(storageKey)) ?? emptySession } catch { return emptySession }
  })
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const inFlight = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const resultHeading = useRef<HTMLDivElement>(null)
  const allowed = importPermissions.every(permission => access.has(permission))
  const canRead = access.has('SHIP_READ')
  const registration = session.registration
  const loadHistory = useCallback((signal: AbortSignal) => registration && canRead && !busy ? shipImportApi.history(registration, signal) : Promise.resolve(null), [registration, canRead, busy])
  const history = useReadQuery(`import-history:${registration?.shipModelId}:${refresh}:${busy}`, loadHistory)
  const job = history.data?.[0] ?? session.job
  const running = job?.status === 'RUNNING'
  const historyReady = !registration || (history.data !== null && !history.loading && !history.error)
  useEffect(() => {
    try {
      if (session.uploaded) sessionStorage.setItem(storageKey, JSON.stringify({ ...session, job: null }))
      else sessionStorage.removeItem(storageKey)
    } catch { /* Import remains usable when browser storage is unavailable. */ }
  }, [session, storageKey])
  useEffect(() => {
    if (!running || busy) return
    const timer = setInterval(() => setRefresh(value => value + 1), 4000)
    return () => clearInterval(timer)
  }, [running, busy])
  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])
  async function run(label: string, action: () => Promise<void>) {
    if (inFlight.current || !allowed) return
    inFlight.current = true; setBusy(label); setError('')
    try { await action() }
    catch (failure) {
      if (alive.current) setError(failure instanceof ApiError && failure.status === 409
        ? `${failure.message} Nếu gói đã tải thành công, dùng “Dùng gói đã tải” với đúng mã và phiên bản. Gói đã đăng ký cần tiếp tục từ lượt nhập tương ứng.`
        : failure instanceof Error ? failure.message : 'Chưa thực hiện được thao tác. Vui lòng thử lại.')
    } finally {
      inFlight.current = false
      if (alive.current) { setBusy(''); setRefresh(value => value + 1) }
    }
  }
  async function prepare(draft: ImportSession, file: File | null) {
    await run(file ? 'Đang tải và kiểm tra gói…' : 'Đang chuẩn bị gói đã tải…', async () => {
      if (file) await shipImportApi.upload(draft, file)
      if (alive.current) setSession({ ...draft, uploaded: true })
    })
  }
  async function register() {
    await run('Đang ghi nhận thông tin tàu…', async () => {
      const result = await shipImportApi.register(session)
      if (alive.current) setSession(current => ({ ...current, registration: result }))
    })
  }
  async function importStructure() {
    if (!registration || running || !historyReady) return
    await run('Đang nhập boong và phòng…', async () => {
      const result = await shipImportApi.importStructure(registration)
      if (alive.current) {
        setSession(current => ({ ...current, job: result })); setOpen(false)
        requestAnimationFrame(() => resultHeading.current?.focus())
      }
    })
  }
  function startNew() { setSession(emptySession); setError(''); setOpen(true) }
  function chooseBundle() {
    if (inFlight.current || session.registration) return
    setError('')
    setSession(current => ({ ...emptySession, modelKey: current.modelKey, assetVersion: current.assetVersion }))
  }
  const hasSession = session.uploaded
  return <>
    <PageHeader breadcrumb="Hệ thống / Nhập thông tin tàu" title="Nhập thông tin tàu" description="Khởi tạo thông tin tàu, boong và phòng từ gói mô hình 3D." />
    {!allowed && <Panel><Notice title="Chưa đủ quyền nhập dữ liệu" tone="warning">Tài khoản cần quyền tạo mô hình, tạo tàu, cập nhật tàu và đọc tàu. Nếu vừa cập nhật quyền cục bộ, khởi động lại BE và đăng nhập lại.</Notice></Panel>}
    {!hasSession ? <>
      <section className={styles.hero}><div><span className={styles.eyebrow}>DỮ LIỆU TỪ MÔ HÌNH 3D</span><h2>Một gói dữ liệu, đầy đủ cấu trúc tàu</h2><p>Tải gói ZIP chứa thông tin mô hình. Hệ thống kiểm tra dữ liệu trước khi ghi nhận tàu, boong và phòng.</p><Button disabled={!allowed} onClick={() => { setError(''); setOpen(true) }}>Nhập thông tin tàu</Button></div><div className={styles.fileVisual} aria-hidden="true"><span>3D</span><strong>GÓI MÔ HÌNH</strong><small>ZIP · manifest · GLB</small></div></section>
      <div className={styles.steps}>{['Chọn gói dữ liệu', 'Xác nhận thông tin', 'Xem kết quả nhập'].map((title, index) => <section key={title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{title}</h3><p>{['Sử dụng gói ZIP đã xuất, kèm thông tin mô hình và tệp kiểm tra.', 'Ghi nhận thông tin tàu từ manifest, sau đó nhập cấu trúc boong và phòng.', 'Xem số boong, số phòng đã nhập và các mục cần xử lý.'][index]}</p></section>)}</div>
    </> : <Panel>
      <div className={styles.stack} ref={resultHeading} tabIndex={-1}>
        <div className={styles.resultHeader}><div><h2>{job ? jobLabel(job.status) : registration ? 'Chờ nhập boong và phòng' : 'Gói dữ liệu đã chọn'}</h2><p className={styles.muted}>{session.modelKey} · {session.assetVersion}</p></div>{job && <Badge label={jobLabel(job.status)} tone={job.status === 'SUCCEEDED' ? 'success' : job.status === 'RUNNING' ? 'info' : job.status === 'PARTIAL' ? 'warning' : 'error'} />}</div>
        {error && !open && <Notice title="Chưa thể hoàn tất" tone="error">{error}</Notice>}
        {busy && !open && <p className={styles.status} role="status">{busy}</p>}
        {registration && !busy && history.loading && <p role="status" className={styles.muted}>Đang kiểm tra lượt nhập gần nhất…</p>}
        {history.error && <Notice title="Chưa xác nhận được trạng thái nhập" tone="error">{history.error.message}<Button tone="text" onClick={history.retry}>Kiểm tra lại</Button></Notice>}
        {job && <>
          <dl className={styles.metrics}><div><dt>Boong đã nhập</dt><dd>{job.decksImported}</dd></div><div><dt>Phòng đã nhập</dt><dd>{job.cabinsImported}</dd></div><div><dt>Mục cần xử lý</dt><dd>{job.objectsFailed}</dd></div></dl>
          {job.status === 'SUCCEEDED' && <Notice title="Đã ghi nhận cấu trúc tàu" tone="success">Thông tin tàu, boong và phòng đã được lưu. Boong kỹ thuật được lưu riêng trong mô hình.</Notice>}
          {job.status === 'PARTIAL' && <Notice title="Một số mục chưa được nhập" tone="warning">Các mục hợp lệ đã được lưu. Kiểm tra lỗi bên dưới trước khi chuẩn bị gói dữ liệu đã chỉnh sửa.</Notice>}
          {job.status === 'FAILED' && <Notice title="Lượt nhập không thành công" tone="error">Kiểm tra dữ liệu của gói và chi tiết lỗi trước khi thử lại.{job.errorMessage && <details><summary>Chi tiết kỹ thuật</summary><p>{job.errorMessage}</p></details>}</Notice>}
          {running && <p role="status" className={styles.status}>Hệ thống đang xử lý. Trạng thái được cập nhật tự động.</p>}
          {job.objectsFailed > 0 && canRead && <ImportIssues job={job} />}
          <p className={styles.muted}>{job.objectsSucceeded}/{job.totalObjects} mục đã nhập · {job.objectsSkipped} mục bỏ qua. Tổng số gồm boong chính, boong kỹ thuật và phòng.</p>
        </>}
        {!job && <p className={styles.muted}>{registration ? 'Thông tin tàu đã được ghi nhận. Tiếp tục để nhập boong và phòng từ gói mô hình.' : 'Gói đã được chọn cho lượt nhập này. Tiếp tục để ghi nhận thông tin tàu từ manifest.'}</p>}
        <div className={styles.actions}>
          {registration && <Link to={`/admin/ship-models?${new URLSearchParams({ship:registration.shipId,model:registration.shipModelId})}`}>Xem model 3D ↗</Link>}
          <span className={styles.muted}>Gói: {bundleLabel(session)}</span>
          {(!job || job.status === 'FAILED' || job.status === 'PARTIAL') && <Button disabled={!allowed || Boolean(busy) || Boolean(running) || !historyReady} onClick={() => { setError(''); setOpen(true) }}>{job ? 'Thử nhập lại' : 'Tiếp tục nhập'}</Button>}
          {!running && <Button tone={job?.status === 'SUCCEEDED' ? 'primary' : 'secondary'} disabled={!allowed || Boolean(busy) || !historyReady} onClick={startNew}>Nhập gói khác</Button>}
        </div>
      </div>
    </Panel>}
    {open && <ImportDialog session={session} busy={busy} error={error || (history.error ? `${history.error.message} Đóng biểu mẫu và chọn “Kiểm tra lại” để cập nhật trạng thái.` : '')} allowed={allowed && historyReady && !running} onPrepare={prepare} onRegister={register} onImport={importStructure} onChooseBundle={chooseBundle} onClose={() => setOpen(false)} />}
  </>
}
export function ShipImportPage() {
  const access = useSessionAccess()
  return <AdminShell><ShipImportContent key={access.userId} userId={access.userId ?? ''} /></AdminShell>
}
