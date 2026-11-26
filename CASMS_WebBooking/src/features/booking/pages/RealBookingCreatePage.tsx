import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { apiRequest, useReadQuery } from '@/shared/api'
import { Button, ButtonLink, Field, Notice, Panel } from '@/shared/ui'
import { cruisePackageApi } from '@/domain/cruise-package'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { bookingCruisePackageSelectionErrors, bookingFieldErrors, bookingPackageErrors, realBookingApi } from '../api/real-booking-api'
import { createQuotedBooking, quoteSelection, requestBookingQuote } from '../api/booking-quote-api'
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
import { primaryPhotoForCruise } from '../model/cruise-port-photos'
import styles from '../components/LiveBooking.module.css'
import flow from '../components/BookingParty.module.css'
import type { BookingModelRenderer } from '../components/BookingShipModel'

export function RealBookingCreatePage({ step = 2, renderShipModel }: { step?: BookingStage; renderShipModel?: BookingModelRenderer }) {
  const [params] = useSearchParams(), navigate = useNavigate(), access = useSessionAccess()
  const meQuery = useReadQuery(
    'booking-me:' + (access.userId ?? 'anon'),
    useCallback(
      signal => access.userId
        ? apiRequest<{
            fullName?: string | null
            email?: string | null
            phoneNumber?: string | null
            dateOfBirth?: string | null
            nationality?: string | null
            documentType?: 'Passport' | 'NationalID' | null
            documentNumber?: string | null
          }>('/auth/me', { signal }).catch(() => null)
        : Promise.resolve(null),
      [access.userId],
    ),
  )
  const customerUser = meQuery.data
  const { draft, setDraft, saved, setSaved, uncertain, setUncertain, busy, setBusy, submitError: error,
    setSubmitError: setError, errors, setErrors, submissionLockRef, quoteIntent, setQuoteIntent,
    quoteUnknown, setQuoteUnknown, partyConfirmed, setPartyConfirmed, setPersonIds } = useLiveBooking()
  const heading = useRef<HTMLHeadingElement>(null), recovery = useRef<HTMLDivElement>(null)
  const [validationAttempt, setValidationAttempt] = useState(0), [clock, setClock] = useState(Date.now)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [changingCruise, setChangingCruise] = useState(false)
  const lastAutoQuotedRef = useRef<string>('')
  const state = transactionState({ busy, quoteUnknown, uncertain, saved })
  const locked = state !== 'editable'
  const back = catalogReturn(params.get('from')), requestedCruise = params.get('cruiseId')
  const usable = quoteUsable(draft, quoteIntent, clock)
  // Auto-prefill full verified passenger profile on Step 3 so returning customers do not trigger 409 mismatch
  useEffect(() => {
    if (!customerUser || locked || draft.bookForOthers) return
    setDraft(current => {
      if (current.bookForOthers) return current
      const lead = current.passengers[0]
      if (!lead) return current
      const nextFullName = lead.fullName || customerUser.fullName || ''
      const nextEmail = lead.email || customerUser.email || ''
      const nextPhone = lead.phoneNumber || customerUser.phoneNumber || ''
      const nextDob = lead.dateOfBirth || customerUser.dateOfBirth || ''
      const nextNationality = lead.nationality || customerUser.nationality || ''
      const nextDocType = lead.documentType || customerUser.documentType || ''
      const nextDocNumber = lead.documentNumber || customerUser.documentNumber || ''
      if (
        nextFullName === lead.fullName
        && nextEmail === lead.email
        && nextPhone === lead.phoneNumber
        && nextDob === lead.dateOfBirth
        && nextNationality === lead.nationality
        && nextDocType === lead.documentType
        && nextDocNumber === lead.documentNumber
      ) return current
      const nextPassengers = [...current.passengers]
      nextPassengers[0] = {
        ...lead,
        fullName: nextFullName,
        email: nextEmail,
        phoneNumber: nextPhone,
        dateOfBirth: nextDob,
        nationality: nextNationality,
        documentType: nextDocType,
        documentNumber: nextDocNumber,
      }
      return { ...current, passengers: nextPassengers }
    })
  }, [customerUser, locked, draft.bookForOthers, setDraft])
  useEffect(() => {
    if (!quoteIntent?.quote.expiresAt) return
    const remaining = Date.parse(quoteIntent.quote.expiresAt) - Date.now()
    const timer = setTimeout(() => setClock(Date.now()), Math.max(0, remaining + 1))
    return () => clearTimeout(timer)
  }, [quoteIntent])
  useEffect(() => {
    if (requestedCruise && requestedCruise !== draft.cruiseId && !locked) {
      setDraft(d => ({ ...d, cruiseId: requestedCruise, currency: 'VND', passengers: d.passengers.map(p => ({ ...p, cabinId: '', tourPackageId: '', cabinSelectionMode: undefined, farePackageOfferId: undefined, farePackagePriceRevisionId: undefined })) }))
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
  const cruises = useReadQuery('booking-published-cruises:' + (requestedCruise ?? 'all'), realBookingApi.cruises)
  const cabins = useReadQuery('booking-available-cabins:' + draft.cruiseId, useCallback(signal => draft.cruiseId ? realBookingApi.cabins(draft.cruiseId, signal) : Promise.resolve(null), [draft.cruiseId]))
  const packages = useReadQuery('booking-cruise-packages:' + draft.cruiseId, useCallback(signal => realBookingApi.packagesForCruise(draft.cruiseId, signal), [draft.cruiseId]))
  const fares = useReadQuery('booking-fares:' + draft.cruiseId, useCallback(signal => draft.cruiseId ? cruisePackageApi.available(draft.cruiseId, signal) : Promise.resolve(null), [draft.cruiseId]))
  const selected = cruises.data?.find(c => c.cruiseId === draft.cruiseId)
  useEffect(() => {
    const currency = selected?.saleCurrency === 'USD' ? 'USD' : 'VND'
    if (selected && !locked && draft.currency !== currency) setDraft(current => ({ ...current, currency }))
  }, [selected, locked, draft.currency, setDraft])
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
      if (!unknown) { setQuoteIntent(null); lastAutoQuotedRef.current = ''; cabins.retry(); packages.retry(); cruises.retry(); fares.retry() }
      requestAnimationFrame(() => heading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } finally { submissionLockRef.current = unknown; setBusy(false) }
  }

  const runAutoQuote = useCallback(async (targetDraft: typeof draft) => {
    if (submissionLockRef.current || locked) return
    const key = quoteSelection(targetDraft)
    lastAutoQuotedRef.current = key
    setQuoteLoading(true)
    setQuoteError('')
    try {
      const nextIntent = await requestBookingQuote(targetDraft)
      const eligible = nextIntent.quote.eligiblePaymentPlans
      if (eligible.length > 0 && !eligible.includes(targetDraft.paymentPlan)) {
        const fallbackPlan = eligible.includes('DEPOSIT')
          ? 'DEPOSIT'
          : eligible.includes('FULL')
            ? 'FULL'
            : eligible[0]
        const adjustedDraft = { ...targetDraft, paymentPlan: fallbackPlan }
        setDraft(current => (current.paymentPlan === fallbackPlan ? current : { ...current, paymentPlan: fallbackPlan }))
        const adjustedIntent = await requestBookingQuote(adjustedDraft)
        lastAutoQuotedRef.current = quoteSelection(adjustedDraft)
        setQuoteIntent(adjustedIntent)
        setClock(bookingNow())
        return
      }
      setQuoteIntent(nextIntent)
      setClock(bookingNow())
    } catch (value) {
      const unknown = mutationOutcomeUnknown(value)
      if (unknown) setQuoteUnknown(true)
      setQuoteError(bookingTransactionFailure(value))
    } finally {
      setQuoteLoading(false)
    }
  }, [locked, setDraft, setQuoteIntent, setQuoteUnknown, submissionLockRef])

  // Auto-fetch authoritative quote when entering Step 4 or switching payment plan — NO manual "Kiểm tra giá" click needed!
  const currentQuoteKey = quoteSelection(draft)
  useEffect(() => {
    if (step !== 4 || locked || choicesLoading || Boolean(readError) || usable || quoteLoading) return
    if (lastAutoQuotedRef.current === currentQuoteKey) return
    void runAutoQuote(draft)
  }, [step, locked, choicesLoading, readError, usable, quoteLoading, currentQuoteKey, draft, runAutoQuote])

  function handleSelectPlanOnReview(plan: typeof draft.paymentPlan) {
    if (plan === draft.paymentPlan || locked) return
    const nextDraft = { ...draft, paymentPlan: plan }
    setDraft(nextDraft)
    setQuoteIntent(null)
    lastAutoQuotedRef.current = ''
  }

  function handleRefreshQuote() {
    if (locked || quoteLoading) return
    setQuoteIntent(null)
    lastAutoQuotedRef.current = ''
    void runAutoQuote(draft)
  }

  const [acceptedTerms, setAcceptedTerms] = useState(false)
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
    if (!acceptedTerms) {
      setError('Vui lòng xác nhận đã kiểm tra thông tin hành khách và đồng ý điều kiện đặt chỗ trước khi gửi.')
      return
    }
    if (usable) { await submit(); return }
    await runAutoQuote(draft)
  }
  if (saved) return <RealBookingFrame><BookingReceipt booking={saved} headingRef={heading} onNew={() => {
    setDraft(initialLiveBooking()); setPersonIds([crypto.randomUUID()]); setPartyConfirmed(false); setSaved(null); setQuoteIntent(null); setErrors({}); setError(''); setUncertain(false); setQuoteUnknown(false); submissionLockRef.current = false; navigate('/cruises')
  }} /></RealBookingFrame>
  if (!locked && !choicesLoading && !readError && (!requestedCruise || requestedCruise === draft.cruiseId) && step > available) return <Navigate to={path(available)} replace />
  const selectedPhoto = selected ? primaryPhotoForCruise({
    title: selected.cruiseName,
    departurePort: selected.departurePortName,
    returnPort: selected.returnPortName,
  }) : null
  const selectedBenefits = [...new Map(
    draft.passengers
      .map(p => fares.data?.offers.find(o => o.selection.offerId === p.farePackageOfferId)?.selection)
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .flatMap(s => s.benefits)
      .filter(b => b.inclusion === 'INCLUDED' || b.inclusion === 'LIMITED_INCLUDED')
      .map(b => [b.resourceName, b.resourceName]),
  ).values()]
  const selectedOfferTotal = draft.passengers.reduce((sum, p) => {
    const offer = fares.data?.offers.find(o => o.selection.offerId === p.farePackageOfferId)
    return sum + (offer ? Number(offer.selection.amount) : 0)
  }, 0)
  const hasEstimatedTotal = selectedOfferTotal > 0 && draft.passengers.every(p => Boolean(p.farePackageOfferId))
  const summaryCurrency = quoteIntent?.quote.currency ?? selected?.saleCurrency ?? draft.currency
  const formatSummaryMoney = (amount: number) =>
    `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: summaryCurrency === 'VND' ? 0 : 2 }).format(amount)} ${summaryCurrency}`
  return <RealBookingFrame><BookingFlowLayout stage={step} available={available} locked={locked} path={path} back={back} headingRef={heading} summary={<>
    {selectedPhoto && <div className={flow.summaryMedia}>
      <img src={selectedPhoto.image} alt={selected?.cruiseName ?? selectedPhoto.caption} width="800" height="500" />
      <div className={flow.summaryMediaOverlay}>
        {selected?.shipName && <span className={flow.summaryShipBadge}>{selected.shipName}</span>}
        {selected?.cruiseCode && <span className={flow.summaryCodeBadge}>{selected.cruiseCode}</span>}
      </div>
    </div>}
    <div className={flow.summaryBody}>
      <p className={flow.summaryEyebrow}>HÀNH TRÌNH CỦA BẠN</p>
      <h2>{selected?.cruiseName ?? 'Chọn chuyến khởi hành'}</h2>
      {selected?.departurePortName && (
        <p className={flow.summaryRouteLine}>
          {selected.departurePortName}{selected.returnPortName ? ` → ${selected.returnPortName}` : ''}
        </p>
      )}
      <div className={flow.summaryDateGrid}>
        <div>
          <span>Khởi hành</span>
          <strong>{bookingWhen(selected?.departureDatetime)}</strong>
        </div>
        <div>
          <span>Trở về</span>
          <strong>{bookingWhen(selected?.returnDatetime)}</strong>
        </div>
      </div>
      <div className={flow.summaryPartyPill}>
        <span>Hành khách &amp; phòng</span>
        <strong>{draft.passengers.length} khách · {groupPassengers(draft.passengers).length} phòng</strong>
      </div>
      {selectedBenefits.length > 0 && <details className={flow.summaryInclusions}>
        <summary>Bao gồm trong gói đã chọn ({selectedBenefits.length})</summary>
        <ul>{selectedBenefits.map(item => <li key={item}>{item}</li>)}</ul>
      </details>}
      {usable && quoteIntent && <div className={flow.summaryBreakdown}>
        {quoteIntent.quote.subtotalAmount != null && <div className={flow.summaryBreakdownRow}>
          <span>Giá gói ({draft.passengers.length} khách)</span>
          <strong>{formatSummaryMoney(quoteIntent.quote.subtotalAmount)}</strong>
        </div>}
        {quoteIntent.quote.taxesAndFeesAmount != null && <div className={flow.summaryBreakdownRow}>
          <span>Thuế &amp; phí cảng</span>
          <strong>{formatSummaryMoney(quoteIntent.quote.taxesAndFeesAmount)}</strong>
        </div>}
      </div>}
      <div className={flow.summaryTotalCard}>
        <span>{usable && quoteIntent ? 'Tổng tiền đặt chỗ' : hasEstimatedTotal ? 'Tạm tính gói du thuyền' : 'Tổng tiền dự kiến'}</span>
        <strong>
          {usable && quoteIntent
            ? formatSummaryMoney(quoteIntent.quote.totalAmount ?? 0)
            : hasEstimatedTotal
              ? formatSummaryMoney(selectedOfferTotal)
              : 'Chọn gói để xem tạm tính'}
        </strong>
      </div>
      {usable && quoteIntent && quoteIntent.quote.installments.length > 0 && (
        <div className={flow.summaryDepositPill}>
          <span>{quoteIntent.quote.installments.length > 1 ? 'Cần đóng Đợt 1 (Đặt cọc)' : 'Cần thanh toán'}</span>
          <strong>{formatSummaryMoney(quoteIntent.quote.installments[0].amount)}</strong>
        </div>
      )}
    </div>
  </>}>
    {(uncertain || quoteUnknown) && <div ref={recovery} tabIndex={-1} role="region" aria-label="Cần đối chiếu kết quả"><Notice title={uncertain ? 'Cần kiểm tra kết quả trước khi đặt lại' : 'Chưa nhận được kết quả báo giá'} tone="warning"><p>{uncertain ? 'Hệ thống có thể đã tiếp nhận yêu cầu. Đã khóa gửi lại để tránh tạo trùng. Nếu chưa có mã, liên hệ bộ phận hỗ trợ để kiểm tra bằng thông tin người đại diện.' : 'Chưa có mã báo giá để đối chiếu. Thông tin đã nhập được giữ; vui lòng liên hệ bộ phận hỗ trợ trước khi tiếp tục.'}</p><ButtonLink tone="secondary" to="/booking/lookup">Tra cứu khi đã có mã</ButtonLink></Notice></div>}
    {error && !uncertain && !quoteUnknown && <Notice title="Chưa hoàn tất yêu cầu" tone="error">{error}</Notice>}
    <form noValidate onSubmit={next}>
      {Object.keys(errors).length > 0 && <Notice title="Vui lòng kiểm tra thông tin" tone="error"><ul>{Object.entries(errors).map(([id, message]) => <li key={id}><button type="button" className={styles.errorLink} onClick={() => { const field = document.getElementById(id); if (field) field.focus(); else showInvalid({ [id]: message }) }}>{message}</button></li>)}</ul></Notice>}
      <fieldset disabled={locked} className={styles.draftFields}><div className={flow.section}>
        <BookingReadState {...cruises} publicResource="danh sách hành trình" />
        {step === 1 && <>
          {selected && !changingCruise ? (
            <section className={flow.selectedCruiseBanner} aria-label="Chuyến khởi hành đang chọn">
              {selectedPhoto && (
                <div className={flow.selectedCruiseThumb}>
                  <img src={selectedPhoto.image} alt={selected.cruiseName} width="320" height="200" />
                </div>
              )}
              <div className={flow.selectedCruiseInfo}>
                <div className={flow.selectedCruiseTags}>
                  {selected.cruiseCode && <span className={flow.selectedCruiseCode}>{selected.cruiseCode}</span>}
                  {selected.shipName && <span className={flow.selectedCruiseShip}>Tàu {selected.shipName}</span>}
                </div>
                <h2>{selected.cruiseName}</h2>
                <p className={flow.muted}>
                  {selected.departurePortName ?? ''}{selected.returnPortName ? ` → ${selected.returnPortName}` : ''}
                  {' · '}Khởi hành {bookingWhen(selected.departureDatetime)}
                </p>
              </div>
              <Button tone="secondary" size="compact" autoWidth onClick={() => setChangingCruise(true)}>
                Đổi chuyến
              </Button>
            </section>
          ) : (
            <Panel title="Chọn chuyến khởi hành">
              <div className={flow.section}>
                <Field htmlFor="real-booking-cruise" label="Hành trình đang mở bán *" error={errors['real-booking-cruise']}>
                  <select id="real-booking-cruise" value={draft.cruiseId} onChange={e => {
                    navigate(path(1, e.target.value))
                    setChangingCruise(false)
                    if (!e.target.value) {
                      setDraft(d => ({ ...d, cruiseId: '', passengers: d.passengers.map(p => ({ ...p, cabinId: '', tourPackageId: '', farePackageOfferId: undefined, farePackagePriceRevisionId: undefined, cabinSelectionMode: undefined })) }))
                      setPartyConfirmed(false); setErrors({})
                    }
                  }}>
                    <option value="">Chọn hành trình</option>
                    {cruises.data?.map(c => <option key={c.cruiseId} value={c.cruiseId}>{c.cruiseName} ({c.cruiseCode})</option>)}
                  </select>
                </Field>
                {selected && <Button tone="text" size="compact" autoWidth onClick={() => setChangingCruise(false)}>Giữ nguyên chuyến hiện tại</Button>}
              </div>
            </Panel>
          )}
          <BookingPartyStep />
        </>}
        {step === 2 && <>
          <BookingReadState {...cabins} publicResource="phòng trống" /><BookingReadState {...fares} publicResource="gói du thuyền" />
          {packages.error && <Notice title="Chưa tải được gói dịch vụ tùy chọn" tone="warning"><Button tone="secondary" onClick={packages.retry}>Tải lại gói</Button></Notice>}
          {!choicesLoading && !readError && fares.data && cabins.data && <CruisePackageCabinSelection catalog={fares.data} cabins={cabins.data} shipId={selected?.shipId} render={renderShipModel} packages={packages.data} />}
        </>}
        {step === 3 && <>
          <PassengerDetailsFields
            publicJourney
            representativeEmailRequired={!access.userId || Boolean(draft.bookForOthers)}
            canSwitchLeadProfile={Boolean(access.userId)}
            usingOwnProfile={!draft.bookForOthers}
            onSelectLeadMode={useOwn => {
              if (locked) return
              setDraft(current => {
                const nextPassengers = [...current.passengers]
                if (nextPassengers[0]) {
                  nextPassengers[0] = useOwn
                    ? {
                        ...nextPassengers[0],
                        fullName: customerUser?.fullName || '',
                        email: customerUser?.email || '',
                        phoneNumber: customerUser?.phoneNumber || '',
                        dateOfBirth: customerUser?.dateOfBirth || '',
                        nationality: customerUser?.nationality || '',
                        documentType: customerUser?.documentType || '',
                        documentNumber: customerUser?.documentNumber || '',
                      }
                    : { ...nextPassengers[0], fullName: '', email: '', phoneNumber: '', dateOfBirth: '', nationality: '', documentType: '', documentNumber: '' }
                }
                return { ...current, bookForOthers: !useOwn, passengers: nextPassengers }
              })
            }}
          />
          <Panel title="Kế hoạch thanh toán"><div className={flow.section}>
            <div>
              <p className={flow.choiceGroupLabel}>Chọn hình thức thanh toán *</p>
              <div id="real-booking-plan" tabIndex={-1} className={flow.choiceCardGrid} role="group" aria-label="Kế hoạch thanh toán" aria-invalid={Boolean(errors['real-booking-plan'])}>
                {(Object.entries(bookingPlanLabels) as [typeof draft.paymentPlan, string][]).map(([key, label]) => {
                  const active = draft.paymentPlan === key
                  const desc = key === 'FULL'
                    ? 'Đóng 1 lần (100% tổng giá trị) trong vòng 2 ngày kể từ lúc đặt chỗ.'
                    : key === 'DEPOSIT'
                      ? 'Đợt 1: đặt cọc 30% trong 2 ngày để giữ cabin · Đợt 2: đóng 70% còn lại trước ngày đi.'
                      : 'Chia 3 đợt rõ ràng: Đợt 1 cọc 30% (2 ngày) · Đợt 2 giữa kỳ 40% (30 ngày trước đi) · Đợt 3 tất toán 30%.'
                  return <button
                    key={key}
                    type="button"
                    className={`${flow.choiceCard} ${active ? flow.choiceCardActive : ''}`}
                    aria-pressed={active}
                    onClick={() => setDraft(d => ({ ...d, paymentPlan: key }))}
                  >
                    <div className={flow.choiceCardHead}>
                      <span className={flow.choiceCardTitle}>{label}</span>
                      <span className={flow.choiceCardCheck} aria-hidden="true">✓</span>
                    </div>
                    <span className={flow.choiceCardDesc}>{desc}</span>
                  </button>
                })}
              </div>
              {errors['real-booking-plan'] && <p className={flow.inlineError} role="alert">{errors['real-booking-plan']}</p>}
            </div>
            <Field htmlFor="real-booking-notes" label="Ghi chú đặc biệt (tùy chọn)" error={errors['real-booking-notes']}><textarea id="real-booking-notes" maxLength={500} placeholder="Ví dụ: yêu cầu chế độ ăn, kỷ niệm ngày cưới, hỗ trợ di chuyển…" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          </div></Panel>
        </>}
        {step === 4 && (
          <>
            <BookingReviewStep
              draft={draft}
              cruise={selected}
              cabins={cabins.data}
              fares={fares.data}
              packages={packages.data}
              intent={quoteIntent}
              usable={usable}
              quoteLoading={quoteLoading}
              quoteError={quoteError}
              onSelectPlan={handleSelectPlanOnReview}
              onRefreshQuote={handleRefreshQuote}
              path={path}
            />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', background: 'var(--ui-surface, #fff)', border: '1px solid var(--ui-border, #d5e0e4)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', lineHeight: 1.55 }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => { setAcceptedTerms(e.target.checked); if (e.target.checked) setError('') }}
                style={{ marginTop: '2px' }}
              />
              <span>Tôi xác nhận thông tin hành khách là chính xác và đồng ý với điều kiện đặt chỗ, lịch thanh toán và chính sách hợp đồng của OceVie Cruises.</span>
            </label>
          </>
        )}
        {readError && step > 2 && <><BookingReadState {...cabins} publicResource="phòng trống" /><BookingReadState {...fares} publicResource="gói du thuyền" /></>}
        <div className={flow.actions}>
          {step > 1 && <Button tone="secondary" onClick={() => navigate(path(step - 1))}>Quay lại</Button>}
          <Button
            type="submit"
            busy={busy || quoteLoading}
            disabled={locked || choicesLoading || Boolean(readError) || (step === 4 && (quoteLoading || !usable || !acceptedTerms))}
          >
            {step === 1
              ? 'Tiếp tục chọn gói & cabin'
              : step === 2
                ? 'Tiếp tục nhập thông tin'
                : step === 3
                  ? 'Xem xác nhận & lịch thanh toán'
                  : 'Xác nhận đặt chỗ'}
          </Button>
        </div>
      </div></fieldset>
    </form>
  </BookingFlowLayout></RealBookingFrame>
}
