import { EditorLayout } from '@/shared/ui'
import { PermissionLink as Link } from '@/shared/ui'
import { useEffect, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {readinessContextReturn} from '@/shared/lib/cruise-context'
import { AdminShell } from '@/shared/ui/admin-v3'
import { ApiError } from '@/shared/api/client'
import { supplierApi } from '../api/supplier-api'
import {
  emptySupplierForm,
  formToSupplierRequest,
  supplierToForm,
  type SupplierFormMode,
  type SupplierFormValues,
} from '../model/supplier-form'
import { type SupplierListItem } from '../model/supplier-list'
import { SupplierForm } from '../components/SupplierForm'
import styles from '../components/SupplierForm.module.css'

export function SupplierFormPage() {
  const access = useSessionAccess()
  const { supplierId } = useParams<{ supplierId: string }>()
  const navigate = useNavigate()
  const [params]=useSearchParams(),returnTo=readinessContextReturn(params,'SUPPLIER',supplierId)
  const mode: SupplierFormMode = supplierId === undefined ? 'create' : 'edit'

  const [supplier, setSupplier] = useState<SupplierListItem | null>(null)
  const [loading, setLoading] = useState(mode === 'edit')
  const [error, setError] = useState<{ message: string; isNotFound?: boolean } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (!supplierId || mode !== 'edit') return
    let active = true
    void supplierApi
      .get(supplierId)
      .then((data) => {
        if (!active) return
        setSupplier(data)
        setError(null)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof ApiError && err.status === 404) {
          setError({
            message: 'Nhà cung cấp này không tồn tại hoặc đã bị xóa.',
            isNotFound: true,
          })
        } else if (err instanceof ApiError) {
          setError({ message: err.message })
        } else {
          setError({ message: 'Không thể tải thông tin nhà cung cấp.' })
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [mode, supplierId, reloadKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }

  async function handleSubmit(values: SupplierFormValues) {
    if (!access.canDo(mode === 'create' ? 'SUPPLIER_CREATE' : 'SUPPLIER_UPDATE')) { setApiError('Tài khoản chưa có quyền lưu nhà cung cấp.'); return }
    setIsSubmitting(true)
    setApiError(null)
    try {
      const payload = formToSupplierRequest(values)
      if (mode === 'create') {
        const created = await supplierApi.create(payload)
        navigate(`/admin/suppliers/${created.id}`)
      } else if (supplierId) {
        const updated = await supplierApi.update(supplierId, payload)
        navigate(returnTo??`/admin/suppliers/${updated.id}`)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setApiError('Tên nhà cung cấp đã tồn tại.')
      } else if (err instanceof ApiError) {
        setApiError(err.message)
      } else {
        setApiError(
          mode === 'create'
            ? 'Không thể tạo nhà cung cấp. Vui lòng thử lại.'
            : 'Không thể cập nhật nhà cung cấp. Vui lòng thử lại.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminShell>
      <div className={styles.content}>
        {loading ? (
          <div className={styles.header}>
            <p>Đang tải thông tin nhà cung cấp...</p>
          </div>
        ) : mode === 'edit' && error ? (
          <section className={styles.notFound}>
            <h1>{error.isNotFound ? 'Không tìm thấy nhà cung cấp' : 'Lỗi tải dữ liệu'}</h1>
            <p>{error.message}</p>
            <div className={styles.actions}>
              <Link className={styles.returnLink} to="/admin/suppliers">
                Quay lại danh sách
              </Link>
              {!error.isNotFound && (
                <button type="button" className={styles.returnLink} onClick={handleRetry}>
                  Thử lại
                </button>
              )}
            </div>
          </section>
        ) : (
          <>
            <header className={styles.header}>
              <h1>{mode === 'create' ? 'Thêm nhà cung cấp' : 'Chỉnh sửa nhà cung cấp'}</h1>
              <p>
                {mode === 'create'
                  ? 'Tạo hồ sơ đối tác và thông tin liên hệ chính.'
                  : 'Cập nhật hồ sơ đối tác và thông tin liên hệ chính.'}
              </p>
            </header>
            <EditorLayout ><SupplierForm
              key={supplier ? supplier.id : 'new'}
              mode={mode}
              initialValues={supplier ? supplierToForm(supplier) : emptySupplierForm}
              isSubmitting={isSubmitting}
              apiError={apiError}
              onSubmitValues={handleSubmit}
              onCancel={() =>
                navigate(
                  mode === 'edit' && supplierId
                    ? `/admin/suppliers/${supplierId}`
                    : '/admin/suppliers',
                )
              }
            /></EditorLayout>
          </>
        )}
      </div>
    </AdminShell>
  )
}
