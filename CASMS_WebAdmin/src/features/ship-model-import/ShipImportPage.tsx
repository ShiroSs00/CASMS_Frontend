
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, ButtonLink, Notice, PageHeader, Panel } from '@/shared/ui'
import { getSessionAccess, useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipImportApi } from './api'
import {
  emptySession,
  importRequirements,
  importSteps,
  importErrorText,
  importOutcomeUnknown,
  rejectedImportIssues,
  jobLabel,
  restoreSession,
  type ImportJob,
  type ImportSession,
  type Registration,
} from './model'
import { ImportDialog } from './ImportDialog'
import { ImportIssueList, ImportJobDetails } from './ImportJobDetails'
import { shipDeckCabinApi } from '../ship-deck-cabin/api/ship-deck-cabin-api'
import styles from './ShipImport.module.css'

function sourceLabel(session: ImportSession) {
  return session.fileName.startsWith('Gói đã')
    ? session.registration
      ? 'Mô hình đã đăng ký'
      : 'Mô hình đã tải lên'
    : session.fileName
}

function ShipImportContent({ userId }: { userId: string }) {
  const access = useSessionAccess()
  const storageKey = `ocevie:ship-import:${userId}`
  const registerKeyFor = (draft: ImportSession) => `${storageKey}:register:${JSON.stringify([draft.modelKey])}`
  function restoredRegistration(draft: ImportSession, legacyVersion?: string) {
    if (!draft.uploaded || draft.registration) return { draft, pending: false }
    const legacyPrefix = `${storageKey}:register:[${JSON.stringify(draft.modelKey)},`
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (key?.startsWith(legacyPrefix) && localStorage.getItem(key) === 'pending') {
        return { draft, pending: true }
      }
    }
    const raw = localStorage.getItem(registerKeyFor(draft)) ?? (legacyVersion
      ? localStorage.getItem(`${storageKey}:register:${JSON.stringify([draft.modelKey, legacyVersion])}`)
      : null)
    if (!raw) return { draft, pending: false }
    if (raw === 'pending') return { draft, pending: true }
    const result = JSON.parse(raw) as Registration
    if (!result || typeof result.shipId !== 'string' || typeof result.shipModelId !== 'string' || result.shipCreated !== true) {
      return { draft, pending: true }
    }
    return { draft: { ...draft, registration: result }, pending: false }
  }

  const [restored] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      const draft = restoreSession(raw) ?? emptySession
      // Recover an already confirmed registration from a pre-upgrade draft.
      const legacyVersion = raw && draft.uploaded ? JSON.parse(raw).assetVersion : undefined
      return restoredRegistration(draft, typeof legacyVersion === 'string' ? legacyVersion : undefined)
    } catch {
      return { draft: emptySession, pending: false }
    }
  })
  const [session, setSession] = useState(restored.draft)

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [failure, setFailure] = useState<unknown>(null)
  const [registerUncertain, setRegisterUncertain] = useState(restored.pending)
  const [refresh, setRefresh] = useState(0)

  const inFlight = useRef(false)
  const alive = useRef(true)
  const resultHeading = useRef<HTMLDivElement>(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const permissions = {
    upload:
      access.inWorkScope('ship-import')
      && access.can(importRequirements.upload),
    register:
      access.inWorkScope('ship-import')
      && access.can(importRequirements.register),
    import:
      access.inWorkScope('ship-import')
      && access.can(importRequirements.import),
  }

  const canPrepare = permissions.upload || permissions.register

  const allowed = session.registration
    ? permissions.import
    : session.uploaded
      ? permissions.register
      : canPrepare

  const canRead = access.canDo('SHIP_READ')
  const registration = session.registration
  const registerKey = registerKeyFor(session)
  const pendingStructure = session.pendingStructure

  const loadHistory = useCallback(
    (signal: AbortSignal) =>
      registration && canRead && !busy
        ? shipImportApi.history(registration, signal)
        : Promise.resolve(null),
    [registration, canRead, busy],
  )

  const history = useReadQuery(
    `import-history:${registration?.shipModelId}:${refresh}:${busy}`,
    loadHistory,
  )

  const observed = pendingStructure ? history.data?.filter(item => !pendingStructure.includes(item.jobId)) : undefined
  const job = pendingStructure ? (observed?.length === 1 ? observed[0] : null) : history.data?.[0] ?? session.job
  const running = job?.status === 'RUNNING'

  const historyReady =
    !registration
    || (
      history.data !== null
      && !history.loading
      && !history.error
    )

  const activeStage = !session.uploaded
    ? 0
    : !registration
      ? 1
      : 2

  const complete = job?.status === 'SUCCEEDED'

  useEffect(() => {
    try {
      if (session.uploaded) {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ ...session, job: null }),
        )
      } else {
        sessionStorage.removeItem(storageKey)
      }
    } catch {
      // The mutation handlers persist their intent before sending a write.
    }
  }, [session, storageKey])

  useEffect(() => {
    if (!running || busy) return

    const timer = setInterval(() => {
      setRefresh(value => value + 1)
    }, 4000)

    return () => clearInterval(timer)
  }, [running, busy])

  useEffect(() => {
    if (!busy) return

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warn)

    return () => {
      window.removeEventListener('beforeunload', warn)
    }
  }, [busy])

  async function run(
    label: string,
    permitted: boolean,
    action: () => Promise<void>,
  ) {
    if (inFlight.current || !permitted) return

    inFlight.current = true
    setBusy(label)
    setError('')
    setFailure(null)

    try {
      await action()
    } catch (failure) {
      if (alive.current) {
        setFailure(failure)
        setError(importErrorText(failure))
      }
    } finally {
      inFlight.current = false

      if (alive.current) {
        setBusy('')
        setRefresh(value => value + 1)
      }
    }
  }

  async function prepare(
    draft: ImportSession,
    file: File | null,
  ) {
    await run(
      file
        ? 'Đang tải mô hình lên hệ thống…'
        : 'Đang chuẩn bị mô hình đã tải lên…',
      file ? permissions.upload : permissions.register,
      async () => {
        const prepared = { ...draft, uploaded: true }
        const previous = restoredRegistration(prepared)
        if (previous.pending || previous.draft.registration) {
          if (alive.current) {
            setSession(previous.draft)
            setRegisterUncertain(previous.pending)
          }
          return
        }

        if (file) {
          await shipImportApi.upload(draft, file)
        }

        if (alive.current) {
          const next = restoredRegistration(prepared)
          setSession(next.draft)
          setRegisterUncertain(next.pending)
        }
      },
    )
  }

  async function register(supplements?:Record<string,string|number>) {
    await run(
      'Đang đăng ký tàu và mô hình…',
      permissions.register,
      async () => {
        const create = async () => {
          if (getSessionAccess().userId !== userId) return
          const previous = restoredRegistration(session)
          if (previous.pending || previous.draft.registration) {
            setRegisterUncertain(previous.pending)
            setSession(previous.draft)
            return
          }
          localStorage.setItem(registerKey, 'pending')
          setRegisterUncertain(true)
          try {
            const result = await shipImportApi.register(session, supplements)
            const next = { ...session, registration: result }
            localStorage.setItem(registerKey, JSON.stringify(result))
            sessionStorage.setItem(storageKey, JSON.stringify(next))
            if (alive.current) setSession(next)
          } catch (cause) {
            if (!importOutcomeUnknown(cause)) {
              localStorage.removeItem(registerKey)
              setRegisterUncertain(false)
            }
            throw cause
          }
        }
        if (navigator.locks) await navigator.locks.request(registerKey, { ifAvailable: true }, async lock => {
          if (lock) await create()
          else setRegisterUncertain(true)
        })
        else await create()
      },
    )
  }

  async function importStructure() {
    if (!registration || running || !historyReady || pendingStructure) return

    await run(
      'Đang thiết lập cấu trúc tàu…',
      permissions.import,
      async () => {
        const next = { ...session, pendingStructure: (history.data ?? []).map(item => item.jobId) }
        sessionStorage.setItem(storageKey, JSON.stringify({ ...next, job: null }))
        setSession(next)
        let result
        try { result = await shipImportApi.importStructure(registration) }
        catch (cause) {
          if (!importOutcomeUnknown(cause)) {
            sessionStorage.setItem(storageKey, JSON.stringify({ ...session, job: null }))
            setSession(session)
          }
          throw cause
        }

        if (alive.current) {
          setSession(current => ({
            ...current,
            job: result,
            pendingStructure: undefined,
          }))
          shipDeckCabinApi.refresh()

          setOpen(false)

          requestAnimationFrame(() => {
            resultHeading.current?.focus()
          })
        }
      },
    )
  }

  function startNew() {
    if (!canPrepare || inFlight.current || pendingStructure) return

    if (registration) {
      try { localStorage.removeItem(registerKey) }
      catch { setError('Không thể làm mới phiên tạo tàu trên thiết bị.'); return }
    }

    setSession(emptySession)
    setError('')
    setRegisterUncertain(false)
    setOpen(true)
  }

  function chooseBundle() {
    if (
      inFlight.current
      || session.registration
      || !canPrepare
    ) return

    setError('')
    setRegisterUncertain(false)

    setSession(current => ({
      ...emptySession,
      modelKey: current.modelKey,
    }))
  }

  const viewerUrl = registration
    ? `/admin/ship-models?${new URLSearchParams({
        ship: registration.shipId,
        model: registration.shipModelId,
      })}`
    : ''

  return (
    <>
      <PageHeader
        breadcrumb="Quản trị hệ thống / Mô hình tàu 3D"
        title="Tạo tàu từ mô hình 3D"
      />

      {!allowed && (
        <Notice
          title="Bạn chưa có quyền thực hiện bước này"
          tone="warning"
        >
          Vui lòng liên hệ quản trị viên để được cấp quyền phù hợp.
        </Notice>
      )}

      <div className={styles.studio}>
      <ol
        className={styles.workflow}
        aria-label="Quy trình thiết lập mô hình tàu"
      >
        {importSteps.map((step, index) => {
          const state =
            complete || index < activeStage
              ? 'done'
              : index === activeStage
                ? 'active'
                : 'pending'

          return (
            <li
              key={step}
              data-state={state}
              aria-current={
                state === 'active' ? 'step' : undefined
              }
            >
              <span
                className={styles.workflowIndex}
                aria-hidden="true"
              >
                {state === 'done' ? '✓' : index + 1}
              </span>
              <strong>{step}</strong>
            </li>
          )
        })}
      </ol>

      <div className={styles.stack}>
      {registerUncertain && !registration && !busy && <Notice title="Chưa xác nhận được việc tạo tàu" tone="warning">
        Kiểm tra danh sách tàu trước khi tiếp tục. Yêu cầu tạo với gói này đang được giữ để tránh tạo trùng.
        <ButtonLink tone="secondary" to="/admin/ship-models">Kiểm tra tàu trong sơ đồ 3D</ButtonLink>
        <Button tone="text" onClick={() => {
          try {
            const next = restoredRegistration(session)
            setSession(next.draft)
            setRegisterUncertain(next.pending)
          } catch { setError('Không đọc được trạng thái đã lưu trên thiết bị.') }
        }}>Đọc lại trạng thái đã lưu</Button>
      </Notice>}
      {pendingStructure && <Notice title="Đối chiếu lần import" tone="warning">
        {job ? 'Lịch sử có một lần import mới. Đây là kết quả quan sát được từ hệ thống.' : 'Chưa xác định được lần import tương ứng. Kiểm tra lịch sử trước khi tiếp tục.'}
        <Button tone="text" onClick={history.retry}>Kiểm tra lại</Button>
        {job && job.status !== 'RUNNING' && <Button tone="secondary" onClick={() => {
          setSession(current => ({ ...current, job, pendingStructure: undefined }))
          shipDeckCabinApi.refresh()
        }}>Đã đối chiếu lịch sử</Button>}
      </Notice>}
      {rejectedImportIssues(failure).length > 0 && <ImportIssueList issues={rejectedImportIssues(failure)} />}
      {!job ? (
        !open && <ImportDialog embedded session={session} busy={busy} error={error || history.error?.message || ''} allowed={historyReady && !running && !pendingStructure && !registerUncertain} permissions={permissions} onPrepare={prepare} onRegister={register} onImport={importStructure} onChooseBundle={chooseBundle} onClose={()=>setOpen(false)}/>
      ) : (
        <div className={styles.sessionLayout}>
          <Panel className={styles.sessionPanel}>
            <div
              className={styles.stack}
              ref={resultHeading}
              tabIndex={-1}
            >
              <div className={styles.resultHeader}>
                <div>
                  <span className={styles.eyebrow}>
                    {job ? 'KẾT QUẢ' : 'TRẠNG THÁI MÔ HÌNH'}
                  </span>

                  <h2>
                    {job
                      ? jobLabel(job.status)
                      : registration
                        ? 'Sẵn sàng thiết lập cấu trúc'
                        : 'Đã tải mô hình lên'}
                  </h2>
                </div>
              </div>

              {error && !open && (
                <Notice
                  title="Không thể hoàn tất thao tác"
                  tone="error"
                >
                  {error}
                </Notice>
              )}

              {busy && !open && (
                <p className={styles.status} role="status">
                  {busy}
                </p>
              )}

              {registration && !busy && history.loading && (
                <p className={styles.muted} role="status">
                  Đang kiểm tra kết quả gần nhất…
                </p>
              )}

              {history.error && (
                <Notice
                  title="Chưa xác nhận được kết quả"
                  tone="error"
                >
                  {history.error.message}
                  <Button tone="text" onClick={history.retry}>
                    Kiểm tra lại
                  </Button>
                </Notice>
              )}

              <dl className={styles.summary}>

                <div>
                  <dt>Tệp mô hình</dt>
                  <dd>{sourceLabel(session)}</dd>
                </div>
              </dl>

              {job && <ImportJobDetails job={job} canRead={canRead} />}

              <div className={styles.actions}>
                {registration && canRead && (
                  <ButtonLink
                    tone="secondary"
                    to={viewerUrl}
                  >
                    Xem sơ đồ tàu
                  </ButtonLink>
                )}

                {allowed
                  && (!job
                    || job.status === 'FAILED'
                    || job.status === 'PARTIAL')
                  && (
                    <Button
                      disabled={
                        Boolean(busy)
                        || Boolean(running)
                        || Boolean(pendingStructure)
                        || !historyReady
                      }
                      onClick={() => {
                        setError('')
                        setOpen(true)
                      }}
                    >
                      {job ? 'Thử lại' : 'Tiếp tục'}
                    </Button>
                  )}

                {canPrepare && !running && (
                  <Button
                    tone={
                      complete ? 'primary' : 'secondary'
                    }
                    disabled={
                        Boolean(busy) || !historyReady || Boolean(pendingStructure)
                    }
                    onClick={startNew}
                  >
                    Thêm tàu khác
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        </div>
      )}

      </div>
      </div>
      {open && (
        <ImportDialog
          session={session}
          busy={busy}
          error={
            error
            || (
              history.error
                ? `${history.error.message} Vui lòng đóng biểu mẫu và kiểm tra lại trạng thái.`
                : ''
            )
          }
          allowed={historyReady && !running && !pendingStructure && !registerUncertain}
          permissions={permissions}
          onPrepare={prepare}
          onRegister={register}
          onImport={importStructure}
          onChooseBundle={chooseBundle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export function ShipImportPage() {
  const access = useSessionAccess()

  return (
    <AdminShell>
      <ShipImportContent
        key={access.userId}
        userId={access.userId ?? ''}
      />
    </AdminShell>
  )
}
