import type { ItineraryDayRole } from '@/domain/itinerary-day'
import { apiRequest, ApiError } from '@/shared/api'
export type SourceDay={dayNumber:number;dayRole?:ItineraryDayRole;departurePortId?:string|null;departurePortName?:string|null;plannedDepartureTime?:string|null;dayType:string|null;title:string|null;shipTimeZoneId:string}
export type SourceStop={clientKey:string;portName?:string;stopOrder:number;arrivalDayNumber:number;departureDayNumber:number;plannedArrivalTime:string|null;plannedDepartureTime:string|null;timeZoneId?:string}
export type SourceEntry={clientKey:string;title:string;kind:'ONBOARD_ACTIVITY'|'SHORE_EXCURSION'|'SERVING_WINDOW';startDayNumber:number;endDayNumber:number;plannedStartTime:string;plannedEndTime:string;timeZoneId:string;locationText:string|null;meetingPoint:string|null}
type SourceVersionDto={versionId:string;versionNumber:number;revision?:number|null;tripId:string;status:string;days:SourceDay[];stops:SourceStop[];entries:SourceEntry[]}
type SourceTripDto={tripId:string;tripCode:string;name:string;status:string;description?:string|null}

export async function readPublishedSource(versionId: string, signal?: AbortSignal) {
  const version = await apiRequest<SourceVersionDto>('/trip-schedule-versions/' + encodeURIComponent(versionId), {signal})
  if (version?.versionId !== versionId || !version.tripId || !Number.isSafeInteger(version.versionNumber)) throw new ApiError('Chưa đọc được đúng phiên bản nguồn đã chọn.',502)
  if (version.status !== 'PUBLISHED') throw new ApiError('Chỉ phiên bản lịch trình đã phát hành mới được dùng làm nguồn.',400,'VERSION_NOT_PUBLISHED')
  const trip = await apiRequest<SourceTripDto>('/trips/' + encodeURIComponent(version.tripId),{signal})
  if (trip?.tripId !== version.tripId || !trip.tripCode || !trip.name) throw new ApiError('Chưa đọc được chuyến đi của phiên bản nguồn.',502)
  if(trip.status==='ARCHIVED')throw new ApiError('Chuyến đi nguồn đã lưu trữ. Chọn phiên bản của chuyến còn sử dụng.',422,'TRIP_ARCHIVED')
  if(!Array.isArray(version.days)||!version.days.length||version.days.some(d=>!d||typeof d!=='object'||!Number.isSafeInteger(d.dayNumber))||!Array.isArray(version.stops)||version.stops.some(v=>!v||typeof v!=='object'||!v.clientKey||!Number.isSafeInteger(v.arrivalDayNumber)||!Number.isSafeInteger(v.departureDayNumber))||!Array.isArray(version.entries)||version.entries.some(v=>!v||typeof v!=='object'||!v.clientKey||typeof v.title!=='string'||!['ONBOARD_ACTIVITY','SHORE_EXCURSION','SERVING_WINDOW'].includes(v.kind)))throw new ApiError('Nội dung phiên bản nguồn chưa đầy đủ. Chưa thể tạo lần khởi hành từ bản này.',502)
  if(version.revision!=null&&(!Number.isSafeInteger(version.revision)||version.revision<0))throw new ApiError('Revision nguồn chưa hợp lệ.',502)
  return {revision:version.revision??null,description:trip.description??null,days:version.days,stops:version.stops,entries:version.entries,versionId:version.versionId,versionNumber:version.versionNumber,status:version.status,tripId:trip.tripId,tripCode:trip.tripCode,tripName:trip.name}
}

export type EligibleSource = {
  versionId:string;versionNumber:number;revision?:number|null;publishedAt?:string|null
  tripId:string;tripCode:string;tripName:string;durationDays:number;durationNights?:number|null
  plannedScope?:string|null;countryCodes?:string[]|null;domesticRegions?:string[]|null
  departurePortId?:string|null;departurePortName?:string|null;departurePortCode?:string|null
  returnPortId?:string|null;returnPortName?:string|null;returnPortCode?:string|null
  totalStops?:number;stopsSummary?:string[]|null
}
type EligibleSourcePage = {content:EligibleSource[];totalPages:number;totalElements:number;number:number;size:number}
export async function eligibleSources(keyword:string,page:number,signal?:AbortSignal,tripId?:string){
  const result=await apiRequest<EligibleSourcePage>('/trip-schedule-versions/eligible-sources',{query:{tripId:tripId||undefined,keyword:keyword.trim()||undefined,page,size:10},signal})
  if(!Array.isArray(result?.content)||!Number.isSafeInteger(result.totalPages)||result.totalPages<0||!Number.isSafeInteger(result.totalElements)||result.totalElements<0||!Number.isSafeInteger(result.number)||result.number!==page||!Number.isSafeInteger(result.size)||result.size<=0||result.content.some(v=>!v||typeof v.versionId!=='string'||!v.versionId||typeof v.tripId!=='string'||!v.tripId||typeof v.tripCode!=='string'||!v.tripCode||typeof v.tripName!=='string'||!v.tripName||!Number.isSafeInteger(v.versionNumber)||v.versionNumber<1||!Number.isSafeInteger(v.durationDays)||v.durationDays<1||v.revision!=null&&(!Number.isSafeInteger(v.revision)||v.revision<0)))throw new ApiError('Danh sách lịch trình nguồn chưa hợp lệ.',502)
  if(result.content.some(v=>[v.publishedAt,v.plannedScope,v.departurePortId,v.departurePortName,v.departurePortCode,v.returnPortId,v.returnPortName,v.returnPortCode].some(value=>value!=null&&typeof value!=='string')||[v.durationNights,v.totalStops].some(value=>value!=null&&(!Number.isSafeInteger(value)||value<0))||[v.countryCodes,v.domesticRegions,v.stopsSummary].some(value=>value!=null&&(!Array.isArray(value)||value.some(item=>typeof item!=='string')))||v.publishedAt!=null&&!Number.isFinite(Date.parse(v.publishedAt))))throw new ApiError('Thông tin lịch trình nguồn chưa đúng định dạng.',502)
  return result
}

export type PublishedSource=Awaited<ReturnType<typeof readPublishedSource>>
