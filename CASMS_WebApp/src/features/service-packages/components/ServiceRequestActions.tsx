import { useRef, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Modal, Notice, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import type { ServiceRequest } from '../model/catalog'

const labels = { assign: 'Nhận phân công cho tôi', accept: 'Tiếp nhận yêu cầu', reject: 'Từ chối yêu cầu', start: 'Bắt đầu thực hiện', complete: 'Hoàn thành yêu cầu', cancel: 'Hủy yêu cầu' }
type Action = keyof typeof labels
export function ServiceRequestActions({ request, onChanged }: { request: ServiceRequest; onChanged: () => void }) {
  const access = useSessionAccess()
  const [action, setAction] = useState<Action | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const ownAssignment = request.assignedUserId === access.userId
  const actions: Action[] = request.status === 'REQUESTED' ? ['assign', 'accept', 'reject', 'cancel'] : request.status === 'ACCEPTED' ? [...(ownAssignment ? ['start' as const] : []), 'cancel'] : request.status === 'IN_PROGRESS' && ownAssignment ? ['complete'] : []
  const allowed = (action: Action) => action === 'cancel' ? access.has('SERVICE_REQUEST_CREATE') : access.has('SERVICE_REQUEST_ASSIGN') || access.has('SERVICE_REQUEST_EXECUTE')
  async function confirm() {
    if (!action || !actions.includes(action) || !allowed(action) || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await servicePackageApi.requestAction(request.id, action); setAction(null); onChanged() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được yêu cầu.') }
    finally { lock.current = false; setBusy(false) }
  }
  if (!access.has('SERVICE_REQUEST_CREATE') && !access.has('SERVICE_REQUEST_ASSIGN') && !access.has('SERVICE_REQUEST_EXECUTE')) return null
  return <Panel title="Phân công và thực hiện">
    {request.status === 'REQUESTED' && (access.has('SERVICE_REQUEST_CREATE') || access.has('SERVICE_REQUEST_EXECUTE')) && <ButtonLink tone="secondary" to={`/admin/service-requests/${request.id}/edit`}>Sửa số lượng và ghi chú</ButtonLink>}
    {actions.filter(allowed).map(action => <Button key={action} tone={action === 'cancel' || action === 'reject' ? 'danger' : 'secondary'} disabled={busy || !allowed(action)} onClick={() => { setAction(action); setError('') }}>{labels[action]}</Button>)}
    {!ownAssignment && ['ACCEPTED', 'IN_PROGRESS'].includes(request.status) && <p>Chỉ người được phân công mới có thể bắt đầu hoặc hoàn thành yêu cầu.</p>}
    <p>Nhận phân công sử dụng tài khoản đang đăng nhập; chưa hỗ trợ chỉ định nhân viên khác.</p>
    {action && allowed(action) && <Modal title={labels[action]} busy={busy} onClose={() => setAction(null)}><p>Xác nhận {labels[action].toLocaleLowerCase('vi')} cho yêu cầu đang xem?</p>{error && <Notice tone="error" title="Không thực hiện được">{error}</Notice>}<Button disabled={busy || !allowed(action)} onClick={() => void confirm()}>Xác nhận</Button></Modal>}
  </Panel>
}
