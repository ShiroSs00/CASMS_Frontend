export type ShipChoice = { shipId: string; shipCode: string; shipName: string }
export type ModelVersion = { shipModelId: string; version: string; status: string; fileFormat: string; createdAt: string; updatedAt: string; shipManufacturerName?: string; modelProvider?: string }
export type AssetInfo = { id: string; modelKey: string; assetVersion: string; revision: string; status: string; cabinCount: number; mappedCabinCount: number; deckCount: number; mappedDeckCount: number; units: string; shipManufacturerName?: string; modelProvider?: string }
export type Deck = { id: string; number: number; name: string; nodeName: string; asset: string; elevationMetres?: number; cabinIds?: string[] }
export type Cabin = { id: string; modelId?: string; deckId: string; deckNumber: number; cabinNumber: string; cabinType: string; nodeName: string; capacity?: number; isAccessible?: boolean; position?: number[]; size?: number[]; areaSquareMetres?: number; gradeName?: string; sourceNumberVerified?: boolean }
export type Area = {id:string;nodeName:string;name:string;kind:string;deckId:string;deckNumber:number;center?:number[];size?:number[];interiorDetails?:string[]}
export type Manifest = { modelId: string; name: string; revision: string; units: string; length?: number; beam?: number; accuracy?: string; referenceSource?: string; referenceVersion?: string; gltfAxes?: { up?: string; bow?: string; port?: string }; assets: { full?: string; exterior?: string }; decks: Deck[]; serviceDecks?: Deck[]; cabins: Cabin[];areas?:Area[] }
export type Job = { jobId: string; status: string; startedAt: string; finishedAt?: string; decksImported: number; cabinsImported: number; objectsFailed: number; requestedBy?: string }
export type Issue = { issueId: string; objectIdentifier?: string; objectType: string; errorCode: string; message: string }
export const modelStatus: Record<string, string> = { DRAFT: 'Bản nháp', PROCESSING: 'Đang xử lý', READY: 'Đã công bố', ACTIVE: 'Đang sử dụng', FAILED: 'Lỗi xử lý', ARCHIVED: 'Lưu trữ' }
export const cabinTypes: Record<string, string> = { INTERIOR: 'Phòng trong', OCEAN_VIEW: 'Hướng biển', BALCONY: 'Ban công', SUITE: 'Phòng cao cấp' }
export function assetPath(shipId: string, modelId: string, file: string) {
  if (!file || file.startsWith('/') || file.split('/').some(part=>!part || !/^[\w.-]+$/.test(part) || part==='.' || part==='..') || !/\.(glb|json)$/i.test(file)) throw new Error('Asset không thuộc gói mô hình hợp lệ.')
  return `/ships/${encodeURIComponent(shipId)}/models/${encodeURIComponent(modelId)}/assets/${file.split('/').map(encodeURIComponent).join('/')}`
}
export function decodeManifest(value: unknown): Manifest {
  const manifest=value as Manifest
  if (!manifest || !Array.isArray(manifest.decks) || !Array.isArray(manifest.cabins) || !manifest.assets || (manifest.serviceDecks!==undefined&&!Array.isArray(manifest.serviceDecks)) || [...manifest.decks,...manifest.serviceDecks??[]].some(d=>!d.id || !Number.isFinite(d.number) || !d.asset) || manifest.cabins.some(c=>!c.id || !c.nodeName || !c.deckId)) throw new Error('Manifest chưa có cấu trúc boong/cabin hợp lệ.')
  const decks=[...manifest.decks,...manifest.serviceDecks??[]],ids=new Set<string>(),nodes=new Set<string>()
  if(manifest.areas!==undefined){
    if(!Array.isArray(manifest.areas))throw new Error('Danh sách khu vực trong manifest không hợp lệ.')
    for(const area of manifest.areas){
      if(!area||![area.id,area.nodeName,area.name,area.kind,area.deckId].every(v=>typeof v==='string'&&v.length>0)||ids.has(area.id)||nodes.has(area.nodeName)||!decks.some(d=>d.id===area.deckId&&d.number===area.deckNumber)||[area.center,area.size].some(v=>v!==undefined&&(!Array.isArray(v)||v.length!==3||!v.every(n=>typeof n==='number'&&Number.isFinite(n))))||area.size?.some(n=>n<=0)||(area.interiorDetails!==undefined&&(!Array.isArray(area.interiorDetails)||!area.interiorDetails.every(v=>typeof v==='string'))))throw new Error('Khu vực trong manifest có thông tin hoặc boong không hợp lệ.')
      ids.add(area.id);nodes.add(area.nodeName)
    }
  }
  return manifest
}
export function decodeAsset(value:unknown,modelId:string):AssetInfo { const asset=value as AssetInfo;if(!asset || asset.id!==modelId || typeof asset.revision!=='string' || ![asset.cabinCount,asset.mappedCabinCount,asset.deckCount,asset.mappedDeckCount].every(n=>Number.isInteger(n)&&n>=0))throw new Error('Thông tin asset không khớp phiên bản đã chọn.');return asset }
export function selectedCabins(manifest: Manifest, deck: string, search: string) {
  const term=search.trim().toLocaleLowerCase('vi')
  return manifest.cabins.filter(c=>(!deck || c.deckId===deck)&&(!term || `${c.cabinNumber} ${c.id} ${c.cabinType} ${cabinTypes[c.cabinType]??c.cabinType}`.toLocaleLowerCase('vi').includes(term)))
}
export function selectedAreas(manifest:Manifest,deck:string,search:string){
 const normalize=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').trim()
 const term=normalize(search)
 return (manifest.areas??[]).filter(a=>(!deck||a.deckId===deck)&&(!term||normalize(`${serviceName(a)} ${a.name} ${serviceType(a.kind)} ${a.kind} ${a.id}`).includes(term)))
}
export const formatTime = (value?: string) => value ? new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : 'Chưa có'

