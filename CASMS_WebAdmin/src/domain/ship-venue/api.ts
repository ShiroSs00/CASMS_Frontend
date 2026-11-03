import {ApiError,apiRequest} from '@/shared/api'
import type {ShipVenueOptions} from './index'

export type ShipVenueCabin={id:string;number:string;shipId:string;deckId:string;capacity:number;status:string}
const invalid=()=>new ApiError('Địa điểm trên tàu chưa khớp dữ liệu hiện tại. Tải lại danh mục trước khi chọn.',502)
const text=(value:unknown):value is string=>typeof value==='string'&&Boolean(value.trim())

/** CRUISE_READ + DECK_READ. No dependency on the service-management options permission. */
export async function readShipVenueOptions(cruiseId:string,signal?:AbortSignal):Promise<ShipVenueOptions>{
  const cruise=await apiRequest<{cruiseId:string;shipId:string|null;shipName:string|null}>(`/cruise/${encodeURIComponent(cruiseId)}`,{signal})
  if(cruise?.cruiseId!==cruiseId||cruise.shipId!=null&&!text(cruise.shipId)||cruise.shipName!=null&&typeof cruise.shipName!=='string')throw invalid()
  if(cruise.shipId==null)return{ship:{id:null,name:null},decks:[]}
  const decks:ShipVenueOptions['decks']=[]
  let page=0,totalPages:number
  do{
    const rows:{content:{deckId:string;shipId:string;deckName:string;deckNumber:number}[];number:number;totalPages:number}=await apiRequest<{content:{deckId:string;shipId:string;deckName:string;deckNumber:number}[];number:number;totalPages:number}>(`/decks/by-ship/${encodeURIComponent(cruise.shipId)}`,{query:{page,size:100,sort:'deckNumber,asc'},signal})
    if(!rows||!Array.isArray(rows.content)||rows.number!==page||!Number.isSafeInteger(rows.totalPages)||rows.totalPages<0)throw invalid()
    for(const deck of rows.content){
      if(!deck||!text(deck.deckId)||deck.shipId!==cruise.shipId||!text(deck.deckName)||!Number.isSafeInteger(deck.deckNumber)||decks.some(item=>item.id===deck.deckId))throw invalid()
      decks.push({id:deck.deckId,shipId:deck.shipId,name:deck.deckName,number:deck.deckNumber})
    }
    totalPages=rows.totalPages;page++
  }while(page<totalPages)
  return{ship:{id:cruise.shipId,name:cruise.shipName??null},decks}
}

/** DeckController explicitly permits this projection with DECK_READ. It does not reserve a cabin. */
export async function readShipVenueCabins(shipId:string,deckId:string,signal?:AbortSignal):Promise<ShipVenueCabin[]>{
  const rows=await apiRequest<{cabinId:string;cabinNumber:string;shipId:string;deckId:string;capacity:number;status:string}[]>(`/decks/${encodeURIComponent(deckId)}/cabins`,{signal})
  if(!Array.isArray(rows)||rows.some(c=>!c||!text(c.cabinId)||!text(c.cabinNumber)||c.shipId!==shipId||c.deckId!==deckId||!Number.isSafeInteger(c.capacity)||c.capacity<1||!text(c.status))||new Set(rows.map(c=>c.cabinId)).size!==rows.length)throw invalid()
  return rows.map(c=>({id:c.cabinId,number:c.cabinNumber,shipId:c.shipId,deckId:c.deckId,capacity:c.capacity,status:c.status}))
}
