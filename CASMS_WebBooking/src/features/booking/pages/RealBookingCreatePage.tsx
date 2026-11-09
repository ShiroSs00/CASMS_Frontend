import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { Button, ButtonLink, Field, Notice, Panel } from '@/shared/ui'
import { cruisePackageApi } from '@/domain/cruise-package'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { bookingCruisePackageSelectionErrors, bookingFieldErrors, bookingPackageErrors, realBookingApi } from '../api/real-booking-api'
import { createQuotedBooking, requestBookingQuote } from '../api/booking-quote-api'
import { PassengerDetailsFields } from '../components/LiveBookingFields'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { CruisePackageCabinSelection } from '../components/CruisePackageCabinSelection'
import { BookingPartyStep } from '../components/BookingPartyStep'
import { BookingFlowLayout } from '../components/BookingFlowLayout'
import { BookingReviewStep } from '../components/BookingReviewStep'
import { BookingReceipt } from '../components/BookingReceipt'
import { bookingMutationFailure, bookingTransactionFailure } from '../model/booking-mutation'
import { initialLiveBooking, useLiveBooking } from '../model/live-booking-context'
import { availableBookingStage } from '../model/booking-progress'
import { bookingStagePaths, bookingPlanLabels, catalogReturn, type BookingStage } from '../model/live-booking-navigation'
import { groupPassengers } from '../model/booking-party'
import { eligibleCabins } from '../model/booking-cabin-selection'
import { bookingNow, quoteUsable, transactionState } from '../model/booking-transaction'
import { bookingWhen } from '../model/real-booking-view'
import styles from '../components/LiveBooking.module.css'
import flow from '../components/BookingParty.module.css'
import type { BookingModelRenderer } from '../components/BookingShipModel'

