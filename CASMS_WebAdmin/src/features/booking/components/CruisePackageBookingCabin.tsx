import {useCallback,useRef,useState} from 'react'
import {useReadQuery} from '@/shared/api'
import {useBookingModelRenderer} from './BookingModelIntegration'
import {Button,Field,Notice,Panel} from '@/shared/ui'
import {cabinTypeLabel} from '@/shared/i18n/business-copy'
import {realBookingApi,type BookingDetail} from '../api/real-booking-api'

export function CruisePackageBookingHistory({booking}:{booking:BookingDetail}) {
  return <>{booking.passengers.filter(p=>p.purchasedFare||p.selectedFare).map(p=><Panel key={p.bookingPassengerId} title={`Gói du thuyền · ${p.fullName}`}>
    <p>{p.purchasedFare?.fare.templateName??p.selectedFare?.templateName} · {p.purchasedFare?.fare.logicalCategory??p.selectedFare?.logicalCategory} · {p.purchasedFare?.fare.amount??p.selectedFare?.amount} USD/người</p>
    <p>{p.purchasedFare?'Nội dung gói du thuyền đã mua được lưu tại thời điểm xác nhận.':'Lựa chọn theo báo giá đã chốt; đặt chỗ chưa xác nhận mua.'}</p>
    <details><summary>Tham chiếu phiên bản gói và giá</summary><p>Phiên bản mẫu: {p.purchasedFare?.fare.templateVersionId??p.selectedFare?.templateVersionId}</p><p>Phiên bản giá: {p.purchasedFare?.fare.priceRevisionId??p.selectedFare?.priceRevisionId}</p>{p.purchasedFare&&<p>Mua lúc: {new Date(p.purchasedFare.fare.purchasedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} (giờ tàu)</p>}</details>
    <p>{p.cabinSelectionMode==='CATEGORY_HOLD'?`Chưa phân Cabin · giữ nguyên nhóm theo hạng ${p.purchasedFare?.fare.logicalCategory??p.selectedFare?.logicalCategory??cabinTypeLabel(p.fareCabinCategory??'')}`:`Cabin vật lý: ${p.cabinNumber??'Chưa phân Cabin'}`}</p>
    <ul>{(p.purchasedFare?.benefits??p.selectedFare?.benefits)?.map(b=><li key={b.sourceBenefitId}>{b.resourceName} · {({INCLUDED:'Đã bao gồm',LIMITED_INCLUDED:'Bao gồm có giới hạn',OPTIONAL:'Tùy chọn mua thêm',NOT_INCLUDED:'Không bao gồm'})[b.inclusion]}{b.quantityLimit!=null&&` · ${b.quantityLimit} ${b.usageUnit==='PARTICIPATION'?'lượt tham gia':b.serviceUnitCode??'đơn vị chưa xác định'}`} · {b.eligibility}</li>)}</ul>
    <p>Mua gói du thuyền không tự giữ chỗ hoạt động/dịch vụ. Cần đăng ký riêng theo chỗ phục vụ còn trống.</p>
  </Panel>)}</>
}
export function CruisePackageBookingCabin({booking,onChanged}:{booking:BookingDetail;onChanged:()=>void}) {
  const renderModel=useBookingModelRenderer()
  const candidates=booking.passengers.filter(p=>p.canSelectFareCabin&&p.selectedFare)
  const [passengerId,setPassenger]=useState(''),[cabinId,setCabin]=useState(''),[ack,setAck]=useState(false),[reason,setReason]=useState('')
  const [busy,setBusy]=useState(false),[review,setReview]=useState(false),[error,setError]=useState(''),lock=useRef(false)
  const passenger=candidates.find(p=>p.bookingPassengerId===passengerId)
  const query=useReadQuery(`fare-assign-cabins:${booking.bookingId}:${passengerId}`,useCallback(signal=>passengerId?realBookingApi.cabins(booking.cruiseId,signal,{bookingPassengerId:passengerId}):Promise.resolve([]),[booking.cruiseId,passengerId]))
  if(!candidates.length)return null
  const group=passenger?booking.passengers.filter(p=>p.farePackageOfferId&&p.participationStatus==='Active'&&p.cabinGroupKey===passenger.cabinGroupKey):[]
  const disabled=busy||review||query.loading||Boolean(query.error)
  async function assign(){
    if(!passenger||disabled||lock.current||!ack||!query.data?.some(c=>c.cabinId===cabinId))return
    lock.current=true;setBusy(true);setError('')
    try {const result=await realBookingApi.changeCabin(passengerId,cabinId,reason,true);if(result.bookingId!==booking.bookingId||group.some(p=>!result.passengers.some(r=>r.bookingPassengerId===p.bookingPassengerId&&r.cabinId===cabinId&&r.cabinSelectionMode==='PHYSICAL_CABIN')))throw new Error('Chưa xác nhận phân cabin thành công cho toàn bộ nhóm.');onChanged();setCabin('');setAck(false)}
    catch(e){setReview(true);setError(e instanceof Error?e.message:'Chưa xác nhận kết quả.');}
    finally{lock.current=false;setBusy(false)}
  }
  return <Panel title="Chọn hoặc phân cabin cho gói du thuyền"><Field htmlFor="fare-assign-passenger" label="Nhóm hành khách"><select id="fare-assign-passenger" disabled={busy} value={passengerId} onChange={e=>{setPassenger(e.target.value);setCabin('');setAck(false)}}><option value="">Chọn hành khách trong nhóm</option>{candidates.map(p=><option key={p.bookingPassengerId} value={p.bookingPassengerId}>{p.fullName} · {p.cabinGroupKey}</option>)}</select></Field>
    {query.loading&&<p role="status">Đang đối chiếu cabin phù hợp…</p>}{query.error&&<Notice title="Chưa đọc được cabin" tone="error"><p>{query.error.message}</p><Button onClick={query.retry}>Tải lại</Button></Notice>}
    {passenger?.selectedFare&&query.data&&!query.loading&&!query.error&&<><p>Phân nguyên nhóm {group.length} hành khách; giữ nguyên giá, quyền lợi và hạng cabin đã chọn/mua.</p><fieldset disabled={disabled}>
      {renderModel?renderModel({shipId:passenger.selectedFare.shipId,cruiseId:booking.cruiseId,cabins:query.data.map(c=>({cabinId:c.cabinId,remainingCapacity:c.remainingCapacity})),selectedCabinId:cabinId||undefined,onSelectCabin:id=>{if(query.data?.some(c=>c.cabinId===id)){setCabin(id);setAck(false)}}}):<Notice title="Chưa kết nối mô hình chọn cabin" tone="warning">Chưa thể chọn cabin trên mô hình hiện tại. Không có cabin nào được tự phân bổ.</Notice>}
      <Field htmlFor="fare-assign-reason" label="Lý do hoặc ghi chú"><textarea id="fare-assign-reason" value={reason} onChange={e=>setReason(e.target.value)}/></Field>
      <label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>Xác nhận phân cabin {query.data.find(c=>c.cabinId===cabinId)?.cabinNumber??'chưa chọn'} cho toàn bộ nhóm {group.length} hành khách.</label>
      <Button disabled={!cabinId||!ack} onClick={()=>void assign()}>Xác nhận phân cabin</Button>
    </fieldset></>}
    {error&&<Notice title="Cần đối chiếu kết quả phân cabin" tone="error"><p>{error}</p><Button disabled={busy} onClick={()=>{onChanged();query.retry();setReview(false);setAck(false)}}>Tải lại để đối chiếu</Button></Notice>}
  </Panel>
}
