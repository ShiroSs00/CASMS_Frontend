import {ApiError} from '@/shared/api'
import {decodeCruisePackagePurchaseSelection,decodeCabinSelectionMode,fareUuid,type CruisePackagePurchaseSelection,type CabinSelectionMode} from '@/domain/cruise-package'

export type QuoteRequest={cruiseId:string;currency?:string|null;paymentPlan?:'FULL'|'DEPOSIT'|'STAGES'|null;passengers:{cabinId:string|null;tourPackageId?:string|null;cabinSelectionMode?:CabinSelectionMode;cabinGroupKey?:string;farePackageOfferId?:string;farePackagePriceRevisionId?:string}[]}
export type QuoteLine={cabinId:string|null;cabinNumber:string|null;cabinType:string|null;deckNumber:number|null;baseFare:number|null;priceMultiplier:number|null;cabinPrice:number|null;tourPackageId:string|null;packageName:string|null;packagePrice:number|null;itemTotal:number|null;fareSelection:CruisePackagePurchaseSelection|null;cabinSelectionMode:CabinSelectionMode|null;cabinGroupKey:string|null}
export type Quote={quoteId:string;cruiseId:string;quoteCode:string|null;cruiseCode:string|null;departureDatetime:string|null;policyVersion:string|null;currency:string|null;lineItems:QuoteLine[]|null;subtotalAmount:number|null;portFeesAmount:number|null;taxesAmount:number|null;taxesAndFeesAmount:number|null;totalAmount:number|null;paymentPlan:string|null;depositAmount:number|null;remainingAmount:number|null;finalPaymentDueAt:string|null;fingerprint:string|null;issuedAt:string|null;expiresAt:string|null;status:string|null}
type Row=Record<string,unknown>
const invalid=()=>new ApiError('Thông tin báo giá chưa khớp hoặc không đầy đủ. Không thể dùng báo giá này để đặt chỗ.',502)
function object(value:unknown):Row {if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();return value as Row}
function text(r:Row,key:string){const v=r[key];if(v==null)return null;if(typeof v!=='string')throw invalid();return v}
function number(r:Row,key:string){const v=r[key];if(v==null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw invalid();return v}
function instant(r:Row,key:string){const v=text(r,key);if(v!=null&&!Number.isFinite(Date.parse(v)))throw invalid();return v}
export function decodeQuote(value:unknown,cruiseId:string,quoteId?:string):Quote {
  const r=object(value),id=text(r,'quoteId'),cruise=text(r,'cruiseId')
  if(!id||cruise!==cruiseId||quoteId&&id!==quoteId)throw invalid()
  const raw=r.lineItems;if(raw!=null&&!Array.isArray(raw))throw invalid()
  const lineItems=(raw as unknown[]|null|undefined)?.map(value=>{
    const l=object(value),fareSelection=l.fareSelection==null?null:decodeCruisePackagePurchaseSelection(l.fareSelection)
    const cabinSelectionMode=l.cabinSelectionMode==null?null:decodeCabinSelectionMode(l.cabinSelectionMode),cabinGroupKey=text(l,'cabinGroupKey')
    const result={cabinId:text(l,'cabinId'),cabinNumber:text(l,'cabinNumber'),cabinType:text(l,'cabinType'),deckNumber:number(l,'deckNumber'),baseFare:number(l,'baseFare'),priceMultiplier:number(l,'priceMultiplier'),cabinPrice:number(l,'cabinPrice'),tourPackageId:text(l,'tourPackageId'),packageName:text(l,'packageName'),packagePrice:number(l,'packagePrice'),itemTotal:number(l,'itemTotal'),fareSelection,cabinSelectionMode,cabinGroupKey}
    if(fareSelection){
      if(!cabinSelectionMode||!cabinGroupKey||result.cabinType!==fareSelection.cabinType||result.itemTotal!==Number(fareSelection.amount)||result.baseFare!=null||result.cabinPrice!=null||result.packagePrice!=null||result.tourPackageId!=null)throw invalid()
      if(cabinSelectionMode==='CATEGORY_HOLD'&&(result.cabinId!=null||result.cabinNumber!=null||result.deckNumber!=null))throw invalid()
      if(!fareSelection.logicalCategoryId||!fareSelection.cabinMappingId||!fareSelection.physicalCabinIds.length)throw invalid()
      if(cabinSelectionMode==='PHYSICAL_CABIN'){
        const cabinId=fareUuid(result.cabinId)
        if(!result.cabinNumber||!fareSelection.physicalCabinIds.includes(cabinId))throw invalid()
      }
    }else if(cabinSelectionMode!=null||cabinGroupKey!=null)throw invalid()
    return result
  })??null
  if(lineItems?.some(line=>line.fareSelection)&&lineItems.some(line=>!line.fareSelection))throw invalid()
  return {quoteId:id,cruiseId,quoteCode:text(r,'quoteCode'),cruiseCode:text(r,'cruiseCode'),departureDatetime:instant(r,'departureDatetime'),policyVersion:text(r,'policyVersion'),currency:text(r,'currency'),lineItems,subtotalAmount:number(r,'subtotalAmount'),portFeesAmount:number(r,'portFeesAmount'),taxesAmount:number(r,'taxesAmount'),taxesAndFeesAmount:number(r,'taxesAndFeesAmount'),totalAmount:number(r,'totalAmount'),paymentPlan:text(r,'paymentPlan'),depositAmount:number(r,'depositAmount'),remainingAmount:number(r,'remainingAmount'),finalPaymentDueAt:instant(r,'finalPaymentDueAt'),fingerprint:text(r,'fingerprint'),issuedAt:instant(r,'issuedAt'),expiresAt:instant(r,'expiresAt'),status:text(r,'status')}
}
