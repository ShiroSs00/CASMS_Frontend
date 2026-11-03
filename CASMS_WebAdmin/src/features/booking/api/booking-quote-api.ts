import {ApiError,apiRequest} from '@/shared/api'
import {decodeQuote,type Quote} from './quote-contract'
import {decodeBookingDetail,serializeBooking,serializeCabinSelection,type BookingDraft} from './real-booking-api'

export type BookingQuoteIntent={quote:Quote;selection:string;guestToken?:string;idempotencyKey:string}
export const quoteSelection=(draft:BookingDraft)=>JSON.stringify({cruiseId:draft.cruiseId,currency:'USD',paymentPlan:draft.paymentPlan,passengers:draft.passengers.map(p=>serializeCabinSelection(p,true))})
function valid(quote:Quote,draft:BookingDraft){
 if(quote.currency!=='USD'||quote.status!=='ACTIVE'||!quote.expiresAt||Date.parse(quote.expiresAt)<=Date.now()||quote.totalAmount===null||!quote.policyVersion||!quote.fingerprint||quote.paymentPlan!==draft.paymentPlan||!quote.lineItems||quote.lineItems.length!==draft.passengers.length||quote.lineItems.some((line,i)=>{
  const p=draft.passengers[i],fare=Boolean(p.farePackageOfferId)
  if((line.cabinId??'')!==p.cabinId||(line.tourPackageId??'')!==p.tourPackageId||Boolean(line.fareSelection)!==fare)return true
  if(!fare)return false
  const captured=line.fareSelection;if(!captured)return true
  const mode=p.cabinSelectionMode??'PHYSICAL_CABIN',group=p.cabinGroupKey?.trim()||(mode==='CATEGORY_HOLD'?'BOOKING_GROUP':'CABIN:'+p.cabinId)
  return captured.offerId!==p.farePackageOfferId||captured.priceRevisionId!==p.farePackagePriceRevisionId||line.cabinSelectionMode!==mode||line.cabinGroupKey!==group
 }))throw new ApiError('',409,'QUOTE_INVALIDATED')
}
const fareContent=(quote:Quote)=>JSON.stringify(quote.lineItems?.map(line=>line.fareSelection))
export async function requestBookingQuote(draft:BookingDraft):Promise<BookingQuoteIntent>{
 const value=await apiRequest<Quote&{guestToken?:string}>('/booking/quotes',{method:'POST',body:JSON.parse(quoteSelection(draft))})
 const quote=decodeQuote(value,draft.cruiseId);valid(quote,draft)
 const guestToken=typeof value.guestToken==='string'&&value.guestToken?value.guestToken:undefined
 const readback=decodeQuote(await apiRequest('/booking/quotes/'+encodeURIComponent(quote.quoteId),{guestToken}),draft.cruiseId,quote.quoteId)
 valid(readback,draft)
 if(readback.fingerprint!==quote.fingerprint||readback.totalAmount!==quote.totalAmount||readback.policyVersion!==quote.policyVersion||fareContent(readback)!==fareContent(quote))throw new ApiError('',502)
 return {quote:readback,selection:quoteSelection(draft),guestToken,idempotencyKey:crypto.randomUUID()}
}
export async function createQuotedBooking(draft:BookingDraft,intent:BookingQuoteIntent){
 if(intent.selection!==quoteSelection(draft))throw new ApiError('',409,'QUOTE_SELECTION_MISMATCH')
 valid(intent.quote,draft)
 const actual=decodeQuote(await apiRequest('/booking/quotes/'+encodeURIComponent(intent.quote.quoteId),{guestToken:intent.guestToken}),draft.cruiseId,intent.quote.quoteId)
 valid(actual,draft)
 if(actual.fingerprint!==intent.quote.fingerprint||actual.totalAmount!==intent.quote.totalAmount||actual.policyVersion!==intent.quote.policyVersion||fareContent(actual)!==fareContent(intent.quote))throw new ApiError('',409,'QUOTE_INVALIDATED')
 const saved=decodeBookingDetail(await apiRequest('/booking',{method:'POST',idempotencyKey:intent.idempotencyKey,body:{...serializeBooking(draft),currency:'USD',quoteId:actual.quoteId,quoteGuestToken:intent.guestToken}}))
 if(saved.cruiseId!==draft.cruiseId||saved.currency!=='USD'||saved.agreedFareAmount!==actual.totalAmount)throw new ApiError('',502)
 return saved
}
