import { date, money } from '../model/booking-format'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { bookingApi, bookingCatalog } from '../api/booking-api'
import { useBookingDraft } from '../model/booking-context'
import { cabinConflict } from '../model/booking-scenarios'
import { blankTraveller, estimateDraft, validateTravellers } from '../model/booking-draft'
import { useAdapterData, useBookingAction } from '../model/booking-state'
import type { Cruise } from '../model/booking-types'
import { Action, ActionLink, Badge, EmptyState, Feedback, FieldInput, Heading, Panel, Steps } from './BookingUI'
import deluxe from '../assets/deluxe.png'
import reviewImage from '../assets/review.png'
import s from './Booking.module.css'
const loadCruises=(signal:AbortSignal)=>bookingApi.listCruises(signal)
export function BookingFlow({step}:{step:1|2|3}) {
 const {draft}=useBookingDraft()
 const data=useAdapterData(loadCruises)
 const cruise=data.data?.find(c=>c.id===draft.cruiseId)
 if(data.loading)return <div className={s.surface}><div className={s.container} role="status">Đang tải lựa chọn…</div></div>
 if(!cruise)return <div className={s.surface}><div className={s.container}><EmptyState title="Chọn hành trình để bắt đầu"><p>Lựa chọn được giữ khi quay lại các bước trong phiên này. Tải lại trang sẽ bắt đầu bản nháp mới.</p><ActionLink to="/cruises">Tìm chuyến</ActionLink></EmptyState></div></div>
 return <div className={s.surface+' '+(step===1?s.white:'')}><div className={s.container}>{step!==3&&<Steps active={step}/>}<Heading large={step!==1} title={step===1?'Thông tin người đi':step===2?'Chọn nơi bạn sẽ nghỉ trên hành trình':'Kiểm tra lại hành trình trước khi gửi booking'} description={step===1?'Thông tin chính xác giúp giảm xử lý lại ở bước check-in.':step===2?'So sánh không gian, tầm nhìn và tiện nghi trước khi chọn.':'Bạn vẫn có thể sửa người đi, cabin hoặc gói trước khi gửi.'}/>{step===1?<Travellers cruise={cruise}/>:step===2?<Cabins cruise={cruise}/>:<Review cruise={cruise}/>}</div></div>
}
function Summary({cruise,title,children}:{cruise:Cruise;title:string;children?:React.ReactNode}) {
 const {draft}=useBookingDraft()
 const amount=estimateDraft(draft,cruise.price,bookingCatalog)
 return <Panel title={title} className={s.rail}><p>{cruise.title}</p><p className={s.muted}>{date(cruise.departure)} – {date(cruise.end)} · {cruise.duration} ngày {cruise.duration-1} đêm</p><p className={s.muted}>{draft.travellers.length} hành khách</p>{draft.selectedCabinCategory&&<p>{bookingCatalog.cabins.find(c=>c.id===draft.selectedCabinCategory)?.name} · loại yêu cầu</p>}<p className={s.caption}>Tổng tham khảo</p><strong className={s.price}>{money(amount.total)}</strong><p className={s.caption}>Giá và chỗ trống cần được xác nhận. Loại cabin yêu cầu chưa phải cabin được phân bổ.</p>{children}</Panel>
}
function Travellers({cruise}:{cruise:Cruise}) {
 const {draft,setDraft}=useBookingDraft()
 const [attempted,setAttempted]=useState(false)
 const navigate=useNavigate()
 const errors=attempted?validateTravellers(draft):{}
 function next(){setAttempted(true);if(Object.keys(validateTravellers(draft)).length===0)navigate('/booking/cabin-experience')}
 return <form className={s.columns} noValidate onSubmit={e=>{e.preventDefault();next()}}><div className={s.stack}>{draft.travellers.map((t,i)=><Panel key={t.id} title={i===0?'Người đại diện booking':'Hành khách '+(i+1)}><div className={s.fields}>{([['name','Họ và tên','text'],['birthDate','Ngày sinh','date'],...(i===0?[['email','Email','email'],['phone','Điện thoại','tel']]:[])] as const).map(([key,label,type])=><FieldInput key={key} id={t.id+'-'+key} label={label+' *'} type={type} required value={t[key as keyof typeof t]} error={errors[t.id+'-'+key]} onChange={e=>setDraft(d=>({...d,acceptedTerms:false,travellers:d.travellers.map(x=>x.id===t.id?{...x,[key]:e.target.value}:x)}))}/>)}</div>{i>0&&<Action secondary onClick={()=>setDraft(d=>{const packages={...d.passengerPackages};delete packages[t.id];return {...d,acceptedTerms:false,travellers:d.travellers.filter(x=>x.id!==t.id),passengerPackages:packages}})}>Xóa hành khách {i+1}</Action>}</Panel>)}<div className={s.row}><Action secondary onClick={()=>setDraft(d=>({...d,acceptedTerms:false,travellers:[...d.travellers,blankTraveller()]}))}>Thêm hành khách</Action><ActionLink secondary to={'/cruises/'+cruise.id}>Quay lại hành trình</ActionLink></div><p className={s.caption}>* Thông tin bắt buộc. Người đại diện là hành khách; tài khoản đặt chỗ được quản lý riêng.</p></div><Summary cruise={cruise} title="Chuyến đã chọn"><Action type="submit">Tiếp tục chọn cabin</Action></Summary></form>
}
function Cabins({cruise}:{cruise:Cruise}) {
 const {draft,setDraft,scenario}=useBookingDraft()
 const [passengerId,setPassengerId]=useState(draft.travellers[0].id)
 const [compare,setCompare]=useState(false)
 const [error,setError]=useState('')
 const navigate=useNavigate()
 const selectedPackage=draft.passengerPackages[passengerId]??'Essential'
 return <div className={s.columns}><div className={s.stack}>{bookingCatalog.cabins.map(c=><Panel className={s.cabin+' '+(draft.selectedCabinCategory===c.id?s.selected:'')} key={c.id}><div className={s.cabinImage+' '+(c.id==='balcony'?s.balcony:'')}><img src={deluxe} alt={c.name}/></div><div className={s.stack}><Badge>{draft.selectedCabinCategory===c.id?'Được chọn':'Lựa chọn cabin'}</Badge><h2>{c.name}</h2><p className={s.muted}>{c.area} m² · tối đa {c.capacity} khách / cabin</p><p className={s.muted}>{c.description}</p><h3>Từ {money(cruise.price+c.price-4800000)} / khách</h3><Action disabled={scenario.unavailableCategory===c.id} secondary={draft.selectedCabinCategory!==c.id} aria-pressed={draft.selectedCabinCategory===c.id} onClick={()=>setDraft(d=>({...d,selectedCabinCategory:c.id,acceptedTerms:false}))}>{scenario.unavailableCategory===c.id?'Hết chỗ':draft.selectedCabinCategory===c.id?'Đã chọn':'Chọn cabin'}</Action></div></Panel>)}
 <h2 className={s.editorial}>Gói trải nghiệm theo từng khách</h2><label>Chọn hành khách<select value={passengerId} onChange={e=>setPassengerId(e.target.value)}>{draft.travellers.map((t,i)=><option value={t.id} key={t.id}>{t.name||'Hành khách '+(i+1)}</option>)}</select></label>
 <div className={s.grid3}>{bookingCatalog.packages.map(p=><Panel key={p.id} className={s.package+' '+(selectedPackage===p.id?s.selected:'')}><p>{p.id}</p><h3>{p.kind==='INCLUDED'?'Đã bao gồm':'+'+money(p.price)}</h3><p className={s.caption}>{p.description}</p><Action secondary={selectedPackage!==p.id} aria-pressed={selectedPackage===p.id} onClick={()=>setDraft(d=>({...d,acceptedTerms:false,passengerPackages:{...d.passengerPackages,[passengerId]:p.id}}))}>{selectedPackage===p.id?'Đã chọn':'Chọn'}</Action></Panel>)}</div>
 <Action secondary aria-expanded={compare} onClick={()=>setCompare(v=>!v)}>So sánh đầy đủ quyền lợi</Action>{compare&&<Panel title="Quyền lợi theo gói">{bookingCatalog.packages.map(p=><p key={p.id}><strong>{p.id}</strong> — {p.description} · {p.kind==='INCLUDED'?'Đã nằm trong giá hành trình':money(p.price)+' / khách'}</p>)}</Panel>}<ActionLink secondary to="/booking/travellers">Quay lại người đi</ActionLink></div>
 <Summary cruise={cruise} title="Tóm tắt lựa chọn">{draft.travellers.map((t,i)=><p key={t.id}>{t.name||'Hành khách '+(i+1)} · {draft.passengerPackages[t.id]??'Essential'}</p>)}{error&&<p role="alert">{error}</p>}<Action onClick={()=>{if(cabinConflict(draft,scenario.unavailableCategory)){setError('Loại cabin đã chọn vừa hết chỗ. Chọn loại khác để tiếp tục; thông tin người đi và gói được giữ nguyên.');return}if(!draft.selectedCabinCategory){setError('Chọn loại cabin trước khi tiếp tục.');return}if(Object.keys(validateTravellers(draft)).length){setError('Hoàn tất thông tin người đi trước khi kiểm tra.');return}navigate('/booking/review')}}>Tiếp tục kiểm tra</Action></Summary></div>
}
function Review({cruise}:{cruise:Cruise}) {
 const {draft,setDraft,scenario}=useBookingDraft()
 const action=useBookingAction()
 const [validation,setValidation]=useState('')
 const amount=estimateDraft(draft,cruise.price,bookingCatalog)
 function submit(){if(cabinConflict(draft,scenario.unavailableCategory)){setValidation('Cabin vừa hết chỗ. Quay lại chọn cabin khác trước khi gửi.');return}if(Object.keys(validateTravellers(draft)).length||!draft.selectedCabinCategory||!draft.acceptedTerms){setValidation('Kiểm tra thông tin người đi, loại cabin và xác nhận thông tin trước khi gửi.');return}setValidation('');void action.run('booking-create',draft)}
 return <div className={s.columns}><div className={s.stack}><Panel className={s.row}><img className={s.reviewImage} src={cruise.id==='ha-long-lan-ha'?reviewImage:cruise.image} alt={cruise.title}/><div className={s.stack}><h2>{cruise.title}</h2><p className={s.muted}>{cruise.ship} · {date(cruise.departure)} · {cruise.duration} ngày {cruise.duration-1} đêm</p><p>{cruise.route}</p><Link to={'/cruises/'+cruise.id}>Sửa hành trình</Link></div></Panel>
 <Panel><div className={s.between}><p>Người đi</p><Link to="/booking/travellers">Sửa</Link></div><p className={s.muted}>{draft.travellers.map(t=>t.name).join(' · ')}</p></Panel>
 <Panel><div className={s.between}><p>Loại cabin yêu cầu</p><Link to="/booking/cabin-experience">Sửa</Link></div><p className={s.muted}>{bookingCatalog.cabins.find(c=>c.id===draft.selectedCabinCategory)?.name} · Chưa phân bổ cabin</p>{cabinConflict(draft,scenario.unavailableCategory)&&<p role="alert" className={s.notice}>Loại cabin đã chọn vừa hết chỗ. Chọn lại cabin để tiếp tục; người đi và gói trải nghiệm được giữ nguyên.</p>}</Panel>
 <Panel><div className={s.between}><p>Gói trải nghiệm</p><Link to="/booking/cabin-experience">Sửa</Link></div>{draft.travellers.map(t=><p className={s.muted} key={t.id}>{t.name} · {draft.passengerPackages[t.id]??'Essential'}</p>)}</Panel>
 <Panel><p>Điều khoản booking</p><label className={s.check}><input type="checkbox" checked={draft.acceptedTerms} onChange={e=>setDraft(d=>({...d,acceptedTerms:e.target.checked}))}/>Tôi xác nhận thông tin đã nhập.</label><p className={s.caption}>Điều khoản áp dụng cần được cung cấp trước khi tiếp nhận booking. Xác nhận này chưa phải chấp thuận hợp đồng.</p></Panel>
 <p className={s.notice}>✓ Giá và chỗ trống được kiểm tra lại trước khi booking được xác nhận. Gửi booking không đồng nghĩa đã thanh toán.</p><ActionLink secondary to="/booking/cabin-experience">Quay lại cabin & gói</ActionLink></div>
 <Panel title="Tổng thanh toán dự kiến" className={s.rail}><p className={s.caption}>Giá hành trình</p><p>{money(amount.fare)}</p><p className={s.caption}>Gói trải nghiệm tùy chọn</p><p>{money(amount.packages)}</p><p className={s.eyebrow}>TỔNG DỰ KIẾN</p><strong className={s.price}>{money(amount.total)}</strong><p className={s.caption}>Chi tiết thuế và phí sẽ được xác nhận trước khi thanh toán.</p>{validation&&<p role="alert">{validation}</p>}<Feedback {...action}/><Action disabled={action.pending} onClick={submit}>{action.pending?'Đang gửi…':'Gửi booking'}</Action></Panel></div>
}

