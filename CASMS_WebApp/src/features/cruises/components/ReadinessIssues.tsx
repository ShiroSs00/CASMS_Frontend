import {useSessionAccess} from '@/shared/auth'
import {canRoleOpenAdminPath} from '@/shared/ui/admin-v3'
import {ButtonLink,Notice} from '@/shared/ui'
import type {ReadinessIssueDto} from '../api/dto'
import {readinessTarget} from '../model/readiness-target'
import {validCruiseContextId} from '@/shared/lib/cruise-context'
import {businessCopy,domainStatus} from '@/shared/i18n/business-copy'
import {readinessMessage} from '../model/readiness-copy'

export function ReadinessIssues({items,cruiseId,shipId}:{items:ReadinessIssueDto[]|null|undefined;cruiseId:string;shipId:string|null}) {
  const access=useSessionAccess()
  if(!items?.length)return null
  const ordered=[...items].sort((a,b)=>(a.severity==='BLOCKER'?0:a.severity==='WARNING'?1:2)-(b.severity==='BLOCKER'?0:b.severity==='WARNING'?1:2))
  return <ul aria-label={businessCopy('cruise.readiness.details')}>{ordered.map((item,index)=>{
    const target=readinessTarget(item,cruiseId,shipId)
    const url=target?new URL(target,'https://ocvviet.local'):null
    const allowed=Boolean(url&&item.requiredPermission&&access.canDo(item.requiredPermission)&&canRoleOpenAdminPath(access.roles,url.pathname,url.search,access))
    const unavailable=businessCopy(!validCruiseContextId(item.targetId)||!target?'cruise.readiness.targetUnavailable':'cruise.readiness.permissionUnavailable')
    const message=readinessMessage(item.code)
    return <li key={item.code+':'+item.targetId+':'+index}><Notice title={message} tone={item.severity==='BLOCKER'?'error':'warning'}>
      <p>{domainStatus('cruise.readiness',item.severity??'UNKNOWN')} · {businessCopy('cruise.readiness.scope')}: {domainStatus('cruise.readiness.scope',item.scope??'UNKNOWN')}</p>
      <p>{businessCopy('cruise.readiness.owner')}: {domainStatus('cruise.readiness.owner',item.ownerRole??'UNKNOWN')}</p>
      <details><summary>{businessCopy('cruise.readiness.technical')}</summary><code>{item.code}</code>{item.evidence&&<pre>{item.evidence}</pre>}</details>
      {allowed&&target?<ButtonLink tone="secondary" to={target+(target.includes('?')?'&':'?')+new URLSearchParams({cruiseId,targetType:item.targetType??'',targetId:item.targetId??'',returnTo:'/admin/cruises/'+cruiseId+'?section=checks'})}>{businessCopy('cruise.readiness.resolve')}</ButtonLink>:<p>{unavailable}</p>}
    </Notice></li>
  })}</ul>
}
