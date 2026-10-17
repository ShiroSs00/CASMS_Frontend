import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AdminShell } from '@/shared/ui/admin-v3'
import { Button } from '@/shared/ui'
import { ApiError } from '@/shared/api/client'
import { supplierApi } from '../api/supplier-api'
import { SupplierListView } from '../components/SupplierListView'
import { emptySupplierFilters, filterSuppliers, type SupplierListItem } from '../model/supplier-list'
import styles from '../components/SupplierList.module.css'
import formStyles from '../components/SupplierForm.module.css'

export function SupplierListPage() {
  const [filters, setFilters] = useState(emptySupplierFilters)
  const [data, setData] = useState<SupplierListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    void supplierApi
      .list()
      .then((items) => {
        if (!active) return
        setData(items)
        setError(null)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(
          err instanceof ApiError
            ? err.message
            : 'Không thể tải danh sách nhà cung cấp. Kiểm tra máy chủ và thử lại.',
        )
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const rows = data ? filterSuppliers(data, filters) : []
  const totalCount = data ? data.length : 0
  const reset = () => setFilters(emptySupplierFilters)
  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }

  return (
    <AdminShell>
      <div className={styles.content}>
        <header className={styles.titleRow}>
          <div className={styles.titleCopy}>
            <h1>Nhà cung cấp</h1>
            <p>Quản lý đối tác tour, liên hệ và trạng thái vận hành.</p>
          </div>
          <Link
            className={`${styles.createButton} ${formStyles.listCreateLink}`}
            to="/admin/suppliers/new"
          >
            Thêm nhà cung cấp
          </Link>
        </header>

        {error && (
          <aside className={styles.errorBanner} role="alert">
            <span>{error}</span>
            <Button tone="secondary" onClick={handleRetry}>
              Thử lại
            </Button>
          </aside>
        )}

        <SupplierListView
          rows={rows}
          filters={filters}
          totalCount={totalCount}
          loading={loading}
          onFiltersChange={setFilters}
          onReset={reset}
        />
      </div>
    </AdminShell>
  )
}
