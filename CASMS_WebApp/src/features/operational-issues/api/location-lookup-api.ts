import { apiRequest } from '@/shared/api'

export type IssueShipOption = { shipId: string; shipCode: string; shipName: string }
export type IssueCruiseOption = { cruiseId: string; cruiseCode: string; cruiseName: string; shipId: string | null }
export type IssueCabinOption = { cabinId: string; shipId: string; cabinNumber: string }

async function all<T>(path: string, fields: string[], signal?: AbortSignal): Promise<T[]> {
  const result: T[] = []
  for (let page = 0, pages = 1; page < pages; page++) {
    const dto = await apiRequest<{ content: unknown[]; totalPages: number }>(path, { query: { page, size: 100 }, signal })
    if (!dto || !Array.isArray(dto.content) || !Number.isSafeInteger(dto.totalPages) || dto.totalPages < 0 || dto.content.some(row => !row || typeof row !== 'object' || fields.some(field => typeof (row as Record<string, unknown>)[field] !== 'string' || !(row as Record<string, string>)[field].trim()))) throw new Error('Danh mục liên quan không đầy đủ. Vui lòng thử lại.')
    result.push(...dto.content as T[]); pages = dto.totalPages
  }
  return result
}
export const issueLocationApi = {
  ships: (signal?: AbortSignal) => all<IssueShipOption>('/ships', ['shipId', 'shipCode', 'shipName'], signal),
  cruises: (signal?: AbortSignal) => all<IssueCruiseOption>('/cruise', ['cruiseId', 'cruiseCode', 'cruiseName'], signal),
  cabins: (signal?: AbortSignal) => all<IssueCabinOption>('/cabins', ['cabinId', 'shipId', 'cabinNumber'], signal),
}

export function validateIssueLocation(shipId: string, cruiseId: string, cabinId: string, context: { ships: IssueShipOption[]; cruises: IssueCruiseOption[]; cabins: IssueCabinOption[] } | null): string {
  if (!context) return 'Chưa tải đủ dữ liệu tàu, chuyến hoặc cabin. Vui lòng thử lại.'
  if (!context.ships.some(ship => ship.shipId === shipId)) return 'Vui lòng chọn tàu từ danh sách.'
  if (cruiseId && !context.cruises.some(cruise => cruise.cruiseId === cruiseId && cruise.shipId === shipId)) return 'Chuyến đã chọn không thuộc tàu này.'
  if (cabinId && !context.cabins.some(cabin => cabin.cabinId === cabinId && cabin.shipId === shipId)) return 'Cabin đã chọn không thuộc tàu này.'
  return ''
}
