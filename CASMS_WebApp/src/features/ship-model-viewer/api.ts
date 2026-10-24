import { apiAsset, apiRequest } from '@/shared/api'
import { assetPath, decodeAsset, decodeManifest, type Issue, type Job, type ModelVersion, type ShipChoice } from './model'
export const viewerApi = {
  async ships(signal: AbortSignal) {
    const result: ShipChoice[]=[]
    for(let page=0;page<1000;page++) { const data=await apiRequest<{content:ShipChoice[];totalPages:number}>('/ships',{query:{page,size:100},signal}); if(!Array.isArray(data.content)) throw new Error('Danh sách tàu không hợp lệ.'); result.push(...data.content); if(page+1>=data.totalPages) return result }
    throw new Error('Danh sách tàu vượt giới hạn tải.')
  },
  versions: (ship:string,signal:AbortSignal)=>apiRequest<ModelVersion[]>(`/ships/${encodeURIComponent(ship)}/models`,{signal}),
  async info(ship:string,model:string,signal:AbortSignal){return decodeAsset(await apiRequest<unknown>(`/ships/${encodeURIComponent(ship)}/models/${encodeURIComponent(model)}`,{signal}),model)},
  async manifest(ship:string,model:string,signal:AbortSignal) { const bytes=await apiAsset(assetPath(ship,model,'manifest.json'),signal); return decodeManifest(JSON.parse(new TextDecoder().decode(bytes))) },
  history: (ship:string,model:string,signal:AbortSignal)=>apiRequest<Job[]>(`/ships/${encodeURIComponent(ship)}/models/${encodeURIComponent(model)}/imports`,{signal}),
  issues: (ship:string,job:string,signal:AbortSignal)=>apiRequest<Issue[]>(`/ships/${encodeURIComponent(ship)}/imports/${encodeURIComponent(job)}/issues`,{signal}),
}
