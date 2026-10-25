import { PermissionLink as Link } from '@/shared/ui'
import { useEffect, useRef, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { useNavigate, useParams } from 'react-router'
import { AdminShell } from '@/shared/ui/admin-v3'
import { ApiError } from '@/shared/api/client'
import { supplierApi, type SupplierVerificationRequest } from '../api/supplier-api'
import { type SupplierListItem } from '../model/supplier-list'
import { SupplierDetail } from '../components/SupplierDetail'
import styles from '../components/SupplierDetail.module.css'

export function SupplierDetailPage() {
  const access = useSessionAccess()
  const lock = useRef(false)
  const { supplierId } = useParams<{ supplierId: string }>()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState<SupplierListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; isNotFound?: boolean } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    if (!supplierId) return
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
  }, [supplierId, reloadKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }

  async function handleToggleStatus() {
    if (!supplier || lock.current || !access.canDo('SUPPLIER_STATUS_CHANGE')) return
    lock.current = true
    const isActivating = supplier.status === 'INACTIVE'
    const actionKey = isActivating ? 'activate' : 'deactivate'
    setActionInProgress(actionKey)
    setActionFeedback(null)
    try {
      const updated = isActivating
        ? await supplierApi.activate(supplier.id)
        : await supplierApi.deactivate(supplier.id)
      setSupplier(updated)
      setActionFeedback({
        type: 'success',
        message: isActivating
          ? 'Đã kích hoạt nhà cung cấp thành công.'
          : 'Đã tạm dừng hoạt động của nhà cung cấp.',
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionFeedback({
          type: 'error',
          message: isActivating
            ? 'Nhà cung cấp chưa được xác minh hoặc không đủ điều kiện kích hoạt.'
            : 'Không thể tạm dừng hoạt động nhà cung cấp.',
        })
      } else if (err instanceof ApiError) {
        setActionFeedback({ type: 'error', message: err.message })
      } else {
        setActionFeedback({
          type: 'error',
          message: 'Thao tác trạng thái thất bại. Vui lòng thử lại.',
        })
      }
    } finally {
      lock.current = false; setActionInProgress(null)
    }
  }

  async function handleVerify(request: SupplierVerificationRequest) {
    if (!supplier || lock.current || !access.canDo('SUPPLIER_VERIFY')) throw new Error('Chưa thể xác minh nhà cung cấp.')
    lock.current = true
    setActionInProgress('verify')
    setActionFeedback(null)
    try {
      const updated = await supplierApi.verify(supplier.id, request)
      setSupplier(updated)
      setActionFeedback({
        type: 'success',
        message:
          request.verificationStatus === 'VERIFIED'
            ? 'Đã xác minh nhà cung cấp thành công.'
            : 'Đã ghi nhận từ chối xác minh nhà cung cấp.',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setActionFeedback({ type: 'error', message: err.message })
      } else {
        setActionFeedback({
          type: 'error',
          message: 'Không thể ghi nhận kết quả xác minh. Vui lòng thử lại.',
        })
      }
      throw err
    } finally {
      lock.current = false; setActionInProgress(null)
    }
  }

  async function handleDelete() {
    if (!supplier || lock.current || !access.canDo('SUPPLIER_DELETE')) return
    lock.current = true
    setActionInProgress('delete')
    setActionFeedback(null)
    try {
      await supplierApi.deleteUnused(supplier.id)
      navigate('/admin/suppliers')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionFeedback({
          type: 'error',
          message: 'Không thể xóa nhà cung cấp đang được liên kết hoặc sử dụng trong hệ thống.',
        })
      } else if (err instanceof ApiError) {
        setActionFeedback({ type: 'error', message: err.message })
      } else {
        setActionFeedback({
          type: 'error',
          message: 'Không thể xóa nhà cung cấp. Vui lòng thử lại.',
        })
      }
      lock.current = false; setActionInProgress(null)
    }
  }

  return (
    <AdminShell>
      {loading ? (
        <div className={styles.loadingPlaceholder}>Đang tải thông tin nhà cung cấp...</div>
      ) : error ? (
        <section className={styles.notFound}>
          <h1>{error.isNotFound ? 'Không tìm thấy nhà cung cấp' : 'Lỗi tải dữ liệu'}</h1>
          <p>{error.message}</p>
          <div className={styles.headerActions}>
            <Link to="/admin/suppliers" className={styles.returnLink}>
              Quay lại danh sách
            </Link>
            {!error.isNotFound && (
              <button type="button" className={styles.statusButton} onClick={handleRetry}>
                Thử lại
              </button>
            )}
          </div>
        </section>
      ) : supplier ? (
        <><Link className={styles.statusButton} to={`/admin/shore-excursions?supplierId=${supplier.id}`}>Các chuyến tham quan của nhà cung cấp</Link><SupplierDetail
          supplier={supplier}
          actionInProgress={actionInProgress}
          actionFeedback={actionFeedback}
          onDismissFeedback={() => setActionFeedback(null)}
          onToggleStatus={handleToggleStatus}
          onVerify={handleVerify}
          onDelete={handleDelete}
        /></>
      ) : null}
    </AdminShell>
  )
}
