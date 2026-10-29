import {useRef,useState,type FormEvent} from 'react'
import {useSessionAccess} from '@/shared/auth'
import {Button,Field,Notice,Panel} from '@/shared/ui'
import {realBookingApi,type BookingDetail} from '../api/real-booking-api'
import {bookingMutationFailure} from '../model/booking-mutation'

export function BookingContractAcceptance({booking,onChanged}:{booking:BookingDetail;onChanged:()=>void}) {
  const access=useSessionAccess(),lock=useRef(false)
  const [reference,setReference]=useState(''),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[unknown,setUnknown]=useState(false)
  const allowed=access.canDo('BOOKING_CONTRACT_MANAGE')&&booking.bookingStatus==='Draft'&&booking.contractStatus==='Draft'
  async function save(event:FormEvent){
    event.preventDefault();if(!allowed||lock.current||unknown||!reference.trim())return
    lock.current=true;setBusy(true);setError('')
    try{await realBookingApi.acceptContract(booking.bookingId,reference,notes);onChanged()}
    catch(reason){const failure=bookingMutationFailure(reason);setError(failure.message);setUnknown(failure.uncertain)}
    finally{lock.current=false;setBusy(false)}
  }
  if(!allowed)return null
  return <Panel title="Ghi nhận hợp đồng đã ký"><p>Chỉ thực hiện sau khi đã đối chiếu bản hợp đồng có chữ ký. Thao tác này chưa xác nhận đã thanh toán hoặc xác nhận đặt chỗ.</p><form onSubmit={event=>void save(event)}><Field htmlFor="booking-contract-document" label="Mã hồ sơ bản ký *"><input id="booking-contract-document" required value={reference} disabled={busy||unknown} onChange={event=>setReference(event.target.value)}/></Field><Field htmlFor="booking-contract-notes" label="Ghi chú đối chiếu"><textarea id="booking-contract-notes" value={notes} disabled={busy||unknown} onChange={event=>setNotes(event.target.value)}/></Field>{error&&<Notice title={unknown?'Cần tải lại hồ sơ để kiểm tra':'Chưa ghi nhận được hợp đồng'} tone="error">{error}</Notice>}<Button type="submit" disabled={busy||unknown||!reference.trim()}>Ghi nhận bản ký đã đối chiếu</Button></form></Panel>
}
