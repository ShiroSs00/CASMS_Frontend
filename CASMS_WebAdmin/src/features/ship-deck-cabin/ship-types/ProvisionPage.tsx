import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, DataTable, Empty, Field, FormErrorSummary, Loading, Notice, PageHeader } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipTypesApi, shipError, importIssues, provisionedShipId, type PendingProvision, type ShipType } from './api'
import { DesignFacts, PageControls } from './Catalog'
import { ProfileFacts, ProfileFields } from './ProfileFields'
import { profilePayload, validateProfile, type ProfileDraft } from './profile'
import { saveAttempt } from './attempt-storage'
import styles from './ShipWork.module.css'

function TypePicker({ selected, onSelect }: { selected: ShipType | null; onSelect: (type: ShipType) => void }) {
  const access = useSessionAccess()
  const isAdmin = access.roles.includes('ADMIN')
  const choiceId = useId()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => shipTypesApi.list(page, q, 'ACTIVE', signal), [page, q])
  const query = useReadQuery('pick-type:' + page + ':' + q, load)
  return <>
    <form role="search" className={styles.typePickerSearch} onSubmit={event => { event.preventDefault(); setQ(search.trim()); setPage(0) }}>
      <Field htmlFor="provision-type-search" label="Tên hoặc mã loại tàu"><input type="search" placeholder="Nhập tên hoặc mã loại tàu" value={search} onChange={event => setSearch(event.target.value)} /></Field>
      <div className={styles.filterActions}><Button type="submit" tone="secondary" autoWidth>Tìm kiếm</Button>
        {(q || search) && <Button tone="text" onClick={() => { setSearch(''); setQ(''); setPage(0) }}>Xóa tìm kiếm</Button>}</div>
    </form>
    {query.loading && <Loading label="Đang tải các loại tàu đang sử dụng…" />}
    {query.error && <Notice title="Chưa tải được loại tàu" tone="error">{shipError(query.error)} <Button tone="text" onClick={query.retry}>Thử lại</Button></Notice>}
    {query.data && <div className={`${styles.catalogList} ${styles.typePickerTable}`}>
      <p className={styles.resultSummary} aria-live="polite">{query.data.totalElements.toLocaleString('vi-VN')} loại tàu đang sử dụng{q ? ' phù hợp' : ''}</p>
      {query.data.content.length > 0 ? <><p className={styles.tableHint}>Vuốt ngang bảng để xem đầy đủ thông tin.</p><DataTable label="Chọn loại tàu" headers={['Lựa chọn', 'Mã loại', 'Tên loại tàu', 'Sức chứa (khách)', 'Boong hành khách']}>
        {query.data.content.map(type => <tr key={type.shipTypeId} data-selected={selected?.shipTypeId === type.shipTypeId}>
          <td><label className={styles.typeChoice} htmlFor={choiceId + type.shipTypeId}><input id={choiceId + type.shipTypeId} type="radio" name="provision-type" aria-label={'Chọn ' + type.name}
            checked={selected?.shipTypeId === type.shipTypeId} onChange={() => onSelect(type)} /><span>{selected?.shipTypeId === type.shipTypeId ? 'Đã chọn' : 'Chọn'}</span></label></td>
          <td>{type.code}</td><th scope="row">{type.name}</th>
          <td className={styles.number}>{type.totalCapacity.toLocaleString('vi-VN')}</td><td className={styles.number}>{type.totalDecks}</td>
        </tr>)}
      </DataTable></> : <Empty title={q ? 'Không có loại tàu phù hợp' : 'Chưa có loại tàu đang sử dụng'}>
        {q ? 'Tìm theo mã hoặc một phần tên loại.' : isAdmin ? <ButtonLink to="/admin/ship-types/new">Tạo loại tàu mới</ButtonLink> : 'Liên hệ Quản trị hệ thống để kiểm tra hoặc tạo mới loại tàu.'}
      </Empty>}
      {query.data.totalPages > 1 && <PageControls page={query.data} label="loại tàu" onPage={setPage} />}
    </div>}
  </>
}

