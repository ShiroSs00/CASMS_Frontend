import { useCallback } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { Button, Loading, Notice } from '@/shared/ui'
import { CustomerModelScene } from './CustomerModelScene'
import { decodeManifest } from './model'
import { mapBookingCabins } from './customer-model-selection'

export type CustomerShipExplorerProps = {
  shipId: string; cruiseId?: string; selectedCabinId?: string
  cabins?: Array<{ cabinId: string; remainingCapacity: number }>
  onSelectCabin?: (id: string) => void
}
type Mapping = { modelId: string; cabinId: string }

export function CustomerShipExplorer(props: CustomerShipExplorerProps) {
  const { shipId, cabins, selectedCabinId, onSelectCabin } = props
  const load = useCallback(async (signal: AbortSignal) => {
    const data = await apiRequest<{ shipId: string; modelId: string; manifest: unknown; cabinMappings: Mapping[] }>(`/ships/${encodeURIComponent(shipId)}/public-model`, { signal, authenticated: false })
    if (!data || data.shipId !== shipId || typeof data.modelId !== 'string' || !data.modelId) throw new Error('Mô hình không thuộc tàu đang xem.')
    const manifest = decodeManifest(data.manifest), mappings = data.cabinMappings
    if (!Array.isArray(mappings) || mappings.some(item => !item || typeof item.modelId !== 'string' || typeof item.cabinId !== 'string')) throw new Error('Ánh xạ cabin của mô hình chưa hợp lệ.')
    return { modelId: data.modelId, manifest, mappings }
  }, [shipId])
  const query = useReadQuery(`customer-model:${shipId}`, load)
  if (query.loading) return <Loading label="Đang tải cấu trúc tàu 3D…" />
  if (query.error) return <Notice title="Chưa tải được mô hình tàu" tone="warning">{query.error instanceof ApiError && query.error.status === 404 ? 'Tàu chưa có mô hình đang hoạt động.' : 'Không thể tải mô hình lúc này. Bạn có thể tiếp tục chọn phòng bằng danh sách.'}<Button tone="secondary" onClick={query.retry}>Thử lại mô hình</Button></Notice>
  if (!query.data) return null
  const { modelId, manifest, mappings } = query.data
  const choices = cabins ? mapBookingCabins(cabins, mappings, manifest.cabins) : undefined
  return <CustomerModelScene key={`${shipId}:${modelId}`} shipId={shipId} modelId={modelId} manifest={manifest} cabins={choices} selectedCabinId={selectedCabinId} onSelectCabin={onSelectCabin} />
}

