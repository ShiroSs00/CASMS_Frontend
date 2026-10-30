import { apiRequest, ApiError } from '@/shared/api'
import type { CurrentTrip, CurrentVersion } from './current-contract'
import { tripView, versionView, contentRequest } from './mappers'
import { PlanningFault, type PlanningGateway } from './gateway'
import type { Report, Violation } from '../model/plan'
import { planningSources } from './catalogs'
import { supportedDuration } from '../model/duration'
import { businessErrorMessage } from '@/shared/api/business-errors'

const segment=encodeURIComponent
export function failure(error: unknown): PlanningFault {
  if (error instanceof PlanningFault) return error
  if (error instanceof ApiError) {
    const details=error.details as ({violations?:Violation[]}&Partial<Violation>)|Violation[]|undefined
    const rows:Violation[]=Array.isArray(details)?details:Array.isArray(details?.violations)?details.violations:details&&(typeof details.clientKey==='string'||typeof details.fieldPath==='string'||typeof details.dayNumber==='number')?[{...details,code:error.code??'REQUEST_FAILED',severity:'ERROR',message:error.message}]:[]
    return new PlanningFault(businessErrorMessage(error.code,error.message),error.status,error.code??'REQUEST_FAILED',rows.map(row=>({...row,message:businessErrorMessage(row.code,row.message)})))
  }
  return new PlanningFault(error instanceof Error?error.message:'Chưa thực hiện được yêu cầu.')
}
async function currentTrip(id:string,signal?:AbortSignal) {return tripView(await apiRequest<CurrentTrip>(`/trips/${segment(id)}`,{signal}))}
async function currentVersion(id:string,signal?:AbortSignal) {return versionView(await apiRequest<CurrentVersion>(`/trip-schedule-versions/${segment(id)}`,{signal}))}
export const liveGateway: PlanningGateway = {
  mode:'api',readOnly:false,supportsMiddleDayRemoval:true,supportsFullInfo:true,
  async list(page,status,signal,filters) {
    const result=await apiRequest<{content:CurrentTrip[];totalPages:number;totalElements:number}>('/trips',{query:{page,size:20,sort:'createdAt,tripId,desc',status:status||undefined,includeArchived:true,search:filters?.search.trim()||undefined,durationGroup:filters?.durationGroup||undefined,plannedScope:filters?.plannedScope||undefined},signal})
    if(!Array.isArray(result.content)||!Number.isSafeInteger(result.totalPages)||!Number.isSafeInteger(result.totalElements)) throw new PlanningFault('Chưa đọc được phân trang chuyến đi.',502)
    return {...result,content:result.content.map(tripView)}
  },
  getTrip:currentTrip,version:currentVersion,
  async saveInfo(info,key,previous) {
    if(previous&&info.durationBand!==previous.info.durationBand)throw new PlanningFault('Không đổi nhóm thời lượng của chuyến đang có qua biểu mẫu này: số ngày hiện có có thể không còn phù hợp. Hãy nhân bản hoặc tạo chuyến mới đúng thời lượng.',422,'DURATION_GROUP_CHANGE_PENDING')
    if(!supportedDuration(info.durationBand))throw new PlanningFault('Nhóm thời lượng này chưa được hỗ trợ.',422,'INVALID_DURATION_GROUP')
    const body={name:info.name.trim(),description:info.description,durationGroup:info.durationBand,plannedScope:info.scope,domesticRegions:info.regionIds,countryCodes:info.countryCodes}
    return tripView(await apiRequest<CurrentTrip>(previous?`/trips/${segment(previous.tripId)}/draft`:'/trips',{method:previous?'PATCH':'POST',idempotencyKey:previous?undefined:key,body:previous?{...body,expectedRevision:previous.revision}:body}))
  },
  async clone(id,sourceVersionId,key) {return tripView(await apiRequest<CurrentTrip>(`/trips/${segment(id)}/clone`,{method:'POST',idempotencyKey:key,query:{sourceVersionId}}))},
  async archive(id,revision,reason) {return tripView(await apiRequest<CurrentTrip>(`/trips/${segment(id)}/archive`,{method:'POST',body:{expectedRevision:revision,reason:reason?.trim()||undefined}}))},
  async createVersion(trip,sourceVersionId) {
    if(trip.versions?.some(v=>v.status==='DRAFT'||v.status==='IN_REVIEW')) throw new PlanningFault('Đã có phiên bản chưa hoàn tất. Mở phiên bản đó để tiếp tục.',409,'DUPLICATE_DRAFT_VERSION')
    return versionView(await apiRequest<CurrentVersion>(`/trips/${segment(trip.tripId)}/schedule-versions`,{method:'POST',body:sourceVersionId?{sourceVersionId}:{}}))
  },
  async save(version,content) {return versionView(await apiRequest<CurrentVersion>(`/trip-schedule-versions/${segment(version.versionId)}/content`,{method:'PUT',body:contentRequest(version,content)}))},
  async changeDay(trip,version,removeDay) {
    if(trip.structuralLockedAt||trip.versions?.some(v=>v.status==='PUBLISHED')) throw new PlanningFault('Khung chuyến có mẫu đã chốt nên không thể đổi số ngày. Hãy nhân bản chuyến.',422,'TRIP_DURATION_LOCKED')
    const result=await apiRequest<{trip:CurrentTrip;version:CurrentVersion}>(`/trip-schedule-versions/${segment(version.versionId)}/days/manage`,{method:'POST',body:{expectedTripRevision:trip.revision,expectedVersionRevision:version.revision,action:removeDay===undefined?'ADD':'REMOVE',...(removeDay===undefined?{}:{dayNumber:removeDay})}})
    return {trip:tripView(result.trip),version:versionView(result.version)}
  },
  sources:planningSources,
  async validate(version) {const report=await apiRequest<Report>(`/trip-schedule-versions/${segment(version.versionId)}/validate`,{method:'POST'});if(typeof report?.validForSubmit!=='boolean'||!Array.isArray(report.violations)||!Array.isArray(report.deferredChecks))throw new PlanningFault('Báo cáo kiểm tra chưa đúng định dạng.',502);return {...report,violations:report.violations.map(row=>({...row,message:businessErrorMessage(row.code,row.message)}))}},
  async action(version,action,reason) {
    if(action==='submit'||action==='publish'||action==='return') throw new PlanningFault('Mẫu chờ xử lý theo quy trình cũ',410,'TEMPLATE_REVIEW_RETIRED')
    const saved=versionView(await apiRequest<CurrentVersion>(`/trip-schedule-versions/${segment(version.versionId)}/${action}`,{method:'POST',body:{expectedRevision:version.revision,...(action==='withdraw'||action==='cancel'?{reason:reason?.trim()||undefined}:{})}}))
    const readback=await currentVersion(version.versionId)
    if(readback.versionId!==saved.versionId||readback.revision!==saved.revision||readback.status!==saved.status||(action==='finalize'&&readback.status!=='PUBLISHED'))throw new PlanningFault('Hệ thống chưa xác nhận được kết quả. Vui lòng kiểm tra lại trạng thái trước khi gửi tiếp.',502,'READBACK_MISMATCH')
    return readback
  },
  history:(id,signal)=>apiRequest(`/trip-schedule-versions/${segment(id)}/history`,{signal}),
  historyPage:async(id,scope,page,signal)=>readPage(await apiRequest(`/${scope==='trip'?'trips':'trip-schedule-versions'}/${segment(id)}/history`,{query:{page,size:20},signal})),
}
function readPage<T>(result:{content:T[];totalPages:number;totalElements:number}) {
  if(!Array.isArray(result?.content)||!Number.isSafeInteger(result.totalPages)||!Number.isSafeInteger(result.totalElements))throw new PlanningFault('Máy chủ chưa trả đúng dữ liệu phân trang.',502)
  return result
}
