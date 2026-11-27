import { useCallback, useEffect, useState } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Field, Modal, Notice, useFormChanges } from '@/shared/ui'
import { useCruisePackageMutation } from './useCruisePackageMutation'
import type { ResourceType } from './api'
import styles from './TemplateWorkspace.module.css'

/** Reuses Activity/Excursion entities; no real voyage times/capacity are fabricated. */
export function SourceDefinitionEditor({ type, onCreated, onPendingChange, onOpenChange }: { type: ResourceType; onPendingChange?: (pending: boolean) => void; onOpenChange?: (open: boolean) => void; onCreated: (id: string, name: string) => void }) {
  const access = useSessionAccess()
  const [open, setOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [supplier, setSupplier] = useState('')
  const [meetingPoint, setMeetingPoint] = useState('')
  const permitted = access.roles.includes('ACTIVITY_SERVICE_MANAGER') && access.canDo(type === 'ACTIVITY' ? 'ACTIVITY_CREATE' : 'EXCURSION_CREATE')
  const canReadSupplier = access.has('SUPPLIER_READ')
  const pending = Boolean(name || description || supplier || meetingPoint)
  useEffect(() => { onPendingChange?.(pending); return () => onPendingChange?.(false) }, [onPendingChange, pending])
  useEffect(() => { onOpenChange?.(open); return () => onOpenChange?.(false) }, [onOpenChange, open])
  const suppliers = useReadQuery(`shared-source-suppliers:${access.userId}:${open}:${type}`, useCallback(signal => open && type === 'EXCURSION' && canReadSupplier ? apiRequest<{ supplierId: string; supplierName: string; status: string; verificationStatus: string }[]>('/suppliers', { signal }) : Promise.resolve([]), [open, type, canReadSupplier]))
  const mutation = useCruisePackageMutation(() => {})
  useFormChanges(Boolean(name || description || supplier || meetingPoint), mutation.busy)
  if (!permitted || type === 'SERVICE') return null
  function discardAndClose() {
    setName('')
    setDescription('')
    setSupplier('')
    setMeetingPoint('')
    setConfirmDiscard(false)
    setOpen(false)
  }
  async function create() {
    if (!name.trim() || type === 'EXCURSION' && (!supplier || !meetingPoint.trim())) return
    await mutation.run(async () => {
      const saved = await apiRequest<{ id: string; name: string }>(type === 'ACTIVITY' ? '/activities/definitions' : '/shore-excursions/definitions', { method: 'POST', body: type === 'ACTIVITY' ? { name: name.trim(), description } : { name: name.trim(), supplierId: supplier, meetingPoint: meetingPoint.trim() } })
      if (!saved.id || saved.name !== name.trim()) throw new Error('Chưa đối chiếu được nội dung nguồn vừa tạo. Không gửi lại trước khi kiểm tra danh mục.')
      onCreated(saved.id, saved.name); setName(''); setDescription(''); setSupplier(''); setMeetingPoint(''); setOpen(false)
    }, 'Đã tạo nội dung dùng chung; chưa tạo lịch phục vụ trên chuyến.')
  }
  return <div>{mutation.feedback}{!open && <Button tone="text" disabled={mutation.busy || mutation.needsReview} aria-expanded={open} onClick={() => setOpen(true)}>Tạo nội dung dùng chung</Button>}
    {open && <fieldset disabled={mutation.busy || mutation.needsReview} className={styles.sourceFields}><legend>Tạo nội dung dùng chung</legend>
      <Field htmlFor="definition-name" label="Tên nội dung *"><input id="definition-name" maxLength={type === 'ACTIVITY' ? 200 : 250} value={name} onChange={e => setName(e.target.value)} /></Field>
      {type === 'ACTIVITY' ? <Field htmlFor="definition-description" label="Mô tả"><textarea id="definition-description" maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} /></Field> : <>
        <Field htmlFor="definition-supplier" label="Nhà cung cấp đã xác minh *"><select id="definition-supplier" disabled={suppliers.loading || Boolean(suppliers.error)} value={supplier} onChange={e => setSupplier(e.target.value)}><option value="">Chọn nhà cung cấp</option>{suppliers.data?.filter(s => s.status === 'ACTIVE' && s.verificationStatus === 'VERIFIED').map(s => <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>)}</select>{suppliers.error && <Notice title="Chưa tải được nhà cung cấp" tone="error"><p>{suppliers.error.message}</p><Button onClick={suppliers.retry}>Tải lại</Button></Notice>}</Field>
        <Field htmlFor="definition-meeting" label="Điểm tập trung theo nội dung tour *"><input id="definition-meeting" maxLength={250} value={meetingPoint} onChange={e => setMeetingPoint(e.target.value)} /></Field>
      </>}
      <p>Đây là nội dung dùng chung. Ngày giờ, địa điểm trên tàu và sức chứa sẽ được cấu hình khi lập lần phục vụ thực tế.</p>
      {type === 'ACTIVITY' && <p>Hoạt động tạo tại đây chưa có sức chứa. Bổ sung sức chứa trong danh mục hoặc nhập khi lập lịch cho chuyến.</p>}
      {type === 'ACTIVITY' && access.canDo('ACTIVITY_READ') && <ButtonLink tone="secondary" to="/admin/activities">Mở danh mục hoạt động</ButtonLink>}
      <Button tone="secondary" disabled={!name.trim() || type === 'EXCURSION' && (!supplier || !meetingPoint.trim())} onClick={() => void create()}>Tạo và chọn nội dung</Button>
      <Button tone="text" onClick={() => { if (pending) setConfirmDiscard(true); else discardAndClose() }}>Hủy tạo nội dung</Button>
    </fieldset>}
    {confirmDiscard && (
      <Modal
        title="Bỏ nội dung nguồn đang nhập?"
        protectChanges={false}
        onClose={() => setConfirmDiscard(false)}
        footer={
          <>
            <Button tone="secondary" data-overlay-dismiss onClick={() => setConfirmDiscard(false)}>Tiếp tục nhập</Button>
            <Button tone="danger" onClick={discardAndClose}>Bỏ nội dung đang nhập</Button>
          </>
        }
      >
        <p>Thông tin nội dung dùng chung bạn vừa nhập sẽ không được lưu.</p>
      </Modal>
    )}
  </div>
}
