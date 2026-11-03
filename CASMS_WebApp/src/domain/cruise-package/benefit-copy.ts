/** Display the configured unit; never turn service quantities into participation counts. */
export function benefitQuantity(quantity:number,benefit:{usageUnit:string|null;serviceUnitCode:string|null}){
 const unit=benefit.usageUnit==='PARTICIPATION'?'lượt tham gia':benefit.usageUnit==='SERVICE_UNIT'?benefit.serviceUnitCode:null
 return unit?`${quantity} ${unit}`:`${quantity} (chưa có đơn vị được hỗ trợ)`
}
