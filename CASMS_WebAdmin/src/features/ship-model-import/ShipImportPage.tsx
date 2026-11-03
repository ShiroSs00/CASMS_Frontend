
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, ButtonLink, Notice, PageHeader, Panel } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipImportApi } from './api'
import {
  emptySession,
  importRequirements,
  issueMessage,
  restoreSession,
  type ImportJob,
  type ImportSession,
} from './model'
import { ImportDialog } from './ImportDialog'
import styles from './ShipImport.module.css'

const stages = [
  'Tải mô hình 3D',
  'Lưu thông tin tàu',
  'Tạo boong và phòng',
]

function statusLabel(status: ImportJob['status']) {
  const labels: Record<ImportJob['status'], string> = {
    RUNNING: 'Đang xử lý',
    SUCCEEDED: 'Thành công',
    PARTIAL: 'Chưa hoàn tất',
    FAILED: 'Thất bại',
  }
  return labels[status]
}

function sourceLabel(session: ImportSession) {
  return session.fileName.startsWith('Gói đã')
    ? session.registration
      ? 'Mô hình đã đăng ký'
      : 'Mô hình đã tải lên'
    : session.fileName
}

function ImportIssues({ job }: { job: ImportJob }) {
  const load = useCallback(
    (signal: AbortSignal) => shipImportApi.issues(job, signal),
    [job],
  )
  const query = useReadQuery(`import-issues:${job.jobId}`, load)

  return (
    <details className={styles.issues} open>
      <summary>
        Các mục cần xử lý ({job.objectsFailed})
      </summary>

      {query.loading && (
        <p role="status">Đang tải danh sách lỗi…</p>
      )}

      {query.error && (
        <Notice title="Không tải được chi tiết lỗi" tone="error">
          {query.error.message}
          <Button tone="text" onClick={query.retry}>
            Thử lại
          </Button>
        </Notice>
      )}

      {query.data && (
        query.data.length ? (
          <ul className={styles.issueList}>
            {query.data.map(issue => (
              <li key={issue.issueId}>
                <strong>
                  {issue.objectType === 'CABIN'
                    ? 'Phòng'
                    : issue.objectType === 'DECK'
                      ? 'Boong'
                      : issue.objectType === 'AREA'
                        ? 'Khu vực'
                        : 'Đối tượng'}
                  {' · '}
                  {issue.objectIdentifier ?? 'Chưa xác định'}
                </strong>

                <p>
                  {issueMessage(issue.errorCode, issue.message)}
                </p>

                <details>
                  <summary>Thông tin kỹ thuật</summary>
                  <code>{issue.errorCode}</code>
                  <p>{issue.message}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>
            Chưa có thông tin lỗi theo từng đối tượng.
          </p>
        )
      )}
    </details>
  )
}

function ShipImportContent({ userId }: { userId: string }) {
  const access = useSessionAccess()
  const storageKey = `ocevie:ship-import:${userId}`

  const [session, setSession] = useState<ImportSession>(() => {
    try {
      return (
        restoreSession(sessionStorage.getItem(storageKey))
        ?? emptySession
      )
    } catch {
      return emptySession
    }
  })

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
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

  const job = history.data?.[0] ?? session.job
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
      // Vẫn cho phép thao tác khi bộ nhớ trình duyệt bị chặn.
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

    try {
      await action()
    } catch (failure) {
      if (alive.current) {
        setError(
          failure instanceof Error
            ? failure.message
            : 'Không thể hoàn tất thao tác. Vui lòng thử lại.',
        )
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
        if (file) {
          await shipImportApi.upload(draft, file)
        }

        if (alive.current) {
          setSession({
            ...draft,
            uploaded: true,
          })
        }
      },
    )
  }

  async function register(supplements?:Record<string,string|number>) {
    await run(
      'Đang đăng ký tàu và mô hình…',
      permissions.register,
      async () => {
        const result = await shipImportApi.register(session,supplements)

        if (alive.current) {
          setSession(current => ({
            ...current,
            registration: result,
          }))
        }
      },
    )
  }

  async function importStructure() {
    if (!registration || running || !historyReady) return

    await run(
      'Đang thiết lập cấu trúc tàu…',
      permissions.import,
      async () => {
        const result = await shipImportApi.importStructure(registration)

        if (alive.current) {
          setSession(current => ({
            ...current,
            job: result,
          }))

          setOpen(false)

          requestAnimationFrame(() => {
            resultHeading.current?.focus()
          })
        }
      },
    )
  }

  function startNew() {
    if (!canPrepare || inFlight.current) return

    setSession(emptySession)
    setError('')
    setOpen(true)
  }

  function chooseBundle() {
    if (
      inFlight.current
      || session.registration
      || !canPrepare
    ) return

    setError('')

    setSession(current => ({
      ...emptySession,
      modelKey: current.modelKey,
      assetVersion: current.assetVersion,
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
        title="Thiết lập cấu trúc tàu"
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
        {stages.map((step, index) => {
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
                {state === 'done' ? '✓' : `0${index + 1}`}
              </span>
              <strong>{step}</strong>
            </li>
          )
        })}
      </ol>

      {!job ? (
        <ImportDialog embedded session={session} busy={busy} error={error || history.error?.message || ''} allowed={historyReady && !running} permissions={permissions} onPrepare={prepare} onRegister={register} onImport={importStructure} onChooseBundle={chooseBundle} onClose={()=>setOpen(false)}/>
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
                      ? statusLabel(job.status)
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

              {job && (
                <>
                  <dl className={styles.metrics}>
                    <div>
                      <dt>Boong</dt>
                      <dd>{job.decksImported}</dd>
                    </div>

                    <div>
                      <dt>Phòng</dt>
                      <dd>{job.cabinsImported}</dd>
                    </div>

                    <div>
                      <dt>Mục cần xử lý</dt>
                      <dd>{job.objectsFailed}</dd>
                    </div>

                    <div>
                      <dt>Mục bỏ qua</dt>
                      <dd>{job.objectsSkipped}</dd>
                    </div>
                  </dl>

                  {job.totalObjects > 0 && (
                    <div className={styles.completion}>
                      <div>
                        <strong>
                          Đối tượng xử lý thành công
                        </strong>
                        <span>
                          {job.objectsSucceeded}/{job.totalObjects}
                        </span>
                      </div>

                      <progress
                        value={job.objectsSucceeded}
                        max={job.totalObjects}
                        aria-label="Tỷ lệ xử lý thành công"
                      />
                    </div>
                  )}

                  {job.status === 'PARTIAL' && (
                    <Notice
                      title="Chưa hoàn tất"
                      tone="warning"
                    >
                      Một số đối tượng chưa được xử lý thành công.
                    </Notice>
                  )}

                  {job.status === 'FAILED' && (
                    <Notice
                      title="Thất bại"
                      tone="error"
                    >
                      {job.errorMessage
                        || 'Vui lòng kiểm tra dữ liệu và thử lại.'}
                    </Notice>
                  )}

                  {running && (
                    <p
                      className={styles.status}
                      role="status"
                    >
                      Hệ thống đang xử lý.
                    </p>
                  )}

                  {job.objectsFailed > 0 && canRead && (
                    <ImportIssues job={job} />
                  )}
                </>
              )}

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
                      Boolean(busy) || !historyReady
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
          allowed={historyReady && !running}
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
