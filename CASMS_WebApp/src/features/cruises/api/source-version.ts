import { apiRequest, ApiError } from '@/shared/api'
type SourceVersionDto={versionId:string;versionNumber:number;tripId:string;status:string}
type SourceTripDto={tripId:string;tripCode:string;name:string}

export async function readPublishedSource(versionId: string, signal?: AbortSignal) {
  const version = await apiRequest<SourceVersionDto>('/trip-schedule-versions/' + encodeURIComponent(versionId), {signal})
  if (version?.versionId !== versionId || !version.tripId || !Number.isSafeInteger(version.versionNumber)) throw new ApiError('Chưa đọc được đúng phiên bản nguồn đã chọn.',502)
  if (version.status !== 'PUBLISHED') throw new ApiError('Chỉ phiên bản lịch trình đã phát hành mới được dùng làm nguồn.',400,'VERSION_NOT_PUBLISHED')
  const trip = await apiRequest<SourceTripDto>('/trips/' + encodeURIComponent(version.tripId),{signal})
  if (trip?.tripId !== version.tripId || !trip.tripCode || !trip.name) throw new ApiError('Chưa đọc được chuyến đi của phiên bản nguồn.',502)
  return {versionId:version.versionId,versionNumber:version.versionNumber,status:version.status,tripId:trip.tripId,tripCode:trip.tripCode,tripName:trip.name}
}
