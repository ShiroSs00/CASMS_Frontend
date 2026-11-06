import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import { useCallback,useRef, useState } from 'react'
import {useReadQuery} from '@/shared/api'
import {OperationalCruisePackageEntitlement} from '@/domain/cruise-package'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Field,Modal, Notice, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import type { ServiceRequest } from '../model/catalog'

const labels = { assign: 'Nhận xử lý', accept: 'Tiếp nhận yêu cầu', reject: 'Từ chối yêu cầu', start: 'Bắt đầu thực hiện', complete: 'Hoàn thành yêu cầu', cancel: 'Hủy yêu cầu' }
type Action = keyof typeof labels
export function ServiceRequestActions({ request, onChanged }: { request: ServiceRequest; onChanged: () => void }) {
  const access = useSessionAccess()
  const [action, setAction] = useState<Action | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const before = useRef<{request:ServiceRequest;action:Action;fulfillment?:{fulfilledQuantity:number;unitCode:string}} | null>(null)
  const [fulfilledQuantity,setFulfilledQuantity]=useState(''),[needsReview,setNeedsReview]=useState(false)
  const entitlement=useReadQuery(`service-request-entitlement:${access.userId}:${request.id}:${request.status}:${request.fulfilledQuantity??''}`,useCallback(signal=>request.fareBenefitSnapshotId?servicePackageApi.requestEntitlement(request.id,signal):Promise.resolve(null),[request.id,request.fareBenefitSnapshotId]))
  const ownAssignment = request.assignedUserId === access.userId
  const actions: Action[] = request.status === 'REQUESTED' ? ['assign', 'accept', 'reject', 'cancel'] : request.status === 'ACCEPTED' ? [...(ownAssignment ? ['start' as const] : []), 'cancel'] : request.status === 'IN_PROGRESS' && ownAssignment ? ['complete'] : []
  const allowed = (action: Action) => {
    if (action === 'cancel') return access.canDo('SERVICE_REQUEST_CREATE')
    if ((action === 'accept' || action === 'reject') && !ownAssignment && !access.roles.includes('ACTIVITY_SERVICE_MANAGER')) return false
    return access.canDo('SERVICE_REQUEST_ASSIGN') || access.canDo('SERVICE_REQUEST_EXECUTE')
  }
  async function confirm() {
    if (!action || !actions.includes(action) || !allowed(action) || lock.current||needsReview) return
    let fulfillment: {fulfilledQuantity:number;unitCode:string}|undefined
    if(action==='complete'&&request.fareBenefitSnapshotId) {
      if(entitlement.loading||entitlement.error||!entitlement.data||entitlement.data.grantId!==request.fareBenefitSnapshotId||entitlement.data.bookingPassengerId!==request.bookingPassengerId){setError('Cần đối chiếu quyền lợi của đúng yêu cầu trước khi hoàn tất.');return}
      const actual=Number(fulfilledQuantity)
      if(!fulfilledQuantity||!Number.isSafeInteger(actual)||actual!==request.quantity||!request.fulfillmentUnitCode){setError('Xác nhận đã phục vụ đủ toàn bộ số lượng yêu cầu theo đúng đơn vị.');return}
      fulfillment={fulfilledQuantity:actual,unitCode:request.fulfillmentUnitCode}
    }
    before.current = {request,action,fulfillment}
    lock.current = true; setBusy(true); setError('')
    let actionSaved=false
    try {
      await servicePackageApi.requestAction(request.id, action,fulfillment)
      actionSaved=true
      if(fulfillment){
        const saved=await servicePackageApi.request(request.id)
        if(saved.status!=='COMPLETED'||saved.fulfilledQuantity!==fulfillment.fulfilledQuantity||saved.fulfillmentUnitCode!==fulfillment.unitCode)
          throw new Error('Chưa đối chiếu được số lượng và đơn vị đã ghi nhận.')
      }
      setAction(null);onChanged();entitlement.retry()
    }
    catch (reason) { setNeedsReview(actionSaved||mutationOutcomeUnknown(reason));setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được yêu cầu.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function reconcile(){
    if(lock.current)return
    lock.current=true;setBusy(true)
    try{
      const fresh=await servicePackageApi.request(request.id)
      if(fresh.id!==request.id)throw new Error('Phản hồi không đúng yêu cầu.')
      const operation=before.current
      const expected={accept:'ACCEPTED',reject:'REJECTED',start:'IN_PROGRESS',complete:'COMPLETED',cancel:'CANCELLED'}
      const confirmed=operation&&(operation.action==='assign'?fresh.assignedUserId===access.userId:fresh.status===expected[operation.action])&&(!operation.fulfillment||fresh.fulfilledQuantity===operation.fulfillment.fulfilledQuantity&&fresh.fulfillmentUnitCode===operation.fulfillment.unitCode)
      if(!confirmed){setError('Chưa thấy kết quả thay đổi được xác nhận. Không tự gửi lại thao tác; tiếp tục đối chiếu yêu cầu.');return}
      setNeedsReview(false);setAction(null);setError('');onChanged();entitlement.retry()
    }catch(reason){setError(reason instanceof Error?reason.message:'Chưa đối chiếu được yêu cầu.')}
    finally{lock.current=false;setBusy(false)}
  }
  if (!access.canDo('SERVICE_REQUEST_CREATE') && !access.canDo('SERVICE_REQUEST_ASSIGN') && !access.canDo('SERVICE_REQUEST_EXECUTE')) return null
  return <Panel title="Tiếp nhận và thực hiện">
    {entitlement.loading&&request.fareBenefitSnapshotId&&<p role="status">Đang đối chiếu quyền lợi…</p>}
    {entitlement.error&&<Notice title="Chưa đối chiếu được quyền lợi" tone="error"><p>{entitlement.error.message}</p><Button onClick={entitlement.retry}>Tải lại quyền lợi</Button></Notice>}
    {entitlement.data&&<OperationalCruisePackageEntitlement entitlement={entitlement.data}/>}
    {request.fareBenefitSnapshotId&&<p>Đã ghi nhận phục vụ: {request.fulfilledQuantity??'Chưa xác định'} {request.fulfillmentUnitCode??'Chưa có đơn vị nguồn'}. Giá tham chiếu danh mục: {request.unitPriceSnapshot??'Chưa xác định'} {request.currencySnapshot??''}.</p>}
    {needsReview&&<Notice title="Cần đối chiếu trước khi thao tác tiếp" tone="warning"><p>{error}</p><Button disabled={busy} onClick={()=>void reconcile()}>Đối chiếu kết quả đã lưu</Button></Notice>}
    {!needsReview && request.status === 'REQUESTED' && (access.canDo('SERVICE_REQUEST_CREATE') || (access.canDo('SERVICE_REQUEST_EXECUTE') && (ownAssignment || access.roles.includes('ACTIVITY_SERVICE_MANAGER')))) && <ButtonLink tone="secondary" to={`/admin/service-requests/${request.id}/edit`}>Sửa số lượng và ghi chú</ButtonLink>}
    {actions.filter(allowed).map(action => <Button key={action} tone={action === 'cancel' || action === 'reject' ? 'danger' : 'secondary'} disabled={busy || needsReview || !allowed(action)} onClick={() => { setAction(action); setError('') }}>{labels[action]}</Button>)}
    {!ownAssignment && ['ACCEPTED', 'IN_PROGRESS'].includes(request.status) && <p>Chỉ người được phân công mới có thể bắt đầu hoặc hoàn thành yêu cầu.</p>}
    <p>Nhận xử lý gắn yêu cầu với tài khoản của bạn. Chỉ bắt đầu hoặc hoàn thành yêu cầu đã được giao cho bạn.</p>
    {action && allowed(action) && <Modal title={labels[action]} busy={busy} onClose={() => setAction(null)}><p>Xác nhận {labels[action].toLocaleLowerCase('vi')} cho yêu cầu đang xem?</p>
      {action==='complete'&&request.fareBenefitSnapshotId&&<><Field htmlFor="service-actual-fulfilled" label={`Số lượng đã phục vụ thực tế (${request.fulfillmentUnitCode??'chưa có đơn vị'})`}><input id="service-actual-fulfilled" type="number" min={request.quantity} max={request.quantity} step="1" value={fulfilledQuantity} onChange={e=>setFulfilledQuantity(e.target.value)}/></Field><p>Chỉ xác nhận hoàn tất khi đã phục vụ đủ toàn bộ số lượng yêu cầu.</p></>}
      {error && <Notice tone="error" title="Không thực hiện được">{error}</Notice>}<Button disabled={busy || needsReview || !allowed(action)} onClick={() => void confirm()}>{labels[action]}</Button></Modal>}
  </Panel>
}
