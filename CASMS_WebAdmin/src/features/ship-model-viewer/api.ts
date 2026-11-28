import { apiAsset, apiRequest } from '@/shared/api'
import { assetPath, decodeAsset, decodeManifest, type Issue, type Job, type ShipModel, type ShipChoice, type ShipTypeChoice } from './model'
const MAX_DIRECTORY_PAGES = 20

export const viewerApi = {
  async shipTypes(signal: AbortSignal) {
    const first = await apiRequest<{ content: ShipTypeChoice[]; totalPages: number }>('/ship-types', { query: { page: 0, size: 100, sort: 'code,asc' }, signal })
    const validate = (data: { content: ShipTypeChoice[]; totalPages: number }) => {
      if (!Array.isArray(data.content) || !Number.isInteger(data.totalPages) || data.totalPages < 0
        || data.content.some(row => !row || !row.shipTypeId || typeof row.name !== 'string' || typeof row.code !== 'string')) {
        throw new Error('Danh mục loại tàu không hợp lệ.')
      }
    }
    validate(first)
    const rows: ShipTypeChoice[] = [...first.content]
    const totalPages = Math.min(MAX_DIRECTORY_PAGES, first.totalPages)
    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          apiRequest<{ content: ShipTypeChoice[]; totalPages: number }>('/ship-types', { query: { page: i + 1, size: 100, sort: 'code,asc' }, signal }),
        ),
      )
      for (const pageData of rest) {
        validate(pageData)
        rows.push(...pageData.content)
      }
    }
    return rows
  },
  async ships(signal: AbortSignal) {
    const first = await apiRequest<{ content: ShipChoice[]; totalPages: number }>('/ships', { query: { page: 0, size: 100 }, signal })
    if (!Array.isArray(first.content)) throw new Error('Danh sách tàu không hợp lệ.')
    const result: ShipChoice[] = [...first.content]
    const totalPages = Math.min(MAX_DIRECTORY_PAGES, Math.max(1, first.totalPages))
    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          apiRequest<{ content: ShipChoice[]; totalPages: number }>('/ships', { query: { page: i + 1, size: 100 }, signal }),
        ),
      )
      for (const pageData of rest) {
        if (!Array.isArray(pageData.content)) throw new Error('Danh sách tàu không hợp lệ.')
        result.push(...pageData.content)
      }
    }
    return result
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
