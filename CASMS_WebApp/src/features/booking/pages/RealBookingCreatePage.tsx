import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { Button, ButtonLink, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { bookingFieldErrors, bookingPackageErrors, realBookingApi } from '../api/real-booking-api'
import { CabinPassengerFields, PassengerDetailsFields } from '../components/LiveBookingFields'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { bookingMutationFailure } from '../model/booking-mutation'
import { initialLiveBooking, useLiveBooking } from '../model/live-booking-context'
import { availableBookingStep } from '../model/booking-progress'
import { bookingStepPaths, catalogReturn } from '../model/live-booking-navigation'
import { bookingWhen } from '../model/real-booking-view'
import { bookingReadFailure } from '../model/booking-feedback'
import { ApiError } from '@/shared/api'
import { BookingRecord } from './RealBookingPages'
import styles from '../components/LiveBooking.module.css'

const labels = ['Chọn phòng', 'Thông tin & thanh toán', 'Xác nhận đặt chỗ']
const descriptions = ['Chọn chuyến, phòng cho từng hành khách và gói dịch vụ nếu cần.', 'Điền thông tin hành khách và chọn kế hoạch thanh toán. Bước này chưa thu tiền.', 'Kiểm tra lựa chọn và thông tin liên hệ. Bạn có thể quay lại sửa trước khi gửi.']
const plans: Record<string, string> = { STAGES: 'Thanh toán theo đợt', DEPOSIT: 'Đặt cọc & thanh toán phần còn lại', FULL: 'Thanh toán toàn bộ' }
export function RealBookingCreatePage({ admin = false, step: routeStep }: { admin?: boolean; step?: 1 | 2 | 3 }) {
  const [params] = useSearchParams(), navigate = useNavigate()
  const step = routeStep ?? (params.get('step') === '2' ? 2 : params.get('step') === '3' ? 3 : 1)
  const { draft, setDraft, saved, setSaved, uncertain, setUncertain, busy, setBusy, submitError: error, setSubmitError: setError, errors, setErrors, submissionLockRef } = useLiveBooking()
  const access = useSessionAccess(), heading = useRef<HTMLHeadingElement>(null)
  const recovery = useRef<HTMLDivElement>(null)
  const [review, setReview] = useState(false), [copied, setCopied] = useState('')
  const [validationAttempt, setValidationAttempt] = useState(0)
  const publicRecovery = !admin && uncertain
  useEffect(() => {
    if (!admin && uncertain && !review) recovery.current?.focus()
  }, [admin, uncertain, review])
  const back = catalogReturn(params.get('from')), requestedCruise = params.get('cruiseId')
  useEffect(() => {
    if (requestedCruise && requestedCruise !== draft.cruiseId && !busy && !uncertain) {
      setDraft(current => ({ ...current, cruiseId: requestedCruise, passengers: current.passengers.map(person => ({ ...person, cabinId: '', tourPackageId: '' })) }))
      setSaved(null); setErrors({})
    }
  }, [requestedCruise, draft.cruiseId, busy, uncertain, setDraft, setSaved, setErrors])
  useEffect(() => {
    if (publicRecovery) return
    const first = document.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (first) first.focus(); else heading.current?.focus()
  }, [step, validationAttempt, saved, publicRecovery])
  const dirty = !saved && draft.passengers.some(person => person.fullName || person.email || person.documentNumber || person.phoneNumber)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const cruises = useReadQuery('booking-published-cruises', realBookingApi.cruises)
  const cabins = useReadQuery('booking-available-cabins:' + draft.cruiseId, useCallback(signal => draft.cruiseId ? realBookingApi.cabins(draft.cruiseId, signal) : Promise.resolve(null), [draft.cruiseId]))
  const packages = useReadQuery('booking-active-packages', realBookingApi.packages)
  const selected = cruises.data?.find(item => item.cruiseId === draft.cruiseId)
  const lastAvailableStep = availableBookingStep(draft, selected, cabins.data ?? null, packages.data)
  const choicesLoading = cruises.loading || cabins.loading || packages.loading
  function stepPath(next: number, cruiseId = draft.cruiseId) {
    const query = new URLSearchParams({ from: back })
    if (cruiseId) query.set('cruiseId', cruiseId)
    if (admin) query.set('step', String(next))
    return (admin ? '/admin/bookings/new' : bookingStepPaths[next - 1]) + '?' + query
  }
  function validate(nextStep: number) {
    const invalid = bookingFieldErrors(draft, selected, cabins.data, undefined, nextStep)
    if (nextStep !== 1 && !access.userId && !draft.passengers[0]?.email.trim()) invalid['person-0-email'] = 'Khách chưa đăng nhập cần email người đại diện để nhận hướng dẫn hợp đồng.'
    if (nextStep !== 2) Object.assign(invalid, bookingPackageErrors(draft, packages.data))
    setErrors(invalid)
    if (Object.keys(invalid).length) setValidationAttempt(value => value + 1)
    return invalid
  }
  function showInvalid(invalid: Record<string, string>) {
    const first = Object.keys(invalid)[0]
    const target = first === 'real-booking-cruise' || first.endsWith('-cabinId') || first.endsWith('-tourPackageId') ? 1 : 2
    navigate(stepPath(target))
  }
  function focusError(id: string) {
    const field = document.getElementById(id)
    if (field) field.focus()
    else showInvalid({ [id]: errors[id] })
  }
  function next(event: FormEvent) {
    event.preventDefault()
    if (busy || uncertain) return
    const invalid = validate(step)
    if (Object.keys(invalid).length) { showInvalid(invalid); return }
    setError(''); if (step < 3) navigate(stepPath(step + 1)); else setReview(true)
  }
  async function submit() {
    if (submissionLockRef.current || uncertain) return
    const invalid = validate(3)
    if (Object.keys(invalid).length) { setReview(false); showInvalid(invalid); return }
    submissionLockRef.current = true; setBusy(true); setError('')
    try {
      const result = await realBookingApi.create(draft)
      setSaved(result); setReview(false)
      if (admin) navigate('/admin/bookings/' + encodeURIComponent(result.bookingId))
    } catch (value) {
      const failure = bookingMutationFailure(value)
      setError(failure.message); setUncertain(failure.uncertain)
      if (!failure.uncertain) { setReview(false); cabins.retry(); if (failure.conflict) navigate(stepPath(1)) }
    } finally { submissionLockRef.current = false; setBusy(false) }
  }
  async function copyReference() {
    if (!saved) return
    try { await navigator.clipboard.writeText(saved.bookingReference); setCopied('Đã sao chép mã đặt chỗ.') }
    catch { setCopied('Chưa sao chép được. Bạn có thể chọn và sao chép mã hiển thị bên trên.') }
  }
  if (saved && admin) return <RealBookingFrame admin={admin}><PageHeader title="Đã tiếp nhận đặt chỗ" breadcrumb="ĐẶT CHỖ" description="Lưu mã đặt chỗ để tra cứu. Tiếp nhận chưa có nghĩa đã xác nhận, thanh toán hoặc làm thủ tục." /><p className={styles.reference}>{saved.bookingReference}</p><div className={styles.actions}><Button onClick={() => void copyReference()}>Sao chép mã đặt chỗ</Button><ButtonLink to={'/booking/lookup?reference=' + encodeURIComponent(saved.bookingReference)}>Tra cứu đặt chỗ</ButtonLink><Button tone="secondary" onClick={() => { setDraft(initialLiveBooking()); setSaved(null); setErrors({}); navigate(admin ? '/admin/bookings/new' : '/cruises') }}>Bắt đầu đặt chỗ khác</Button></div>{copied && <p role="status">{copied}</p>}<BookingRecord booking={saved} /></RealBookingFrame>
  if (saved) return <RealBookingFrame><div className={styles.stack}>
    <header className={styles.heading}><p>ĐẶT CHỖ / KẾT QUẢ</p><h1 ref={heading} tabIndex={-1}>Đã tiếp nhận đặt chỗ</h1><p>Lưu mã đặt chỗ để tra cứu. Trạng thái xác nhận, hợp đồng và lịch thanh toán được hiển thị riêng bên dưới.</p></header>
    <section className={styles.resultReference} aria-label="Mã đặt chỗ và bước tiếp theo"><p className={styles.helper}>MÃ ĐẶT CHỖ CỦA BẠN</p><p className={styles.reference}>{saved.bookingReference}</p><div className={styles.actions}><Button onClick={() => void copyReference()}>Sao chép mã đặt chỗ</Button><ButtonLink tone="secondary" to={'/booking/lookup?reference=' + encodeURIComponent(saved.bookingReference)}>Tra cứu đặt chỗ</ButtonLink></div>{copied && <p role="status">{copied}</p>}<ol className={styles.nextSteps}><li>Lưu mã cùng email hoặc số điện thoại đại diện.</li><li>Đọc hướng dẫn hợp đồng và các hạn thanh toán.</li><li>Tra cứu để xem trạng thái mới nhất trước chuyến đi.</li></ol><p className={styles.helper}>Hoàn tất hợp đồng và thanh toán theo hướng dẫn để xác nhận đặt chỗ.</p></section>
    <BookingRecord booking={saved} publicView /><div><Button tone="secondary" onClick={() => { setDraft(initialLiveBooking()); setSaved(null); setErrors({}); navigate('/cruises') }}>Bắt đầu đặt chỗ khác</Button></div>
  </div></RealBookingFrame>
  if (step > 1 && choicesLoading) return <RealBookingFrame admin={admin}><Loading label="Đang kiểm tra thông tin đặt chỗ…" /></RealBookingFrame>
  if (step > 1 && (cruises.error || cabins.error)) return <RealBookingFrame admin={admin}>
    <PageHeader breadcrumb="ĐẶT CHỖ" title={labels[step - 1]} description="Tải lại thông tin hành trình trước khi tiếp tục." />
    <BookingReadState {...cruises} publicResource={!admin ? 'danh sách hành trình' : undefined} />
    <BookingReadState {...cabins} publicResource={!admin ? 'phòng trống' : undefined} />
    <ButtonLink tone="secondary" to={stepPath(1)}>Về bước chọn phòng</ButtonLink>
  </RealBookingFrame>
  if (!busy && !uncertain && !choicesLoading && !cruises.error && !cabins.error
    && (!requestedCruise || requestedCruise === draft.cruiseId) && step > lastAvailableStep) {
    return <Navigate to={stepPath(lastAvailableStep)} replace />
  }
  return <RealBookingFrame admin={admin}><div className={styles.stack}>
    {!admin && <div className={styles.journeyTopline}><Link to={back}>← Về danh mục hành trình</Link></div>}
    <header className={styles.heading}><h1 ref={heading} tabIndex={-1}>{labels[step - 1]}</h1><p>Bước {step}/3 · {descriptions[step - 1]}</p></header>
    <nav aria-label="Các bước đặt chỗ"><ol className={styles.steps}>{labels.map((label, index) => <li key={label}><Link to={stepPath(index + 1)} aria-label={`${index + 1}. ${label}`} aria-current={step === index + 1 ? 'step' : undefined} aria-disabled={busy || uncertain || index + 1 > lastAvailableStep || undefined} tabIndex={busy || uncertain || index + 1 > lastAvailableStep ? -1 : undefined} data-complete={index + 1 < step || undefined} onClick={event => { if (busy || uncertain || index + 1 > lastAvailableStep) event.preventDefault() }}>{admin ? `${index + 1}. ${label}` : <><span className={styles.stepNumber} aria-hidden="true">{index + 1}</span><span>{label}</span></>}</Link></li>)}</ol></nav>
    {uncertain && (admin ? <Notice title="Cần kiểm tra kết quả trước khi gửi lại" tone="warning">Thông tin được giữ nguyên; gửi lại đã khóa để tránh tạo trùng. Tra cứu bằng mã đã nhận hoặc liên hệ nhân viên hỗ trợ.<ButtonLink tone="secondary" to="/booking/lookup">Tra cứu đặt chỗ</ButtonLink></Notice> : <div ref={recovery} tabIndex={-1} role="region" aria-label="Cần kiểm tra kết quả gửi"><Notice title="Cần kiểm tra kết quả trước khi gửi lại" tone="warning"><div className={styles.recoveryBody}><p>Hệ thống có thể đã tiếp nhận yêu cầu. Thông tin được giữ nguyên; gửi lại đã khóa để tránh tạo trùng.</p><p>Nếu đã nhận mã, hãy tra cứu bằng mã đó. Nếu chưa có mã, liên hệ bộ phận hỗ trợ để kiểm tra bằng thông tin người đại diện trước khi đặt lại.</p><ButtonLink tone="secondary" to="/booking/lookup">Tra cứu khi đã có mã</ButtonLink></div></Notice></div>)}
    {error && !review && (admin || !uncertain) && <Notice title="Chưa gửi được đặt chỗ" tone="error">{error}</Notice>}
    <form noValidate onSubmit={next}><div className={styles.layout}><div className={styles.main}>
      {Object.keys(errors).length > 0 && <Notice title="Vui lòng kiểm tra thông tin" tone="error"><ul>{Object.entries(errors).map(([id, message]) => <li key={id}>{admin ? message : <button type="button" className={styles.errorLink} onClick={() => focusError(id)}>{message}</button>}</li>)}</ul></Notice>}
      <fieldset disabled={busy || uncertain} className={styles.draftFields}><div className={styles.stack}>
        {step === 1 && <><Panel title="Chọn chuyến đã công bố"><BookingReadState {...cruises} publicResource={!admin ? 'danh sách hành trình' : undefined} />{cruises.data?.length === 0 && <Empty title="Chưa có chuyến đã công bố để đặt">{!admin && <div className={styles.recoveryBody}><p>Hiện chưa có hành trình để chọn. Bạn có thể tải lại danh sách hoặc quay về danh mục.</p><Button tone="secondary" onClick={cruises.retry}>Tải lại danh sách hành trình</Button><ButtonLink tone="secondary" to={back}>Về danh mục hành trình</ButtonLink></div>}</Empty>}<Field htmlFor="real-booking-cruise" label="Chuyến đi *" error={errors['real-booking-cruise']}><select id="real-booking-cruise" value={draft.cruiseId} aria-invalid={Boolean(errors['real-booking-cruise'])} aria-describedby={errors['real-booking-cruise'] ? 'real-booking-cruise-hint' : undefined} onChange={event => { const id = event.target.value; setDraft(current => ({ ...current, cruiseId: id, passengers: current.passengers.map(person => ({ ...person, cabinId: '', tourPackageId: '' })) })); setErrors({}); navigate(stepPath(1, id), { replace: true }) }}><option value="">Chọn chuyến đã công bố</option>{cruises.data?.map(item => <option key={item.cruiseId} value={item.cruiseId}>{item.cruiseCode} · {item.cruiseName}</option>)}</select></Field></Panel>{draft.cruiseId && <BookingReadState {...cabins} publicResource={!admin ? 'phòng trống' : undefined} />}{cabins.data?.length === 0 && <Empty title="Chưa có phòng trống cho chuyến này">{!admin && <div className={styles.recoveryBody}><p>Chưa có phòng để tiếp tục với chuyến này. Tải lại để kiểm tra tình trạng mới nhất hoặc chọn hành trình khác.</p><Button tone="secondary" onClick={cabins.retry}>Tải lại phòng trống</Button><ButtonLink tone="secondary" to={back}>Chọn hành trình khác</ButtonLink></div>}</Empty>}{packages.loading && <p role="status">Đang tải gói dịch vụ tùy chọn…</p>}{packages.error && <Notice title="Chưa tải được gói dịch vụ" tone="warning">{admin ? <>{packages.error.message} Bạn có thể tiếp tục mà không chọn gói.<Button onClick={packages.retry}>Tải lại gói</Button></> : <div className={styles.recoveryBody}><p>{bookingReadFailure(packages.error instanceof ApiError ? packages.error.status : undefined)}</p><p>Bạn có thể tiếp tục mà không chọn gói.</p><Button tone="secondary" onClick={packages.retry}>Tải lại gói</Button></div>}</Notice>}{!admin && packages.data?.length === 0 && <p className={styles.helper}>Chưa có gói dịch vụ đang hoạt động. Bạn có thể tiếp tục mà không chọn gói.</p>}<CabinPassengerFields cabins={cabins.data} packages={packages.data} publicJourney={!admin} /></>}
        {step === 2 && <><PassengerDetailsFields publicJourney={!admin} representativeEmailRequired={!access.userId} /><Panel title="Hình thức thanh toán"><p>Chọn kế hoạch thanh toán. Số tiền và ngày đến hạn từng đợt sẽ có trong thông tin đặt chỗ.</p><div className={styles.fields}><Field htmlFor="real-booking-currency" label="Tiền tệ yêu cầu" error={errors['real-booking-currency']}><input id="real-booking-currency" maxLength={3} value={draft.currency} aria-invalid={Boolean(errors['real-booking-currency'])} aria-describedby={errors['real-booking-currency'] ? 'real-booking-currency-hint' : undefined} onChange={event => setDraft(current => ({ ...current, currency: event.target.value.toUpperCase() }))} /></Field><Field htmlFor="real-booking-plan" label="Hình thức thanh toán" error={errors['real-booking-plan']}><select id="real-booking-plan" aria-invalid={Boolean(errors['real-booking-plan'])} aria-describedby={errors['real-booking-plan'] ? 'real-booking-plan-hint' : undefined} value={draft.paymentPlan} onChange={event => setDraft(current => ({ ...current, paymentPlan: event.target.value as typeof draft.paymentPlan }))}>{Object.entries(plans).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>{draft.paymentPlan === 'STAGES' && <p className={styles.helper}>Ba đợt thanh toán: đặt cọc, thanh toán giữa kỳ và thanh toán phần còn lại theo hợp đồng.</p>}<Field htmlFor="real-booking-notes" label="Ghi chú (tối đa 500 ký tự)" error={errors['real-booking-notes']}><textarea aria-invalid={Boolean(errors['real-booking-notes'])} aria-describedby={errors['real-booking-notes'] ? 'real-booking-notes-hint' : undefined} id="real-booking-notes" maxLength={500} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} /></Field></Panel></>}
        {step === 3 && <><BookingReadState {...cruises} publicResource={!admin ? 'danh sách hành trình' : undefined} /><BookingReadState {...cabins} publicResource={!admin ? 'phòng trống' : undefined} /><Panel title="Kiểm tra toàn bộ đặt chỗ"><div className={styles.sectionHeading}><h2>{selected?.cruiseName ?? 'Chưa chọn chuyến'}</h2>{!admin && <Link to={stepPath(1)}>Sửa phòng & gói</Link>}</div><p>{bookingWhen(selected?.departureDatetime)} → {bookingWhen(selected?.returnDatetime)} · Giờ Việt Nam</p>{!admin && <div className={styles.sectionHeading}><h3>Thông tin hành khách</h3><Link to={stepPath(2)}>Sửa thông tin hành khách</Link></div>}<ol className={styles.review}>{draft.passengers.map((person, index) => <li key={index}><strong>{person.fullName || `Hành khách ${index + 1} · Chưa nhập tên`}</strong><p>Phòng: {cabins.data?.find(cabin => cabin.cabinId === person.cabinId)?.cabinNumber ?? 'Cần kiểm tra lại'}</p><p>Gói: {person.tourPackageId ? packages.data?.find(pack => pack.id === person.tourPackageId)?.name ?? 'Cần kiểm tra lại' : 'Không chọn'}</p><p>Ngày sinh: {person.dateOfBirth || 'Chưa cung cấp'} · Quốc tịch: {person.nationality || 'Chưa cung cấp'}</p><p>Liên hệ: {person.email || 'Không có email'} · {person.phoneNumber || 'Không có số điện thoại'}</p>{person.documentNumber && <p>Giấy tờ: {person.documentType || 'Chưa chọn loại'} · ••••{person.documentNumber.slice(-4)}</p>}</li>)}</ol><p>Hình thức: {plans[draft.paymentPlan]} · Tiền tệ yêu cầu: {draft.currency}</p>{draft.notes && <p>Ghi chú: {draft.notes}</p>}<p>Sau khi đặt chỗ, bạn sẽ nhận tổng giá vé, lịch thanh toán từng đợt và hướng dẫn hợp đồng.</p></Panel></>}
        <div className={styles.actions}>{step > 1 && <Button tone="secondary" onClick={() => navigate(stepPath(step - 1))}>Quay lại</Button>}<Button type="submit" disabled={busy || uncertain || (step !== 2 && (cruises.loading || cabins.loading || (packages.loading && draft.passengers.some(person => person.tourPackageId))))}>{step === 1 ? 'Tiếp tục nhập hành khách' : step === 2 ? 'Kiểm tra đặt chỗ' : 'Kiểm tra và gửi đặt chỗ'}</Button></div>
      </div></fieldset>
    </div><aside className={styles.rail}><Panel title="Hành trình của bạn"><strong>{selected?.cruiseName ?? 'Chưa chọn chuyến'}</strong>{!admin && <dl className={styles.summary}><div><dt>Khởi hành · giờ Việt Nam</dt><dd>{bookingWhen(selected?.departureDatetime)}</dd></div><div><dt>Trở về · giờ Việt Nam</dt><dd>{bookingWhen(selected?.returnDatetime)}</dd></div><div><dt>Lựa chọn phòng</dt><dd>{draft.passengers.filter(person => person.cabinId).length}/{draft.passengers.length} hành khách đã chọn phòng</dd></div><div><dt>Gói dịch vụ</dt><dd>{draft.passengers.filter(person => person.tourPackageId).length} hành khách chọn gói</dd></div></dl>}<p>{draft.passengers.length} hành khách</p><p className={!admin ? styles.helper : undefined}>Phòng và gói được chọn riêng cho từng người. Không giữ chỗ cho đến khi hệ thống tiếp nhận.</p><ButtonLink tone="secondary" to={back}>Xem hành trình khác</ButtonLink></Panel></aside></div></form>
  </div>{review && <Modal title="Xác nhận gửi đặt chỗ" busy={busy} onClose={() => setReview(false)}><p>{selected?.cruiseName} · {draft.passengers.length} hành khách · {plans[draft.paymentPlan]}</p><p>Kiểm tra thông tin và gửi yêu cầu để nhận mã đặt chỗ cùng lịch thanh toán.</p>{error && <Notice title="Chưa xác nhận được kết quả" tone="error">{error}</Notice>}{uncertain && <Notice title="Kiểm tra kết quả trước khi gửi lại" tone="warning">Không gửi lại để tránh tạo trùng. Đóng hộp thoại để tra cứu hoặc liên hệ nhân viên hỗ trợ.</Notice>}<Button disabled={busy || uncertain} onClick={() => void submit()}>Gửi đặt chỗ</Button></Modal>}</RealBookingFrame>
}
