import {ApiError,apiRequest} from '@/shared/api'
export const preparationCodes=['TECHNICAL_NAUTICAL','HOTEL_CABIN','ENTERTAINMENT_SHORE','SAFETY_CREW'] as const
export type PreparationAction='submit'|'confirm'|'return'
export type PreparationSection={sectionCode:string;sectionName:string;ownerRole:string;submitterRole:string;allowedActions:string[];status:'NOT_STARTED'|'IN_PROGRESS'|'SUBMITTED'|'CONFIRMED'|'RETURNED';revision:number;submittedByUserId:string|null;submittedAt:string|null;confirmedByUserId:string|null;confirmedAt:string|null;confirmedByUsername:string|null;returnedByUserId:string|null;returnedAt:string|null;evidence:string|null;returnReason:string|null;checkItems:{itemCode:string;ready:boolean;required:boolean;evidence?:string|null;details?:string|null}[]}
export type PreparationDashboard={cruiseId:string;coordinatorUserId:string|null;coordinatorUsername:string|null;cruiseRevision:number;canAssignCoordinator:boolean;sections:PreparationSection[]}
const root=(id:string)=>`/cruise/${encodeURIComponent(id)}/preparation`
export function decodePreparation(value:PreparationDashboard,id:string){
 if(!value||value.cruiseId!==id||!Number.isSafeInteger(value.cruiseRevision)||typeof value.canAssignCoordinator!=='boolean'||!Array.isArray(value.sections)||value.sections.length!==preparationCodes.length||new Set(value.sections.map(s=>s.sectionCode)).size!==preparationCodes.length||value.sections.some(s=>!preparationCodes.includes(s.sectionCode as typeof preparationCodes[number])||s.submitterRole!=='CRUISE_MANAGER'||!Number.isSafeInteger(s.revision)||!['NOT_STARTED','IN_PROGRESS','SUBMITTED','CONFIRMED','RETURNED'].includes(s.status)||!Array.isArray(s.allowedActions)||s.allowedActions.some(a=>!['SUBMIT','CONFIRM','RETURN'].includes(a))||!Array.isArray(s.checkItems)||s.checkItems.some(i=>typeof i.ready!=='boolean'||typeof i.required!=='boolean')))throw new ApiError('Phản hồi hồ sơ chuẩn bị thiếu hoặc sai dữ liệu bắt buộc. Không thể xác nhận trạng thái hồ sơ.',502,'PREPARATION_RESPONSE_INVALID')
 return value
}
export const preparationApi={
 async get(id:string,signal?:AbortSignal){return decodePreparation(await apiRequest<PreparationDashboard>(root(id),{signal}),id)},
 async submitDossier(id:string,evidence:string,actorId:string){
  if(!evidence.trim())throw new ApiError('Nhập nội dung hồ sơ chuẩn bị.',422,'PREPARATION_EVIDENCE_REQUIRED')
  let actual=await this.get(id)
  if(actual.coordinatorUserId!==actorId)throw new ApiError('',403,'PREPARATION_ACTION_FORBIDDEN')
  // Existing APIs persist each section. Reconcile after every response and skip completed submissions.
  for(const code of preparationCodes){
   const section=actual.sections.find(item=>item.sectionCode===code)!
   if(['SUBMITTED','CONFIRMED'].includes(section.status))continue
   if(!section.allowedActions.includes('SUBMIT'))throw new ApiError('',403,'PREPARATION_ACTION_FORBIDDEN')
   actual=await this.action(id,section,'submit',evidence)
  }
  if(actual.sections.some(section=>!['SUBMITTED','CONFIRMED'].includes(section.status)))throw new ApiError('',502)
  return actual
 },
 async action(id:string,section:PreparationSection,action:PreparationAction,text:string){
  if(!section.allowedActions.includes(action.toUpperCase()))throw new ApiError('',403,'PREPARATION_ACTION_FORBIDDEN')
  const saved=await apiRequest<PreparationSection>(`${root(id)}/${encodeURIComponent(section.sectionCode)}/${action}`,{method:'POST',body:{expectedRevision:section.revision,...(action==='submit'?{evidence:text}:action==='return'?{reason:text}:{notes:text})}})
  const readback=await this.get(id),actual=readback.sections.find(s=>s.sectionCode===section.sectionCode)
  const expected={submit:'SUBMITTED',confirm:'CONFIRMED',return:'RETURNED'}[action]
  if(saved.sectionCode!==section.sectionCode||saved.revision!==section.revision+1||saved.status!==expected||!actual||actual.revision!==saved.revision||actual.status!==saved.status||action==='submit'&&actual.evidence!==text||action==='return'&&actual.returnReason!==text)throw new ApiError('',502)
  return readback
 },
 async candidates(id:string,signal?:AbortSignal){
  const rows=await apiRequest<{id:string;name:string}[]>(root(id)+'/coordinator-candidates',{signal})
  if(!Array.isArray(rows)||rows.some(r=>typeof r.id!=='string'||!r.id||typeof r.name!=='string'||!r.name))throw new ApiError('',502)
  return rows
 },
 async assign(view:PreparationDashboard,userId:string){
  if(!view.canAssignCoordinator)throw new ApiError('',403)
  const saved=decodePreparation(await apiRequest<PreparationDashboard>(root(view.cruiseId)+'/coordinator',{method:'PUT',body:{coordinatorUserId:userId,expectedRevision:view.cruiseRevision}}),view.cruiseId)
  const actual=await this.get(view.cruiseId)
  if(actual.coordinatorUserId!==userId||saved.coordinatorUserId!==userId||actual.cruiseRevision!==saved.cruiseRevision)throw new ApiError('',502)
  return actual
 }
}
