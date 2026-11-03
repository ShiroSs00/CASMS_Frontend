import { RealBookingList, RealBookingDetail, RealBookingCreatePage, BookingLookupPage } from '@/features/booking';
import { BookingPackageAssignments } from '@/features/service-packages';
export function AdminBookingListPage() { return <RealBookingList />; }
export function AdminBookingCreatePage() { return <RealBookingCreatePage />; }
export function AdminBookingDetailPage() { return <RealBookingDetail related={bookingId => <BookingPackageAssignments bookingId={bookingId}/>}/>; }
export function AdminBookingLookupPage() { return <BookingLookupPage />; }
