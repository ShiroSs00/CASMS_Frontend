import { useCallback, useState } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { Button, Field, Loading, Notice } from '@/shared/ui'
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

type PublicShip = { shipId: string; shipName: string }
async function fleet(signal: AbortSignal) {
  const result = new Map<string, PublicShip>()
  for (let page = 0, pages = 1; page < pages; page++) {
    const data = await apiRequest<{ content: Array<{ shipId?: string; shipName?: string }>; totalPages: number }>('/cruise', { query: { status: 'PUBLISHED', size: 100, page }, signal })
    if (!Array.isArray(data.content) || !Number.isSafeInteger(data.totalPages) || data.totalPages < 0 || data.totalPages > 1000) throw new Error('Danh sách tàu chưa hợp lệ.')
    pages = data.totalPages
    for (const item of data.content) if (item.shipId && item.shipName) result.set(item.shipId, { shipId: item.shipId, shipName: item.shipName })
  }
  return [...result.values()]
}
export function CustomerFleetExplorer() {
  const query = useReadQuery('public-model-fleet', fleet)
  const [requested, setShip] = useState('')
  const selected = query.data?.find(ship => ship.shipId === requested) ?? query.data?.[0]
  return <section aria-labelledby="fleet-model-heading">
    <h2 id="fleet-model-heading">Tàu & không gian 3D</h2><p>Khám phá vị trí cabin và các khu vực trên tàu của những hành trình đã công bố.</p>
    {query.loading && <Loading label="Đang tải danh sách tàu…" />}
    {query.error && <Notice title="Chưa tải được danh sách tàu" tone="warning"><Button onClick={query.retry}>Thử lại</Button></Notice>}
    {query.data?.length === 0 && <p>Chưa có tàu gắn với hành trình đã công bố.</p>}
    {selected && <><Field htmlFor="public-explorer-ship" label="Chọn tàu"><select id="public-explorer-ship" value={selected.shipId} onChange={event => setShip(event.target.value)}>{query.data?.map(ship => <option key={ship.shipId} value={ship.shipId}>{ship.shipName}</option>)}</select></Field><CustomerShipExplorer key={selected.shipId} shipId={selected.shipId} /></>}
  </section>
}
