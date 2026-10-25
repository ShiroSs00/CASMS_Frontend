export type ShipChoice = { shipId: string; shipCode: string; shipName: string }
export type ModelVersion = { shipModelId: string; version: string; status: string; fileFormat: string; createdAt: string; updatedAt: string; shipManufacturerName?: string; modelProvider?: string }
export type AssetInfo = { id: string; modelKey: string; assetVersion: string; revision: string; status: string; cabinCount: number; mappedCabinCount: number; deckCount: number; mappedDeckCount: number; units: string; shipManufacturerName?: string; modelProvider?: string }
export type Deck = { id: string; number: number; name: string; nodeName: string; asset: string; elevationMetres?: number; cabinIds?: string[] }
export type Cabin = { id: string; modelId?: string; deckId: string; deckNumber: number; cabinNumber: string; cabinType: string; nodeName: string; capacity?: number; isAccessible?: boolean; position?: number[]; size?: number[]; areaSquareMetres?: number; gradeName?: string; sourceNumberVerified?: boolean }
export type Manifest = { modelId: string; name: string; revision: string; units: string; length?: number; beam?: number; accuracy?: string; referenceSource?: string; referenceVersion?: string; gltfAxes?: { up?: string; bow?: string; port?: string }; assets: { full?: string; exterior?: string }; decks: Deck[]; serviceDecks?: Deck[]; cabins: Cabin[] }
export type Job = { jobId: string; status: string; startedAt: string; finishedAt?: string; decksImported: number; cabinsImported: number; objectsFailed: number; requestedBy?: string }
export type Issue = { issueId: string; objectIdentifier?: string; objectType: string; errorCode: string; message: string }
export const modelStatus: Record<string, string> = { DRAFT: 'Bản nháp', PROCESSING: 'Đang xử lý', READY: 'Đã công bố', ACTIVE: 'Đang sử dụng', FAILED: 'Lỗi xử lý', ARCHIVED: 'Lưu trữ' }
export const cabinTypes: Record<string, string> = { INTERIOR: 'Phòng trong', OCEAN_VIEW: 'Hướng biển', BALCONY: 'Ban công', SUITE: 'Suite' }
export function assetPath(shipId: string, modelId: string, file: string) {
  if (!file || file.startsWith('/') || file.split('/').some(part=>!part || !/^[\w.-]+$/.test(part) || part==='.' || part==='..') || !/\.(glb|json)$/i.test(file)) throw new Error('Asset không thuộc gói mô hình hợp lệ.')
  return `/ships/${encodeURIComponent(shipId)}/models/${encodeURIComponent(modelId)}/assets/${file.split('/').map(encodeURIComponent).join('/')}`
}
export function decodeManifest(value: unknown): Manifest {
  const manifest=value as Manifest
  if (!manifest || !Array.isArray(manifest.decks) || !Array.isArray(manifest.cabins) || !manifest.assets || (manifest.serviceDecks!==undefined&&!Array.isArray(manifest.serviceDecks)) || [...manifest.decks,...manifest.serviceDecks??[]].some(d=>!d.id || !Number.isFinite(d.number) || !d.asset) || manifest.cabins.some(c=>!c.id || !c.nodeName || !c.deckId)) throw new Error('Manifest chưa có cấu trúc boong/cabin hợp lệ.')
  return manifest
}
export function decodeAsset(value:unknown,modelId:string):AssetInfo { const asset=value as AssetInfo;if(!asset || asset.id!==modelId || typeof asset.revision!=='string' || ![asset.cabinCount,asset.mappedCabinCount,asset.deckCount,asset.mappedDeckCount].every(n=>Number.isInteger(n)&&n>=0))throw new Error('Thông tin asset không khớp phiên bản đã chọn.');return asset }
export function selectedCabins(manifest: Manifest, deck: string, search: string) {
  const term=search.trim().toLocaleLowerCase('vi')
  return manifest.cabins.filter(c=>(!deck || c.deckId===deck)&&(!term || `${c.cabinNumber} ${c.id} ${cabinTypes[c.cabinType]??c.cabinType}`.toLocaleLowerCase('vi').includes(term)))
}
export const formatTime = (value?: string) => value ? new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : 'Chưa có'
