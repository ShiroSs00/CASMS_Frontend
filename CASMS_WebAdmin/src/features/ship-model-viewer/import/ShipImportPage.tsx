
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, ButtonLink, Notice, PageHeader, Panel } from '@/shared/ui'
import { getSessionAccess, useSessionAccess } from '@/shared/auth'
import { ApiError, useReadQuery } from '@/shared/api'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipImportApi, type ImportPreview, type ShipProvisionFields } from './api'
import {
  emptySession,
  importRequirements,
  importSteps,
  importErrorText,
  importOutcomeUnknown,
  rejectedImportIssues,
  jobLabel,
  importStage,
  type ImportSession,
} from './model'
import { createRegistrationStore, importScope, prepareImport } from './registration-store'
import { previewFingerprint } from './preview-proof'
import { ImportDialog } from './ImportDialog'
import { ImportIssueList, ImportJobDetails } from './ImportJobDetails'
import { ImportedShipProfile } from './ImportPreviewDetails'
import { refreshShipStructure } from '@/shared/lib/ship-structure-revision'
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
  const scope = importScope(userId, import.meta.env.VITE_API_BASE_URL || '/api', window.location.origin)
  const store = useMemo(() => createRegistrationStore(scope, userId, localStorage, sessionStorage), [scope, userId])
  const storageKey = store.key
  const [restored] = useState(() => {
    try { return store.restore() }
    catch { return { draft: emptySession, pending: true } }
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
  const candidate = session.registration
  const loadVerification = useCallback((signal: AbortSignal) => candidate && canRead
    ? shipImportApi.verifyRegistration(session, signal) : Promise.resolve(null), [candidate, canRead, session])
  const verification = useReadQuery(`import-registration:${scope}:${session.attemptId}:${candidate?.shipModelId}:${canRead}:${refresh}`, loadVerification)
  const registration = verification.data
  const verifiedSession = registration ? session : { ...session, registration: null, job: null }
  const registerKey = store.registerKey(session.modelKey)
  const pendingStructure = session.pendingStructure

  const loadHistory = useCallback(
    (signal: AbortSignal) =>
      registration && canRead && !busy
        ? shipImportApi.history(registration, signal)
        : Promise.resolve(null),
    [registration, canRead, busy],
  )

  const history = useReadQuery(
    `import-history:${registration?.shipModelId}:${canRead}:${refresh}:${busy}`,
    loadHistory,
  )

  const observed = pendingStructure ? history.data?.filter(item => !pendingStructure.includes(item.jobId)) : undefined
  const job = pendingStructure ? (observed?.length === 1 ? observed[0] : null) : history.data?.[0] ?? session.job
  const running = job?.status === 'RUNNING'

  const historyReady =
    !registration
    || (
      canRead
      && history.data !== null
      && !history.loading
      && !history.error
    )
  const canAdvance = registration
    ? historyReady && !running && !pendingStructure
    : !registerUncertain && !candidate

  const activeStage = importStage(session, Boolean(registration))

  const complete = job?.status === 'SUCCEEDED'

  const importStatus = registration && !busy && (
    !canRead ? <Notice title="Thiếu quyền đọc lịch sử import" tone="warning">
      Cần quyền SHIP_READ để kiểm tra các lần import trước của tàu.
    </Notice>
      : history.loading ? <p className={styles.muted} role="status">Đang kiểm tra lịch sử import của tàu…</p>
      : history.error ? <Notice title="Không tải được lịch sử import" tone="error">
        {history.error.message}
        <Button tone="text" onClick={history.retry}>Tải lại lịch sử</Button>
      </Notice>
      : running ? <p className={styles.muted} role="status">Tàu đang có một lần import chưa hoàn tất.</p>
      : null
  )

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
        if (!navigator.locks) throw new ApiError('Trình duyệt chưa hỗ trợ khóa phiên tạo tàu. Vui lòng dùng phiên bản Chrome hoặc Edge mới.', 400)
        await navigator.locks.request(store.registerKey(draft.modelKey), { ifAvailable: true }, async lock => {
          if (!lock) throw new ApiError('Mô hình đang được xử lý ở cửa sổ khác. Kiểm tra kết quả trước khi tiếp tục.', 409)
          if (store.read(draft).pending) {
            setSession(draft)
            setRegisterUncertain(true)
            throw new ApiError('Lần tạo tàu trước chưa rõ kết quả. Kiểm tra hồ sơ tàu trước khi tải gói khác có cùng mã.', 409)
          }
          const next = await prepareImport(draft, file, store, shipImportApi.upload)
          if (alive.current) {
            setSession(next)
            setRegisterUncertain(false)
          }
        })
      },
    )
  }

  async function register(supplements: ShipProvisionFields, preview: ImportPreview) {
    await run(
      'Đang đăng ký tàu và mô hình…',
      permissions.register && !candidate && !registerUncertain && session.uploaded,
      async () => {
        const create = async () => {
          if (getSessionAccess().userId !== userId) return
          const previous = store.read(session)
          if (previous.pending || previous.draft.registration) {
            setRegisterUncertain(previous.pending)
            setSession(previous.draft)
            return
          }
          const fingerprint = await previewFingerprint(preview)
          const current = await shipImportApi.preview(session.modelKey, new AbortController().signal)
          if (await previewFingerprint(current) !== fingerprint) throw new ApiError('Mô hình đã thay đổi. Tải lại bản xem trước và xác nhận lại.', 409)
          const confirmed = { ...session, previewFingerprint: fingerprint }
          store.pending(confirmed)
          setSession(confirmed)
          setRegisterUncertain(true)
          try {
            const result = await shipImportApi.register(confirmed, supplements)
            const next = store.registered(confirmed, result)
            if (alive.current) {
              setSession(next)
              setRegisterUncertain(false)
            }
          } catch (cause) {
            if (!importOutcomeUnknown(cause)) {
              store.rejected(confirmed)
              setRegisterUncertain(false)
            }
            throw cause
          }
        }
        if (navigator.locks) await navigator.locks.request(registerKey, { ifAvailable: true }, async lock => {
          if (lock) await create()
          else setRegisterUncertain(true)
        })
        else throw new ApiError('Trình duyệt chưa hỗ trợ khóa phiên tạo tàu. Vui lòng dùng phiên bản Chrome hoặc Edge mới.', 400)
      },
    )
  }

  async function importStructure() {
    if (!registration || running || !historyReady || pendingStructure) return

    await run(
      'Đang thiết lập cấu trúc tàu…',
      permissions.import,
      async () => {
        await shipImportApi.verifyRegistration(session, new AbortController().signal)
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
          refreshShipStructure()

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

    setSession(emptySession)
    setError('')
    setFailure(null)
    setRegisterUncertain(false)
    setOpen(false)
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
            const next = store.read(session)
            setSession(next.draft)
            setRegisterUncertain(next.pending)
          } catch { setError('Không đọc được trạng thái đã lưu trên thiết bị.') }
        }}>Đọc lại trạng thái đã lưu</Button>
      </Notice>}
      {candidate && !registration && !busy && <Notice title="Chưa xác nhận được hồ sơ tàu" tone={verification.error ? 'error' : 'warning'}>
        {verification.error?.message ?? (canRead ? 'Đang đối chiếu tàu và mô hình với hệ thống…' : 'Cần quyền đọc thông tin tàu để tiếp tục.')}
        <Button tone="text" onClick={verification.retry}>Kiểm tra lại hồ sơ</Button>
        <ButtonLink tone="secondary" to="/admin/ship-models">Kiểm tra tàu trong sơ đồ 3D</ButtonLink>
      </Notice>}
      {pendingStructure && <Notice title="Đối chiếu lần import" tone="warning">
        {job ? 'Lịch sử có một lần import mới. Đây là kết quả quan sát được từ hệ thống.' : 'Chưa xác định được lần import tương ứng. Kiểm tra lịch sử trước khi tiếp tục.'}
        <Button tone="text" onClick={history.retry}>Kiểm tra lại</Button>
        {job && job.status !== 'RUNNING' && <Button tone="secondary" onClick={() => {
          setSession(current => ({ ...current, job, pendingStructure: undefined }))
          refreshShipStructure()
        }}>Đã đối chiếu lịch sử</Button>}
      </Notice>}
      {rejectedImportIssues(failure).length > 0 && <ImportIssueList issues={rejectedImportIssues(failure)} />}
      {!job ? (
        !open && <ImportDialog embedded session={verifiedSession} busy={busy} error={error} allowed={canAdvance} verifying={Boolean(candidate && !registration)} importStatus={importStatus} permissions={permissions} onPrepare={prepare} onRegister={register} onImport={importStructure} onChooseBundle={chooseBundle} onClose={()=>setOpen(false)}/>
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

              {registration && canRead && <ImportedShipProfile shipId={registration.shipId} />}

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
          session={verifiedSession}
          busy={busy}
          error={error}
          allowed={canAdvance} verifying={Boolean(candidate && !registration)}
          importStatus={importStatus}
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
