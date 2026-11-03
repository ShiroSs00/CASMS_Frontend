import {ApiError,apiRequest} from '@/shared/api'

export type CruiseStaffAssignment={cruiseStaffId:string;cruiseId:string;userId:string;username:string;roleInCruise:string;status:string;assignedAt:string;assignedBy:string|null;assignedByName:string|null;endedAt:string|null;endedBy:string|null;endedByName:string|null;notes:string|null}
export type CruiseStaffOptions={roles:string[];users:{userId:string;username:string;allowedRoles:string[]}[]}
const root=(id:string)=>`/cruise/${encodeURIComponent(id)}/staff`
const object=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new ApiError('Chưa đọc được dữ liệu phân công.',502);return v as Record<string,unknown>}
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim())throw new ApiError('Dữ liệu phân công thiếu thông tin.',502);return v}
const id=(v:unknown)=>{const s=text(v);if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s))throw new ApiError('ID phân công chưa hợp lệ.',502);return s}
const instant=(v:unknown)=>{const s=text(v);if(!Number.isFinite(Date.parse(s)))throw new ApiError('Thời điểm phân công chưa hợp lệ.',502);return s}
const nullableText=(v:unknown)=>v==null?null:text(v)
function assignment(value:unknown,cruiseId:string):CruiseStaffAssignment {
  const r=object(value);if(r.cruiseId!==cruiseId)throw new ApiError('Phân công không thuộc chuyến đang xem.',502)
  return {cruiseStaffId:id(r.cruiseStaffId),cruiseId,userId:id(r.userId),username:text(r.username),roleInCruise:text(r.roleInCruise),status:text(r.status),assignedAt:instant(r.assignedAt),assignedBy:r.assignedBy==null?null:id(r.assignedBy),assignedByName:nullableText(r.assignedByName),endedAt:r.endedAt==null?null:instant(r.endedAt),endedBy:r.endedBy==null?null:id(r.endedBy),endedByName:nullableText(r.endedByName),notes:typeof r.notes==='string'?r.notes:null}
}
export const cruiseStaffApi={
  async list(cruiseId:string,signal?:AbortSignal){const value=await apiRequest<unknown>(root(cruiseId),{signal});if(!Array.isArray(value))throw new ApiError('Danh sách phân công chưa hợp lệ.',502);return value.map(v=>assignment(v,cruiseId))},
  async options(cruiseId:string,signal?:AbortSignal):Promise<CruiseStaffOptions>{const r=object(await apiRequest(root(cruiseId)+'/options',{signal}));if(!Array.isArray(r.roles)||!Array.isArray(r.users))throw new ApiError('Chưa đọc được vai trò và tài khoản được phép phân công.',502);const roles=r.roles.map(text);if(new Set(roles).size!==roles.length)throw new ApiError('Danh sách vai trò bị trùng.',502);return {roles,users:r.users.map(value=>{const u=object(value);if(!Array.isArray(u.allowedRoles)||u.allowedRoles.some(role=>!roles.includes(String(role))))throw new ApiError('Vai trò tài khoản không khớp contract phân công.',502);return{userId:id(u.userId),username:text(u.username),allowedRoles:u.allowedRoles.map(text)}})}},
  async assign(cruiseId:string,body:{userId:string;roleInCruise:string;notes:string}){const saved=assignment(await apiRequest(root(cruiseId),{method:'POST',body}),cruiseId);if(saved.userId!==body.userId||saved.roleInCruise!==body.roleInCruise||saved.status!=='ACTIVE')throw new ApiError('Chưa xác nhận đúng nhân sự và vai trò đã phân công.',502);const rows=await cruiseStaffApi.list(cruiseId);if(!rows.some(r=>r.cruiseStaffId===saved.cruiseStaffId&&r.userId===saved.userId&&r.roleInCruise===saved.roleInCruise&&r.status==='ACTIVE'))throw new ApiError('Chưa đối chiếu được assignment đã lưu.',502);return saved},
  async remove(cruiseId:string,assignmentId:string,userId:string){await apiRequest(root(cruiseId)+'/'+encodeURIComponent(userId),{method:'DELETE'});const rows=await cruiseStaffApi.list(cruiseId);const ended=rows.find(r=>r.cruiseStaffId===assignmentId);if(!ended||ended.status!=='CANCELLED'||!ended.endedAt)throw new ApiError('Chưa xác nhận được kết thúc assignment; cần tải lại lịch sử.',502);return 'Đã kết thúc phân công, lịch sử được giữ nguyên.'},
}
