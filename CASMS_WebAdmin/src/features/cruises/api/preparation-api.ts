import {ApiError,apiRequest} from '@/shared/api'
export const preparationCodes=['TECHNICAL_NAUTICAL','HOTEL_CABIN','ENTERTAINMENT_SHORE','SAFETY_CREW'] as const
export type PreparationAction='submit'|'confirm'|'return'|'reject'
export const preparationStatuses=['NOT_STARTED','IN_PROGRESS','SUBMITTED','CONFIRMED','RETURNED','REJECTED','STALE'] as const
export type PreparationStatus=typeof preparationStatuses[number]
export const preparationStatusLabels: Record<PreparationStatus,string> = {
 NOT_STARTED:'Chưa gửi xét duyệt', IN_PROGRESS:'Đang chuẩn bị', SUBMITTED:'Chờ Vận hành xét duyệt',
 CONFIRMED:'Đã xác nhận', RETURNED:'Cần bổ sung', REJECTED:'Đã từ chối', STALE:'Cần đối chiếu lại',
}
const dataReadinessValues = ['READY', 'INCOMPLETE'] as const
const submissionValues = ['NOT_SUBMITTED', 'SUBMITTED'] as const
const approvalValues = ['NOT_REVIEWED', 'PENDING', 'CONFIRMED', 'RETURNED', 'REJECTED', 'STALE'] as const
export const preparationApprovalLabels: Record<typeof approvalValues[number], string> = {
 NOT_REVIEWED: 'Chưa xét duyệt', PENDING: 'Chờ xét duyệt', CONFIRMED: 'Đã xác nhận',
 RETURNED: 'Cần bổ sung', REJECTED: 'Đã từ chối', STALE: 'Cần đối chiếu lại',
}
export type PreparationSection={sectionCode:string;sectionName:string;ownerRole:string;submitterRole:string;allowedActions:string[];status:PreparationStatus;revision:number;submittedByUserId:string|null;submittedAt:string|null;confirmedByUserId:string|null;confirmedAt:string|null;confirmedByUsername:string|null;returnedByUserId:string|null;returnedAt:string|null;evidence:string|null;returnReason:string|null;checkItems:{itemCode:string;ready:boolean;required:boolean;evidence?:string|null;details?:string|null}[]
 submissionBlockReason?: string | null
 dataReadiness: typeof dataReadinessValues[number]
 submissionStatus: typeof submissionValues[number]
 approvalStatus: typeof approvalValues[number]
 submittedRevision: number | null
 missingRequiredCheckCodes: string[]
}
export type PreparationDashboard={cruiseId:string;coordinatorUserId:string|null;coordinatorUsername:string|null;cruiseRevision:number;canAssignCoordinator:boolean;operatingBudgetVnd?:string|null;sections:PreparationSection[]}
export type OperatingBudget={revision:number;amountVnd:string|null;canEdit:boolean;reviewRevision:number;status:'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED';rejectionReason:string|null}
export function operatingBudgetInput(input: string) {
 const text = input.trim()
 const digits = /^[1-9][0-9]{0,2}(\.[0-9]{3})+$/.test(text) ? text.replaceAll('.', '') : text
 return /^[1-9][0-9]{0,17}$/.test(digits) ? digits : null
}
export function formatOperatingBudget(amount:string) {
 return `${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(BigInt(amount))} VND`
}
const root=(id:string)=>`/cruise/${encodeURIComponent(id)}/preparation`
export function coordinatorDossierSections(sections: PreparationSection[]) {
 return sections.filter(section => section.sectionCode === 'HOTEL_CABIN' || section.sectionCode === 'ENTERTAINMENT_SHORE')
}
export function preparationActionAllowed(section: PreparationSection, action: PreparationAction, actorId: string | null) {
 return section.allowedActions.includes(action.toUpperCase())
   && (action === 'submit' || section.submittedByUserId !== actorId)
}
function validSectionEvidence(section: PreparationSection) {
 return dataReadinessValues.includes(section.dataReadiness)
   && submissionValues.includes(section.submissionStatus)
   && approvalValues.includes(section.approvalStatus)
   && (section.submittedRevision === null || Number.isSafeInteger(section.submittedRevision)
     && section.submittedRevision >= 0 && section.submittedRevision <= section.revision)
   && Array.isArray(section.missingRequiredCheckCodes)
   && section.missingRequiredCheckCodes.every(code => typeof code === 'string')
}
export function decodePreparation(value:PreparationDashboard,id:string){
 if(!value||value.cruiseId!==id||!Number.isSafeInteger(value.cruiseRevision)||typeof value.canAssignCoordinator!=='boolean'||!Array.isArray(value.sections)||value.sections.length!==preparationCodes.length||new Set(value.sections.map(s=>s.sectionCode)).size!==preparationCodes.length||value.sections.some(s=>!preparationCodes.includes(s.sectionCode as typeof preparationCodes[number])||!['CRUISE_MANAGER','SHIP_MANAGER','OPERATIONS_MANAGER'].includes(s.submitterRole)||!Number.isSafeInteger(s.revision)||!preparationStatuses.includes(s.status)||!Array.isArray(s.allowedActions)||s.allowedActions.some(a=>!['SUBMIT','CONFIRM','RETURN','REJECT'].includes(a))||!Array.isArray(s.checkItems)||s.checkItems.some(i=>typeof i.ready!=='boolean'||typeof i.required!=='boolean')))throw new ApiError('Phản hồi hồ sơ chuẩn bị thiếu hoặc sai dữ liệu bắt buộc. Không thể xác nhận trạng thái hồ sơ.',502,'PREPARATION_RESPONSE_INVALID')
 if (!value.sections.every(validSectionEvidence)) throw new ApiError('Chưa đọc được trạng thái nộp và duyệt hồ sơ.',502,'PREPARATION_RESPONSE_INVALID')
 return value
}
export const preparationApi={
 operatingBudget: (id:string,signal:AbortSignal) =>
  apiRequest<OperatingBudget>(root(id)+'/operating-budget',{signal}),
 saveOperatingBudget: (id:string,expectedRevision:number,amountVnd:string) =>
  apiRequest<OperatingBudget>(root(id)+'/operating-budget',{method:'PUT',body:{expectedRevision,amountVnd}}),
 submitOperatingBudget: (id:string,expectedRevision:number,expectedReviewRevision:number) =>
  apiRequest<OperatingBudget>(root(id)+'/operating-budget/submit',{method:'POST',body:{expectedRevision,expectedReviewRevision}}),
 reviewOperatingBudget: (id:string,expectedReviewRevision:number,decision:'APPROVE'|'REJECT',reason?:string|null) =>
  apiRequest<OperatingBudget>(root(id)+'/operating-budget/review',{method:'POST',body:{expectedReviewRevision,decision,reason:reason?.trim()||null}}),
 async get(id:string,signal?:AbortSignal){return decodePreparation(await apiRequest<PreparationDashboard>(root(id),{signal}),id)},
 async action(id:string,section:PreparationSection,action:PreparationAction,text:string){
  if(!section.allowedActions.includes(action.toUpperCase()))throw new ApiError('',403,'PREPARATION_ACTION_FORBIDDEN')
  const saved=await apiRequest<PreparationSection>(`${root(id)}/${encodeURIComponent(section.sectionCode)}/${action}`,{method:'POST',body:{expectedRevision:section.revision,...(action==='submit'?{evidence:text}:action==='confirm'?{notes:text}:{reason:text})}})
  const readback=await this.get(id),actual=readback.sections.find(s=>s.sectionCode===section.sectionCode)
  const expected={submit:'SUBMITTED',confirm:'CONFIRMED',return:'RETURNED',reject:'REJECTED'}[action]
  if(saved.sectionCode!==section.sectionCode||saved.revision!==section.revision+1||saved.status!==expected||!actual||actual.revision!==saved.revision||actual.status!==saved.status||action==='submit'&&actual.evidence!==text||(action==='return'||action==='reject')&&actual.returnReason!==text)throw new ApiError('',502)
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
