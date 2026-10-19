import { isUuid } from './live-cruise-contract.ts'

type Json = Record<string, unknown>
const record = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined
function uuid(value: unknown, field: string) {
  if (!isUuid(value)) throw new Error(`Dữ liệu ${field} không hợp lệ.`)
  return value
}
function optionalUuid(value: unknown, field: string) {
  return value == null ? undefined : uuid(value, field)
}
function count(value: unknown, field: string) {
  if (value == null) return undefined
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`Dữ liệu ${field} không hợp lệ.`)
  return value as number
}
function instant(value: unknown, field: string) {
  if (value == null) return undefined
  const result = text(value)
  if (!result || !Number.isFinite(Date.parse(result))) throw new Error(`Dữ liệu ${field} không hợp lệ.`)
  return result
}

export type LiveShip = { id:string; name:string; code?:string; status?:string; capacity?:number; decks?:number; commissionDate?:string }
export type LiveItinerary = { id:string; cruiseId:string; name?:string; status?:string; startDate?:string; endDate?:string }
export type LiveItineraryDay = { id:string; itineraryId:string; number:number; date?:string; type?:string; description?:string }
export type LivePortCall = { id:string; itineraryId:string; arrivalDayId?:string; departureDayId?:string; order?:number; port?:string; destination?:string; plannedArrival?:string; plannedDeparture?:string; status?:string }
export type ItineraryLookup = {kind:'found'; itinerary:LiveItinerary} | {kind:'missing'} | {kind:'limit'; pagesScanned:number; totalPages:number}

export function toLiveShip(value: unknown): LiveShip {
  if (!record(value)) throw new Error('Dữ liệu tàu không đúng định dạng.')
  return { id:uuid(value.shipId,'shipId'), name:text(value.shipName)??'Chưa có tên tàu', code:text(value.shipCode), status:text(value.status), capacity:count(value.totalCapacity,'totalCapacity'), decks:count(value.totalDecks,'totalDecks'), commissionDate:text(value.commissionDate) }
}
export function toLiveItinerary(value: unknown): LiveItinerary {
  if (!record(value)) throw new Error('Dữ liệu lịch trình không đúng định dạng.')
  return { id:uuid(value.itineraryId,'itineraryId'), cruiseId:uuid(value.cruiseId,'cruiseId'), name:text(value.itineraryName), status:text(value.status), startDate:text(value.startDate), endDate:text(value.endDate) }
}
export function toLiveDays(value: unknown, itineraryId:string): LiveItineraryDay[] {
  if (!Array.isArray(value)) throw new Error('Danh sách ngày lịch trình không đúng định dạng.')
  return value.map(item=>{
    if (!record(item)) throw new Error('Dữ liệu ngày lịch trình không đúng định dạng.')
    const parent=uuid(item.itineraryId,'itineraryId')
    if (parent!==itineraryId) throw new Error('Ngày lịch trình không thuộc hành trình này.')
    const number=count(item.dayNumber,'dayNumber')
    if (number===undefined || number<1) throw new Error('Ngày lịch trình thiếu thứ tự ngày.')
    return {id:uuid(item.itineraryDayId,'itineraryDayId'),itineraryId:parent,number,date:text(item.date),type:text(item.dayType),description:text(item.description)}
  }).sort((a,b)=>a.number-b.number)
}
export function toLivePortCalls(value: unknown, itineraryId:string): LivePortCall[] {
  if (!Array.isArray(value)) throw new Error('Danh sách điểm dừng không đúng định dạng.')
  return value.map(item=>{
    if (!record(item)) throw new Error('Dữ liệu điểm dừng không đúng định dạng.')
    const parent=uuid(item.itineraryId,'itineraryId')
    if (parent!==itineraryId) throw new Error('Điểm dừng không thuộc hành trình này.')
    return {id:uuid(item.cruiseStopId,'cruiseStopId'),itineraryId:parent,arrivalDayId:optionalUuid(item.arrivalItineraryDayId,'arrivalItineraryDayId'),departureDayId:optionalUuid(item.departureItineraryDayId,'departureItineraryDayId'),order:count(item.stopOrder,'stopOrder'),port:text(item.portName),destination:text(item.destinationName),plannedArrival:instant(item.plannedArrival,'plannedArrival'),plannedDeparture:instant(item.plannedDeparture,'plannedDeparture'),status:text(item.status)}
  }).sort((a,b)=>(a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER))
}

export async function lookupItinerary(cruiseId:string, loadPage:(page:number)=>Promise<unknown>, maxPages=8):Promise<ItineraryLookup> {
  if (!isUuid(cruiseId) || !Number.isSafeInteger(maxPages) || maxPages<1) throw new Error('Yêu cầu tra cứu lịch trình không hợp lệ.')
  let expectedPages:number|undefined
  for (let page=0;page<maxPages;page++) {
    const value=await loadPage(page)
    if (!record(value) || !Array.isArray(value.content) || value.number!==page || !Number.isInteger(value.totalPages) || (value.totalPages as number)<0) throw new Error('Phân trang lịch trình không đúng định dạng.')
    if (expectedPages!==undefined && value.totalPages!==expectedPages) throw new Error('Số trang lịch trình đã thay đổi trong lúc tra cứu.')
    expectedPages=value.totalPages as number
    const matches=value.content.map(toLiveItinerary).filter(item=>item.cruiseId===cruiseId)
    if (matches.length>1) throw new Error('Có nhiều lịch trình cho cùng một chuyến đi.')
    if (matches.length===1) return {kind:'found',itinerary:matches[0]}
    const totalPages=value.totalPages as number
    if (page+1>=totalPages) return {kind:'missing'}
    if (page+1===maxPages) return {kind:'limit',pagesScanned:maxPages,totalPages}
  }
  throw new Error('Không thể hoàn tất tra cứu lịch trình.')
}
