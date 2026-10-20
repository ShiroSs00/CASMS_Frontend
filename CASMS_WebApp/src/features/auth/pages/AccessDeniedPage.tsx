import { Link, useNavigate } from 'react-router'
import { Button } from '@/shared/ui'
import { useAuth } from '../useAuth'
import styles from '../components/Auth.module.css'

const navigation = ['Tổng quan', 'Bookings', 'Check-in', 'Yêu cầu dịch vụ', 'Tài khoản', 'Tàu', 'Chuyến', 'Quy định', 'Sự cố', 'Người dùng', 'Báo cáo']

export function AccessDeniedPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  return <div className={styles.deniedShell}>
    <aside className={styles.deniedSidebar}><Link to="/" className={styles.deniedBrand}>OcvViet</Link><p>Trung tâm vận hành</p><nav aria-label="Điều hướng quản trị">{navigation.map((label) => <span className={label === 'Người dùng' ? styles.navActive : ''} aria-disabled="true" key={label}>{label}</span>)}</nav></aside>
    <div className={styles.deniedMain}>
      <header className={styles.deniedTopbar}><span>Tìm kiếm hoặc chạy lệnh…</span><b>{auth.user ? 'Đã đăng nhập' : 'Chưa đăng nhập'}</b></header>
      <main className={styles.deniedContent}>
        <div className={styles.deniedTitle}><div><h1>Bạn không có quyền truy cập</h1><p>Direct-link bị từ chối; menu visibility không thay thế security enforcement.</p></div><Button onClick={() => navigate(auth.isStaff ? '/admin' : '/')}>Về tổng quan</Button></div>
        <section className={styles.deniedCard}><span className={styles.deniedBadge}>403</span><h2>Không thể mở Refund Approval</h2><p>Quyền hiện tại không cho phép action này. Permission contract đang được backend xây dựng; UI không tự suy ra role/capability.</p><Button tone="secondary" onClick={() => navigate(-1)}>Về trang trước</Button></section>
      </main>
    </div>
  </div>
}
