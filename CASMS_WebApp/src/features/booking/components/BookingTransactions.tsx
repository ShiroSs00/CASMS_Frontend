import { date, money } from '../model/booking-format'
import { useState } from 'react'
import { useBookingDraft } from '../model/booking-context'
import { bookingStatusLabel } from '../model/booking-scenarios'
import type { Booking, Cruise } from '../model/booking-types'
import { useBookingAction } from '../model/booking-state'
import { Action, Badge, Feedback, Heading, Panel, Steps } from './BookingUI'
import s from './Booking.module.css'
export function PaymentContract({booking:b,cruise:c}:{booking:Booking;cruise:Cruise}) {
 const [method,setMethod]=useState('gateway')
 const action=useBookingAction()
 const due=Math.max(0,b.fare-b.paid)
 return <><Steps active={4}/><Heading title="Thanh toán & xác nhận điều khoản" description="Trạng thái thanh toán được cập nhật sau khi hệ thống nhận xác nhận từ cổng thanh toán."/><div className={s.columns}><div className={s.stack}><Panel title="Phương thức thanh toán">{[['gateway','Cổng thanh toán trực tuyến','Bạn sẽ được chuyển đến cổng thanh toán khi phương thức này được hỗ trợ.'],['transfer','Chuyển khoản','Hiển thị khi phương thức này được hỗ trợ cho booking của bạn.']].map(([id,title,description])=><label key={id} className={s.panel+' '+s.row+' '+(method===id?s.selected:'')}><input type="radio" name="payment-method" checked={method===id} onChange={()=>setMethod(id)}/><div><p>{title}</p><p className={s.caption}>{description}</p></div></label>)}</Panel><Panel title="Điều khoản & xác nhận"><p>Xem và xác nhận điều khoản áp dụng cho booking này trước khi thanh toán.</p><p>Trạng thái hợp đồng: {b.contract}</p><Action secondary disabled={action.pending} onClick={()=>void action.run('contract-read',{bookingId:b.id})}>Xem điều khoản</Action><p className={s.caption}>Chưa có tài liệu hợp đồng để xác nhận.</p></Panel><Feedback {...action}/></div><Panel title="Thanh toán" className={s.rail}><p>{c.title}</p><p className={s.muted}>{date(c.departure)} – {date(c.end)} · {c.duration} ngày {c.duration-1} đêm</p><p>{b.passengers.length} hành khách</p><p className={s.caption}>Tổng tham khảo</p><strong className={s.price}>{money(b.fare)}</strong><Badge warning={b.payment!=='Confirmed'}>{b.payment}</Badge><p>Đã thanh toán: {money(b.paid)}</p><p>Còn lại: {money(due)}</p><p className={s.caption}>Tiền đặt cọc và thời hạn thanh toán chưa có dữ liệu xác nhận.</p><Action disabled={action.pending||due===0} onClick={()=>void action.run('payment-start',{bookingId:b.id,method})}>Tiếp tục thanh toán</Action><Action secondary disabled={action.pending} onClick={()=>void action.run('payment-status',{bookingId:b.id})}>Kiểm tra trạng thái</Action></Panel></div></>
}
export function ChangeRequest({booking:b,cruise:c}:{booking:Booking;cruise:Cruise}) {
 const {scenario}=useBookingDraft()
 const [change,setChange]=useState('')
 const [reason,setReason]=useState('')
 const [confirmed,setConfirmed]=useState(false)
 const action=useBookingAction()
 const stage=scenario.requestStage==='not-submitted'&&action.result?.state==='received'?'received':scenario.requestStage
 const stageLabels={'not-submitted':'Chưa có yêu cầu được tiếp nhận.','received':'Đã nhận yêu cầu mô phỏng.','under-review':'Yêu cầu mô phỏng đang được xem xét.','decision':'Quyết định mô phỏng: cần bổ sung thông tin trước khi xử lý.'}
 return <><Heading title="Yêu cầu thay đổi hoặc hủy booking" description="Gửi yêu cầu không tự thay đổi trạng thái booking. Mọi khoản phí hoặc hoàn tiền sẽ được xác nhận trước khi áp dụng."/><Panel><p className={s.eyebrow}>{b.reference} · {bookingStatusLabel[b.status]}</p><h2>{c.title}</h2><p className={s.muted}>{date(c.departure)} – {date(c.end)} · {c.ship} · {b.requestedCategory}</p></Panel><div className={s.grid2}>
 <form className={s.panel} onSubmit={e=>{e.preventDefault();void action.run('change-request',{bookingId:b.id,type:'change',reason:change})}}><h2>Thay đổi booking</h2><p className={s.muted}>Ngày khởi hành, cabin và thông tin có thể thay đổi tùy điều kiện của booking.</p><label>Nội dung yêu cầu<textarea required value={change} onChange={e=>setChange(e.target.value)} placeholder="Tôi muốn đổi ngày khởi hành…" rows={2}/></label><Action type="submit" disabled={action.pending}>Gửi yêu cầu thay đổi</Action></form>
 <form className={s.panel} onSubmit={e=>{e.preventDefault();if(confirmed)void action.run('change-request',{bookingId:b.id,type:'cancel',reason})}}><h2>Yêu cầu hủy</h2><p className={s.muted}>Khoản hoàn tiền hoặc phí hủy, nếu có, sẽ được xác nhận trước khi bạn quyết định.</p><label>Lý do<textarea required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Nhập lý do hủy" rows={2}/></label><label className={s.check}><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Tôi muốn gửi yêu cầu xem xét hủy booking.</label><Action type="submit" secondary disabled={action.pending}>Gửi yêu cầu hủy</Action></form></div><Feedback {...action}/><Panel title="Yêu cầu gần nhất"><p className={s.muted}>{stageLabels[stage]}</p><p className={s.caption}>Các bước khi có yêu cầu: ĐÃ NHẬN → ĐANG XEM XÉT → QUYẾT ĐỊNH</p><p>Trong thời gian chờ xử lý, booking hiện tại vẫn giữ nguyên cho tới khi có quyết định xác nhận.</p></Panel></>
}

