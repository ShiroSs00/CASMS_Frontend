import {CruiseStaffAssignments} from './CruiseStaffAssignments'
import { CruisePassengerManifest } from '@/domain/cruise-manifest'
import { journeyTime } from '@/shared/lib/journey-time'
import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import {businessCopy,domainStatus} from '@/shared/i18n/business-copy'
import {guidanceAttendanceApi,type GuidanceAttendanceAction} from '../api/guidance-attendance-api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
function State({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) { return loading ? <Loading /> : error ? <Notice title={error instanceof ApiError&&error.status===403?'Chưa có quyền xem':'Chưa tải được'} tone="error">{error.message}<Button onClick={retry}>Thử lại</Button></Notice> : null }
export function CruiseOperations({ cruiseId, view='all', onChanged }: { cruiseId: string; view?: 'all'|'staff'|'guests'|'guidance'; onChanged?:()=>void }) {
  const access=useSessionAccess(),canManifest=(view==='all'||view==='guests')&&access.canDo('CRUISE_MANIFEST_READ')
  return <>
    {(view==='all'||view==='staff')&&<CruiseStaffAssignments cruiseId={cruiseId} onChanged={onChanged}/>}
    {canManifest && <CruisePassengerManifest cruiseId={cruiseId}/>}
    {(view==='all'||view==='guidance') && access.can({mode:'ANY',permissions:['CHECKIN_READ','CHECKIN_CREATE','CHECKIN_UPDATE']}) && <Guidance key={cruiseId} cruiseId={cruiseId} />}
  </>
}

function Guidance({ cruiseId }: { cruiseId: string }) {
  const access=useSessionAccess(),canUpdate=access.canDo('CHECKIN_UPDATE')
  const sessions=useReadQuery(`guidance:${cruiseId}`,useCallback(signal=>guidanceAttendanceApi.sessions(cruiseId,signal),[cruiseId]))
  const [selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[uncertain,setUncertain]=useState(false)
  const [confirm,setConfirm]=useState<{sessionId:string;action:GuidanceAttendanceAction;label:string}|null>(null),lock=useRef(false)
  const current=sessions.data?.find(row=>row.guidanceSessionId===selected)
  const participants=useReadQuery(`guidance-participants:${selected}:${canUpdate}:${current?.status??''}`,useCallback(signal=>current&&canUpdate?guidanceAttendanceApi.participants(current.guidanceSessionId,signal):Promise.resolve([]),[current,canUpdate]))
  const live=current?.status==='Scheduled'||current?.status==='Published'
  const blocked=busy||uncertain||!canUpdate||sessions.loading||Boolean(sessions.error)||!current||!live
  const statusKeys={Scheduled:'SCHEDULED',Published:'PUBLISHED',Completed:'COMPLETED',Cancelled:'CANCELLED'} as const
  const attendanceLabels={Registered:'Đã ghi danh',Attended:'Đã tham gia',Absent:'Vắng mặt'} as const
  async function mutate(){
    if(!confirm||confirm.sessionId!==selected||blocked||lock.current||confirm.action.kind==='complete'&&current?.status!=='Published')return
    const operation=confirm.action
    if(operation.kind==='attendance'&&(participants.loading||participants.error||!participants.data?.some(row=>row.bookingPassengerId===operation.bookingPassengerId)))return
    lock.current=true;setBusy(true);setError('');setSuccess('')
    try{
      await guidanceAttendanceApi.execute(cruiseId,confirm.sessionId,confirm.action)
      setSuccess(confirm.label);setConfirm(null);sessions.retry();participants.retry()
    }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,reason instanceof Error?reason.message:''));if(mutationOutcomeUnknown(reason))setUncertain(true)}
    finally{lock.current=false;setBusy(false)}
  }
  return <Panel title="Hướng dẫn an toàn & điểm danh"><State {...sessions}/>
    {error&&!confirm&&<Notice title="Chưa cập nhật được" tone="error">{error}</Notice>}
    {success&&<Notice title="Đã đối chiếu kết quả" tone="success">{success}</Notice>}
    {uncertain&&<Notice title="Chưa xác định được kết quả">Tải lại trang và đối chiếu buổi hướng dẫn trước khi thao tác tiếp. Không gửi lại yêu cầu khi chưa xác định kết quả.</Notice>}
    <Field htmlFor="guidance-session" label="Buổi hướng dẫn"><select id="guidance-session" value={selected} disabled={busy||sessions.loading||Boolean(sessions.error)} onChange={e=>{setSelected(e.target.value);setConfirm(null);setError('');setSuccess('')}}><option value="">Chọn buổi</option>{sessions.data?.map(row=><option key={row.guidanceSessionId} value={row.guidanceSessionId}>{row.sessionName} — {journeyTime(row.startAt)} — {domainStatus('guidance',statusKeys[row.status])}</option>)}</select></Field>
    {!sessions.loading&&!sessions.error&&sessions.data?.length===0&&<Empty title="Chưa có buổi hướng dẫn của chuyến"/>}
    {current&&<p>{current.attendedCount} / {current.totalParticipants} hành khách đã tham gia.</p>}
    {selected&&canUpdate&&<><State {...participants}/>
      <Button disabled={blocked} onClick={()=>setConfirm({sessionId:selected,action:{kind:'populate'},label:'Ghi danh hành khách của chuyến vào buổi hướng dẫn'})}>Ghi danh hành khách</Button>
      {!participants.loading&&!participants.error&&participants.data&&(participants.data.length?<DataTable label="Điểm danh an toàn" headers={['Khách','Trạng thái','Thao tác']}>{participants.data.map(person=><tr key={person.bookingPassengerId}><td>{person.passengerFullName}</td><td>{attendanceLabels[person.attendanceStatus]}</td><td>{(['Attended','Absent'] as const).map(status=><Button key={status} tone="secondary" disabled={blocked||person.attendanceStatus===status} onClick={()=>setConfirm({sessionId:selected,action:{kind:'attendance',bookingPassengerId:person.bookingPassengerId,attendanceStatus:status},label:`${person.passengerFullName}: ${attendanceLabels[status]}`})}>{status==='Attended'?'Có mặt':'Vắng'}</Button>)}</td></tr>)}</DataTable>:<Empty title="Chưa có hành khách được ghi danh"/>)}
      {current?.status==='Published'&&<Button disabled={blocked} onClick={()=>setConfirm({sessionId:selected,action:{kind:'complete'},label:'Hoàn tất buổi hướng dẫn an toàn'})}>Hoàn tất buổi hướng dẫn</Button>}
      {current?.status==='Scheduled'&&<p>Buổi hướng dẫn cần được công bố trước khi hoàn tất.</p>}
    </>}
    <Notice title={businessCopy('guidance.title')}>{businessCopy('guidance.legacyCreateRetired')}</Notice>
    {confirm&&<Modal title="Xác nhận cập nhật" busy={busy} onClose={()=>{if(!busy)setConfirm(null)}}><p>{confirm.label}</p>{error&&<Notice title="Chưa cập nhật được" tone="error">{error}</Notice>}<Button disabled={blocked||confirm.action.kind==='complete'&&current?.status!=='Published'} onClick={()=>void mutate()}>{confirm.label}</Button></Modal>}
  </Panel>
}

