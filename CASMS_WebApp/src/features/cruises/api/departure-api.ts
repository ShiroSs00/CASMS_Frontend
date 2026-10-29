import { ApiError, apiRequest } from '@/shared/api'
import { decodeAuditEvents, decodeChange, decodeHandoff, decodeImpactTask, decodeInventory, decodeNotificationAggregate, decodePublicSellability, decodeReadiness, decodeSaleReadiness, decodeSchedule, type ChangeInput } from '../model/departure-contract'

const path = (id: string) => '/cruise/' + encodeURIComponent(id)
function savedTasks(value: unknown, id: string) {
  if (!Array.isArray(value)) throw new ApiError('Chưa đọc được danh sách công việc.', 502)
  const tasks=value.map(item=>decodeImpactTask(item,id))
  if(tasks.some(task=>!task.taskId)||new Set(tasks.map(task=>task.taskId)).size!==tasks.length)throw new ApiError('Danh sách công việc thiếu định danh hoặc có mục trùng.',502)
  return tasks
}
export const departureApi = {
  async preview(sourceVersionId: string, departureDatetime: string, signal?: AbortSignal) {
    const result = decodeSchedule(await apiRequest('/cruise/preview-schedule', { method: 'POST', body: { sourceVersionId, departureDatetime }, signal }))
    if (result.sourceVersionId !== sourceVersionId || !result.departureDatetime || Date.parse(result.departureDatetime) !== Date.parse(departureDatetime)) throw new ApiError('Kết quả xem trước chưa khớp phiên bản và thời gian đã chọn.', 502)
    return result
  },
  async schedule(id: string, signal?: AbortSignal) { return decodeSchedule(await apiRequest(path(id) + '/schedule', { signal })) },
  async inventory(id: string, signal?: AbortSignal) { return decodeInventory(await apiRequest(path(id) + '/inventory-summary', { signal }), id) },
  async departureReadiness(id:string,signal?:AbortSignal) { return decodeReadiness(await apiRequest(path(id)+'/departure-readiness',{signal}),id) },
  async publicSellability(id:string,signal?:AbortSignal) { return decodePublicSellability(await apiRequest(path(id)+'/sellability',{signal}),id) },
  async auditEvents(id:string,signal?:AbortSignal) { return decodeAuditEvents(await apiRequest(path(id)+'/audit-events',{signal}),id) },
  async notificationAggregate(id:string,signal?:AbortSignal) { return decodeNotificationAggregate(await apiRequest(path(id)+'/impact-notifications/aggregate',{signal}),id) },
  async saleReadiness(id: string, signal?: AbortSignal) { return decodeSaleReadiness(await apiRequest(path(id) + '/sale-readiness', { signal }), id) },
  async impact(id: string, input: ChangeInput, signal?: AbortSignal) { return decodeChange(await apiRequest(path(id) + '/preview-change-impact', { method: 'POST', body: input, signal }), id) },
  async tasks(id: string, status?: string, signal?: AbortSignal) {
    const value = await apiRequest<unknown>(path(id) + '/impact-tasks', { query: { status: status || undefined }, signal })
    return savedTasks(value,id)
  },
  async generateTasks(id:string,input:ChangeInput){
    return savedTasks(await apiRequest<unknown>(path(id)+'/impact-tasks/generate',{method:'POST',body:input}),id)
  },
  async resolveTask(id:string,taskId:string,resolutionNotes:string,expectedRevision?:number){
    const task=decodeImpactTask(await apiRequest<unknown>(path(id)+'/impact-tasks/'+encodeURIComponent(taskId)+'/resolve',{method:'POST',query:{resolutionNotes,expectedRevision}}),id)
    if(task.taskId!==taskId||task.status!=='RESOLVED')throw new ApiError('Chưa xác nhận được trạng thái công việc.',502)
    return task
  },
  async handoff(id: string, signal?: AbortSignal) { return decodeHandoff(await apiRequest(path(id) + '/downstream-handoff', { signal }), id) },
}
