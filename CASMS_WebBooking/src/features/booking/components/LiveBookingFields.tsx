import { Button, Field, Panel } from '@/shared/ui'
import type { AvailableCabin, BookingPersonDraft } from '../api/real-booking-api'
import { blankBookingPerson, useLiveBooking } from '../model/live-booking-context'
import { bookingMoney, cabinTypeName } from '../model/booking-presentation'
import styles from './LiveBooking.module.css'
import { CustomerPackageDetails } from './CustomerPackageDetails'

export type BookingPackageOption = { id: string; name: string; price: number; currency: string }
export function CabinPassengerFields({ cabins, packages, publicJourney = false }: { cabins: AvailableCabin[] | null; packages: BookingPackageOption[] | null; publicJourney?: boolean }) {
  const { draft, setDraft, errors, setErrors } = useLiveBooking()
  function update(index: number, key: 'cabinId' | 'tourPackageId', value: string) {
    setDraft(current => ({ ...current, passengers: current.passengers.map((person, i) => i === index ? { ...person, [key]: value } : person) }))
    if (publicJourney) setErrors(current => { const next = { ...current }; delete next[`person-${index}-${key}`]; return next })
  }
  return <div className={styles.stack}>
    {draft.passengers.map((person, index) => <Panel className={styles.passengerCard} key={index} title={`Hành khách ${index + 1}${person.fullName ? ' · ' + person.fullName : ''}`}>
      <Field htmlFor={`person-${index}-cabinId`} label={`Phòng cho hành khách ${index + 1} *`} hint={publicJourney ? 'Chọn cùng một phòng cho các hành khách ở chung, trong số chỗ còn lại.' : undefined} error={errors[`person-${index}-cabinId`]}>
        <select id={`person-${index}-cabinId`} value={person.cabinId} aria-invalid={Boolean(errors[`person-${index}-cabinId`])} aria-describedby={publicJourney || errors[`person-${index}-cabinId`] ? `person-${index}-cabinId-hint` : undefined} onChange={event => update(index, 'cabinId', event.target.value)}>
          <option value="">Chọn phòng trống</option>
          {person.cabinId && !cabins?.some(item => item.cabinId === person.cabinId) && <option value={person.cabinId}>Phòng đã chọn cần kiểm tra lại</option>}
          {cabins?.map(cabin => {
            const others = draft.passengers.filter((other, i) => i !== index && other.cabinId === cabin.cabinId).length
            return <option key={cabin.cabinId} value={cabin.cabinId} disabled={cabin.remainingCapacity <= others && person.cabinId !== cabin.cabinId}>{cabin.deckNumber == null ? 'Chưa có thông tin boong' : `Boong ${cabin.deckNumber}`} · {cabin.cabinNumber} · {publicJourney ? cabinTypeName(cabin.cabinType) : cabin.cabinType} · Còn {Math.max(0, cabin.remainingCapacity - others)} chỗ cho người này{cabin.isAccessible ? ' · Hỗ trợ tiếp cận' : ''}</option>
          })}
        </select>
      </Field>
      {publicJourney && cabins?.filter(cabin => cabin.cabinId === person.cabinId).map(cabin => <p key={cabin.cabinId} className={styles.selection}>Đã chọn <strong>phòng {cabin.cabinNumber}</strong> · {cabinTypeName(cabin.cabinType)} · {cabin.deckName || (cabin.deckNumber == null ? 'Chưa có thông tin boong' : `Boong ${cabin.deckNumber}`)}. Sức chứa tối đa {cabin.capacity} khách; {draft.passengers.filter(other => other.cabinId === cabin.cabinId).length} khách trong nhóm đang chọn phòng này.{cabin.estimatedPrice != null && <><br />Giá tham chiếu ước tính / khách: {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 20 }).format(cabin.estimatedPrice)} · chưa có đơn vị tiền tệ. Giá vé và tiền tệ áp dụng xem ở kết quả đặt chỗ.</>}</p>)}
      <Field htmlFor={`person-${index}-tourPackageId`} label={`Gói cho hành khách ${index + 1} (tùy chọn)`} error={errors[`person-${index}-tourPackageId`]}>
        <select id={`person-${index}-tourPackageId`} value={person.tourPackageId} disabled={!packages && !person.tourPackageId} aria-invalid={Boolean(errors[`person-${index}-tourPackageId`])} aria-describedby={publicJourney || errors[`person-${index}-tourPackageId`] ? `person-${index}-tourPackageId-hint` : undefined} onChange={event => update(index, 'tourPackageId', event.target.value)}>
          <option value="">Không chọn gói</option>
          {person.tourPackageId && !packages?.some(item => item.id === person.tourPackageId) && <option value={person.tourPackageId}>Gói đã chọn cần kiểm tra lại</option>}
          {packages?.map(pack => <option key={pack.id} value={pack.id} disabled={pack.currency !== draft.currency}>{pack.name} · {publicJourney ? bookingMoney(pack.price, pack.currency) : `${pack.price} ${pack.currency}`}{pack.currency !== draft.currency ? ` · Khác tiền tệ đặt chỗ (${draft.currency})` : ''}</option>)}
        </select>
      </Field>
      {publicJourney && person.tourPackageId && <CustomerPackageDetails key={person.tourPackageId} id={person.tourPackageId} passenger={index + 1} />}
      {index > 0 && <Button tone="secondary" onClick={() => setDraft(current => ({ ...current, passengers: current.passengers.filter((_, i) => i !== index) }))}>Bỏ hành khách {index + 1}</Button>}
    </Panel>)}
    <Button tone="secondary" onClick={() => setDraft(current => ({ ...current, passengers: [...current.passengers, blankBookingPerson()] }))}>Thêm hành khách</Button>
    <p>Đặt chỗ đang dùng {draft.currency}. Chỉ chọn gói cùng tiền tệ; hệ thống không tự quy đổi. Chọn gói không tự động giữ chỗ dịch vụ hoặc hoạt động trong gói. Phòng còn trống sẽ được kiểm tra lại khi gửi đặt chỗ.</p>
  </div>
}

