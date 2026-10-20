import { apiRequestRaw } from '@/shared/api'

export type ExcursionOption = { shoreExcursionId: string; excursionName: string; excursionCode?: string | null; maximumCapacity: number; status: string }
export async function listExcursionOptions(signal?: AbortSignal): Promise<ExcursionOption[]> {
  return apiRequestRaw('/shore-excursions', value => {
    if (!Array.isArray(value) || value.some(item => !item || typeof item.shoreExcursionId !== 'string' || !item.shoreExcursionId || typeof item.excursionName !== 'string' || !item.excursionName || !Number.isSafeInteger(item.maximumCapacity) || typeof item.status !== 'string')) throw new Error('Danh mục chuyến tham quan không đúng định dạng.')
    return value
  }, { signal })
}
