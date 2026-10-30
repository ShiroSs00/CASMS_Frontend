import { apiRequest, ApiError } from '@/shared/api'
import type { ImportIssue, ImportJob, ImportSession, Registration } from './model'

const segment = encodeURIComponent
const modelPath = (registration: Registration) => `/ships/${segment(registration.shipId)}/models/${segment(registration.shipModelId)}`
function invalid(): never { throw new ApiError('Kết quả nhập dữ liệu không đúng định dạng. Hãy tải lại để kiểm tra.', 502) }
export function decodeJob(value: unknown): ImportJob {
  const job = value as ImportJob
  if (!job || typeof job.jobId !== 'string' || typeof job.shipId !== 'string' || typeof job.modelId !== 'string'
    || !['RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED'].includes(job.status)
    || ![job.totalObjects, job.decksImported, job.cabinsImported, job.objectsSucceeded, job.objectsFailed, job.objectsSkipped].every(n => Number.isInteger(n) && n >= 0)) invalid()
  return job
}
export type ImportPreview = {
  name?:string;passengerCapacity?:number;deckCount?:number;length?:number;beam?:number;units?:string;commissionDate?:string
  decks:Array<{id:string;number:number;name:string}>;serviceDecks?:Array<{id:string;number:number;name:string}>
  cabins:Array<{deckId:string;cabinNumber:string}>;areas?:Array<{deckId:string}>
}
export type PreviewShip = {shipId:string;shipName:string;shipCode:string;totalCapacity?:number;totalDecks?:number;lengthMeters?:number;beamMeters?:number;commissionDate?:string}
export const shipImportApi = {
  async preview(session:ImportSession,signal:AbortSignal) {
    const data=await apiRequest<ImportPreview>(`/ship-model-assets/${segment(session.modelKey)}/${segment(session.assetVersion)}/preview`,{signal})
    if(!data||!Array.isArray(data.decks)||!Array.isArray(data.cabins)||data.decks.some(d=>!d||typeof d.id!=='string'||typeof d.name!=='string'||!Number.isFinite(d.number))||data.cabins.some(c=>!c||typeof c.deckId!=='string'||typeof c.cabinNumber!=='string')||(data.serviceDecks!==undefined&&(!Array.isArray(data.serviceDecks)||data.serviceDecks.some(d=>!d||typeof d.id!=='string'||typeof d.name!=='string'||!Number.isFinite(d.number))))||(data.areas!==undefined&&(!Array.isArray(data.areas)||data.areas.some(a=>!a||typeof a.deckId!=='string')))) invalid()
    return data
  },
  async ship(id:string,signal:AbortSignal) {
    const data=await apiRequest<PreviewShip>(`/ships/${segment(id)}`,{signal})
    if(!data||data.shipId!==id||typeof data.shipName!=='string'||typeof data.shipCode!=='string') invalid()
    return data
  },
  async stored(signal?:AbortSignal) {
    const rows=await apiRequest<unknown>('/ship-model-assets',{signal})
    if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.modelKey!=='string'||typeof r.assetVersion!=='string'||typeof r.uploadedAt!=='string')) invalid()
    return rows as Array<{modelKey:string;assetVersion:string;uploadedAt:string}>
  },
  async upload(session: ImportSession, file: File) {
    const body = new FormData()
    body.append('bundle', file)
    const result = await apiRequest<{ modelKey: string; assetVersion: string; fileCount: number }>('/ship-model-assets', {
      method: 'POST', query: { modelKey: session.modelKey, assetVersion: session.assetVersion }, body, timeoutMs: 15 * 60_000,
    })
    if (!result || result.modelKey !== session.modelKey || result.assetVersion !== session.assetVersion || !Number.isInteger(result.fileCount)) invalid()
  },
  async register(session: ImportSession, supplements?:Record<string,string|number>): Promise<Registration> {
    try {
      const result = await apiRequest<Registration>(`/ship-model-assets/${segment(session.modelKey)}/${segment(session.assetVersion)}/register`, { method: 'POST', body:supplements, timeoutMs: 60_000 })
      if (!result || typeof result.shipId !== 'string' || typeof result.shipModelId !== 'string' || typeof result.shipCreated !== 'boolean') invalid()
      return result
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.message.includes('Model asset bundle is not uploaded')) {
        throw new ApiError(`Chưa có gói mô hình “${session.modelKey}” phiên bản “${session.assetVersion}” trên hệ thống. Chọn “Chọn lại gói” để tải tệp ZIP lên hoặc nhập đúng phiên bản đã tải.`, 404, error.code)
      }
      throw error
    }
  },
  async importStructure(registration: Registration) {
    return decodeJob(await apiRequest<unknown>(`${modelPath(registration)}/imports`, { method: 'POST', timeoutMs: 10 * 60_000 }))
  },
  async history(registration: Registration, signal?: AbortSignal) {
    const result = await apiRequest<unknown[]>(`${modelPath(registration)}/imports`, { signal })
    if (!Array.isArray(result)) invalid()
    return result.map(decodeJob)
  },
  async issues(job: ImportJob, signal?: AbortSignal) {
    const result = await apiRequest<ImportIssue[]>(`/ships/${segment(job.shipId)}/imports/${segment(job.jobId)}/issues`, { signal })
    if (!Array.isArray(result) || result.some(issue => !issue || typeof issue.issueId !== 'string' || typeof issue.errorCode !== 'string' || typeof issue.message !== 'string' || typeof issue.objectType !== 'string')) invalid()
    return result
  },
}