const NATIONALITY_OPTIONS = [
  ['VN', 'Việt Nam (VN)'],
  ['US', 'Hoa Kỳ (US)'],
  ['SG', 'Singapore (SG)'],
  ['JP', 'Nhật Bản (JP)'],
  ['KR', 'Hàn Quốc (KR)'],
  ['CN', 'Trung Quốc (CN)'],
  ['TH', 'Thái Lan (TH)'],
  ['MY', 'Malaysia (MY)'],
  ['ID', 'Indonesia (ID)'],
  ['PH', 'Philippines (PH)'],
  ['AU', 'Úc (AU)'],
  ['GB', 'Vương quốc Anh (GB)'],
  ['FR', 'Pháp (FR)'],
  ['DE', 'Đức (DE)'],
  ['CA', 'Canada (CA)'],
  ['TW', 'Đài Loan (TW)'],
  ['HK', 'Hồng Kông (HK)'],
] as const

export function PassengerDetailsFields({
  publicJourney = false,
  representativeEmailRequired = false,
  canSwitchLeadProfile = false,
  usingOwnProfile = true,
  onSelectLeadMode,
}: {
  publicJourney?: boolean
  representativeEmailRequired?: boolean
  canSwitchLeadProfile?: boolean
  usingOwnProfile?: boolean
  onSelectLeadMode?: (useOwnProfile: boolean) => void
}) {
  const { draft, setDraft, errors, setErrors, personIds } = useLiveBooking()
  function update(index: number, key: keyof BookingPersonDraft, value: string) {
    setDraft(current => ({ ...current, passengers: current.passengers.map((person, i) => i === index ? { ...person, [key]: value } : person) }))
    setErrors(current => {
      const next = { ...current }
      delete next[`person-${index}-${key}`]
      if (key === 'documentType') delete next[`person-${index}-documentNumber`]
      if (index === 0 && (key === 'email' || key === 'phoneNumber')) {
        delete next['person-0-email']
        delete next['person-0-phoneNumber']
      }
      return next
    })
  }
  const fields = [
    ['fullName', 'Họ tên *', 'text', 100], ['dateOfBirth', 'Ngày sinh (tùy chọn)', 'date', undefined],
    ['email', 'Email', 'email', undefined],
    ['phoneNumber', 'Số điện thoại', 'tel', 16],
  ] as const
  return <div className={styles.stack}>{draft.passengers.map((person, index) => <Panel className={styles.passengerCard} key={personIds[index] ?? index} title={`Hành khách ${index + 1}${index === 0 ? ' · Người đại diện' : ''}`}>
    {index === 0 && canSwitchLeadProfile && onSelectLeadMode && (
      <div style={{ display: 'grid', gap: '6px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} role="group" aria-label="Nguồn thông tin hành khách 1">
          <Button
            type="button"
            size="compact"
            autoWidth
            tone={usingOwnProfile ? 'primary' : 'secondary'}
            aria-pressed={usingOwnProfile}
            onClick={() => onSelectLeadMode(true)}
          >
            Dùng hồ sơ của tôi
          </Button>
          <Button
            type="button"
            size="compact"
            autoWidth
            tone={!usingOwnProfile ? 'primary' : 'secondary'}
            aria-pressed={!usingOwnProfile}
            onClick={() => onSelectLeadMode(false)}
          >
            Nhập hành khách khác
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          {usingOwnProfile
            ? 'Đang dùng hồ sơ đã lưu của tài khoản — có thể để trống ngày sinh/giấy tờ nếu không đổi, hoặc liên hệ bộ phận hỗ trợ nếu cần điều chỉnh thông tin định danh.'
            : 'Đang nhập thông tin cho người đại diện khác. Nếu hành khách đã từng đặt chuyến, giữ đúng họ tên và để trống trường tùy chọn để tránh lệch hồ sơ.'}
        </p>
      </div>
    )}
    <div className={styles.fields}>{fields.map(([key, label, type, maxLength]) => {
      const id = `person-${index}-${key}`
      const autoComplete = ({ fullName: 'name', dateOfBirth: 'bday', email: 'email', phoneNumber: 'tel' } as Record<string, string>)[key]
      const emailRequired = publicJourney && representativeEmailRequired && index === 0 && key === 'email'
      return <Field key={key} htmlFor={id} label={emailRequired ? 'Email người đại diện *' : label} error={errors[id]}><input id={id} type={type} maxLength={maxLength} required={key === 'fullName' || emailRequired} aria-required={emailRequired || undefined} autoComplete={publicJourney && autoComplete ? `section-traveller${index} ${autoComplete}` : undefined} value={person[key]} aria-invalid={Boolean(errors[id])} aria-describedby={errors[id] || emailRequired ? id + '-hint' : undefined} onChange={event => update(index, key, event.target.value)} /></Field>
    })}
    <Field htmlFor={`person-${index}-nationality`} label="Quốc tịch (tùy chọn)" error={errors[`person-${index}-nationality`]}>
      <select id={`person-${index}-nationality`} aria-invalid={Boolean(errors[`person-${index}-nationality`])} aria-describedby={errors[`person-${index}-nationality`] ? `person-${index}-nationality-hint` : undefined} value={person.nationality} onChange={event => update(index, 'nationality', event.target.value)}>
        <option value="">Chưa cung cấp</option>
        {person.nationality && !NATIONALITY_OPTIONS.some(([code]) => code === person.nationality) && <option value={person.nationality}>{person.nationality}</option>}
        {NATIONALITY_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
    </Field>
    <Field htmlFor={`person-${index}-documentType`} label="Loại giấy tờ (tùy chọn)" error={errors[`person-${index}-documentType`]}>
      <select id={`person-${index}-documentType`} aria-invalid={Boolean(errors[`person-${index}-documentType`])} aria-describedby={errors[`person-${index}-documentType`] ? `person-${index}-documentType-hint` : undefined} value={person.documentType} onChange={event => update(index, 'documentType', event.target.value)}>
        <option value="">Chưa cung cấp</option>
        <option value="NationalID">CCCD</option>
        <option value="Passport">Hộ chiếu</option>
      </select>
    </Field>
    <Field
      htmlFor={`person-${index}-documentNumber`}
      label={person.documentType ? 'Số giấy tờ *' : 'Số giấy tờ (tùy chọn)'}
      hint={!person.documentType ? 'Chọn loại giấy tờ trước khi nhập số.' : person.documentType === 'NationalID' ? 'CCCD gồm đúng 12 chữ số.' : 'Hộ chiếu gồm 6–12 ký tự chữ hoặc số (không dấu).'}
      error={errors[`person-${index}-documentNumber`]}
    >
      <input
        id={`person-${index}-documentNumber`}
        type="text"
        maxLength={30}
        disabled={!person.documentType && !person.documentNumber}
        required={Boolean(person.documentType)}
        value={person.documentNumber}
        aria-invalid={Boolean(errors[`person-${index}-documentNumber`])}
        aria-describedby={`person-${index}-documentNumber-hint`}
        onChange={event => update(index, 'documentNumber', event.target.value)}
      />
    </Field></div>
  </Panel>)}</div>
}
