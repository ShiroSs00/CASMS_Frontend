import { useEffect, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { AdminShell } from '@/shared/ui/admin-v3'
import { ButtonLink, PageHeader } from '@/shared/ui'
import { ApiError } from '@/shared/api/client'
import { supplierApi } from '../api/supplier-api'
import { SupplierListView } from '../components/SupplierListView'
import { emptySupplierFilters, filterSuppliers, type SupplierListItem } from '../model/supplier-list'
import styles from '../components/SupplierList.module.css'


export function SupplierListPage() {
  const access = useSessionAccess()
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
        <PageHeader breadcrumb="ĐỐI TÁC / NHÀ CUNG CẤP" title="Nhà cung cấp" description="Quản lý đối tác, thông tin liên hệ và trạng thái hoạt động." actions={access.canDo('SUPPLIER_CREATE') && <ButtonLink to="/admin/suppliers/new">Thêm nhà cung cấp</ButtonLink>} />

        <SupplierListView
          rows={rows}
          filters={filters}
          totalCount={totalCount}
          loading={loading}
          error={error}
          onRetry={handleRetry}
          onFiltersChange={setFilters}
          onReset={reset}
        />
      </div>
    </AdminShell>
  )
}
