import type { ActionResult, Booking, BookingDraft, CheckinStatus, MissingCapability, PaymentStatus } from './booking-types'

export type MockAction = 'missing' | 'received' | 'validation' | 'conflict' | 'network-error' | 'unknown' | 'no-access' | 'expired'
export type RequestStage = 'not-submitted' | 'received' | 'under-review' | 'decision'
export type BookingScenario = {
 action: MockAction
 unavailableCategory?: string
 payment: PaymentStatus | 'fixture'
 checkin: CheckinStatus | 'fixture'
 requestStage: RequestStage
}
export const defaultScenario: BookingScenario = { action:'missing', payment:'fixture', checkin:'fixture', requestStage:'not-submitted' }
export const bookingStatusLabel = { Draft:'Chờ xử lý', Confirmed:'CONFIRMED', Cancelled:'Đã hủy' } as const
export function cabinConflict(draft:BookingDraft, unavailableCategory?:string) {
 return Boolean(draft.selectedCabinCategory && draft.selectedCabinCategory===unavailableCategory)
}
export function previewBooking(booking:Booking, scenario:BookingScenario):Booking {
 return {...booking, payment:scenario.payment==='fixture'?booking.payment:scenario.payment,
  // Explicit fixture amounts; never infer settlement from a URL or an action response.
  paid:scenario.payment==='fixture'?booking.paid:scenario.payment==='Confirmed'?booking.fare:0,
  passengers:booking.passengers.map(p=>({...p,checkin:scenario.checkin==='fixture'?p.checkin:scenario.checkin}))}
}
export function mockActionResult(capability:MissingCapability, scenario:MockAction):ActionResult {
 if(scenario==='missing'||['payment-start','payment-status','contract-read','contract-accept','boarding-pass'].includes(capability))return {state:'missing',message:'Chức năng này chưa kết nối dịch vụ. Yêu cầu chưa được gửi; thông tin bạn nhập vẫn được giữ lại.'}
 const messages = {
  received:'Mô phỏng đã tiếp nhận. Yêu cầu chưa được gửi lên hệ thống; booking và thanh toán không thay đổi.',
  validation:'Mô phỏng dữ liệu chưa hợp lệ. Kiểm tra thông tin và gửi lại; bản nháp vẫn được giữ.',
  conflict:'Mô phỏng xung đột dữ liệu. Kiểm tra lại lựa chọn trước khi gửi; bản nháp vẫn được giữ.',
  'network-error':'Mô phỏng lỗi kết nối trước khi gửi. Dữ liệu vẫn được giữ để thử lại.',
  unknown:'Mô phỏng chưa xác định kết quả. Kiểm tra trạng thái trước khi gửi lại để tránh trùng yêu cầu.',
  'no-access':'Mô phỏng không có quyền thực hiện. Thông tin đang nhập vẫn được giữ.',
  expired:'Mô phỏng phiên đã hết hạn. Đăng nhập lại trước khi gửi; bản nháp vẫn được giữ trong phiên này.',
 }
 return {state:scenario==='network-error'?'error':scenario,message:capability==='arrival-save'&&scenario==='received'?'Đã lưu lựa chọn trong bản xem trước này. Chưa lưu lên hệ thống.':messages[scenario],...(scenario==='received'?{reference:'MOCK-'+capability.toUpperCase()+'-001'}:{})}
}
