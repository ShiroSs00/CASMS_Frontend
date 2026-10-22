import { apiRequest } from '@/shared/api'
import { toPublishedCruise, toPublishedPage, type LiveCruiseDto, type LiveCruisePageDto } from './live-cruise-contract'
import { lookupItinerary, toLiveDays, toLivePortCalls, toLiveShip } from './live-itinerary-contract'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const liveCruiseCatalogApi = {
 async list(page:number, signal?:AbortSignal, cruiseType?: 'ONE_DAY' | 'MULTI_DAYS') {
  const data = await apiRequest<LiveCruisePageDto>('/cruise', {
   query: { status:'PUBLISHED', page:page-1, size:6, sort:'departureDatetime,asc', cruiseType }, signal,
  })
  return toPublishedPage(data)
 },
 async detail(id:string, signal?:AbortSignal) {
  if (!UUID_REGEX.test(id)) return null
  const data = await apiRequest<LiveCruiseDto>(`/cruise/${encodeURIComponent(id)}`, { signal })
  const cruise = toPublishedCruise(data)
  if (cruise && cruise.id !== id) throw new Error('Chuyến đi trả về không khớp mã yêu cầu.')
  return cruise
 },
 async ship(id:string, signal?:AbortSignal) {
  if (!UUID_REGEX.test(id)) return null
  const ship=toLiveShip(await apiRequest<unknown>(`/ships/${encodeURIComponent(id)}`, {signal}))
  if (ship.id!==id) throw new Error('Thông tin tàu trả về không khớp shipId của chuyến đi.')
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
