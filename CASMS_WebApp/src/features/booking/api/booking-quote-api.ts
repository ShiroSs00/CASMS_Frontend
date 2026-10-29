import {ApiError,apiRequest} from '@/shared/api'
import {decodeQuote,type Quote} from './quote-contract'
import {decodeBookingDetail,serializeBooking,type BookingDraft} from './real-booking-api'

export type BookingQuoteIntent={quote:Quote;selection:string;guestToken?:string;idempotencyKey:string}
export const quoteSelection=(draft:BookingDraft)=>JSON.stringify({cruiseId:draft.cruiseId,currency:'USD',paymentPlan:draft.paymentPlan,passengers:draft.passengers.map(p=>({cabinId:p.cabinId,tourPackageId:p.tourPackageId||null}))})
function valid(quote:Quote,draft:BookingDraft){
 if(quote.currency!=='USD'||quote.status!=='ACTIVE'||!quote.expiresAt||Date.parse(quote.expiresAt)<=Date.now()||quote.totalAmount===null||!quote.policyVersion||!quote.fingerprint||quote.paymentPlan!==draft.paymentPlan||!quote.lineItems||quote.lineItems.length!==draft.passengers.length||quote.lineItems.some((line,i)=>line.cabinId!==draft.passengers[i].cabinId||(line.tourPackageId??'')!==draft.passengers[i].tourPackageId))throw new ApiError('',409,'QUOTE_INVALIDATED')
}
export async function requestBookingQuote(draft:BookingDraft):Promise<BookingQuoteIntent>{
 const value=await apiRequest<Quote&{guestToken?:string}>('/booking/quotes',{method:'POST',body:JSON.parse(quoteSelection(draft))})
 const quote=decodeQuote(value,draft.cruiseId);valid(quote,draft)
 const guestToken=typeof value.guestToken==='string'&&value.guestToken?value.guestToken:undefined
 const readback=decodeQuote(await apiRequest('/booking/quotes/'+encodeURIComponent(quote.quoteId),{guestToken}),draft.cruiseId,quote.quoteId)
 valid(readback,draft)
 if(readback.fingerprint!==quote.fingerprint||readback.totalAmount!==quote.totalAmount||readback.policyVersion!==quote.policyVersion)throw new ApiError('',502)
 return {quote:readback,selection:quoteSelection(draft),guestToken,idempotencyKey:crypto.randomUUID()}
}
export async function createQuotedBooking(draft:BookingDraft,intent:BookingQuoteIntent){
 if(intent.selection!==quoteSelection(draft))throw new ApiError('',409,'QUOTE_SELECTION_MISMATCH')
 valid(intent.quote,draft)
 const actual=decodeQuote(await apiRequest('/booking/quotes/'+encodeURIComponent(intent.quote.quoteId),{guestToken:intent.guestToken}),draft.cruiseId,intent.quote.quoteId)
 valid(actual,draft)
 if(actual.fingerprint!==intent.quote.fingerprint||actual.totalAmount!==intent.quote.totalAmount||actual.policyVersion!==intent.quote.policyVersion)throw new ApiError('',409,'QUOTE_INVALIDATED')
 const saved=decodeBookingDetail(await apiRequest('/booking',{method:'POST',idempotencyKey:intent.idempotencyKey,body:{...serializeBooking(draft),currency:'USD',quoteId:actual.quoteId,quoteGuestToken:intent.guestToken}}))
 if(saved.cruiseId!==draft.cruiseId||saved.currency!=='USD'||saved.agreedFareAmount!==actual.totalAmount)throw new ApiError('',502)
 return saved
}
