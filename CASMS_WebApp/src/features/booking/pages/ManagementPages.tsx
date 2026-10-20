import { Notice } from '@/shared/ui'
import { RealBookingList, RealBookingDetail } from './RealBookingPages'
export function MyBookingsPage(){return <RealBookingList/>}
export function BookingDetailPage(){return <RealBookingDetail/>}
export function ManageBookingPage(){return <RealBookingDetail/>}
function Unsupported(){return <Notice title="Chưa hỗ trợ thao tác này" tone="warning">Chưa có chức năng xử lý trực tuyến cho bước này. Vui lòng xem thông tin hợp đồng trong chi tiết đặt chỗ hoặc liên hệ nhân viên hỗ trợ.</Notice>}
export function TravellerDocumentsPage(){return <><Unsupported/><RealBookingDetail/></>}
export function OnlineCheckinPage(){return <><Unsupported/><RealBookingDetail/></>}
export function ArrivalTimePage(){return <><Unsupported/><RealBookingDetail/></>}
export function BoardingPassPage(){return <><Unsupported/><RealBookingDetail/></>}
export function PaymentContractPage(){return <><Unsupported/><RealBookingDetail/></>}
export function ChangeRequestPage(){return <RealBookingDetail/>}