function ProvisionForm({ userId, initial, initialError }: { userId: string; initial: ShipType | null; initialError?: string }) {
  const navigate = useNavigate()
  const storageKey = 'ship-provision:' + userId
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

  // Clear any legacy pending provision verification state so users always see the direct form
  useEffect(() => { saveAttempt(storageKey, null) }, [storageKey])

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

  function confirm(attempt: PendingProvision) {
    void run('Đang tạo tàu…', async () => {
      try {
        const id = provisionedShipId(await shipTypesApi.provision(attempt))
        navigate('/admin/ships/' + id, { replace: true })
      } catch (error) {
        if (error instanceof ApiError && error.code === 'SHIP_TYPE_INACTIVE') {
          setSelected(null)
          move(0)
        }
        throw error
      }
    })
  }

  const payload = profilePayload(profile)
  const isFormValid = Boolean(name.trim() && name.trim().length <= 100 && Object.keys(validateProfile(profile)).length === 0)
  return <div className={`${styles.stack} ${styles.designPage}`}>
    <PageHeader title="Thêm tàu" breadcrumb="Quản lý tàu / Thêm tàu"
      description=""
      actions={<ButtonLink to="/admin/ships" tone="secondary" autoWidth><span aria-hidden="true">←</span> Về danh sách tàu</ButtonLink>} />
    {failure ? <Notice title="Chưa thực hiện được thao tác" tone="error">
      {shipError(failure)}
      {issues.length > 0 && <ul>{issues.map((issue, index) => <li key={index}>{[issue.objectIdentifier, issue.message].filter(Boolean).join(' · ')}</li>)}</ul>}
    </Notice> : null}
    {notice && <Notice title="Thông tin yêu cầu" tone="info">{notice}</Notice>}
    <>
      <ol className={`${styles.designSteps} ${styles.provisionSteps}`} aria-label="Tiến độ tạo tàu">
        {[
          ['Chọn loại tàu', 'Chọn thông số có sẵn'],
          ['Thông tin tàu', 'Tên tàu và hồ sơ vận hành'],
          ['Xác nhận tạo tàu', 'Kiểm tra trước khi tạo'],
        ].map(([label, hint], index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-complete={index < step}>
          <span aria-hidden="true">{index + 1}</span><div><strong>{label}</strong><small>{index < step ? 'Đã hoàn tất' : hint}</small></div>
        </li>)}
      </ol>
      {step === 0 && <section className={styles.workflowSection} aria-labelledby="provision-step-heading">
        <div className={styles.workflowHeading}><h2 id="provision-step-heading" ref={headingRef} tabIndex={-1}>Chọn loại tàu</h2>
          <p>Chọn một loại tàu đang sử dụng. Cùng một loại tàu có thể tạo nhiều tàu riêng biệt.</p></div>
        <TypePicker selected={selected} onSelect={setSelected} />
        {selected && <section className={styles.selectedTypeFacts}><h3>Thông số loại tàu: {selected.name}</h3><DesignFacts type={selected} /></section>}
        <div className={styles.workflowActions}><p role="status">{selected?.status === 'INACTIVE' ? 'Loại tàu đã ngừng sử dụng. Hãy chọn loại khác.' : selected ? <>Đã chọn <strong>{selected.name}</strong> ({selected.code})</> : 'Chọn một loại tàu để tiếp tục.'}</p>
          <Button disabled={!selected || selected.status !== 'ACTIVE'} onClick={() => move(1)}>Tiếp tục: Thông tin tàu</Button></div>
      </section>}
      {step === 1 && <section className={styles.workflowSection} aria-labelledby="provision-step-heading">
        <div className={styles.workflowHeading}><h2 id="provision-step-heading" ref={headingRef} tabIndex={-1}>Thông tin tàu</h2>
          <p>Đặt tên riêng cho tàu. Hồ sơ vận hành có thể điền ngay hoặc bổ sung sau khi tạo.</p></div>
        <form className={styles.provisionForm} ref={formRef} noValidate onSubmit={event => {
          event.preventDefault()
          const validation = { ...validateProfile(profile), ...(!name.trim() || name.trim().length > 100
            ? { shipName: 'Nhập tên riêng của tàu, tối đa 100 ký tự.' } : {}) }
          setErrors(validation)
          if (Object.keys(validation).length) {
            requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
          }
          else move(2)
        }}>
          <FormErrorSummary errors={errors} />
          <div className={styles.provisionIdentity}>
            <Field htmlFor="vessel-name" label="Tên tàu *" hint="Tên riêng của tàu, tối đa 100 ký tự." error={errors.shipName}>
              <input id="vessel-name" required maxLength={100} value={name} onChange={event => { setName(event.target.value); setErrors(current => ({ ...current, shipName: undefined })) }} />
            </Field>
            <div className={styles.provisionTypeSummary}><dl><dt>Loại tàu đã chọn</dt><dd>{selected?.name}</dd></dl><p>Mã tàu được cấp tự động khi tạo.</p></div>
          </div>
          <section className={styles.provisionProfileDetails} aria-labelledby="provision-profile-heading">
            <h3 id="provision-profile-heading">Hồ sơ vận hành <span>(không bắt buộc khi tạo bản nháp)</span></h3>
            <p>Điền thông tin đang có hoặc bổ sung sau khi tạo tàu. Lưu ý: cần hoàn thiện Hồ sơ vận hành (đăng kiểm, chứng nhận, bảo hành, bảo trì) trước khi chuyển tàu sang trạng thái Sẵn sàng hoạt động.</p>
            <div className={styles.provisionProfileGroups}><ProfileFields grouped draft={profile} errors={errors}
              onChange={(key, value) => { setProfile(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })) }}
              onBlur={key => setErrors(current => ({ ...current, [key]: validateProfile(profile)[key] }))} /></div>
          </section>
          <div className={styles.workflowActions}><Button tone="secondary" onClick={() => move(0)}>Quay lại: Chọn loại tàu</Button>
            <div className={styles.provisionNextAction}><p>Bạn sẽ kiểm tra lại thông tin ở bước tiếp theo.</p><Button type="submit" autoWidth>Tiếp tục: Xác nhận</Button></div>
          </div>
        </form>
      </section>}
      {step === 2 && selected && <section className={styles.workflowSection} aria-labelledby="provision-step-heading">
        <div className={styles.workflowHeading}><h2 id="provision-step-heading" ref={headingRef} tabIndex={-1}>Xác nhận tạo tàu</h2><p>Tàu sẽ được tạo ở trạng thái bản nháp, kèm boong, cabin và mô hình theo loại tàu đã chọn.</p></div>
        <dl className={styles.facts}>
          <div><dt>Tên tàu</dt><dd>{name.trim()}</dd></div>
          <div><dt>Loại tàu</dt><dd>{selected.name}</dd></div>
          <div><dt>Trạng thái khi tạo</dt><dd>Bản nháp</dd></div>
        </dl>
        <section className={styles.selectedTypeFacts}><h3>Thông số loại tàu: {selected.name}</h3><DesignFacts type={selected} /></section>
        <h3>Hồ sơ vận hành</h3>
        {Object.keys(payload).length ? <div className={styles.confirmationProfile}><ProfileFacts profile={payload} onlyProvided /></div> : <p>Hồ sơ sẽ được bổ sung sau.</p>}
        <div className={styles.workflowActions}>
          <Button tone="secondary" disabled={Boolean(busy)} onClick={() => move(1)}>Quay lại: Thông tin tàu</Button>
          <Button busy={Boolean(busy)} disabled={!isFormValid} onClick={() => {
            if (!isFormValid) { move(1); return }
            confirm({
              typeId: selected.shipTypeId, key: crypto.randomUUID(),
              payload: { shipName: name.trim(), profile: Object.keys(payload).length ? payload : null },
            })
          }}>{busy || 'Xác nhận tạo tàu'}</Button>
        </div>
      </section>}
    </>
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