const serviceTypes: Record<string,string> = {
  co_working:'Phòng làm việc chung', pantry:'Quầy đồ uống và đồ ăn nhẹ', meeting_room:'Phòng họp', workshop:'Xưởng bảo trì', engine:'Phòng máy', electrical:'Phòng điện và điều khiển', waterplant:'Khu xử lý nước và máy bơm', stores:'Kho vật tư', crew_quarters:'Khu lưu trú thuyền viên', galley:'Bếp chính', crew_mess:'Nhà ăn thuyền viên', coldstore:'Kho lạnh', dining:'Nhà hàng', lounge:'Phòng sinh hoạt chung', kids:'Khu vui chơi trẻ em', casino:'Khu trò chơi có thưởng', buffet:'Nhà hàng tự chọn',
  housekeeping:'Trạm phục vụ buồng phòng', games_lounge:'Phòng trò chơi', passenger_lounge:'Phòng sinh hoạt chung', reading_room:'Phòng đọc sách', coworking_studio:'Phòng làm việc chung', restaurant:'Nhà hàng', bar:'Quầy bar', cafe:'Quán cà phê', pool:'Hồ bơi', spa:'Spa', gym:'Phòng tập', theatre:'Nhà hát', theater:'Nhà hát', reception:'Quầy lễ tân', medical:'Phòng y tế', shop:'Cửa hàng', public_area:'Không gian chung', service_area:'Khu phục vụ', corridor:'Hành lang', stairs:'Cầu thang', elevator:'Thang máy', laundry:'Phòng giặt', kitchen:'Nhà bếp', storage:'Kho', restroom:'Nhà vệ sinh', sun_deck:'Khu tắm nắng', working_studio:'Phòng làm việc chung',
}
export function serviceType(kind:string) { return serviceTypes[kind.toLowerCase()] ?? 'Dịch vụ khác' }

