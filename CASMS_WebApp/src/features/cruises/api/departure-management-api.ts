import {ApiError,apiRequest} from '@/shared/api'
import type {ChangeInput} from '../model/departure-contract'
import {cruiseApi} from './cruise-api'
import {departureApi} from './departure-api'
const root=(id:string)=>'/cruise/'+encodeURIComponent(id)
function record(value:unknown,id:string):Record<string,unknown>{if(!value||typeof value!=='object'||(value as Record<string,unknown>).cruiseId!==id)throw new ApiError('Phản hồi chưa khớp lần khởi hành. Đối chiếu dữ liệu đã lưu trước khi gửi lại.',502);return value as Record<string,unknown>}
export type PackageChoice={id:string;name:string;code:string;status:string}
export const departureManagementApi={
 async packageOptions(signal?:AbortSignal){const rows=await apiRequest<PackageChoice[]>('/servicepackage/packages',{signal});if(!Array.isArray(rows)||rows.some(v=>!v?.id||!v.name||typeof v.status!=='string'))throw new ApiError('Chưa đọc được danh mục gói.',502);return rows.filter(v=>v.status==='ACTIVE')},
 async assignPackage(id:string,packageId:string){const r=record(await apiRequest(root(id)+'/packages',{method:'POST',body:{tourPackageId:packageId}}),id);if(r.tourPackageId!==packageId)throw new ApiError('Phản hồi chưa khớp gói đã chọn. Đối chiếu trước khi gửi lại.',502);return 'Đã gán gói cho lần khởi hành.'},
 async removePackage(id:string,packageId:string){await apiRequest(root(id)+'/packages/'+encodeURIComponent(packageId),{method:'DELETE'});return 'Đã gỡ gói khỏi lần khởi hành.'},
 async removeStaff(id:string,userId:string){await apiRequest(root(id)+'/staff/'+encodeURIComponent(userId),{method:'DELETE'});return 'Đã gỡ phân công nhân sự.'},
 async sync(id:string){const r=await cruiseApi.syncPrograms(id);return `Hệ thống ghi nhận ${r.onboardActivitiesCount} hoạt động trên tàu và ${r.shoreExcursionsCount} tour trên bờ. ${r.warnings.join(' ')}`},
 async generateTasks(id:string,input:ChangeInput){const tasks=await departureApi.generateTasks(id,input);return `Đã ghi nhận ${tasks.length} công việc xử lý tác động.`},
 async resolveTask(id:string,taskId:string,notes:string,expectedRevision?:number){await departureApi.resolveTask(id,taskId,notes,expectedRevision);return 'Đã ghi nhận xử lý công việc.'},
 // Sale mutations remain unavailable until BE exposes dedicated OPS permissions.
 // CRUISE_PUBLISH / CRUISE_STATUS_CHANGE only establish the legacy contract, not sale authority.
}
