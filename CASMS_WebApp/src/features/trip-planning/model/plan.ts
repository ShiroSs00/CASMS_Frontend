import type { CurrentTrip, CurrentVersion, CurrentDay, CurrentStop, CurrentEntry, EntryLocation } from '../api/current-contract'

/** Form model; api/mappers and saveInfo map it to the Java DTO field names. */
export type TripInfo = { name: string; durationBand: 'SHORT' | 'LONG' | ''; scope: 'DOMESTIC' | 'INTERNATIONAL' | ''; regionIds: string[]; countryCodes: string[]; description: string }
export type TargetTripCreate = TripInfo
export type Day = CurrentDay & { key: string }
export type Stop = CurrentStop
export type Entry = CurrentEntry & { sourceId: string | null }
export type Content = { days: Day[]; stops: Stop[]; entries: Entry[] }
export type Trip = CurrentTrip & { info: TripInfo; durationIssue?:string }
export type Version = Omit<CurrentVersion, 'days' | 'stops' | 'entries'> & Content
export type SourceKind = 'ports' | 'services' | 'activities' | 'excursions' | 'regions' | 'countries' | 'durations' | 'activityCategories'
export type SourceQuery = { keyword?:string; category?:string; portId?:string; destinationId?:string }
export type Source = EntryLocation & { id: string; label: string; name?:string; timeZoneId?: string; portId?: string; countryCode?:string; domesticRegion?:string | null; destinationId?:string; destinationName?:string; supplierName?:string; description?:string; location?:string; meetingPoint?:string; minDays?:number; maxDays?:number; defaultDays?:number }
export type Violation = { code: string; severity: 'ERROR' | 'WARNING'; message: string; dayNumber?: number; clientKey?: string; field?: string; fieldPath?:string; actionHint?:string; entityType?: string }
export type Report = { versionId: string; revision: number; validForSubmit: boolean; violations: Violation[]; deferredChecks: string[] }
export type History = { auditId: string; action: string; actorUserId: string | null; actorName?:string|null; entityType?:string; entityId?:string; detail: string; occurredAt: string; result: string }
export type PageResult<T>={content:T[];totalPages:number;totalElements:number}
export type ReviewItem={versionId:string;versionNumber:number;status:'IN_REVIEW';revision:number;tripId:string;tripCode:string;tripName:string;submitterName?:string|null;creatorName?:string|null;submittedAt?:string|null}
export const SHIP_ZONE = 'Asia/Ho_Chi_Minh'
export function countryLabel(code?:string){
  if(!code)return 'Chưa có thông tin quốc gia'
  try{return new Intl.DisplayNames(['vi'],{type:'region'}).of(code)??code}catch{return code}
}
// Display labels for the region codes published by TripCatalogController. Never infer a region here.
export function domesticRegionLabel(code?:string|null){
  return code?({BAC_BO:'Miền Bắc',TRUNG_BO:'Miền Trung',NAM_BO:'Miền Nam'} as Record<string,string>)[code]??'Miền chưa xác định':'Miền chưa xác định'
}
export const versionLabels = { DRAFT: 'Bản nháp', IN_REVIEW: 'Chờ duyệt', PUBLISHED: 'Đã phát hành', CANCELLED:'Đã hủy' }
export const tripLabels = { DRAFT: 'Nháp', READY: 'Sẵn sàng', ARCHIVED: 'Đã lưu trữ' }
export const kindLabels = { ONBOARD_ACTIVITY: 'Hoạt động trên tàu', SHORE_EXCURSION: 'Tham quan trên bờ', SERVING_WINDOW: 'Khung phục vụ' }
export const emptyInfo = (): TripInfo => ({ name: '', durationBand: 'SHORT', scope: '', regionIds: [], countryCodes: [], description: '' })
export const contentOf = (v: Version): Content => structuredClone({ days: v.days, stops: v.stops, entries: v.entries })
export const newKey = () => crypto.randomUUID()
export const shortTime = (time: string | null | undefined) => time?.slice(0, 5) ?? 'Chưa có giờ'
export const timeNumber = (day: number, time: string | null) => (day - 1) * 86400 + (time ? time.split(':').reduce((sum, part, index) => sum + Number(part) * [3600,60,1][index], 0) : 0)
export function infoErrors(form: TripInfo) {
  const errors: Record<string,string> = {}
  if (!form.name.trim()) errors.name = 'Nhập tên chuyến.'
  if (form.name.length > 200) errors.name = 'Tên chuyến tối đa 200 ký tự.'
  if (!form.durationBand) errors.durationBand = 'Chọn thời lượng.'
  if (!form.scope) errors.scope = 'Chọn phạm vi.'
  if (form.scope === 'DOMESTIC' && !form.regionIds.length) errors.regions = 'Chọn ít nhất một miền.'
  if (form.scope === 'INTERNATIONAL' && !form.countryCodes.length) errors.countries = 'Chọn ít nhất một quốc gia/vùng lãnh thổ.'
  return errors
}
export function localViolations(content: Content): Violation[] {
  const errors: Violation[] = [], orders = new Set<number>()
  const issue = (message: string, dayNumber?: number, clientKey?: string) => errors.push({ code: 'CLIENT_INPUT', severity: 'ERROR', message, dayNumber, clientKey })
  for (const day of content.days) {
    if (!day.dayType) issue('Chọn loại ngày.', day.dayNumber)
    if (day.dayType === 'SEA_DAY' && content.stops.some(s => s.arrivalDayNumber <= day.dayNumber && s.departureDayNumber >= day.dayNumber)) issue('Ngày trên biển vẫn có lần ghé cảng bao phủ.', day.dayNumber)
  }
  for (const stop of content.stops) {
    if (orders.has(stop.stopOrder)) issue('Thứ tự lần ghé cảng phải duy nhất.', stop.arrivalDayNumber, stop.clientKey)
    orders.add(stop.stopOrder)
    if (stop.isEmbarkation && stop.arrivalDayNumber !== 1) issue('Điểm đón phải ở Ngày 1.', stop.arrivalDayNumber, stop.clientKey)
    if (stop.isDisembarkation && stop.departureDayNumber !== content.days.length) issue('Điểm trả phải ở ngày cuối.', stop.departureDayNumber, stop.clientKey)
    if (content.entries.some(e => e.kind === 'SHORE_EXCURSION' && e.stopClientKey === stop.clientKey) && (!stop.allAboardTime || !stop.allAboardDayNumber)) issue('Lần ghé có tham quan cần hạn trở lại tàu.', stop.arrivalDayNumber, stop.clientKey)
  }
  for (const entry of content.entries) if (timeNumber(entry.endDayNumber,entry.plannedEndTime) <= timeNumber(entry.startDayNumber,entry.plannedStartTime)) issue('Giờ kết thúc phải sau giờ bắt đầu.',entry.startDayNumber,entry.clientKey)
  return errors
}
