import { RealBookingList, RealBookingDetail, RealBookingCreatePage, BookingLookupPage } from '@/features/booking'
import { BookingPackageAssignments } from '@/features/service-packages'
export function AdminBookingListPage() { return <RealBookingList admin /> }
export function AdminBookingCreatePage() { return <RealBookingCreatePage admin /> }
export function AdminBookingDetailPage() { return <RealBookingDetail admin related={bookingId => <BookingPackageAssignments bookingId={bookingId} />} /> }

export function AdminBookingLookupPage() { return <BookingLookupPage admin /> }
