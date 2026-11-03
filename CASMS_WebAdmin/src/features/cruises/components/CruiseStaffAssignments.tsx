import {useCallback,useRef,useState,type FormEvent} from 'react'
import {ApiError,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import {journeyTime} from '@/shared/lib/journey-time'
import {Button,DataTable,Empty,Field,Loading,Notice,Panel,UnsavedForms,useFormChanges} from '@/shared/ui'
import {cruiseStaffApi} from '../api/cruise-staff-api'
import {operationsStaffRole,operationsStaffStatus} from '../model/operations-workflow'
import {DepartureCommand} from './DepartureCommand'
import styles from './Cruises.module.css'

function StaffAssignmentsWorkspace({cruiseId,onChanged}:{cruiseId:string;onChanged?:()=>void}){
  const access=useSessionAccess(),canRead=access.canDo('CRUISE_STAFF_READ'),manager=access.roles.includes('OPERATIONS_MANAGER')
  const canAssign=manager&&access.canDo('CRUISE_STAFF_ASSIGN'),canRemove=manager&&access.canDo('CRUISE_STAFF_REMOVE')
  const list=useReadQuery(`cruise-staff:${cruiseId}:${canRead}`,useCallback(signal=>canRead?cruiseStaffApi.list(cruiseId,signal):Promise.resolve([]),[cruiseId,canRead]))
  const options=useReadQuery(`cruise-staff-options:${cruiseId}:${canAssign}`,useCallback(signal=>canAssign?cruiseStaffApi.options(cruiseId,signal):Promise.resolve(null),[cruiseId,canAssign]))
  const [userId,setUserId]=useState(''),[role,setRole]=useState(''),[notes,setNotes]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false)
  const lock=useRef(false),selected=options.data?.users.find(u=>u.userId===userId)
  useFormChanges(Boolean(userId||role||notes),busy)
  const refresh=()=>{list.retry();options.retry();onChanged?.()}
  async function assign(e:FormEvent){
    e.preventDefault();if(lock.current||uncertain||!canAssign||list.loading||list.error||options.loading||options.error||!selected?.allowedRoles.includes(role)||list.data?.some(r=>r.userId===userId&&r.status==='ACTIVE'))return
    lock.current=true;setBusy(true);setError('');setSuccess('')
    try{await cruiseStaffApi.assign(cruiseId,{userId,roleInCruise:role,notes});setSuccess('Đã phân công nhân sự cho chuyến khởi hành. Hồ sơ chuẩn bị và điều kiện sẵn sàng cần đối chiếu lại.');setUserId('');setRole('');setNotes('');refresh()}
    catch(reason){if(mutationOutcomeUnknown(reason))setUncertain(true);setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,reason instanceof Error?reason.message:''))}
    finally{lock.current=false;setBusy(false)}
  }
  if(!canRead)return <Notice title="Chưa có quyền xem nhân sự chuyến khởi hành">Không thể kết luận chuyến chưa có nhân sự khi chưa đọc được dữ liệu.</Notice>
  return <Panel title="Nhân sự chuyến khởi hành"><Button tone="secondary" disabled={busy} onClick={refresh}>Đối chiếu danh sách</Button>
    {list.loading&&<Loading/>}{list.error&&<Notice title="Chưa tải được phân công" tone="error">{list.error.message}<Button onClick={list.retry}>Tải lại</Button></Notice>}
    {!list.loading&&!list.error&&list.data?.length===0&&<Empty title="Chưa có lịch sử phân công nhân sự"/>}
    {!list.loading&&!list.error&&Boolean(list.data?.length)&&<DataTable label="Phân công và lịch sử nhân sự" headers={['Nhân sự','Vai trò trên chuyến','Trạng thái','Phân công','Kết thúc','Thao tác']}>
      {list.data?.map(row=><tr key={row.cruiseStaffId}><td>{row.username}{row.notes&&<p>{row.notes}</p>}</td><td>{operationsStaffRole(row.roleInCruise)}</td><td>{operationsStaffStatus(row.status)}</td><td>{journeyTime(row.assignedAt)}<p>{row.assignedByName??'Chưa có thông tin người phân công'}</p></td><td>{row.endedAt?<>{journeyTime(row.endedAt)}<p>{row.endedByName??'Chưa có thông tin người kết thúc'}</p></>:'Chưa ghi nhận kết thúc'}</td><td>{row.status==='ACTIVE'&&canRemove&&<DepartureCommand label="Kết thúc phân công" tone="danger" permissions={['CRUISE_STAFF_REMOVE']} disabled={busy} run={()=>cruiseStaffApi.remove(cruiseId,row.cruiseStaffId,row.userId)} onChanged={refresh} explanation={`Kết thúc phân công ${row.username} trên chuyến này. Lịch sử phân công được giữ nguyên; hồ sơ chuẩn bị được đánh giá lại.`}/>}</td></tr>)}
    </DataTable>}
    {canAssign&&<form className={styles.operationForm} onSubmit={assign}>
      {options.loading&&<Loading label="Đang đối chiếu tài khoản và vai trò…"/>}{options.error&&<Notice title="Chưa tải được dữ liệu phân công" tone="error">{options.error.message}<Button onClick={options.retry}>Tải lại lựa chọn</Button></Notice>}
      <Field htmlFor="cruise-staff-user" label="Nhân viên"><select id="cruise-staff-user" required disabled={busy||uncertain||options.loading||Boolean(options.error)} value={userId} onChange={e=>{setUserId(e.target.value);setRole('')}}><option value="">Chọn tài khoản đủ điều kiện</option>{options.data?.users.filter(u=>!list.data?.some(r=>r.userId===u.userId&&r.status==='ACTIVE')).map(u=><option key={u.userId} value={u.userId}>{u.username}</option>)}</select></Field>
      <Field htmlFor="cruise-staff-role" label="Vai trò trên chuyến"><select id="cruise-staff-role" required disabled={!selected||busy||uncertain||options.loading} value={role} onChange={e=>setRole(e.target.value)}><option value="">Chọn vai trò được hỗ trợ</option>{selected?.allowedRoles.map(value=><option key={value} value={value}>{operationsStaffRole(value)}</option>)}</select></Field>
      <Field htmlFor="cruise-staff-notes" label="Ghi chú phân công"><textarea id="cruise-staff-notes" value={notes} disabled={busy||uncertain} onChange={e=>setNotes(e.target.value)}/></Field>
      <Button type="submit" disabled={busy||uncertain||list.loading||Boolean(list.error)||options.loading||Boolean(options.error)||!selected?.allowedRoles.includes(role)}>Phân công nhân viên</Button>
      <p>Trạng thái tài khoản, vai trò và lịch trùng được kiểm tra khi lưu. Phân công không cấp thêm quyền hệ thống và không xác nhận đủ nhân sự cho mọi khung phục vụ.</p>
    </form>}
    {error&&<Notice title="Chưa phân công được" tone="error">{error}</Notice>}{success&&<Notice title="Đã lưu phân công" tone="success">{success}</Notice>}
    {uncertain&&<Notice title="Chưa xác định kết quả phân công">Đối chiếu danh sách đã lưu trước khi tạo yêu cầu mới. Biểu mẫu gửi lại đang khóa.<Button onClick={refresh}>Tải lại để đối chiếu</Button></Notice>}
  </Panel>
}
export function CruiseStaffAssignments(props:{cruiseId:string;onChanged?:()=>void}){return <UnsavedForms><StaffAssignmentsWorkspace {...props}/></UnsavedForms>}


