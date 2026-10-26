import { BrandLogo, Button } from '@/shared/ui'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../useAuth'
import styles from '../components/Auth.module.css'

export function AccessDeniedPage() {
  const auth=useAuth(), navigate=useNavigate()
  return <main className={styles.accessPage}>
    <title>OceVie — Không có quyền truy cập</title>
    <Link to="/" aria-label="Trang chủ OceVie"><BrandLogo /></Link>
    <section className={styles.deniedCard}>
      <span className={styles.deniedBadge}>403</span><h1>Bạn không có quyền truy cập</h1>
      <p>Tài khoản hiện tại chưa được cấp quyền sử dụng chức năng này.</p>
      <div className={styles.accessActions}><Button onClick={()=>navigate(auth.isStaff?'/admin':'/')}>Về khu vực của tôi</Button>
      <Button tone="secondary" onClick={()=>navigate(-1)}>Quay lại</Button></div>
    </section>
  </main>
}
