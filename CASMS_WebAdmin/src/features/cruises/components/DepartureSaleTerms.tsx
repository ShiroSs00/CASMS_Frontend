import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Field, Loading, Notice, Panel } from '@/shared/ui'
import { useFormChanges } from '@/shared/ui/useUnsavedFormGuard'
import { journeyTime } from '@/shared/lib/journey-time'
import { saleTermsApi, type Action, type Applicability, type Charge, type Terms } from '../api/sale-terms'
import styles from './DeparturePricingPolicy.module.css'

type Draft = { applicability: Applicability | ''; value: string; reason: string; evidence: string }
const draftOf = (charge?: Charge): Draft => ({
  applicability: charge?.applicability ?? '', value: charge?.value?.toString() ?? '',
  reason: charge?.reason ?? '', evidence: charge?.evidence ?? '',
})
const labels = { MISSING: 'Chưa cấu hình', DRAFT: 'Bản nháp', PENDING_APPROVAL: 'Chờ duyệt', APPROVED: 'Đã duyệt', RETURNED: 'Cần chỉnh sửa' }
const historyLabels: Record<string, string> = { SAVE: 'Lưu bản nháp', SUBMIT: 'Gửi duyệt', APPROVE: 'Phê duyệt', RETURN: 'Trả về chỉnh sửa' }
const errorText: Record<string, string> = {
  STALE_REVISION: 'Dữ liệu đã đổi. Tải bản hiện tại và đối chiếu trước khi lưu lại.',
  SALE_TERMS_PENDING: 'Bản đang chờ duyệt. Hãy tải lại trạng thái.',
  INVALID_SALE_TERMS_TRANSITION: 'Thao tác không còn phù hợp với trạng thái hiện tại.',
  SELF_APPROVAL_FORBIDDEN: 'Người soạn hoặc người gửi không được xét duyệt bản này.',
  SALE_TERMS_SNAPSHOT_STALE: 'Nội dung không còn khớp bản đã gửi duyệt.',
  REASON_REQUIRED: 'Nhập lý do trả về.',
}
function validate(draft: Draft, tax: boolean): string {
  if (!draft.applicability) return 'Chọn có áp dụng hoặc không áp dụng.'
  if (draft.applicability === 'NOT_APPLICABLE') return draft.reason.trim() ? '' : 'Nhập lý do không áp dụng.'
  const value = Number(draft.value)
  if (!draft.value.trim() || !Number.isFinite(value) || value < 0 || tax && value > 1) {
    return tax ? 'Nhập tỷ lệ từ 0 đến 1.' : 'Nhập số USD từ 0 trở lên.'
  }
  return ''
}
function payload(draft: Draft): Charge {
  return {
    applicability: draft.applicability as Applicability,
    value: draft.applicability === 'APPLICABLE' ? Number(draft.value) : null,
    reason: draft.reason.trim() || null,
    evidence: draft.evidence.trim() || null,
  }
}
function ChargeFields({ label, tax, value, onChange, error }: { label: string; tax: boolean; value: Draft; onChange: (value: Draft) => void; error: string }) {
  const id = useId()
  const patch = (change: Partial<Draft>) => onChange({ ...value, ...change })
  const applies = value.applicability === 'APPLICABLE'
  const excluded = value.applicability === 'NOT_APPLICABLE'
  return <section className={styles.group}>
    <h3>{label}</h3>
    <Field label="Áp dụng" htmlFor={id + '-applies'}>
      <select id={id + '-applies'} value={value.applicability} aria-invalid={Boolean(error && !value.applicability)}
        aria-describedby={error ? id + '-error' : undefined}
        onChange={event => patch({ applicability: event.target.value as Draft['applicability'], value: '', reason: '' })}>
        <option value="">Chọn quyết định</option>
        <option value="APPLICABLE">Có áp dụng</option>
        <option value="NOT_APPLICABLE">Không áp dụng</option>
      </select>
    </Field>
    {applies && <Field label={tax ? 'Tỷ lệ thuế (0–1)' : 'Phí cảng mỗi khách (USD)'} htmlFor={id + '-value'}>
      <input id={id + '-value'} type="number" min="0" max={tax ? 1 : undefined} step="any" value={value.value}
        aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined}
        onChange={event => patch({ value: event.target.value })}/>
    </Field>}
    {excluded && <Field label="Lý do không áp dụng" htmlFor={id + '-reason'}>
      <textarea id={id + '-reason'} value={value.reason} aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined} onChange={event => patch({ reason: event.target.value })}/>
    </Field>}
    <Field label="Tài liệu tham chiếu (nếu có)" htmlFor={id + '-evidence'}>
      <input id={id + '-evidence'} value={value.evidence} onChange={event => patch({ evidence: event.target.value })}/>
    </Field>
    {error && <p id={id + '-error'} role="alert">{error}</p>}
  </section>
}

