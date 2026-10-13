import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

import styles from './OperationalIssues.module.css'

const navigation = [
  { section: 'Booking', items: ['Tổng quan', 'Booking', 'Check-in'] },
  { section: 'Operations', items: ['Yêu cầu dịch vụ', 'Hoạt động', 'Sự cố'] },
  { section: 'Master data', items: ['Tàu & cabin', 'Hải trình', 'Package'] },
  { section: 'Finance', items: ['Thanh toán', 'Refund', 'Báo cáo'] },
  { section: 'System', items: ['Người dùng & quyền'] },
]

export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.appShell}>
      <a className={styles.skipLink} href="#oim-main">
        Chuyển đến nội dung chính
      </a>
      <aside className={styles.sidebar} aria-label="Điều hướng quản trị">
        <div className={styles.brand}>CASMS Admin</div>
        {navigation.map((group) => (
          <div key={group.section}>
            <div className={styles.navSection}>{group.section}</div>
            {group.items.map((item) =>
              item === 'Sự cố' ? (
                <NavLink
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                  }
                  key={item}
                  to="/admin/issues"
                >
                  {item}
                </NavLink>
              ) : (
                <span className={styles.navLink} key={item} aria-disabled="true">
                  {item}
                </span>
              ),
            )}
          </div>
        ))}
      </aside>
      <header className={styles.topbar}>
        <span>Chuyến được phân công: CASMS Aurora · 20/11/2026</span>
        <span className={styles.account}>
          <span>Nhân viên vận hành</span>
          <span>Tài khoản ▾</span>
        </span>
      </header>
      <main className={styles.main} id="oim-main" tabIndex={-1}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  )
}
