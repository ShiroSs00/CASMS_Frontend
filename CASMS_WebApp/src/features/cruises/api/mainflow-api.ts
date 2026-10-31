import { ApiError, apiRequest } from '@/shared/api'
import {preparationApi, type PreparationDashboard} from './preparation-api'
export type DossierSubmission={preparationEvidence:string;preparationRevisions:Record<string,number>;pendingPreparationCodes:string[]}
export type MainflowAction='submit'|'withdraw'|'approve'|'reject'|'request-revision'|'ready'
export type ProgramIssue={code:string;kind:'ACTIVITY'|'EXCURSION';itemId:string;name:string;startsAt:string|null;endsAt:string|null;earliestStart:string|null;latestEnd:string|null;timeZoneId:string|null}
export type PlanView={cruiseId:string;revision:number;submittedRevision:number|null;cruiseCode:string;submittedByName:string|null;planStatus:'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'|'REVISION_REQUESTED'|'WITHDRAWN';submittedBy:string|null;submittedAt:string|null;reviewedBy:string|null;reviewedAt:string|null;reason:string|null;submittedSnapshot:unknown;fingerprint:string;readyStatus:'NOT_READY'|'READY'|'INVALIDATED';readyBy:string|null;readyAt:string|null;programIssues?:ProgramIssue[];planBlockers:string[];readyBlockers:string[];allowedActions:string[];windows:{expectedRevision:number;bookingOpensAt:string|null;bookingClosesAt:string|null;guidanceOpensAt:string|null;guidanceClosesAt:string|null}}
const path=(id:string)=>`/cruise-plans/${encodeURIComponent(id)}`
export function decodePlan(value:PlanView,id:string):PlanView{
 if(!value||value.cruiseId!==id||!Number.isSafeInteger(value.revision)||!['DRAFT','SUBMITTED','APPROVED','REJECTED','REVISION_REQUESTED','WITHDRAWN'].includes(value.planStatus)||!['NOT_READY','READY','INVALIDATED'].includes(value.readyStatus)||!Array.isArray(value.allowedActions)||!Array.isArray(value.planBlockers)||!Array.isArray(value.readyBlockers)||typeof value.fingerprint!=='string'||!value.windows)throw new ApiError('Không thể hoàn tất thao tác. Vui lòng tải lại và thử lại.',502)
 if(value.programIssues!==undefined){
  if(!Array.isArray(value.programIssues))throw new ApiError('Chưa đọc được chi tiết lỗi chương trình.',502)
  for(const issue of value.programIssues){
   const datesValid=issue&&[issue.startsAt,issue.endsAt,issue.earliestStart,issue.latestEnd].every(t=>t===null||typeof t==='string'&&Number.isFinite(Date.parse(t)))
   if(!issue||typeof issue.code!=='string'||!['ACTIVITY','EXCURSION'].includes(issue.kind)||typeof issue.itemId!=='string'||!issue.itemId||typeof issue.name!=='string'||issue.timeZoneId!==null&&typeof issue.timeZoneId!=='string'||!datesValid)throw new ApiError('Chưa đọc được chi tiết lỗi chương trình.',502)
  }
 }
 return value
}
export const mainflowApi={
 async get(id:string,signal?:AbortSignal){return decodePlan(await apiRequest<PlanView>(path(id),{signal}),id)},
 async queue(signal?:AbortSignal){const rows=await apiRequest<PlanView[]>('/cruise-plans',{signal});return rows.map(row=>decodePlan(row,row.cruiseId))},
 async action(view:PlanView,action:MainflowAction,reason:string,dossier?:DossierSubmission){
  if(action==='submit'&&!dossier)throw new ApiError('Tải lại hồ sơ trước khi gửi.',422,'PREPARATION_REVISIONS_REQUIRED')
  const saved=decodePlan(await apiRequest<PlanView>(`${path(view.cruiseId)}/${action}`,{method:'POST',body:{expectedRevision:view.revision,reason,fingerprint:view.fingerprint,...(action==='submit'&&dossier?{preparationEvidence:dossier.preparationEvidence,preparationRevisions:dossier.preparationRevisions}:{})}}),view.cruiseId)
  let readback:PlanView
  try{readback=await this.get(view.cruiseId)}catch{throw new ApiError('Chưa đối chiếu được kết quả. Tải lại hồ sơ trước khi tiếp tục.',502)}
  if(readback.revision!==saved.revision||readback.planStatus!==saved.planStatus||readback.readyStatus!==saved.readyStatus)throw new ApiError('Hệ thống chưa xác nhận được kết quả. Vui lòng kiểm tra lại trạng thái trước khi gửi tiếp.',502)
  if(action==='submit'&&dossier){
   let preparation:PreparationDashboard
   try{preparation=await preparationApi.get(view.cruiseId)}catch{throw new ApiError('Chưa đối chiếu được kết quả gửi hồ sơ. Tải lại dữ liệu trước khi tiếp tục.',502)}
   if(preparation.sections.some(section=>!['SUBMITTED','CONFIRMED'].includes(section.status)||section.revision<dossier.preparationRevisions[section.sectionCode]+(dossier.pendingPreparationCodes.includes(section.sectionCode)?1:0)||dossier.pendingPreparationCodes.includes(section.sectionCode)&&section.evidence!==dossier.preparationEvidence))throw new ApiError('Kết quả hồ sơ đã thay đổi. Đối chiếu lại trước khi gửi tiếp.',502)
  }
  return readback
 },
 async windows(view:PlanView,windows:PlanView['windows']){
  const saved=decodePlan(await apiRequest<PlanView>(path(view.cruiseId)+'/windows',{method:'PUT',body:windows}),view.cruiseId),actual=await this.get(view.cruiseId)
  if(actual.windows.expectedRevision!==saved.windows.expectedRevision||(['bookingOpensAt','bookingClosesAt','guidanceOpensAt','guidanceClosesAt'] as const).some(key=>{
   const expected=windows[key],value=actual.windows[key]
   return expected==null?value!=null:value==null||Date.parse(value)!==Date.parse(expected)
  }))throw new ApiError('',502)
  return actual
 }
}
