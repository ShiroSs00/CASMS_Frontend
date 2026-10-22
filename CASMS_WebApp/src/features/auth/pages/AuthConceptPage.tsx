import { Link, Navigate } from 'react-router'
import { AuthPageShell } from '../components/AuthPageShell'
import { authConcepts, type AuthConcept } from '../model/auth-concepts'
import locked from '../assets/account-locked.png'
import s from '../components/Auth.module.css'

export function AuthConceptPage({kind}:{kind:AuthConcept}) {
  if (kind === 'reservation-lookup') return <Navigate to="/booking/lookup" replace />
  const content=authConcepts[kind]
  const descriptions: Partial<Record<AuthConcept,string>> = {
    register:'Liên hệ OceVie để được hỗ trợ cấp tài khoản. Bạn vẫn có thể đặt chuyến và tra cứu bằng mã đặt chỗ.',
    'forgot-password':'Liên hệ quản trị viên để được hỗ trợ khôi phục quyền truy cập tài khoản.',
    'reset-password':'Liên hệ quản trị viên để được hỗ trợ đặt lại mật khẩu.',
    'verify-email':'Liên hệ bộ phận hỗ trợ nếu bạn cần xác minh thông tin tài khoản.',
    'account-locked':'Tài khoản đang bị khóa hoặc ngừng hoạt động. Liên hệ quản trị viên để được hỗ trợ.',
  }
  return <AuthPageShell image={locked} editorialTitle="Hành trình của bạn cùng OceVie" editorialDescription="Quản lý thông tin chuyến đi và chuẩn bị cho kỳ nghỉ."><div className={s.loginCard}>
    <p className={s.eyebrow}>{content.eyebrow}</p><h1>{content.title}</h1><p>{descriptions[kind]}</p>
    <Link className={s.center} to="/login">Về đăng nhập</Link>
    <Link className={s.center} to="/booking/lookup">Tra cứu đặt chỗ</Link>
  </div></AuthPageShell>
}