const serviceNames: Record<string,string> = {
  'Propulsion Workshop':'Xưởng bảo trì hệ thống động lực', 'Machinery Room':'Phòng máy', 'Electrical and Control Room':'Phòng điện và điều khiển', 'Water Treatment and Pumps':'Khu xử lý nước và máy bơm', 'Provisions Store':'Kho thực phẩm', 'Dry Stores':'Kho khô', 'Crew Accommodation':'Khu lưu trú thuyền viên', 'Main Production Galley':'Bếp chế biến chính', 'Main Galley':'Bếp chính', 'Laundry and Linen':'Phòng giặt và kho đồ vải', 'Crew Mess':'Nhà ăn thuyền viên', 'Cold Store':'Kho lạnh', 'Crew Washrooms':'Nhà vệ sinh thuyền viên', 'Medical Centre':'Phòng y tế', 'Medical Center':'Phòng y tế', 'Fitness Centre':'Phòng tập thể dục', 'Fitness Center':'Phòng tập thể dục', 'Library':'Thư viện', 'Internet Cafe':'Phòng máy tính', 'Casino':'Khu trò chơi có thưởng', 'Club Lounge':'Phòng sinh hoạt câu lạc bộ', 'Kids Club':'Câu lạc bộ trẻ em', 'Shops':'Khu mua sắm', 'Spa & Salon':'Khu chăm sóc sức khỏe và làm đẹp', 'Photo Gallery':'Phòng trưng bày ảnh', 'Atrium & Guest Services':'Sảnh trung tâm và quầy dịch vụ khách hàng',
  'Alchemy Bar':'Quầy bar Alchemy', 'Artists Lobby & Guest Services':'Sảnh Artists và quầy dịch vụ khách hàng', 'The Artists Lobby':'Sảnh Artists', 'BlueIguana Cantina':'Nhà hàng BlueIguana', 'BlueIguana Tequila Bar':'Quầy bar BlueIguana', 'Camp Ocean':'Khu vui chơi trẻ em Ocean', 'Club O2':'Câu lạc bộ O2', 'Degas Aft Lounge':'Phòng sinh hoạt Degas phía đuôi tàu', 'Guys Burger Joint':'Quầy bánh mì kẹp thịt Guy', 'Henri Dance Club':'Câu lạc bộ khiêu vũ Henri', 'Main Show Lounge balcony':'Ban công nhà hát chính', 'Monet Dining Room':'Nhà hàng Monet', 'Monet upper dining':'Nhà hàng Monet tầng trên', 'Pizza Pirate':'Quầy bánh pizza Pirate', 'RedFrog Rum Bar':'Quầy bar RedFrog', 'Renoir Dining Room':'Nhà hàng Renoir', 'Renoir Dining Room upper level':'Nhà hàng Renoir tầng trên', 'Restaurant Cezanne & Grand Buffet':'Nhà hàng Cezanne và khu ẩm thực tự chọn', 'Seafood Shack':'Quầy hải sản', 'Show Lounge upper level':'Nhà hát tầng trên', 'Spa Carnival':'Khu chăm sóc sức khỏe Carnival', 'Sports Bar':'Quầy bar thể thao', 'The Fun Shops':'Khu mua sắm', 'The Point Steakhouse':'Nhà hàng bít tết The Point', 'Toulouse-Lautrec Main Show Lounge':'Nhà hát Toulouse-Lautrec', 'Canaletto':'Nhà hàng Canaletto', 'Crows Nest':'Phòng ngắm cảnh', 'Dining Room lower level':'Nhà hàng tầng dưới', 'Dining Room upper level':'Nhà hàng tầng trên', 'Explorers Lounge':'Phòng sinh hoạt Explorers', 'Lido Bar':'Quầy bar Lido', 'Lido Market':'Khu ẩm thực Lido', 'MIX & Piano Bar':'Quầy bar MIX và phòng nhạc dương cầm', 'Neptune Lounge':'Phòng sinh hoạt Neptune', 'Ocean Bar':'Quầy bar Ocean', 'Pinnacle Grill':'Nhà hàng nướng Pinnacle', 'Wajang Theater':'Nhà hát Wajang', 'World Stage':'Sân khấu chính', 'World Stage balcony':'Ban công sân khấu chính',
}
export function serviceName(area:Area) {
  if(serviceNames[area.name]) return serviceNames[area.name]
  const generated=/^D\d+\s+.+?\s+(\d+)$/.exec(area.name)
  if(generated) return `${serviceType(area.kind)} ${generated[1]}`
  const restroom=/^Public Restrooms D(\d+)$/.exec(area.name)
  if(restroom) return `Nhà vệ sinh công cộng boong ${Number(restroom[1])}`
  return area.name
}
