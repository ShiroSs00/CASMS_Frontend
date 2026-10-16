export type BookingStatus = 'Draft' | 'Confirmed' | 'Cancelled'
export type CheckinStatus = 'NotStarted' | 'InProgress' | 'NeedsReview' | 'Completed' | 'BoardingReady'
export type PaymentStatus = 'Pending' | 'Confirmed' | 'Failed' | 'Cancelled'
export type ContractStatus = 'Draft' | 'Accepted' | 'Cancelled'
export type TravellerDraft = { id:string; name:string; birthDate:string; email:string; phone:string }
export type BookingDraft = { cruiseId?:string; travellers:TravellerDraft[]; selectedCabinCategory?:string; passengerPackages:Record<string,string|undefined>; acceptedTerms:boolean }
export type Cruise = { id:string; title:string; ship:string; duration:number; departure:string; end:string; port:string; route:string; price:number; image:string; available:boolean; balcony:boolean }
export type CabinCategory = { id:string; name:string; area:number; capacity:number; price:number; description:string }
export type ExperiencePackage = { id:string; price:number; kind:'INCLUDED'|'OPTIONAL'; description:string }
export type Passenger = TravellerDraft & { surname:string; givenName:string; nationality:string; documentType:string; documentMasked:string; issued:string; expires:string; documentReady:boolean; checkin:CheckinStatus }
export type Booking = { id:string; reference:string; cruiseId:string; status:BookingStatus; fare:number; currency:'VND'; requestedCategory:string; assignedCabin?:string; packageName:string; passengers:Passenger[]; payment:PaymentStatus; paid:number; contract:ContractStatus; arrival?:string; preparationDone:number }
export type ActionState = 'idle'|'pending'|'validation'|'conflict'|'error'|'unknown'|'received'|'no-access'|'expired'|'missing'
export type ActionResult = { state:Exclude<ActionState,'idle'|'pending'>; message:string; reference?:string }
export type MissingCapability = 'cruise-search'|'cruise-detail'|'availability'|'booking-create'|'my-bookings'|'booking-detail'|'traveller-save'|'checkin-save'|'arrival-save'|'boarding-pass'|'payment-start'|'payment-status'|'contract-read'|'contract-accept'|'change-request'

