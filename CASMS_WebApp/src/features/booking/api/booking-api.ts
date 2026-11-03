import { ApiError, apiRequest } from '@/shared/api'
import { decodePublicSale, decodePublicItinerary } from './public-sale-contract'
import { toPublishedCruise, toPublishedPage, type LiveCruiseDto, type LiveCruisePageDto } from './live-cruise-contract'
import { lookupItinerary, toLiveDays, toLivePortCalls, toLiveShip } from './live-itinerary-contract'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const liveCruiseCatalogApi = {
 async publicSaleState(id:string,signal?:AbortSignal) {
  return decodePublicSale(await apiRequest<unknown>(`/cruise/${encodeURIComponent(id)}/sellability`,{signal}),id)
 },
 async publicItinerary(id:string,signal?:AbortSignal) {
  return decodePublicItinerary(await apiRequest<unknown>(`/cruise/${encodeURIComponent(id)}/public-itinerary`,{signal}),id)
 },
 async saleState(id:string,signal?:AbortSignal) {
  if(!UUID_REGEX.test(id))throw new ApiError('Không xác định được chuyến khởi hành.',400)
  const value=await apiRequest<unknown>(`/cruise/${encodeURIComponent(id)}/sellability`,{signal})
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError('Chưa xác định được trạng thái bán.',502)
  const row=value as Record<string,unknown>
  if(row.cruiseId!==id||typeof row.sellable!=='boolean'||typeof row.saleState!=='string'||!['OPEN_FOR_SALE','STOPPED','NOT_YET_OPEN','DEPARTED','SOLD_OUT','DRAFT','CANCELLED'].includes(row.saleState)
   ||row.sellable!==(row.saleState==='OPEN_FOR_SALE')||row.evaluatedAt!=null&&(typeof row.evaluatedAt!=='string'||!Number.isFinite(Date.parse(row.evaluatedAt))))throw new ApiError('Trạng thái bán chưa khớp chuyến khởi hành.',502)
  return {saleState:row.saleState,sellable:row.sellable,evaluatedAt:typeof row.evaluatedAt==='string'?row.evaluatedAt:null}
 },
 async list(page:number, signal?:AbortSignal, cruiseType?: 'ONE_DAY' | 'MULTI_DAYS') {
  const data = await apiRequest<LiveCruisePageDto>('/cruise', {
   query: { status:'PUBLISHED', saleState:'OPEN_FOR_SALE', page:page-1, size:6, sort:'departureDatetime,asc', cruiseType }, signal,
  })
  return toPublishedPage(data)
 },
 async detail(id:string, signal?:AbortSignal) {
  if (!UUID_REGEX.test(id)) return null
  const data = await apiRequest<LiveCruiseDto>(`/cruise/${encodeURIComponent(id)}`, { query:{saleState:'OPEN_FOR_SALE'}, signal })
  const cruise = toPublishedCruise(data)
  if (cruise && cruise.id !== id) throw new Error('Chuyến khởi hành trả về không khớp mã yêu cầu.')
  return cruise
 },
 async ship(id:string, signal?:AbortSignal) {
  if (!UUID_REGEX.test(id)) return null
  const ship=toLiveShip(await apiRequest<unknown>(`/ships/${encodeURIComponent(id)}`, {signal}))
  if (ship.id!==id) throw new Error('Thông tin tàu trả về không khớp shipId của chuyến khởi hành.')
  return ship
 },
 async itinerary(cruiseId:string, signal?:AbortSignal) {
  return lookupItinerary(cruiseId,page=>apiRequest<unknown>('/itineraries',{
   query:{page,size:50,sort:'itineraryId,asc'},signal,
  }))
 },
 async days(itineraryId:string, signal?:AbortSignal) {
  return toLiveDays(await apiRequest<unknown>(`/itineraries/${encodeURIComponent(itineraryId)}/days`,{signal}),itineraryId)
 },
 async stops(itineraryId:string, signal?:AbortSignal) {
  return toLivePortCalls(await apiRequest<unknown>(`/cruise-stops/by-itinerary/${encodeURIComponent(itineraryId)}`,{signal}),itineraryId)
 },
}
