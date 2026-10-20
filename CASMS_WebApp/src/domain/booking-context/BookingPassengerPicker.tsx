import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Empty, Field, Loading, Notice } from '@/shared/ui'
import { bookingContextApi, type BookingContext, type BookingPassenger, type BookingSummary } from './booking-context-api'

export function BookingPassengerPicker({ value, onChange, cruiseId, disabled, allowedStatuses = ['Draft', 'Confirmed'], initialBookingId = '', fixedBookingId }: { value: string; onChange: (passenger: BookingPassenger | null, booking: BookingContext | null) => void; cruiseId?: string; disabled?: boolean; allowedStatuses?: BookingSummary['bookingStatus'][]; initialBookingId?: string; fixedBookingId?: string }) {
  const [bookingId, setBookingId] = useState(fixedBookingId ?? initialBookingId)
  const loadList = useCallback((signal: AbortSignal) => fixedBookingId ? bookingContextApi.get(fixedBookingId, signal).then(item => [item]) : bookingContextApi.list(cruiseId, signal), [cruiseId, fixedBookingId])
  const list = useReadQuery(`passenger-bookings:${cruiseId}:${fixedBookingId}`, loadList)
  const validBooking = list.data?.find(item => item.bookingId === bookingId && allowedStatuses.includes(item.bookingStatus))
  const selectedId = validBooking?.bookingId
  const load = useCallback((signal: AbortSignal) => selectedId ? bookingContextApi.get(selectedId, signal) : Promise.resolve(null), [selectedId])
  const detail = useReadQuery(`passenger-booking:${selectedId}`, load)
  return <div>
    {list.loading && <Loading label="Đang tải đặt chỗ…" />}
    {list.error && <Notice title="Không tra cứu được đặt chỗ" tone="error">{list.error.message}<Button type="button" onClick={list.retry}>Thử lại</Button></Notice>}
    {list.data?.length === 0 && <Empty title="Chưa có đặt chỗ để chọn hành khách" />}
    <Field htmlFor="booking-passenger-booking" label="Đặt chỗ"><select id="booking-passenger-booking" value={bookingId} disabled={disabled || Boolean(fixedBookingId) || list.loading || Boolean(list.error)} onChange={event => { setBookingId(event.target.value); onChange(null, null) }}><option value="">Chọn mã đặt chỗ và chuyến đi</option>{list.data?.map(item => <option key={item.bookingId} value={item.bookingId} disabled={!allowedStatuses.includes(item.bookingStatus)}>{item.bookingReference} · {item.cruiseName} · {item.bookingStatus === 'Confirmed' ? 'Đã xác nhận' : item.bookingStatus === 'Draft' ? 'Nháp' : 'Đã hủy'}</option>)}</select></Field>
    {selectedId && detail.loading && <Loading label="Đang tải hành khách…" />}
    {detail.error && <Notice title="Không tải được hành khách" tone="error">{detail.error.message}<Button type="button" onClick={detail.retry}>Thử lại</Button></Notice>}
    <Field htmlFor="booking-passenger-person" label="Hành khách trong đặt chỗ"><select id="booking-passenger-person" value={value} disabled={disabled || !detail.data || detail.loading || Boolean(detail.error)} onChange={event => onChange(detail.data?.passengers.find(person => person.bookingPassengerId === event.target.value) ?? null, detail.data)}><option value="">Chọn hành khách có thật</option>{detail.data?.passengers.map(person => <option key={person.bookingPassengerId} value={person.bookingPassengerId} disabled={person.participationStatus !== 'Active'}>{person.fullName}{person.cabinNumber ? ` · Cabin ${person.cabinNumber}` : ''}{person.participationStatus !== 'Active' ? ' · Đã hủy tham gia' : ''}</option>)}</select></Field>
  </div>
}
