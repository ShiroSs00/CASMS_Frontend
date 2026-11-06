import { apiAsset, apiRequest, ApiError } from '@/shared/api'
import type { ImportIssue, ImportJob, ImportSession, ModelScope, Registration } from './model'

const segment = encodeURIComponent
const shipPath = (shipId: string) => `/ships/${segment(shipId)}`
const modelPath = (registration: ModelScope) => `/ships/${segment(registration.shipId)}/models/${segment(registration.shipModelId)}`
function invalid(): never { throw new ApiError('Kết quả import dữ liệu không đúng định dạng. Hãy tải lại để kiểm tra.', 502) }
export function decodeJob(value: unknown): ImportJob {
  const job = value as ImportJob
  if (!job || typeof job.jobId !== 'string' || typeof job.shipId !== 'string' || typeof job.modelId !== 'string'
    || !['RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED'].includes(job.status)
    || typeof job.startedAt !== 'string' || !Number.isFinite(Date.parse(job.startedAt))
    || (job.finishedAt != null && (typeof job.finishedAt !== 'string' || !Number.isFinite(Date.parse(job.finishedAt))))
    || (job.errorMessage != null && typeof job.errorMessage !== 'string')
    || ![job.totalObjects, job.decksImported, job.cabinsImported, job.objectsSucceeded, job.objectsFailed, job.objectsSkipped].every(n => Number.isInteger(n) && n >= 0)) invalid()
  return job
}
export type ImportPreview = {
  name?:string;passengerCapacity?:number;deckCount?:number;length?:number;beam?:number;units?:string;commissionDate?:string
  decks:Array<{id:string;number:number;name:string}>;serviceDecks?:Array<{id:string;number:number;name:string}>
  cabins:Array<{deckId:string;cabinNumber:string}>;areas?:Array<{deckId:string;id?:string;name?:string;kind?:string}>
}
export type PreviewShip = {shipId:string;shipName:string;shipCode:string;totalCapacity?:number;totalDecks?:number;lengthMeters?:number;beamMeters?:number;commissionDate?:string}
function decodePreview(data: ImportPreview) {
  if(!data||!Array.isArray(data.decks)||!Array.isArray(data.cabins)||data.decks.some(d=>!d||typeof d.id!=='string'||typeof d.name!=='string'||!Number.isFinite(d.number))||data.cabins.some(c=>!c||typeof c.deckId!=='string'||typeof c.cabinNumber!=='string')||(data.serviceDecks!==undefined&&(!Array.isArray(data.serviceDecks)||data.serviceDecks.some(d=>!d||typeof d.id!=='string'||typeof d.name!=='string'||!Number.isFinite(d.number))))||(data.areas!==undefined&&(!Array.isArray(data.areas)||data.areas.some(a=>!a||typeof a.deckId!=='string')))) invalid()
  return data
}
export const shipImportApi = {
  async importByCode(shipId: string, modelKey: string, file: File) {
    const body = new FormData()
    body.append('bundle', file)
    const job = decodeJob(await apiRequest<unknown>(`${shipPath(shipId)}/models/imports`, {
      method: 'POST', query: { modelKey }, body, timeoutMs: 15 * 60_000,
    }))
    if (job.shipId !== shipId) invalid()
    return job
  },
  async preview(modelKey: string, signal: AbortSignal) {
    return decodePreview(await apiRequest<ImportPreview>(`/ship-model-assets/${segment(modelKey)}/preview`, { signal }))
  },
  async registeredPreview(registration: Registration, signal: AbortSignal) {
    const bytes = await apiAsset(`${modelPath(registration)}/assets/manifest.json`, signal)
    return decodePreview(JSON.parse(new TextDecoder().decode(bytes)))
  },
  async ship(id:string,signal:AbortSignal) {
    const data=await apiRequest<PreviewShip>(`/ships/${segment(id)}`,{signal})
    if(!data||data.shipId!==id||typeof data.shipName!=='string'||typeof data.shipCode!=='string') invalid()
    return data
  },
  async stored(signal?:AbortSignal) {
    const rows=await apiRequest<unknown>('/ship-model-assets',{signal})
    if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.modelKey!=='string'||typeof r.uploadedAt!=='string')) invalid()
    return rows as Array<{modelKey:string;uploadedAt:string}>
  },
  async upload(session: ImportSession, file: File) {
    const body = new FormData()
    body.append('bundle', file)
    const result = await apiRequest<{ modelKey: string; fileCount: number; expandedBytes: number }>('/ship-model-assets', {
      method: 'POST', query: { modelKey: session.modelKey }, body, timeoutMs: 15 * 60_000,
    })
    if (!result || result.modelKey !== session.modelKey || !Number.isInteger(result.fileCount) || !Number.isSafeInteger(result.expandedBytes)) invalid()
  },
  async register(session: ImportSession, supplements?:Record<string,string|number>): Promise<Registration> {
    const result = await apiRequest<Registration>(`/ship-model-assets/${segment(session.modelKey)}/register`, { method: 'POST', body:supplements, timeoutMs: 60_000 })
    if (!result || typeof result.shipId !== 'string' || typeof result.shipModelId !== 'string' || result.shipCreated !== true) invalid()
    return result
  },
  async importStructure(registration: Registration) {
    const job = decodeJob(await apiRequest<unknown>(`${modelPath(registration)}/imports`, { method: 'POST', timeoutMs: 10 * 60_000 }))
    if (job.shipId !== registration.shipId || job.modelId !== registration.shipModelId) invalid()
    return job
  },
  async history(registration: ModelScope, signal?: AbortSignal) {
    const result = await apiRequest<unknown[]>(`${modelPath(registration)}/imports`, { signal })
    if (!Array.isArray(result)) invalid()
    return result.map(item => {
      const job = decodeJob(item)
      if (job.shipId !== registration.shipId || job.modelId !== registration.shipModelId) invalid()
      return job
    })
  },
  async job(shipId: string, jobId: string, signal?: AbortSignal) {
    const job = decodeJob(await apiRequest<unknown>(`${shipPath(shipId)}/imports/${segment(jobId)}`, { signal }))
    if (job.shipId !== shipId || job.jobId !== jobId) invalid()
    return job
  },
  async issues(job: Pick<ImportJob, 'shipId' | 'jobId'>, signal?: AbortSignal) {
    const result = await apiRequest<ImportIssue[]>(`/ships/${segment(job.shipId)}/imports/${segment(job.jobId)}/issues`, { signal })
    if (!Array.isArray(result) || result.some(issue => !issue || typeof issue.issueId !== 'string' || typeof issue.errorCode !== 'string' || typeof issue.message !== 'string' || typeof issue.objectType !== 'string')) invalid()
    return result
  },
}