export function DepartureSaleTerms({ cruiseId, refreshKey, onChanged, focusOnMount }: { cruiseId: string; refreshKey: string | number; onChanged?: () => void; focusOnMount?: boolean }) {
  const access = useSessionAccess()
  const allowed = access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_PRICING_APPROVE')
  const key = `${access.userId}:${cruiseId}:${refreshKey}:${allowed}`
  const terms = useReadQuery('sale-terms:' + key, useCallback(signal => allowed ? saleTermsApi.read(cruiseId, signal) : Promise.resolve(null), [allowed, cruiseId]))
  const history = useReadQuery('sale-terms-history:' + key, useCallback(signal => allowed ? saleTermsApi.history(cruiseId, signal) : Promise.resolve(null), [allowed, cruiseId]))
  const [editor, setEditor] = useState<{ revision: number; tax: Draft; portFee: Draft } | null>(null)
  const [fieldErrors, setFieldErrors] = useState({ tax: '', portFee: '' })
  const [reason, setReason] = useState('')
  const [returning, setReturning] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [reconcile, setReconcile] = useState(false)
  useFormChanges(Boolean(editor || returning && reason.trim()), busy)
  const lock = useRef(false)
  const section = useRef<HTMLElement>(null)
  const [reloaded, setReloaded] = useState(false)
  useEffect(() => {
    if (focusOnMount && allowed) {
      section.current?.focus({ preventScroll: true })
      section.current?.scrollIntoView({ block: 'start' })
    }
  }, [focusOnMount, allowed])
  const data = terms.data
  const fresh = Boolean(data && !terms.loading && !terms.error)
  const editable = fresh && data?.status !== 'PENDING_APPROVAL'
  const events = history.data ?? []
  // The API omits allowedActions. Use the state and known makers to hide invalid actions. Backend checks every request.
  const currentDraftEvents = events.filter(event => event.evidence.snapshot.revision <= (data?.revision ?? 0))
  const previousDecision = currentDraftEvents.find(event => event.action === 'APPROVE' || event.action === 'RETURN')
  const maker = currentDraftEvents.some(event => event.action === 'SAVE' && event.actorId === access.userId
    && event.evidence.snapshot.revision > (previousDecision?.evidence.snapshot.revision ?? 0))
  const canReview = fresh && data?.status === 'PENDING_APPROVAL' && Boolean(access.userId)
    && data.submittedBy !== access.userId && !maker && !history.loading && !history.error && events.some(event => event.action === 'SUBMIT' && event.evidence.snapshot.revision === data.revision)

  const reload = () => { terms.retry(); history.retry() }
  async function run(task: () => Promise<unknown>, message: string) {
    if (!allowed || lock.current || reconcile) return
    lock.current = true
    setBusy(true)
    setError('')
    setSuccess('')
    setReloaded(false)
    setFieldErrors({ tax: '', portFee: '' })
    try {
      await task()
      setEditor(null)
      setReturning(false)
      setReason('')
      setSuccess(message)
      reload()
      onChanged?.()
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.status === 409 || cause.status >= 500 || cause.status === 0) setReconcile(true)
        if (cause.code === 'INVALID_TAX_APPLICABILITY') setFieldErrors({ tax: 'Kiểm tra quyết định và giá trị thuế.', portFee: '' })
        if (cause.code === 'INVALID_PORT_FEE_APPLICABILITY') setFieldErrors({ tax: '', portFee: 'Kiểm tra quyết định và giá trị phí cảng.' })
        setError(errorText[cause.code ?? ''] ?? ({ 401: 'Phiên đăng nhập đã hết hạn.', 403: 'Bạn không có quyền thực hiện thao tác này.', 404: 'Không tìm thấy chuyến hoặc điều kiện mở bán.', 409: 'Trạng thái đã đổi. Tải lại và đối chiếu.' } as Record<number, string>)[cause.status] ?? cause.message)
      } else {
        setReconcile(true)
        setError('Chưa xác nhận được kết quả. Đối chiếu trạng thái trước khi thử lại.')
      }
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || !data || !editable || editor.revision !== data.revision) return
    const errors = { tax: validate(editor.tax, true), portFee: validate(editor.portFee, false) }
    setFieldErrors(errors)
    if (errors.tax || errors.portFee) return
    const input: Terms = { tax: payload(editor.tax), portFee: payload(editor.portFee) }
    void run(() => saleTermsApi.save(cruiseId, editor.revision, input), 'Đã lưu điều kiện mở bán ở trạng thái nháp.')
  }
  function review(action: Action) {
    if (!data || editor || !fresh || (action === 'submit' ? data.status !== 'DRAFT' : !canReview)) return
    if (action === 'return' && !reason.trim()) { setError(errorText.REASON_REQUIRED); return }
    void run(() => saleTermsApi.review(cruiseId, data.revision, action, reason.trim()),
      action === 'approve' ? 'Đã duyệt điều kiện mở bán.' : action === 'submit' ? 'Đã gửi điều kiện mở bán để duyệt.' : 'Đã trả bản điều kiện để chỉnh sửa.')
  }
  const describe = (charge: Charge, tax: boolean) => charge.applicability === 'NOT_APPLICABLE'
    ? `Không áp dụng · ${charge.reason}`
    : tax ? new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 8 }).format(charge.value!)
      : `${charge.value} USD/khách`

  if (!allowed) return null
  return <section ref={section} id="departure-sale-terms" tabIndex={-1}>
    <Panel title="Điều kiện thương mại mở bán">
      <p>Quản lý vận hành cấu hình và duyệt thuế, phí cảng cho chuyến này. Giá Gói du thuyền và chính sách giao dịch có luồng riêng.</p>
      {terms.loading && <Loading label="Đang tải điều kiện mở bán…"/>}
      {terms.error && <Notice tone="error" title="Chưa tải được điều kiện mở bán">{terms.error.message} <Button onClick={reload}>Tải lại</Button></Notice>}
      {data && <><Badge label={labels[data.status]} tone={data.status === 'APPROVED' ? 'success' : 'neutral'}/>
        <p>Phiên bản {data.revision}{data.reviewedAt ? ` · Xét duyệt lúc ${journeyTime(data.reviewedAt)}` : ''}</p>
        {data.terms && <dl className={styles.terms}>
          <div><dt>Thuế</dt><dd>{describe(data.terms.tax, true)}{data.terms.tax.evidence && <p>{data.terms.tax.evidence}</p>}</dd></div>
          <div><dt>Phí cảng</dt><dd>{describe(data.terms.portFee, false)}{data.terms.portFee.evidence && <p>{data.terms.portFee.evidence}</p>}</dd></div>
        </dl>}
      </>}
      {error && <Notice tone="error" title="Chưa hoàn tất thao tác">{error}</Notice>}
      {success && <Notice tone="success" title="Đã ghi nhận kết quả">{success}</Notice>}
      {(reconcile || editor && data && editor.revision !== data.revision) && <Notice tone="warning" title="Cần đối chiếu phiên bản">
        <p>Giá trị bạn đang nhập được giữ lại. So sánh với bản hiện tại trước khi dùng phiên bản mới.</p>
        <Button tone="secondary" disabled={busy} onClick={() => { setReloaded(true); reload() }}>Tải bản hiện tại</Button>
        {reloaded && fresh && data && (!editor || editable) && <Button tone="secondary" disabled={busy} onClick={() => {
          setEditor(previous => previous ? { ...previous, revision: data.revision } : null)
          setReconcile(false)
          setError('')
        }}>Đã đối chiếu, dùng phiên bản {data.revision}</Button>}
      </Notice>}
      {!editor && editable && data && <Button tone="secondary" disabled={busy || reconcile} onClick={() => {
        setEditor({ revision: data.revision, tax: draftOf(data.terms?.tax), portFee: draftOf(data.terms?.portFee) })
        setFieldErrors({ tax: '', portFee: '' })
      }}>{data.status === 'MISSING' ? 'Cấu hình thuế và phí cảng' : 'Sửa điều kiện mở bán'}</Button>}
      {editor && <form noValidate onSubmit={save}>
        <fieldset disabled={busy}>
          <div className={styles.groups}>
            <ChargeFields label="Thuế" tax value={editor.tax} error={fieldErrors.tax} onChange={tax => setEditor({ ...editor, tax })}/>
            <ChargeFields label="Phí cảng" tax={false} value={editor.portFee} error={fieldErrors.portFee} onChange={portFee => setEditor({ ...editor, portFee })}/>
          </div>
          <div className={styles.reviewActions}>
            <Button type="submit" disabled={!editable || reconcile || editor.revision !== data?.revision}>Lưu bản nháp</Button>
            <Button type="button" tone="secondary" onClick={() => setEditor(null)}>Hủy</Button>
          </div>
        </fieldset>
      </form>}
      {!editor && <div className={styles.reviewActions}>
        {fresh && data?.status === 'DRAFT' && <Button disabled={busy || reconcile} onClick={() => review('submit')}>Gửi duyệt</Button>}
        {canReview && !returning && <><Button disabled={busy || reconcile} onClick={() => review('approve')}>Duyệt</Button>
          <Button tone="secondary" disabled={busy || reconcile} onClick={() => setReturning(true)}>Trả về</Button></>}
      </div>}
      {returning && canReview && <div className={styles.review}>
        <Field label="Lý do trả về" htmlFor="sale-terms-return"><textarea id="sale-terms-return" disabled={busy} value={reason} onChange={event => setReason(event.target.value)}/></Field>
        <Button disabled={busy || reconcile || !reason.trim()} onClick={() => review('return')}>Xác nhận trả về</Button>
        <Button tone="secondary" disabled={busy} onClick={() => setReturning(false)}>Hủy</Button>
      </div>}
      <details className={styles.review}>
        <summary>Lịch sử xét duyệt</summary>
        {history.loading && <Loading label="Đang tải lịch sử…"/>}
        {history.error && <Notice tone="error" title="Chưa tải được lịch sử">{history.error.message} <Button onClick={history.retry}>Tải lại</Button></Notice>}
        {history.data && (events.length ? <ul>{events.map((event, index) => <li key={`${event.recordedAt}:${index}`}>
          <strong>{historyLabels[event.action] ?? 'Cập nhật'} · Phiên bản {event.evidence.snapshot.revision}</strong>
          <p>{journeyTime(event.recordedAt)}{event.actorId === access.userId ? ' · Bạn' : ''}</p>
          {event.evidence.snapshot.terms && <p>Thuế: {describe(event.evidence.snapshot.terms.tax, true)} · Phí cảng: {describe(event.evidence.snapshot.terms.portFee, false)}</p>}
          {event.evidence.reason && <p>{event.evidence.reason}</p>}
        </li>)}</ul> : <p>Chưa có lịch sử.</p>)}
      </details>
    </Panel>
  </section>
}