export function RealBookingCreatePage({ step = 2, renderShipModel }: { step?: BookingStage; renderShipModel?: BookingModelRenderer }) {
  const [params] = useSearchParams(), navigate = useNavigate(), access = useSessionAccess()
  const { draft, setDraft, saved, setSaved, uncertain, setUncertain, busy, setBusy, submitError: error,
    setSubmitError: setError, errors, setErrors, submissionLockRef, quoteIntent, setQuoteIntent,
    quoteUnknown, setQuoteUnknown, partyConfirmed, setPartyConfirmed, setPersonIds } = useLiveBooking()
  const heading = useRef<HTMLHeadingElement>(null), recovery = useRef<HTMLDivElement>(null)
  const [validationAttempt, setValidationAttempt] = useState(0), [clock, setClock] = useState(Date.now)
  const state = transactionState({ busy, quoteUnknown, uncertain, saved })
  const locked = state !== 'editable'
  const back = catalogReturn(params.get('from')), requestedCruise = params.get('cruiseId')
  const usable = quoteUsable(draft, quoteIntent, clock)
  useEffect(() => {
    if (!quoteIntent?.quote.expiresAt) return
    const remaining = Date.parse(quoteIntent.quote.expiresAt) - Date.now()
    const timer = setTimeout(() => setClock(Date.now()), Math.max(0, remaining + 1))
    return () => clearTimeout(timer)
  }, [quoteIntent])
  useEffect(() => {
    if (requestedCruise && requestedCruise !== draft.cruiseId && !locked) {
      setDraft(d => ({ ...d, cruiseId: requestedCruise, currency: 'USD', passengers: d.passengers.map(p => ({ ...p, cabinId: '', tourPackageId: '', cabinSelectionMode: undefined, farePackageOfferId: undefined, farePackagePriceRevisionId: undefined })) }))
      setPartyConfirmed(false); setErrors({})
    }
  }, [requestedCruise, draft.cruiseId, locked, setDraft, setErrors, setPartyConfirmed])
  useEffect(() => {
    if (uncertain || quoteUnknown) recovery.current?.focus()
    else {
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"]')
      if (first) first.focus()
      else heading.current?.focus()
    }
  }, [step, validationAttempt, saved, uncertain, quoteUnknown])
  const dirty = !saved && (Boolean(draft.cruiseId) || draft.passengers.some(p => p.fullName || p.email || p.documentNumber))
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const cruises = useReadQuery('booking-published-cruises', realBookingApi.cruises)
  const cabins = useReadQuery('booking-available-cabins:' + draft.cruiseId, useCallback(signal => draft.cruiseId ? realBookingApi.cabins(draft.cruiseId, signal) : Promise.resolve(null), [draft.cruiseId]))
  const packages = useReadQuery('booking-cruise-packages:' + draft.cruiseId, useCallback(signal => realBookingApi.packagesForCruise(draft.cruiseId, signal), [draft.cruiseId]))
  const fares = useReadQuery('booking-fares:' + draft.cruiseId, useCallback(signal => draft.cruiseId ? cruisePackageApi.available(draft.cruiseId, signal) : Promise.resolve(null), [draft.cruiseId]))
  const selected = cruises.data?.find(c => c.cruiseId === draft.cruiseId)
  const choicesLoading = cruises.loading || cabins.loading || packages.loading || fares.loading
  const readError = cruises.error || cabins.error || fares.error
  const available = availableBookingStage(draft, partyConfirmed, selected, cabins.data, packages.data, fares.data, !access.userId, clock)
  function path(next: number, cruiseId = draft.cruiseId) {
    const query = new URLSearchParams({ from: back })
    if (cruiseId) query.set('cruiseId', cruiseId)
    return bookingStagePaths[next - 1] + '?' + query
  }
  function validate(stage: BookingStage) {
    let invalid: Record<string, string> = {}
    if (stage === 1) {
      if (!selected?.sellable || Date.parse(selected.departureDatetime) <= bookingNow() || !draft.passengers.length) invalid['real-booking-cruise'] = 'Chọn chuyến đang mở bán và ít nhất một hành khách.'
    } else {
      const mode = stage === 2 ? 1 : stage === 3 ? 2 : 3
      invalid = bookingFieldErrors(draft, selected, cabins.data, undefined, mode)
      if (mode !== 1 && !access.userId && !draft.passengers[0]?.email.trim()) invalid['person-0-email'] = 'Nhập email người đại diện để nhận hướng dẫn hợp đồng.'
      if (mode !== 2) {
        Object.assign(invalid, bookingPackageErrors(draft, packages.data), bookingCruisePackageSelectionErrors(draft, fares.data))
        draft.passengers.forEach((p, i) => {
          if (p.cabinSelectionMode !== 'CATEGORY_HOLD' && !eligibleCabins(cabins.data ?? [], draft.passengers, i, fares.data).some(c => c.cabinId === p.cabinId)) invalid[`person-${i}-cabinId`] = 'Cabin không còn phù hợp với lựa chọn của cả nhóm. Vui lòng chọn lại.'
        })
      }
    }
    setErrors(invalid)
    if (Object.keys(invalid).length) setValidationAttempt(n => n + 1)
    return invalid
  }
  function showInvalid(invalid: Record<string, string>) {
    const id = Object.keys(invalid)[0]
    const target = id === 'real-booking-cruise' ? 1 : /-(cabinId|tourPackageId|farePackageOfferId|cabinSelectionMode|cabinGroupKey)$/.test(id) ? 2 : 3
    if (target !== step) navigate(path(target))
  }
  async function submit() {
    if (submissionLockRef.current || locked || !quoteIntent || !quoteUsable(draft, quoteIntent)) return
    const invalid = validate(4)
    if (Object.keys(invalid).length) { showInvalid(invalid); return }
    submissionLockRef.current = true; setBusy(true); setError('')
    let unknown = false
    try { setSaved(await createQuotedBooking(draft, quoteIntent)) }
    catch (value) {
      const failure = bookingMutationFailure(value)
      unknown = failure.uncertain; setUncertain(unknown); setError(failure.message)
      if (!unknown) { setQuoteIntent(null); cabins.retry(); packages.retry(); cruises.retry(); fares.retry() }
    } finally { submissionLockRef.current = unknown; setBusy(false) }
  }
  async function next(event: FormEvent) {
    event.preventDefault()
    if (locked || submissionLockRef.current) return
    const invalid = validate(step)
    if (Object.keys(invalid).length) { showInvalid(invalid); return }
    setError('')
    if (step < 4) {
      if (step === 1) setPartyConfirmed(true)
      navigate(path(step + 1)); return
    }
    if (usable) { await submit(); return }
    submissionLockRef.current = true; setBusy(true); setQuoteIntent(null)
    let unknown = false
    try { setQuoteIntent(await requestBookingQuote(draft)); setClock(bookingNow()) }
    catch (value) { unknown = mutationOutcomeUnknown(value); setQuoteUnknown(unknown); setError(bookingTransactionFailure(value)) }
    finally { submissionLockRef.current = unknown; setBusy(false) }
  }
  if (saved) return <RealBookingFrame><BookingReceipt booking={saved} headingRef={heading} onNew={() => {
    setDraft(initialLiveBooking()); setPersonIds([crypto.randomUUID()]); setPartyConfirmed(false); setSaved(null); setQuoteIntent(null); setErrors({}); setError(''); setUncertain(false); setQuoteUnknown(false); submissionLockRef.current = false; navigate('/cruises')
  }} /></RealBookingFrame>
  if (!locked && !choicesLoading && !readError && (!requestedCruise || requestedCruise === draft.cruiseId) && step > available) return <Navigate to={path(available)} replace />
  return <RealBookingFrame><BookingFlowLayout stage={step} available={available} locked={locked} path={path} back={back} headingRef={heading} summary={<>
    <h2>Hành trình của bạn</h2><strong>{selected?.cruiseName ?? 'Chưa chọn chuyến'}</strong><dl>
      <div><dt>Khởi hành · Giờ Việt Nam</dt><dd>{bookingWhen(selected?.departureDatetime)}</dd></div>
      <div><dt>Trở về · Giờ Việt Nam</dt><dd>{bookingWhen(selected?.returnDatetime)}</dd></div>
      <div><dt>Người đi & phòng</dt><dd>{draft.passengers.length} khách · {groupPassengers(draft.passengers).length} phòng</dd></div>
      <div><dt>Giá</dt><dd>{usable && quoteIntent ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(quoteIntent.quote.totalAmount ?? 0) : 'Chưa có báo giá hiệu lực'}</dd></div>
    </dl><p className={flow.muted}>Lựa chọn chưa phải là giữ chỗ.</p>
  </>}>
    {(uncertain || quoteUnknown) && <div ref={recovery} tabIndex={-1} role="region" aria-label="Cần đối chiếu kết quả"><Notice title={uncertain ? 'Cần kiểm tra kết quả trước khi đặt lại' : 'Chưa nhận được kết quả báo giá'} tone="warning"><p>{uncertain ? 'Hệ thống có thể đã tiếp nhận yêu cầu. Đã khóa gửi lại để tránh tạo trùng. Nếu chưa có mã, liên hệ bộ phận hỗ trợ để kiểm tra bằng thông tin người đại diện.' : 'Chưa có mã báo giá để đối chiếu. Thông tin đã nhập được giữ; vui lòng liên hệ bộ phận hỗ trợ trước khi tiếp tục.'}</p><ButtonLink tone="secondary" to="/booking/lookup">Tra cứu khi đã có mã</ButtonLink></Notice></div>}
    {error && !uncertain && !quoteUnknown && <Notice title="Chưa hoàn tất yêu cầu" tone="error">{error}</Notice>}
    <form noValidate onSubmit={next}>
      {Object.keys(errors).length > 0 && <Notice title="Vui lòng kiểm tra thông tin" tone="error"><ul>{Object.entries(errors).map(([id, message]) => <li key={id}><button type="button" className={styles.errorLink} onClick={() => { const field = document.getElementById(id); if (field) field.focus(); else showInvalid({ [id]: message }) }}>{message}</button></li>)}</ul></Notice>}
      <fieldset disabled={locked} className={styles.draftFields}><div className={flow.section}>
        <BookingReadState {...cruises} publicResource="danh sách hành trình" />
        {step === 1 && <>
          <Panel title="Chuyến khởi hành"><Field htmlFor="real-booking-cruise" label="Hành trình *" error={errors['real-booking-cruise']}><select id="real-booking-cruise" value={draft.cruiseId} onChange={e => { navigate(path(1, e.target.value)); if (!e.target.value) { setDraft(d => ({ ...d, cruiseId: '', passengers: d.passengers.map(p => ({ ...p, cabinId: '', tourPackageId: '', farePackageOfferId: undefined, farePackagePriceRevisionId: undefined, cabinSelectionMode: undefined })) })); setPartyConfirmed(false); setErrors({}) } }}><option value="">Chọn hành trình</option>{cruises.data?.map(c => <option key={c.cruiseId} value={c.cruiseId}>{c.cruiseName}</option>)}</select></Field></Panel>
          <BookingPartyStep />
        </>}
        {step === 2 && <>
          <BookingReadState {...cabins} publicResource="phòng trống" /><BookingReadState {...fares} publicResource="gói du thuyền" />
          {packages.error && <Notice title="Chưa tải được gói dịch vụ tùy chọn" tone="warning"><Button tone="secondary" onClick={packages.retry}>Tải lại gói</Button></Notice>}
          {!choicesLoading && !readError && fares.data && cabins.data && <CruisePackageCabinSelection catalog={fares.data} cabins={cabins.data} shipId={selected?.shipId} render={renderShipModel} packages={packages.data} />}
        </>}
        {step === 3 && <>
          <PassengerDetailsFields publicJourney representativeEmailRequired={!access.userId} />
          <Panel title="Kế hoạch thanh toán"><div className={flow.section}>
            <Field htmlFor="real-booking-plan" label="Kế hoạch thanh toán" error={errors['real-booking-plan']}><select id="real-booking-plan" value={draft.paymentPlan} onChange={e => setDraft(d => ({ ...d, paymentPlan: e.target.value as typeof d.paymentPlan }))}>{Object.entries(bookingPlanLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            <p className={flow.muted}>Bước này chưa thu tiền. Lịch thanh toán áp dụng được hiển thị sau khi tiếp nhận đặt chỗ.</p>
            <Field htmlFor="real-booking-notes" label="Ghi chú (tùy chọn)" error={errors['real-booking-notes']}><textarea id="real-booking-notes" maxLength={500} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          </div></Panel>
        </>}
        {step === 4 && <BookingReviewStep draft={draft} cruise={selected} cabins={cabins.data} fares={fares.data} packages={packages.data} intent={quoteIntent} usable={usable} path={path} />}
        {readError && step > 2 && <><BookingReadState {...cabins} publicResource="phòng trống" /><BookingReadState {...fares} publicResource="gói du thuyền" /></>}
        <div className={flow.actions}>{step > 1 && <Button tone="secondary" onClick={() => navigate(path(step - 1))}>Quay lại</Button>}<Button type="submit" busy={busy} disabled={locked || choicesLoading || Boolean(readError)}>{step === 1 ? 'Tiếp tục chọn gói & cabin' : step === 2 ? 'Tiếp tục nhập thông tin' : step === 3 ? 'Kiểm tra đặt chỗ' : usable ? 'Xác nhận đặt chỗ' : 'Kiểm tra giá'}</Button></div>
      </div></fieldset>
    </form>
  </BookingFlowLayout></RealBookingFrame>
}
