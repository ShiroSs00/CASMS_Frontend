import type { ReadinessDto } from '../api/dto'

export function readinessSnapshot(value:ReadinessDto|null,updatedAt?:string,currentRevision?:number|null,now=Date.now()) {
  const evaluatedAt=value?.evaluatedAt&&Number.isFinite(Date.parse(value.evaluatedAt))?value.evaluatedAt:null
  const stale=Boolean(evaluatedAt&&updatedAt&&Date.parse(updatedAt)>Date.parse(evaluatedAt)||currentRevision!=null&&value?.cruiseRevision!=null&&currentRevision!==value.cruiseRevision||value?.validUntil&&Date.parse(value.validUntil)<=now)
  const incomplete=!evaluatedAt||value?.cruiseRevision==null
  const blocked=value?.ready===false||value?.status==='NOT_READY'||Boolean(value?.blockers?.length||value?.details?.some(issue=>issue.severity==='BLOCKER'))
  const state:'READY'|'BLOCKED'|'UNKNOWN'=stale||value?.status==='INDETERMINATE'||value?.status==='NOT_APPLICABLE'?'UNKNOWN':blocked?'BLOCKED':incomplete?'UNKNOWN':value?.ready===true?'READY':'UNKNOWN'
  return {state,stale,evaluatedAt,validUntil:value?.validUntil??null,cruiseRevision:typeof value?.cruiseRevision==='number'&&Number.isSafeInteger(value.cruiseRevision)?value.cruiseRevision:null}
}
