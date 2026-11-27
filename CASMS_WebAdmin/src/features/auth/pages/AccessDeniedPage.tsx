import { BrandLogo, Button } from '@/shared/ui'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../useAuth'
import styles from '../components/Auth.module.css'

export function AccessDeniedPage() {
  const auth=useAuth(), navigate=useNavigate()
  return <main className={styles.accessPage}>
    <title>OceVie — Không có quyền truy cập</title>
    <Link to={auth.isStaff ? '/admin' : '/login'} aria-label="Trang chủ OceVie"><BrandLogo /></Link>
    <section className={styles.deniedCard}>
      <span className={styles.deniedBadge}>403</span><h1>Bạn không có quyền truy cập</h1>
      <p>Tài khoản hiện tại chưa được cấp quyền sử dụng chức năng này.</p>
      <div className={styles.accessActions}>
        {auth.isStaff
          ? <Button onClick={()=>navigate('/admin')}>Về khu vực của tôi</Button>
          : <Button onClick={() => void auth.logout().then(() => navigate('/login', { replace: true }))}>Đăng xuất</Button>}
        {auth.isStaff && <Button tone="secondary" onClick={()=>navigate(-1)}>Quay lại</Button>}
        {auth.isStaff && <Button tone="secondary" onClick={() => void auth.logout().then(() => navigate('/login', { replace: true }))}>Đăng xuất</Button>}
      </div>
    </section>
  </main>
}
