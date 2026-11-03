export const validCruiseContextId = (value:string|null|undefined):value is string => typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)

/** A remediation return is valid only for the exact entity opened from its issue. */
export function readinessContextReturn(params:URLSearchParams,targetType:string,targetId:string|undefined) {
  if(!targetId||params.get('targetType')!==targetType||params.get('targetId')!==targetId)return null
  return cruiseContextReturn(params.get('returnTo'),params.get('cruiseId'))
}

/** Return only to the same Cruise. Route guards still enforce session permissions. */
export function cruiseContextReturn(value:string|null,id:string|null):string|null {
  if(!validCruiseContextId(id))return null
  const fallback='/admin/cruises/'+encodeURIComponent(id)+'?section=program'
  if(!value||/[\\\r\n]/.test(value))return fallback
  try {
    const url=new URL(value,'https://ocvviet.local')
    if(url.origin!=='https://ocvviet.local'||url.pathname!=='/admin/cruises/'+id)return fallback
    const section=url.searchParams.get('section')
    const query=new URLSearchParams()
    if(section&&['overview','schedule','resources','program','sales','checks','fare-packages','staff','preparation','guidance','handoff','changes'].includes(section))query.set('section',section)
    if(url.searchParams.get('step')==='review')query.set('step','review')
    return '/admin/cruises/'+encodeURIComponent(id)+(query.size?'?'+query.toString():'')
  }catch{return fallback}
}

