import { useCallback } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { cabinTypeLabels } from '@/shared/i18n/business-copy'
import type { CabinType } from './api'
import { fareObject, fareText, fareUuid } from './purchase-contract'

export type ShipPackageTemplate = {
  templateId: string
  templateVersionId: string
  name: string
  cabinTypes: CabinType[]
}

export async function readShipPackageTemplates(shipId: string, signal?: AbortSignal): Promise<ShipPackageTemplate[]> {
  const data = await apiRequest<unknown>(`/cruise-package-templates/ship-options/${encodeURIComponent(shipId)}/published-templates`, { signal })
  if (!Array.isArray(data)) throw new Error('Chưa đọc được danh sách mẫu gói của tàu.')
  return data.map(item => {
    const value = fareObject(item)
    const types = value.cabinTypes
    if (!Array.isArray(types) || types.length === 0 || !types.every(type =>
      typeof type === 'string' && Object.hasOwn(cabinTypeLabels, type)) || new Set(types).size !== types.length) {
      throw new Error('Chưa xác định được hạng cabin của mẫu gói.')
    }
    return {
      templateId: fareUuid(value.templateId),
      templateVersionId: fareUuid(value.templateVersionId),
      name: fareText(value.name),
      cabinTypes: types as CabinType[],
    }
  })
}

export function useShipPackageTemplates(shipId: string | null | undefined, revision?: number) {
  const access = useSessionAccess()
  const accessKey = [access.userId, access.roles, access.permissions].flat().join(':')
  return useReadQuery(
    `ship-package-templates:${accessKey}:${shipId ?? ''}:${revision ?? ''}`,
    useCallback(signal => shipId ? readShipPackageTemplates(shipId, signal) : Promise.resolve([]), [shipId]),
  )
}
