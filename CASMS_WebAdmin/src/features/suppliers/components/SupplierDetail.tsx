import { useState } from 'react'
import { Badge, Button, ButtonLink, Field, Modal, Notice, PageHeader, Panel, RecordFacts } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { supplierDateTime, supplierStatusLabels, supplierVerificationLabels, type SupplierListItem, type SupplierVerification } from '../model/supplier-list'
import type { SupplierVerificationRequest } from '../api/supplier-api'
import styles from './SupplierDetailPresentation.module.css'

type Props = {
  supplier: SupplierListItem
  embedded?: boolean
  actionInProgress?: string | null
  actionFeedback?: { type: 'success' | 'error'; message: string } | null
  onDismissFeedback?: () => void
  onToggleStatus?: () => void
  onVerify?: (request: SupplierVerificationRequest) => Promise<void>
  onDelete?: () => void
}
function formatVerifier(value?: string | null) {
  return !value || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? 'Người dùng hệ thống' : value
}
export function SupplierDetail({ supplier, embedded = false, actionInProgress = null, actionFeedback = null, onDismissFeedback, onToggleStatus, onVerify, onDelete }: Props) {
  const access = useSessionAccess()
  const [showVerifyModal, setShowVerifyModal] = useState(false), [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedVerification, setSelectedVerification] = useState<SupplierVerification>('VERIFIED'), [verificationNotes, setVerificationNotes] = useState('')
  const canActivate = supplier.verificationStatus === 'VERIFIED', verifying = actionInProgress === 'verify'
  const isStatusBusy = actionInProgress === 'activate' || actionInProgress === 'deactivate'
  async function handleConfirmVerify() {
    if (!onVerify || !access.canDo('SUPPLIER_VERIFY')) return
    try { await onVerify({ verificationStatus: selectedVerification, verificationNotes: verificationNotes.trim() || null }) } catch { return }
    setShowVerifyModal(false); setVerificationNotes('')
  }
  const actions = <div className={styles.actions}>
    {access.canDo('SUPPLIER_UPDATE') && <ButtonLink to={`/admin/suppliers/${supplier.id}/edit`}>Chỉnh sửa</ButtonLink>}
    {access.canDo('SUPPLIER_VERIFY') && <Button tone="secondary" disabled={actionInProgress !== null} onClick={() => setShowVerifyModal(true)}>Xác minh nhà cung cấp</Button>}
    {access.canDo('SUPPLIER_STATUS_CHANGE') && <Button tone="secondary" busy={isStatusBusy} disabled={supplier.status === 'INACTIVE' && !canActivate} onClick={onToggleStatus}>{supplier.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}</Button>}
    {access.canDo('SUPPLIER_DELETE') && <Button tone="danger" disabled={actionInProgress !== null} onClick={() => setShowDeleteModal(true)}>Xóa</Button>}
    <ButtonLink tone="secondary" to={`/admin/shore-excursions?supplierId=${supplier.id}`}>Các chuyến tham quan</ButtonLink>
  </div>
  return <div className={styles.stack}>
    {!embedded ? <PageHeader title={supplier.supplierName} breadcrumb="NHÀ CUNG CẤP" actions={actions} /> : actions}
    {actionFeedback && <Notice title={actionFeedback.type === 'error' ? 'Chưa thực hiện được' : 'Đã cập nhật'} tone={actionFeedback.type === 'error' ? 'error' : 'success'}>{actionFeedback.message}{onDismissFeedback && <Button tone="text" onClick={onDismissFeedback}>Đóng thông báo</Button>}</Notice>}
    <div className={styles.statuses}><Badge label={supplierStatusLabels[supplier.status]} tone={supplier.status === 'ACTIVE' ? 'success' : 'neutral'} /><Badge label={supplierVerificationLabels[supplier.verificationStatus]} tone={supplier.verificationStatus === 'VERIFIED' ? 'success' : supplier.verificationStatus === 'REJECTED' ? 'error' : 'warning'} /></div>
    <Panel title="Thông tin nhà cung cấp"><RecordFacts entries={[
      ['Loại đối tác', supplier.supplierType || 'Chưa phân loại'], ['Ghi chú', supplier.notes || 'Chưa có ghi chú'],
      ['Tên liên hệ', supplier.contactName || 'Chưa có tên liên hệ'], ['Email', supplier.contactEmail || 'Chưa có email'],
      ['Điện thoại', supplier.contactPhone || 'Chưa có số điện thoại'], ['Cập nhật', supplierDateTime(supplier.updatedAt)],
      ['Tạo lúc', supplierDateTime(supplier.createdAt)],
    ]} /></Panel>
    {(supplier.verificationStatus === 'VERIFIED' || supplier.verificationNotes) && <Panel title="Thông tin xác minh"><RecordFacts entries={[
      ...(supplier.verificationStatus === 'VERIFIED' ? [['Xác minh lúc', supplierDateTime(supplier.verifiedAt)] as const, ['Người xác minh', formatVerifier(supplier.verifiedBy)] as const] : []),
      ...(supplier.verificationNotes ? [['Ghi chú xác minh', supplier.verificationNotes] as const] : []),
    ]} /></Panel>}
    {showVerifyModal && access.canDo('SUPPLIER_VERIFY') && <Modal title="Xác minh nhà cung cấp" busy={verifying} onClose={() => { setShowVerifyModal(false); setVerificationNotes('') }} footer={<>
      <Button tone="secondary" data-overlay-dismiss disabled={verifying} onClick={() => { setShowVerifyModal(false); setVerificationNotes('') }}>Hủy</Button><Button busy={verifying} onClick={() => void handleConfirmVerify()}>Xác nhận</Button>
    </>}><div className={styles.stack}>
      <p>{supplier.supplierName}</p>
      <fieldset className={styles.verificationChoices} disabled={verifying}><legend>Kết quả *</legend>{(['VERIFIED', 'REJECTED'] as const).map(value => <label key={value}><input type="radio" name="verificationStatus" value={value} checked={selectedVerification === value} onChange={() => setSelectedVerification(value)} />{supplierVerificationLabels[value]}</label>)}</fieldset>
      <Field htmlFor="verificationNotesInput" label="Ghi chú xác minh"><textarea id="verificationNotesInput" maxLength={1000} disabled={verifying} value={verificationNotes} onChange={event => setVerificationNotes(event.target.value)} /></Field>
      {actionFeedback?.type === 'error' && <Notice title="Chưa xác minh được" tone="error">{actionFeedback.message}</Notice>}
    </div></Modal>}
    {showDeleteModal && access.canDo('SUPPLIER_DELETE') && <Modal title="Xác nhận xóa nhà cung cấp" busy={actionInProgress === 'delete'} protectChanges={false} onClose={() => setShowDeleteModal(false)} footer={<>
      <Button tone="secondary" disabled={actionInProgress === 'delete'} onClick={() => setShowDeleteModal(false)}>Hủy</Button><Button tone="danger" busy={actionInProgress === 'delete'} onClick={() => { setShowDeleteModal(false); onDelete?.() }}>Xác nhận xóa</Button>
    </>}><p>Bạn có chắc chắn muốn xóa nhà cung cấp <strong>{supplier.supplierName}</strong>?</p><p>Chỉ xóa được nhà cung cấp chưa được liên kết với tour tham quan hoặc hợp đồng.</p></Modal>}
  </div>
}
