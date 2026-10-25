import { PermissionLink as Link } from '@/shared/ui'
import { useState } from 'react'

import { Modal } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import {
  supplierDateTime,
  supplierStatusLabels,
  supplierVerificationLabels,
  type SupplierListItem,
  type SupplierStatus,
  type SupplierVerification,
} from '../model/supplier-list'
import type { SupplierVerificationRequest } from '../api/supplier-api'
import styles from './SupplierDetail.module.css'

type Props = {
  supplier: SupplierListItem
  actionInProgress?: string | null
  actionFeedback?: { type: 'success' | 'error'; message: string } | null
  onDismissFeedback?: () => void
  onToggleStatus?: () => void
  onVerify?: (request: SupplierVerificationRequest) => Promise<void>
  onDelete?: () => void
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

function formatVerifier(verifiedBy?: string | null): string {
  if (!verifiedBy) return 'Người dùng hệ thống'
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(verifiedBy)
  return isUuid ? 'Người dùng hệ thống' : verifiedBy
}

export function SupplierDetail({
  supplier,
  actionInProgress = null,
  actionFeedback = null,
  onDismissFeedback,
  onToggleStatus,
  onVerify,
  onDelete,
}: Props) {
  const access = useSessionAccess()
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedVerification, setSelectedVerification] = useState<SupplierVerification>('VERIFIED')
  const [verificationNotes, setVerificationNotes] = useState('')

  const canActivate = supplier.verificationStatus === 'VERIFIED'
  const isStatusBusy = actionInProgress === 'activate' || actionInProgress === 'deactivate'

  async function handleConfirmVerify() {
    if (!onVerify || !access.canDo('SUPPLIER_VERIFY')) return
    try { await onVerify({
      verificationStatus: selectedVerification,
      verificationNotes: verificationNotes.trim() || null,
    }) } catch { return }
    setShowVerifyModal(false)
    setVerificationNotes('')
  }

  return (
    <div className={styles.content}>
      <nav className={styles.breadcrumb} aria-label="Đường dẫn điều hướng">
        <Link to="/admin/suppliers">Nhà cung cấp</Link>
        <span aria-hidden="true">/</span>
        <span className={styles.breadcrumbCurrent}>{supplier.supplierName}</span>
      </nav>

      {actionFeedback && (
        <aside
          className={`${styles.feedbackBanner} ${
            actionFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
          }`}
          role="status"
          aria-live="polite"
        >
          <span>{actionFeedback.message}</span>
          {onDismissFeedback && (
            <button
              type="button"
              className={styles.rowAction}
              onClick={onDismissFeedback}
              aria-label="Đóng thông báo"
            >
              ✕
            </button>
          )}
        </aside>
      )}

      <header className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h1>{supplier.supplierName}</h1>
          <p>{supplier.supplierType || 'Chưa phân loại'}</p>
        </div>
        <div className={styles.headerActions}>
          {access.canDo('SUPPLIER_UPDATE') && <Link to={`/admin/suppliers/${supplier.id}/edit`} className={styles.editButton}>
            Chỉnh sửa
          </Link>}
          {access.canDo('SUPPLIER_STATUS_CHANGE') && <button
            type="button"
            className={styles.statusButton}
            onClick={onToggleStatus}
            disabled={isStatusBusy || !access.canDo('SUPPLIER_STATUS_CHANGE') || (supplier.status === 'INACTIVE' && !canActivate)}
            title={
              supplier.status === 'INACTIVE' && !canActivate
                ? 'Nhà cung cấp cần được xác minh (VERIFIED) trước khi kích hoạt'
                : supplier.status === 'ACTIVE'
                  ? 'Tạm dừng hoạt động nhà cung cấp'
                  : 'Kích hoạt nhà cung cấp'
            }
          >
            {actionInProgress === 'activate'
              ? 'Đang kích hoạt...'
              : actionInProgress === 'deactivate'
                ? 'Đang cập nhật...'
                : supplier.status === 'ACTIVE'
                  ? 'Tạm dừng'
                  : 'Kích hoạt'}
          </button>}
          {access.canDo('SUPPLIER_DELETE') && <button
            type="button"
            className={styles.deleteButton}
            onClick={() => setShowDeleteModal(true)}
            disabled={actionInProgress !== null || !access.canDo('SUPPLIER_DELETE')}
            title="Xóa nhà cung cấp nếu chưa được sử dụng"
          >
            {actionInProgress === 'delete' ? 'Đang xóa...' : 'Xóa'}
          </button>}
        </div>
      </header>

      {/* 4-card summary row */}
      <section className={styles.summaryRow} aria-label="Tổng quan trạng thái">
        <div className={styles.summaryCard}>
          <p className={styles.cardLabel}>TRẠNG THÁI</p>
          <span className={`${styles.badge} ${statusTones[supplier.status]}`}>
            {supplierStatusLabels[supplier.status]}
          </span>
        </div>

        <div className={styles.summaryCard}>
          <p className={styles.cardLabel}>XÁC MINH</p>
          <span className={`${styles.badge} ${verificationTones[supplier.verificationStatus]}`}>
            {supplierVerificationLabels[supplier.verificationStatus]}
          </span>
        </div>

        <div className={styles.summaryCard}>
          <p className={styles.cardLabel}>CẬP NHẬT</p>
          <p className={styles.cardValue}>{supplierDateTime(supplier.updatedAt)}</p>
        </div>

        {access.canDo('SUPPLIER_VERIFY') && <div className={styles.summaryCard}>
          <p className={styles.cardLabel}>HÀNH ĐỘNG XÁC MINH</p>
          {access.canDo('SUPPLIER_VERIFY') && <button
            type="button"
            className={styles.verifyActiveBtn}
            onClick={() => setShowVerifyModal(true)}
            disabled={actionInProgress !== null || !access.canDo('SUPPLIER_VERIFY')}
          >
            {actionInProgress === 'verify' ? 'Đang xác minh...' : 'Xác minh nhà cung cấp'}
          </button>}
        </div>}
      </section>

      {/* Two-column info cards */}
      <section className={styles.infoRow} aria-label="Thông tin chi tiết">
        <div className={styles.infoCard}>
          <h2 className={styles.cardTitle}>Thông tin nhà cung cấp</h2>
          <div className={styles.infoItem}>
            <span className={styles.itemLabel}>Loại đối tác</span>
            <p className={styles.itemValue}>{supplier.supplierType || 'Chưa phân loại'}</p>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.itemLabel}>Ghi chú</span>
            <p className={styles.itemValue}>{supplier.notes || 'Chưa có ghi chú'}</p>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h2 className={styles.cardTitle}>Liên hệ chính</h2>
          <div className={styles.infoItem}>
            <span className={styles.itemLabel}>Tên liên hệ</span>
            <p className={styles.itemValue}>{supplier.contactName || 'Chưa có tên liên hệ'}</p>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.itemLabel}>Email</span>
            <p className={styles.itemValue}>{supplier.contactEmail || 'Chưa có email'}</p>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.itemLabel}>Điện thoại</span>
            <p className={styles.itemValue}>{supplier.contactPhone || 'Chưa có số điện thoại'}</p>
          </div>
        </div>
      </section>

      {/* Verification section */}
      <section className={styles.verificationBlock} aria-label="Chi tiết xác minh">
        <h2 className={styles.cardTitle}>Xác minh</h2>
        <div className={styles.verificationDetails}>
          {supplier.verificationStatus === 'PENDING' && (
            <>
              <p>
                <strong>Trạng thái hiện tại:</strong> Chờ xác minh
              </p>
              <p>Chưa có thời điểm/người xác minh.</p>
            </>
          )}
          {supplier.verificationStatus === 'VERIFIED' && (
            <>
              <p>
                <strong>Trạng thái hiện tại:</strong> Đã xác minh
              </p>
              <p>
                <strong>Xác minh lúc:</strong> {supplierDateTime(supplier.verifiedAt)}
              </p>
              <p>
                <strong>Người xác minh:</strong> {formatVerifier(supplier.verifiedBy)}
              </p>
              {supplier.verificationNotes && (
                <p>
                  <strong>Ghi chú:</strong> {supplier.verificationNotes}
                </p>
              )}
            </>
          )}
          {supplier.verificationStatus === 'REJECTED' && (
            <>
              <p>
                <strong>Trạng thái hiện tại:</strong> Bị từ chối
              </p>
              {supplier.verificationNotes && (
                <p>
                  <strong>Lý do:</strong> {supplier.verificationNotes}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Metadata row */}
      <footer className={styles.metadataRow}>
        <span>Tạo lúc: {supplierDateTime(supplier.createdAt)}</span>
        <span>Cập nhật: {supplierDateTime(supplier.updatedAt)}</span>
      </footer>

      {/* Verification modal dialog */}
      {showVerifyModal && access.canDo('SUPPLIER_VERIFY') && (
        <Modal title="Xác minh nhà cung cấp" busy={actionInProgress === 'verify'} onClose={() => { setShowVerifyModal(false); setVerificationNotes('') }} footer={<div className={styles.dialogActions}>
              {access.canDo('SUPPLIER_VERIFY') && <button
                type="button"
                className={styles.statusButton}
                onClick={() => {
                  setShowVerifyModal(false)
                  setVerificationNotes('')
                }}
                disabled={actionInProgress === 'verify' || !access.canDo('SUPPLIER_VERIFY')} data-overlay-dismiss
              >
                Hủy
              </button>}
              {access.canDo('SUPPLIER_VERIFY') && <button
                type="button"
                className={styles.editButton}
                onClick={handleConfirmVerify}
                disabled={actionInProgress === 'verify' || !access.canDo('SUPPLIER_VERIFY')}
              >
                {actionInProgress === 'verify' ? 'Đang xác minh...' : 'Xác nhận'}
              </button>}
            </div>}>
            <div className={styles.dialogBody}>
              <p>
                <strong>Nhà cung cấp:</strong> {supplier.supplierName}
              </p>
              <div>
                <label className={styles.itemLabel} id="verification-result-label">
                  Kết quả *
                </label>
                <div
                  className={styles.radioGroup}
                  role="radiogroup"
                  aria-labelledby="verification-result-label"
                >
                  <label className={styles.radioOption}>
                    <input
                      type="radio"
                      name="verificationStatus"
                      value="VERIFIED"
                      checked={selectedVerification === 'VERIFIED'}
                      onChange={() => setSelectedVerification('VERIFIED')}
                    />
                    <span>Đã xác minh</span>
                  </label>
                  <label className={styles.radioOption}>
                    <input
                      type="radio"
                      name="verificationStatus"
                      value="REJECTED"
                      checked={selectedVerification === 'REJECTED'}
                      onChange={() => setSelectedVerification('REJECTED')}
                    />
                    <span>Bị từ chối</span>
                  </label>
                </div>
              </div>
              <div>
                <label htmlFor="verificationNotesInput" className={styles.itemLabel}>
                  Ghi chú xác minh
                </label>
                <textarea
                  id="verificationNotesInput"
                  className={styles.textareaField}
                  placeholder="Nhập ghi chú hoặc lý do đánh giá năng lực..."
                  maxLength={1000}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                />
              </div
            >
            </div>
        </Modal>
      )}

      {/* Delete confirmation modal dialog */}
      {showDeleteModal && access.canDo('SUPPLIER_DELETE') && (
        <Modal title="Xác nhận xóa nhà cung cấp" busy={actionInProgress === 'delete'} onClose={() => setShowDeleteModal(false)} footer={<div className={styles.dialogActions}>
              {access.canDo('SUPPLIER_DELETE') && <button
                type="button"
                className={styles.statusButton}
                onClick={() => setShowDeleteModal(false)}
                disabled={actionInProgress === 'delete' || !access.canDo('SUPPLIER_DELETE')} data-overlay-dismiss
              >
                Hủy
              </button>}
              {access.canDo('SUPPLIER_DELETE') && <button
                type="button"
                className={styles.deleteButton}
                onClick={() => {
                  setShowDeleteModal(false)
                  onDelete?.()
                }}
                disabled={actionInProgress === 'delete' || !access.canDo('SUPPLIER_DELETE')}
              >
                {actionInProgress === 'delete' ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>}
            </div>}>
            <div className={styles.dialogBody}>
              <p>
                Bạn có chắc chắn muốn xóa nhà cung cấp <strong>{supplier.supplierName}</strong>?
              </p>
              <p>
                Thao tác này chỉ thực hiện được khi nhà cung cấp chưa được liên kết với bất kỳ tour tham
                quan hay hợp đồng nào.
              </p
            >
            </div>
        </Modal>
      )}
    </div>
  )
}
