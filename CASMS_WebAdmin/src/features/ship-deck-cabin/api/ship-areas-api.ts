import {ApiError,apiRequest} from '@/shared/api'
import {decodeImportedAreas,decodeShipAreas} from '../model/ship-areas'

export async function readShipAreas(shipId:string,signal?:AbortSignal,canReadDraft=false){
 const root=`/ships/${encodeURIComponent(shipId)}`
 try{return decodeShipAreas(await apiRequest<unknown>(`${root}/3d-configuration`,{signal}),shipId)}
 catch(error){
  if(!canReadDraft||!(error instanceof ApiError)||error.code!=='SHIP_MODEL_NOT_READY')throw error
  const versions=await apiRequest<Array<{shipId:string;shipModelId:string;version:string;status:string;createdAt:string;coordinateUnit?:string}>>(`${root}/models`,{signal})
  if(!Array.isArray(versions)||versions.some(v=>!v||v.shipId!==shipId||typeof v.shipModelId!=='string'||!v.shipModelId||typeof v.version!=='string'||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))))throw new Error('Danh sách phiên bản mô hình không hợp lệ.',{cause:error})
  const draft=versions.filter(v=>v.status==='DRAFT').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]
  if(!draft)throw error
  const objects=await apiRequest<unknown>(`${root}/models/${encodeURIComponent(draft.shipModelId)}/objects`,{signal})
  return decodeImportedAreas(objects,shipId,draft.shipModelId,draft.version,draft.coordinateUnit??null)
 }
}

export type ServiceArea = {id:string;name:string|null;kind:string|null;deckId:string;deckName:string;deckNumber:number}
export async function readShipServiceAreas(shipId:string,signal?:AbortSignal):Promise<ServiceArea[]> {
 const value=await apiRequest<unknown>(`/ships/${encodeURIComponent(shipId)}/areas`,{signal})
 if(!Array.isArray(value))throw new Error('Danh sách khu vực dịch vụ không hợp lệ.')
 const ids=new Set<string>()
 return value.map(row=>{
  if(!row||typeof row!=='object'||row.shipId!==shipId||typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.deckId!=='string'||!row.deckId||typeof row.deckName!=='string'||!Number.isSafeInteger(row.deckNumber)||(row.name!==null&&typeof row.name!=='string')||(row.kind!==null&&typeof row.kind!=='string'))throw new Error('Thông tin khu vực dịch vụ không hợp lệ.')
  ids.add(row.id)
  return {id:row.id,name:row.name,kind:row.kind,deckId:row.deckId,deckName:row.deckName,deckNumber:row.deckNumber}
 })
}
