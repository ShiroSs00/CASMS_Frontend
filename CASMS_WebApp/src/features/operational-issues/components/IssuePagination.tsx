import { buildPaginationRange } from '../../../shared/pagination.ts'
import {
  ISSUE_PAGE_SIZE_OPTIONS,
  type IssueQuery,
} from '../model/issue-query'
import styles from './OperationalIssues.module.css'

type Props = {
  query: IssueQuery
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function IssuePagination({
  query,
  total,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const start = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1
  const end = Math.min(query.page * query.pageSize, total)
  const pageRange = buildPaginationRange(query.page, totalPages)

  return (
    <nav className={styles.pagination} aria-label="Phân trang danh sách sự cố">
      <span aria-live="polite" className={styles.paginationSummary}>
        {start}–{end} / {total} kết quả · Trang {query.page}/{totalPages}
      </span>
      <div className={styles.paginationActions}>
        <label className={styles.pageSizeControl}>
          <span>Số dòng</span>
          <select
            aria-label="Số sự cố mỗi trang"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={query.pageSize}
          >
            {ISSUE_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <button
          aria-label="Trang sự cố trước"
          className={`${styles.secondaryButton} ${styles.paginationButton}`}
          disabled={query.page <= 1}
          onClick={() => onPageChange(query.page - 1)}
          type="button"
        >
          Trước
        </button>
        <div className={styles.pageNumbers} aria-label="Chọn trang sự cố">
          {pageRange.map((item, index) => item === 'ellipsis' ? (
            <span
              aria-hidden="true"
              className={styles.pageEllipsis}
              key={`ellipsis-${index}`}
            >
              …
            </span>
          ) : (
            <button
              aria-current={item === query.page ? 'page' : undefined}
              aria-label={`Trang ${item}`}
              className={`${styles.pageNumberButton} ${item === query.page ? styles.pageNumberActive : ''}`}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <button
          aria-label="Trang sự cố sau"
          className={`${styles.secondaryButton} ${styles.paginationButton}`}
          disabled={query.page >= totalPages}
          onClick={() => onPageChange(query.page + 1)}
          type="button"
        >
          Sau
        </button>
      </div>
    </nav>
  )
}
