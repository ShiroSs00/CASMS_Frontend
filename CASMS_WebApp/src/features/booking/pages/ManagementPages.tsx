import { BookingManagement } from '../components/BookingManagement'
export function MyBookingsPage(){return <BookingManagement/>}
export function BookingDetailPage(){return <BookingManagement view="detail"/>}
export function ManageBookingPage(){return <BookingManagement view="manage"/>}
export function TravellerDocumentsPage(){return <BookingManagement view="travellers"/>}
export function OnlineCheckinPage(){return <BookingManagement view="check-in"/>}
export function ArrivalTimePage(){return <BookingManagement view="arrival-time"/>}
export function BoardingPassPage(){return <BookingManagement view="boarding-pass"/>}
export function PaymentContractPage(){return <BookingManagement view="payment"/>}
export function ChangeRequestPage(){return <BookingManagement view="change-request"/>}

