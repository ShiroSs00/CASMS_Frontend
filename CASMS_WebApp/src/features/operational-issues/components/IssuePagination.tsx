import type { IssueQuery } from '../model/issue-query'
import styles from './OperationalIssues.module.css'

type Props = {
  query: IssueQuery
  total: number
  onPageChange: (page: number) => void
}

export function IssuePagination({ query, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const start = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1
  const end = Math.min(query.page * query.pageSize, total)

  return (
    <nav className={styles.pagination} aria-label="Phân trang danh sách sự cố">
      <span>
        {start}–{end} / {total} kết quả · Trang {query.page}/{totalPages}
      </span>
      <div className={styles.paginationActions}>
        <button
          className={styles.secondaryButton}
          disabled={query.page <= 1}
          onClick={() => onPageChange(query.page - 1)}
          type="button"
        >
          Trước
        </button>
        <button
          className={styles.secondaryButton}
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
