import { Link } from 'react-router'
import { Button, Field } from '@/shared/ui'
import {
  supplierContact,
  supplierStatusLabels,
  supplierUpdatedDate,
  supplierVerificationLabels,
  type SupplierFilters,
  type SupplierListItem,
  type SupplierStatus,
  type SupplierVerification,
} from '../model/supplier-list'
import styles from './SupplierList.module.css'

type Props = {
  rows: readonly SupplierListItem[]
  filters: SupplierFilters
  totalCount: number
  loading?: boolean
  onFiltersChange: (value: SupplierFilters) => void
  onReset: () => void
}

const statusTones: Record<SupplierStatus, string> = {
  ACTIVE: styles.success,
  INACTIVE: styles.neutral,
}

const verificationTones: Record<SupplierVerification, string> = {
  PENDING: styles.warning,
  VERIFIED: styles.success,
  REJECTED: styles.error,
}

export function SupplierListView({
  rows,
  filters,
  totalCount,
  loading = false,
  onFiltersChange,
  onReset,
}: Props) {
  return (
    <>
      <div className={styles.filters} role="group" aria-label="Bộ lọc nhà cung cấp">
        <Field htmlFor="supplier-search" label="Tìm kiếm">
          <input
            id="supplier-search"
            type="search"
            placeholder="Tên, loại hoặc liên hệ"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          />
        </Field>
        <Field htmlFor="supplier-status" label="Trạng thái">
          <select
            id="supplier-status"
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({ ...filters, status: event.target.value as SupplierFilters['status'] })
            }
          >
            <option value="ALL">Tất cả</option>
            {Object.entries(supplierStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field htmlFor="supplier-verification" label="Xác minh">
          <select
            id="supplier-verification"
            value={filters.verification}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                verification: event.target.value as SupplierFilters['verification'],
              })
            }
          >
            <option value="ALL">Tất cả</option>
            {Object.entries(supplierVerificationLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Button tone="secondary" className={styles.resetButton} onClick={onReset}>
          Đặt lại
        </Button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table} aria-label="Danh sách nhà cung cấp">
          <colgroup>
            <col className={styles.nameColumn} />
            <col className={styles.typeColumn} />
            <col className={styles.contactColumn} />
            <col className={styles.statusColumn} />
            <col className={styles.verificationColumn} />
            <col className={styles.dateColumn} />
            <col className={styles.actionColumn} />
          </colgroup>
          <thead>
            <tr>
              {['NHÀ CUNG CẤP', 'LOẠI', 'LIÊN HỆ', 'TRẠNG THÁI', 'XÁC MINH', 'CẬP NHẬT'].map(
                (label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ),
              )}
              <th scope="col">
                <span className={styles.srOnly}>Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  <div className={styles.emptyState}>
                    <p>Đang tải danh sách nhà cung cấp...</p>
                  </div>
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.supplierName}</td>
                  <td>{row.supplierType}</td>
                  <td>{supplierContact(row)}</td>
                  <td>
                    <span className={`${styles.badge} ${statusTones[row.status]}`}>
                      {supplierStatusLabels[row.status]}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${verificationTones[row.verificationStatus]}`}>
                      {supplierVerificationLabels[row.verificationStatus]}
                    </span>
                  </td>
                  <td>
                    <time dateTime={row.updatedAt}>{supplierUpdatedDate(row.updatedAt)}</time>
                  </td>
                  <td>
                    <Link
                      to={`/admin/suppliers/${row.id}`}
                      className={styles.rowAction}
                      aria-label={`Mở ${row.supplierName}`}
                    >
                      Mở →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  <div className={styles.emptyState}>
                    {totalCount === 0 ? (
                      <>
                        <strong>Chưa có nhà cung cấp</strong>
                        <p>Danh sách nhà cung cấp hiện chưa có dữ liệu.</p>
                        <Link
                          to="/admin/suppliers/new"
                          className={styles.createButton}
                          style={{
                            textAlign: 'center',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                          }}
                        >
                          Thêm nhà cung cấp
                        </Link>
                      </>
                    ) : (
                      <>
                        <strong>Không có nhà cung cấp phù hợp</strong>
                        <p>Hãy điều chỉnh hoặc đặt lại bộ lọc.</p>
                        <Button tone="secondary" className={styles.resetButton} onClick={onReset}>
                          Đặt lại
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {loading ? 'Đang tải' : `${rows.length} nhà cung cấp trong danh sách.`}
      </p>
    </>
  )
}
