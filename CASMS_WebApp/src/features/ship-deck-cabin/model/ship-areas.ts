export type AreaVector = { x:number;y:number;z:number }
export type ShipArea = {
  objectId:string;modelNodeKey:string;name:string|null;kind:string|null;deckId:string
  deckName:string;deckNumber:number;serviceLevel:boolean
  position:AreaVector|null;rotation:AreaVector|null;scale:AreaVector|null;dimensions:AreaVector|null;metadataJson:string|null
}
export type AreaDeck = {id:string|null;key:string;name:string;number:number;serviceLevel:boolean}
export type ShipAreas = {shipId:string;shipName:string;configurationVersion:string|null;unit:string|null;decks:AreaDeck[];areas:ShipArea[];supported:boolean}
const record=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null
const invalid=()=>new Error('Dữ liệu khu vực không hợp lệ hoặc không khớp tàu đang xem. Hãy tải lại cấu hình.')
function nullableText(value:unknown):string|null {if(value==null)return null;if(typeof value!=='string')throw invalid();return value}
function vector(value:unknown):AreaVector|null {
 if(value==null)return null
 const v=record(value)
 if(!v||![v.x,v.y,v.z].every(n=>typeof n==='number'&&Number.isFinite(n)))throw invalid()
 return {x:v.x as number,y:v.y as number,z:v.z as number}
}
export function decodeShipAreas(value:unknown,shipId:string):ShipAreas {
 const data=record(value)
 if(!data||data.shipId!==shipId||typeof data.shipName!=='string'||!Array.isArray(data.decks))throw invalid()
 const model=record(data.model),areas:ShipArea[]=[],ids=new Set<string>(),deckKeys=new Set<string>()
 let supported=true
 const decks=data.decks.map(raw=>{
  const d=record(raw)
  if(!d||!Number.isSafeInteger(d.deckNumber)||d.serviceLevel!=null&&typeof d.serviceLevel!=='boolean')throw invalid()
  const id=nullableText(d.deckId),node=nullableText(d.modelNodeKey),key=id||node
  if(!key||deckKeys.has(key))throw invalid()
  deckKeys.add(key)
  const deck={id,key,name:nullableText(d.name)||`Boong ${d.deckNumber}`,number:d.deckNumber as number,serviceLevel:d.serviceLevel===true}
  if(d.facilities===undefined){supported=false;return deck}
  if(!Array.isArray(d.facilities))throw invalid()
  for(const rawArea of d.facilities){
   const a=record(rawArea)
   if(!a||typeof a.objectId!=='string'||!a.objectId||ids.has(a.objectId)||typeof a.modelNodeKey!=='string'||!a.modelNodeKey||!id||a.deckId!==id)throw invalid()
   ids.add(a.objectId)
   areas.push({objectId:a.objectId,modelNodeKey:a.modelNodeKey,name:nullableText(a.name),kind:nullableText(a.kind),deckId:id,
    deckName:deck.name,deckNumber:deck.number,serviceLevel:deck.serviceLevel,
    position:vector(a.position),rotation:vector(a.rotation),scale:vector(a.scale),dimensions:vector(a.dimensions),metadataJson:nullableText(a.metadataJson)})
  }
  return deck
 }).sort((a,b)=>a.number-b.number)
 areas.sort((a,b)=>a.deckNumber-b.deckNumber||(a.name??a.modelNodeKey).localeCompare(b.name??b.modelNodeKey,'vi'))
 return {shipId,shipName:data.shipName,configurationVersion:nullableText(data.configurationVersion),unit:nullableText(model?.unit),decks,areas,supported}
}
const labels:Record<string,string>={gym:'Phòng tập',lounge:'Khu thư giãn',restaurant:'Nhà hàng',pool:'Hồ bơi',spa:'Spa',bar:'Quầy bar',theater:'Nhà hát',theatre:'Nhà hát',shop:'Cửa hàng',casino:'Casino',cinema:'Rạp chiếu phim',library:'Thư viện',reception:'Lễ tân',medical:'Khu y tế',playground:'Khu vui chơi',elevator:'Thang máy',stairs:'Cầu thang',corridor:'Hành lang'}
export const areaKindLabel=(kind:string|null)=>kind?labels[kind.toLowerCase()]??kind:'Chưa phân loại'
const normalized=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').trim()
export function filterShipAreas(areas:ShipArea[],search:string,deck:string,kind:string){
 const term=normalized(search)
 return areas.filter(area=>(!deck||area.deckId===deck)&&(!kind||(area.kind??'')===kind)&&(!term||normalized(`${area.name??''} ${area.modelNodeKey} ${areaKindLabel(area.kind)} ${area.deckName}`).includes(term)))
}
