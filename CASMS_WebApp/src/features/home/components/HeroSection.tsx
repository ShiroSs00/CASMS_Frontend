import styles from './HeroSection.module.css'

const foundationItems = [
  'React, Vite và TypeScript strict',
  'React Router đang phục vụ route trang chủ',
  'Module boundaries được kiểm tra bằng ESLint',
]

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="foundation-title">
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.content}>
        <p className={styles.eyebrow}>CASMS WEB · TECHNICAL FOUNDATION</p>
        <h1 id="foundation-title">Nền tảng đã sẵn sàng cho bước xác nhận sản phẩm.</h1>
        <p className={styles.lede}>
          Đây là shell kỹ thuật của WEB-001, không phải giao diện CASMS hoàn chỉnh. Phạm vi,
          business rules, thiết kế Figma và API vẫn cần nguồn được xác nhận trước khi phát triển
          tính năng.
        </p>

        <ul className={styles.statusList} aria-label="Trạng thái nền tảng">
          {foundationItems.map((item) => (
            <li key={item}>
              <span aria-hidden="true">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <aside className={styles.statusCard} aria-label="Trạng thái nguồn sản phẩm">
        <p>Source readiness</p>
        <dl>
          <div>
            <dt>Kiến trúc Web</dt>
            <dd data-status="confirmed">Confirmed</dd>
          </div>
          <div>
            <dt>UI tokens</dt>
            <dd data-status="proposed">Proposed</dd>
          </div>
          <div>
            <dt>Product · Figma · API</dt>
            <dd data-status="unconfirmed">Unconfirmed</dd>
          </div>
        </dl>
        <p className={styles.cardNote}>Không có logic nghiệp vụ hoặc endpoint giả trong shell.</p>
      </aside>
    </section>
  )
}
