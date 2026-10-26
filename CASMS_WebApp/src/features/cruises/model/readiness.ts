import type { ReadinessDto } from '../api/dto'

export function readinessSnapshot(value:ReadinessDto|null,updatedAt?:string) {
  const evaluatedAt=value?.evaluatedAt&&Number.isFinite(Date.parse(value.evaluatedAt))?value.evaluatedAt:null
  const stale=Boolean(evaluatedAt&&updatedAt&&Date.parse(updatedAt)>Date.parse(evaluatedAt))
  const state:'READY'|'BLOCKED'|'UNKNOWN'=stale?'UNKNOWN':value?.ready===true?'READY':value?.ready===false?'BLOCKED':'UNKNOWN'
  return {state,stale,evaluatedAt,cruiseRevision:typeof value?.cruiseRevision==='number'&&Number.isSafeInteger(value.cruiseRevision)?value.cruiseRevision:null}
}
