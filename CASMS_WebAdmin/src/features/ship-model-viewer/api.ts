import { apiAsset, apiRequest } from '@/shared/api'
import { assetPath, decodeAsset, decodeManifest, type Issue, type Job, type ShipModel, type ShipChoice } from './model'
export const viewerApi = {
  async ships(signal: AbortSignal) {
    const result: ShipChoice[]=[]
    for(let page=0;page<1000;page++) { const data=await apiRequest<{content:ShipChoice[];totalPages:number}>('/ships',{query:{page,size:100},signal}); if(!Array.isArray(data.content)) throw new Error('Danh sách tàu không hợp lệ.'); result.push(...data.content); if(page+1>=data.totalPages) return result }
    throw new Error('Danh sách tàu vượt giới hạn tải.')
  },
  async models(ship: string, signal?: AbortSignal) {
    const rows = await apiRequest<ShipModel[]>(`/ships/${encodeURIComponent(ship)}/models`, { signal })
    if (!Array.isArray(rows) || rows.some(row => !row || row.shipId !== ship || typeof row.shipModelId !== 'string'
      || (row.modelKey != null && typeof row.modelKey !== 'string') || typeof row.status !== 'string'
      || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt)))) throw new Error('Danh sách mô hình không khớp tàu.')
    return rows
  },
  async objects(ship: string, model: string, signal?: AbortSignal) {
    const rows = await apiRequest<Array<{ nodeKey: string | null; objectType: string }>>(
      `/ships/${encodeURIComponent(ship)}/models/${encodeURIComponent(model)}/objects`, { signal })
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.objectType !== 'string'
      || (row.nodeKey !== null && typeof row.nodeKey !== 'string'))) {
      throw new Error('Không đọc được liên kết đối tượng hiện tại.')
    }
    return rows
  },
  async info(ship:string,model:string,signal:AbortSignal){return decodeAsset(await apiRequest<unknown>(`/ships/${encodeURIComponent(ship)}/models/${encodeURIComponent(model)}`,{signal}),model)},
  async manifest(ship:string,model:string,signal:AbortSignal) { const bytes=await apiAsset(assetPath(ship,model,'manifest.json'),signal); return decodeManifest(JSON.parse(new TextDecoder().decode(bytes))) },
  history: (ship:string,model:string,signal:AbortSignal)=>apiRequest<Job[]>(`/ships/${encodeURIComponent(ship)}/models/${encodeURIComponent(model)}/imports`,{signal}),
  issues: (ship:string,job:string,signal:AbortSignal)=>apiRequest<Issue[]>(`/ships/${encodeURIComponent(ship)}/imports/${encodeURIComponent(job)}/issues`,{signal}),
}
