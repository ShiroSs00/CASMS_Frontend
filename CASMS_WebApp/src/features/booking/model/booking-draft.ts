import type { BookingDraft, TravellerDraft, CabinCategory, ExperiencePackage } from './booking-types'
export function parseGuestCount(value: string | null) {
 const count=Number(value)
 return Number.isInteger(count)&&count>=1&&count<=4?count:2
}
export const blankTraveller = ():TravellerDraft => ({ id:crypto.randomUUID(),name:'',birthDate:'',email:'',phone:'' })
export const initialDraft = ():BookingDraft => ({travellers:[blankTraveller(),blankTraveller()],passengerPackages:{},acceptedTerms:false})
export function validateTravellers(draft:BookingDraft) {
 const errors:Record<string,string>={}
 for(const [i,t] of draft.travellers.entries()) {
  if(!t.name.trim()) errors[t.id+'-name']='Nhập họ và tên.'
  const parsedDate=Date.parse(t.birthDate)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(t.birthDate)||!Number.isFinite(parsedDate)||new Date(parsedDate).toISOString().slice(0,10)!==t.birthDate||t.birthDate>new Date().toISOString().slice(0,10)) errors[t.id+'-birthDate']='Nhập ngày sinh hợp lệ.'
  if(i===0&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email)) errors[t.id+'-email']='Nhập email hợp lệ.'
  if(i===0&&!/^\+?[\d\s()-]{7,20}$/.test(t.phone)) errors[t.id+'-phone']='Nhập số điện thoại hợp lệ.'
 }
 return errors
}
export function estimateDraft(draft:BookingDraft, basePrice:number, bookingCatalog:{cabins:CabinCategory[];packages:ExperiencePackage[]}) {
 const cabin = bookingCatalog.cabins.find(c=>c.id===draft.selectedCabinCategory)
 const fare = (cabin ? basePrice + cabin.price - bookingCatalog.cabins[0].price : basePrice)*draft.travellers.length
 const packages=draft.travellers.reduce((sum,t)=>sum+(bookingCatalog.packages.find(p=>p.id===draft.passengerPackages[t.id]&&p.kind==='OPTIONAL')?.price??0),0)
 return {fare,packages,total:fare+packages}
}

