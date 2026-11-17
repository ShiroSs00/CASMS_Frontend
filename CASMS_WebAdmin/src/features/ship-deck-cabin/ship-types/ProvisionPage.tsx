import { useCallback, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, FormErrorSummary, Loading, Notice, PageHeader, Panel, PermissionLink } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipTypesApi, shipError, importIssues, missingProvisionResult, provisionedShipId, unknownOutcome, type PendingProvision, type ShipType } from './api'
import { DesignFacts, PageControls } from './Catalog'
import { ProfileFacts, ProfileFields } from './ProfileFields'
import { profilePayload, validateProfile, type ProfileDraft } from './profile'
import { loadAttempt, saveAttempt } from './attempt-storage'
import styles from './ShipWork.module.css'

function TypePicker({ selected, onSelect }: { selected: ShipType | null; onSelect: (type: ShipType) => void }) {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => shipTypesApi.list(page, q, 'ACTIVE', signal), [page, q])
  const query = useReadQuery('pick-type:' + page + ':' + q, load)
  return <>
    <form role="search" className={styles.filters} onSubmit={event => { event.preventDefault(); setQ(search.trim()); setPage(0) }}>
      <Field htmlFor="provision-type-search" label="Tìm theo tên hoặc mã loại"><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>
      <Button type="submit" tone="secondary" autoWidth>Tìm</Button>
    </form>
    {query.loading && <Loading label="Đang tải các loại tàu đang sử dụng…" />}
    {query.error && <Notice title="Chưa tải được loại tàu" tone="error">{shipError(query.error)} <Button tone="text" onClick={query.retry}>Thử lại</Button></Notice>}
    {query.data && <div className={styles.actions}>
      {query.data.content.length > 0 ? <DataTable label="Chọn loại tàu" headers={['Chọn', 'Mã loại', 'Tên loại', 'Sức chứa', 'Số boong']}>
        {query.data.content.map(type => <tr key={type.shipTypeId}>
          <td><input type="radio" name="provision-type" aria-label={'Chọn ' + type.name}
            checked={selected?.shipTypeId === type.shipTypeId} onChange={() => onSelect(type)} /></td>
          <td>{type.code}</td><th scope="row">{type.name}</th>
          <td className={styles.number}>{type.totalCapacity.toLocaleString('vi-VN')}</td><td className={styles.number}>{type.totalDecks}</td>
        </tr>)}
      </DataTable> : <Empty title={q ? 'Không có loại tàu phù hợp' : 'Chưa có loại tàu đang sử dụng'}>
        {q ? 'Tìm theo mã hoặc một phần tên loại.' : 'Liên hệ Admin để kiểm tra danh mục loại tàu.'}
      </Empty>}
      <PageControls page={query.data} label="loại tàu" onPage={setPage} />
    </div>}
  </>
}

