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
    {draft.passengers.map((person, index) => <Panel key={index} title={`Hành khách ${index + 1}${person.fullName ? ' · ' + person.fullName : ''}`}>
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
      <Field htmlFor={`person-${index}-tourPackageId`} label={`Gói cho hành khách ${index + 1} (tùy chọn)`} hint={publicJourney ? 'Có thể bỏ qua. Giá gói hiển thị riêng, chưa phải tổng giá Booking.' : undefined} error={errors[`person-${index}-tourPackageId`]}>
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

export function PassengerDetailsFields({ publicJourney = false, representativeEmailRequired = false }: { publicJourney?: boolean; representativeEmailRequired?: boolean }) {
  const { draft, setDraft, errors, setErrors } = useLiveBooking()
  function update(index: number, key: keyof BookingPersonDraft, value: string) {
    setDraft(current => ({ ...current, passengers: current.passengers.map((person, i) => i === index ? { ...person, [key]: value } : person) }))
    if (publicJourney) setErrors(current => { const next = { ...current }; delete next[`person-${index}-${key}`]; return next })
  }
  const fields = [
    ['fullName', 'Họ tên *', 'text', 100], ['dateOfBirth', 'Ngày sinh (tùy chọn)', 'date', undefined],
    ['nationality', 'Quốc tịch (tùy chọn)', 'text', 10], ['email', 'Email', 'email', undefined],
    ['phoneNumber', 'Số điện thoại', 'tel', 16], ['documentNumber', 'Số giấy tờ (tùy chọn)', 'text', 30],
  ] as const
  return <div className={styles.stack}>{draft.passengers.map((person, index) => <Panel key={index} title={`Hành khách ${index + 1}${index === 0 ? ' · Người đại diện' : ''}`}>
    {index === 0 && <p>Khách chưa đăng nhập cần email người đại diện để nhận hướng dẫn hợp đồng.</p>}
    {publicJourney && <p className={styles.helper}>Dấu * là thông tin bắt buộc. Nhập họ tên như trên giấy tờ; các thông tin tùy chọn có thể để trống.</p>}
    <div className={styles.fields}>{fields.map(([key, label, type, maxLength]) => {
      const id = `person-${index}-${key}`
      const autoComplete = ({ fullName: 'name', dateOfBirth: 'bday', email: 'email', phoneNumber: 'tel' } as Record<string, string>)[key]
      const emailRequired = publicJourney && representativeEmailRequired && index === 0 && key === 'email'
      return <Field key={key} htmlFor={id} label={label} error={errors[id]} hint={emailRequired ? 'Bắt buộc cho người đại diện chưa đăng nhập.' : undefined}><input id={id} type={type} maxLength={maxLength} required={key === 'fullName'} aria-required={emailRequired || undefined} autoComplete={publicJourney && autoComplete ? `section-traveller${index} ${autoComplete}` : undefined} value={person[key]} aria-invalid={Boolean(errors[id])} aria-describedby={errors[id] || emailRequired ? id + '-hint' : undefined} onChange={event => update(index, key, event.target.value)} /></Field>
    })}<Field htmlFor={`person-${index}-documentType`} label="Loại giấy tờ (tùy chọn)" error={publicJourney ? errors[`person-${index}-documentType`] : undefined}><select id={`person-${index}-documentType`} aria-invalid={publicJourney ? Boolean(errors[`person-${index}-documentType`]) : undefined} aria-describedby={publicJourney && errors[`person-${index}-documentType`] ? `person-${index}-documentType-hint` : undefined} value={person.documentType} onChange={event => update(index, 'documentType', event.target.value)}><option value="">Chưa cung cấp</option><option value="NationalID">CCCD</option><option value="Passport">Hộ chiếu</option></select></Field></div>
  </Panel>)}</div>
}
