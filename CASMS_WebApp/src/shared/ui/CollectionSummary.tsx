import styles from './CollectionSummary.module.css'

/** Describes the loaded collection only, never an inferred system-wide total. */
export function CollectionSummary({ count, visible, filtered = false, label = 'Trong danh mục', scope = 'Dữ liệu đã tải' }: {
  count: number | null; visible?: number; filtered?: boolean; label?: string; scope?: string
}) {
  return <dl className={styles.summary} aria-label="Tóm tắt danh sách">
    <div className={styles.total}><dt>{label}</dt><dd>{count === null ? '—' : count.toLocaleString('vi-VN')}</dd><dd className={styles.hint}>{scope}</dd></div>
    <div><dt>Kết quả hiển thị</dt><dd>{count === null ? '—' : (visible ?? count).toLocaleString('vi-VN')}</dd><dd className={styles.hint}>{filtered ? 'Theo bộ lọc hiện tại' : 'Chưa thu hẹp bằng bộ lọc'}</dd></div>
    <div className={styles.filter}><dt>Phạm vi tra cứu</dt><dd>{filtered ? 'Đang lọc' : 'Tất cả'}</dd><dd className={styles.hint}>{count === null ? 'Chưa có số liệu để tổng hợp' : 'Dùng bộ lọc để tìm thông tin cần xử lý'}</dd></div>
  </dl>
}
