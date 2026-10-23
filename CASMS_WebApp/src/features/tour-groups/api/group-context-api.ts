import { apiRequestRaw } from '@/shared/api'
import { isUuid, type GroupExcursion } from '../model/tour-group'

export type ExcursionOption = GroupExcursion
export async function listExcursionOptions(signal?: AbortSignal): Promise<ExcursionOption[]> {
  return apiRequestRaw('/shore-excursions', value => {
    const invalid = () => new Error('Danh mục chuyến tham quan không đúng định dạng.')
    if (!Array.isArray(value)) throw invalid()
    return value.map((item: unknown): ExcursionOption => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid()
      const row = item as Record<string, unknown>
      if (typeof row.shoreExcursionId !== 'string' || !isUuid(row.shoreExcursionId) || typeof row.excursionName !== 'string' || !row.excursionName.trim() || typeof row.status !== 'string' || !['PLANNED', 'OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(row.status)) throw invalid()
      function optionalText(key: string) {
        const text = row[key]
        if (text == null) return null
        if (typeof text !== 'string') throw invalid()
        return text.trim() || null
      }
      function optionalTime(key: string) {
        const time = optionalText(key)
        if (time && (!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(time) || !Number.isFinite(Date.parse(time)))) throw invalid()
        return time
      }
      const capacity = row.maximumCapacity
      if (capacity != null && (typeof capacity !== 'number' || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2147483647)) throw invalid()
      return {
        shoreExcursionId: row.shoreExcursionId, excursionName: row.excursionName, excursionCode: optionalText('excursionCode'), status: row.status,
        maximumCapacity: capacity == null ? null : capacity as number, meetingPoint: optionalText('meetingPoint'),
        startTime: optionalTime('startTime'), plannedReturnTime: optionalTime('plannedReturnTime'),
      }
    })
  }, { signal })
}
