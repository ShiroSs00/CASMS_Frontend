import type {PlanView} from '../api/mainflow-api'

/** Operational tasks consume the approved snapshot, never the editable plan windows. */
export function approvedPlanWindows(plan:PlanView|null|undefined){
 if(!plan||plan.planStatus!=='APPROVED'||!plan.reviewedBy||!plan.reviewedAt||plan.readyBlockers.includes('PLAN_APPROVAL_REQUIRED'))return null
 const snapshot=plan.submittedSnapshot as {cruise?:Record<string,unknown>}|null
 const cruise=snapshot?.cruise
 if(!cruise||cruise.cruise_id!==plan.cruiseId)return null
 const read=(key:string)=>typeof cruise[key]==='string'&&Number.isFinite(Date.parse(cruise[key]))?cruise[key] as string:null
 const bookingOpensAt=read('booking_opens_at'),bookingClosesAt=read('booking_closes_at'),guidanceOpensAt=read('guidance_opens_at'),guidanceClosesAt=read('guidance_closes_at')
 if(!bookingOpensAt||!bookingClosesAt||!guidanceOpensAt||!guidanceClosesAt)return null
 const windows={bookingOpensAt,bookingClosesAt,guidanceOpensAt,guidanceClosesAt}
 if(Object.entries(windows).some(([key,value])=>Date.parse(value)!==Date.parse(plan.windows[key as keyof typeof windows]??'')))return null
 if(Date.parse(bookingOpensAt)>=Date.parse(bookingClosesAt)||Date.parse(guidanceOpensAt)>=Date.parse(guidanceClosesAt))return null
 if(Date.parse(guidanceOpensAt)<Date.parse(bookingClosesAt))return null
 return windows
}
