import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Field } from '@/shared/ui'
import { AuthPageShell } from '../components/AuthPageShell'
import { authConceptAdapter, authConcepts, type AuthConcept } from '../model/auth-concepts'
import register from '../assets/register.png'
import verify from '../assets/verify-email.png'
import forgot from '../assets/forgot-password.png'
import reset from '../assets/reset-password.png'
import locked from '../assets/account-locked.png'
import lookup from '../assets/reservation-lookup.png'
import s from '../components/Auth.module.css'
const images:Record<AuthConcept,string>={register,'verify-email':verify,'forgot-password':forgot,'reset-password':reset,'account-locked':locked,'reservation-lookup':lookup}
export function AuthConceptPage({kind}:{kind:AuthConcept}) {
 const content=authConcepts[kind]
 const [values,setValues]=useState<Record<string,string>>({})
 const [message,setMessage]=useState('')
 const [accepted,setAccepted]=useState(false)
 const unavailable=()=>setMessage(authConceptAdapter.submit().message)
 return <AuthPageShell image={images[kind]} editorialTitle={content.editorialTitle} editorialDescription={content.editorialDescription}><div className={s.loginCard+' '+s.conceptCard}><p className={s.eyebrow}>{content.eyebrow}</p><h1>{content.title}</h1><p>{content.description}</p>
 {kind==='verify-email'&&<><span className={s.mail} aria-hidden="true">✉</span><p>Mở email và chọn “Xác minh tài khoản” khi bạn nhận được liên kết hợp lệ.</p></>}
 {kind==='account-locked'&&<div className={s.conceptNote}><strong>Đăng nhập tạm thời bị khóa</strong><p>Liên hệ quản trị viên. Chưa hỗ trợ tự mở khóa hoặc khôi phục tài khoản.</p></div>}
 <form className={s.loginForm} onSubmit={e=>{e.preventDefault();if(values.password!==values.confirm&&content.fields.some(([id])=>id==='confirm')){setMessage('Mật khẩu xác nhận chưa khớp.');return}unavailable()}}>
 {content.fields.map(([id,label,type])=><Field htmlFor={'concept-'+id} key={id} label={label}><input id={'concept-'+id} type={type} required value={values[id]??''} autoComplete={type==='password'?'new-password':id==='email'?'email':'off'} onChange={e=>setValues(v=>({...v,[id]:e.target.value}))}/></Field>)}
 {kind==='register'&&<label className={s.conceptCheck}><input type="checkbox" checked={accepted} required onChange={e=>setAccepted(e.target.checked)}/>Tôi đồng ý với Điều khoản sử dụng và Chính sách riêng tư.</label>}
 {kind==='reset-password'&&<div className={s.conceptNote}><p>Yêu cầu độ mạnh và kiểm tra mật khẩu cũ cần được dịch vụ xác nhận.</p><p>Không có liên kết đặt lại đang hoạt động.</p></div>}
 {message&&<p className={s.error} role="alert">{message}</p>}<Button type="submit" className={s.loginButton}>{content.action}</Button>
 </form>
 {kind==='verify-email'&&<><Button tone="secondary" onClick={unavailable}>Gửi lại email</Button><Link to="/register">Dùng email khác</Link></>}
 {kind==='reservation-lookup'&&<><div className={s.conceptNote}><strong>Kết quả tra cứu</strong><p>Chưa có kết quả được xác minh. Chưa thể liên kết booking với tài khoản.</p></div><Button tone="secondary" disabled>Liên kết với tài khoản</Button></>}
 {kind==='account-locked'&&<Link to="/reservation-lookup">Tra cứu booking · bản xem trước</Link>}
 {kind==='forgot-password'&&<div className={s.conceptNote}>Không tiết lộ email có tồn tại trong hệ thống hay không.</div>}
 <Link className={s.center} to="/login">{kind==='register'?'Đã có tài khoản? Đăng nhập':'Quay lại đăng nhập'}</Link><p className={s.help} id="auth-help">Bản xem trước · Chức năng chưa kết nối. Liên hệ quản trị viên để được hỗ trợ.</p></div></AuthPageShell>
}