function ProvisionForm({ userId, initial, initialError }: { userId: string; initial: ShipType | null; initialError?: string }) {
  const navigate = useNavigate()
  const storageKey = 'ship-provision:' + userId
  const [pending, setPending] = useState(() => loadAttempt<PendingProvision>(storageKey))
  const [checked, setChecked] = useState(false)
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<ShipType | null>(initial)
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<ProfileDraft>({})
  const [errors, setErrors] = useState<ReturnType<typeof validateProfile> & { shipName?: string }>({})
  const [failure, setFailure] = useState<unknown>(null)
  const [notice, setNotice] = useState(initialError ?? '')
  const [busy, setBusy] = useState('')
  const locked = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const issues = importIssues(failure)

  function move(next: number) {
    setStep(next)
    setNotice('')
    setFailure(null)
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  async function run(label: string, action: () => Promise<void>) {
    if (locked.current) return
    locked.current = true
    setBusy(label)
    setFailure(null)
    setNotice('')
    try { await action() } catch (error) { setFailure(error) } finally {
      locked.current = false
      setBusy('')
    }
  }

  function clearAttempt() {
    saveAttempt(storageKey, null)
    setPending(null)
    setChecked(false)
  }

  function confirm(attempt: PendingProvision) {
    void run('Đang tạo tàu…', async () => {
      if (!saveAttempt(storageKey, attempt)) {
        throw new Error('Trình duyệt chưa lưu được mã yêu cầu. Bật lưu trữ cho trang này rồi thử lại.')
      }
      setPending(attempt)
      setChecked(false)
      try {
        const id = provisionedShipId(await shipTypesApi.provision(attempt))
        clearAttempt()
        navigate('/admin/ships/' + id, { replace: true })
      } catch (error) {
        if (!unknownOutcome(error)) clearAttempt()
        if (error instanceof ApiError && error.code === 'SHIP_TYPE_INACTIVE') {
          setSelected(null)
          move(0)
        }
        throw error
      }
    })
  }

  function check(attempt: PendingProvision) {
    void run('Đang kiểm tra kết quả…', async () => {
      try {
        const id = provisionedShipId(await shipTypesApi.result(attempt))
        clearAttempt()
        navigate('/admin/ships/' + id, { replace: true })
      } catch (error) {
        if (!missingProvisionResult(error, attempt.key)) throw error
        setChecked(true)
        setNotice('Chưa thấy tàu đã tạo. Bạn có thể kiểm tra lại hoặc gửi lại đúng yêu cầu này.')
      }
    })
  }

  const payload = profilePayload(profile)
  return <div className={styles.stack}>
    <PageHeader title="Thêm tàu" breadcrumb="Quản lý tàu / Thêm tàu" />
    <PermissionLink to="/admin/ships">Về danh sách tàu</PermissionLink>
    {failure ? <Notice title="Chưa thực hiện được thao tác" tone="error">
      {shipError(failure)}
      {issues.length > 0 && <ul>{issues.map((issue, index) => <li key={index}>{[issue.objectIdentifier, issue.message].filter(Boolean).join(' · ')}</li>)}</ul>}
    </Notice> : null}
    {notice && <Notice title="Thông tin yêu cầu" tone="info">{notice}</Notice>}
    {pending ? <Panel title="Xác minh kết quả tạo tàu">
      <p>Tàu đang kiểm tra <strong>{pending.payload.shipName}</strong>.</p>
      <div className={styles.actions}>
        <Button busy={Boolean(busy)} onClick={() => check(pending)}>{busy || 'Kiểm tra kết quả'}</Button>
        {checked && <Button tone="secondary" disabled={Boolean(busy)} onClick={() => confirm(pending)}>Gửi lại yêu cầu này</Button>}
      </div>
    </Panel> : <>
      <ol className={styles.stepper} aria-label="Tiến độ tạo tàu">
        {['Chọn loại tàu', 'Nhập hồ sơ tàu', 'Xác nhận'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}>{index + 1}. {label}</li>)}
      </ol>
      {step === 0 && <Panel>
        <h2 ref={headingRef} tabIndex={-1}>Chọn loại tàu đang sử dụng</h2>
        <TypePicker selected={selected} onSelect={setSelected} />
        {selected && <><h3>Thiết kế {selected.name}</h3><DesignFacts type={selected} /></>}
        <div className={styles.actions}><Button disabled={!selected || selected.status !== 'ACTIVE'} onClick={() => move(1)}>Tiếp tục</Button></div>
      </Panel>}
      {step === 1 && <Panel>
        <h2 ref={headingRef} tabIndex={-1}>Nhập thông tin tàu</h2>
        <p>Thiết kế áp dụng <strong>{selected?.name}</strong>. Mã tàu được cấp khi tạo.</p>
        <form ref={formRef} noValidate onSubmit={event => {
          event.preventDefault()
          const validation = { ...validateProfile(profile), ...(!name.trim() || name.trim().length > 100
            ? { shipName: 'Nhập tên riêng của tàu, tối đa 100 ký tự.' } : {}) }
          setErrors(validation)
          if (Object.keys(validation).length) requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
          else move(2)
        }}>
          <FormErrorSummary errors={errors} />
          <Field htmlFor="vessel-name" label="Tên tàu *" error={errors.shipName}>
            <input id="vessel-name" required maxLength={100} value={name} onChange={event => { setName(event.target.value); setErrors(current => ({ ...current, shipName: undefined })) }} />
          </Field>
          <p>Có thể bổ sung hồ sơ vận hành sau khi tạo bản nháp.</p>
          <ProfileFields draft={profile} errors={errors}
            onChange={(key, value) => { setProfile(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })) }}
            onBlur={key => setErrors(current => ({ ...current, [key]: validateProfile(profile)[key] }))} />
          <div className={styles.actions}><Button tone="secondary" onClick={() => move(0)}>Quay lại</Button><Button type="submit">Kiểm tra trước khi tạo</Button></div>
        </form>
      </Panel>}
      {step === 2 && selected && <Panel>
        <h2 ref={headingRef} tabIndex={-1}>Xác nhận tạo tàu</h2>
        <dl className={styles.facts}>
          <div><dt>Tên tàu</dt><dd>{name.trim()}</dd></div>
          <div><dt>Loại tàu</dt><dd>{selected.name}</dd></div>
          <div><dt>Trạng thái khi tạo</dt><dd>Bản nháp</dd></div>
        </dl>
        <h3>Thiết kế kế thừa</h3><DesignFacts type={selected} />
        <h3>Hồ sơ riêng</h3>
        {Object.keys(payload).length ? <ProfileFacts profile={payload} /> : <p>Hồ sơ sẽ được bổ sung sau.</p>}
        <div className={styles.actions}>
          <Button tone="secondary" disabled={Boolean(busy)} onClick={() => move(1)}>Sửa thông tin</Button>
          <Button busy={Boolean(busy)} onClick={() => confirm({
            typeId: selected.shipTypeId, key: crypto.randomUUID(),
            payload: { shipName: name.trim(), profile: Object.keys(payload).length ? payload : null },
          })}>Tạo tàu</Button>
        </div>
      </Panel>}
    </>}
  </div>
}

export function ShipProvisionPage() {
  const access = useSessionAccess()
  const [params] = useSearchParams()
  const typeId = params.get('type') ?? ''
  const load = useCallback((signal: AbortSignal) => typeId ? shipTypesApi.detail(typeId, signal) : Promise.resolve(null), [typeId])
  const query = useReadQuery('provision-preset:' + typeId, load)
  return <AdminShell>{query.loading ? <Loading label="Đang tải loại tàu…" /> :
    <ProvisionForm key={access.userId + ':' + typeId} userId={access.userId ?? ''} initial={query.data}
      initialError={query.error ? 'Không tải được loại tàu theo liên kết. Hãy chọn một loại đang sử dụng.' : undefined} />}
  </AdminShell>
}
