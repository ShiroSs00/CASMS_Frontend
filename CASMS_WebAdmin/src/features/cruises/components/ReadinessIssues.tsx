import {uniqueOperationsIssues} from '../model/operations-issues'
import {useSessionAccess} from '@/shared/auth'
import {canRoleOpenAdminPath} from '@/shared/ui/admin-v3'
import {ButtonLink,Notice} from '@/shared/ui'
import type {ReadinessIssueDto} from '../api/dto'
import {readinessTarget} from '../model/readiness-target'
import {validCruiseContextId} from '@/shared/lib/cruise-context'
import {businessCopy,domainStatus} from '@/shared/i18n/business-copy'
import {readinessAction,readinessMessage} from '../model/readiness-copy'

export function ReadinessIssues({items,cruiseId,shipId}:{items:ReadinessIssueDto[]|null|undefined;cruiseId:string;shipId:string|null}) {
  const access=useSessionAccess()
  if(!items?.length)return null
  const ordered=uniqueOperationsIssues(items,'readiness').sort((a,b)=>(a.severity==='BLOCKER'?0:a.severity==='WARNING'?1:2)-(b.severity==='BLOCKER'?0:b.severity==='WARNING'?1:2))
  return <ul aria-label={businessCopy('cruise.readiness.details')}>{ordered.map((item,index)=>{
    const saleTerms = ['SALE_TAX_APPROVAL_REQUIRED','SALE_PORT_FEE_APPROVAL_REQUIRED'].includes(item.code ?? '')
    const target=saleTerms && item.targetId === cruiseId
      ? `/admin/cruises/${encodeURIComponent(cruiseId)}?section=overview&step=review&focus=sale-terms`
      : readinessTarget(item,cruiseId,shipId)
    const url=target?new URL(target,'https://ocvviet.local'):null
    const allowed=Boolean(url&&item.requiredPermission&&(saleTerms ? access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_PRICING_APPROVE') : access.canDo(item.requiredPermission))&&canRoleOpenAdminPath(access.roles,url.pathname,url.search,access))
    const unavailable=businessCopy(!validCruiseContextId(item.targetId)||!target?'cruise.readiness.targetUnavailable':'cruise.readiness.permissionUnavailable')
    const message=saleTerms ? item.code==='SALE_TAX_APPROVAL_REQUIRED' ? 'Thuế trong hồ sơ chưa được phê duyệt' : 'Phí cảng trong hồ sơ chưa được phê duyệt' : readinessMessage(item.code,item.message)
    const action=readinessAction(item.code)
    return <li key={item.code+':'+item.targetId+':'+index}><Notice title={message} tone={item.severity==='BLOCKER'?'error':'warning'}>
      <p>{domainStatus('cruise.readiness',item.severity??'UNKNOWN')} · {businessCopy('cruise.readiness.scope')}: {domainStatus('cruise.readiness.scope',item.scope??'UNKNOWN')}</p>
      <p>{businessCopy('cruise.readiness.owner')}: {domainStatus('cruise.readiness.owner',item.ownerRole??'UNKNOWN')}</p>
      {action&&<p>{action}</p>}
      <details><summary>{businessCopy('cruise.readiness.technical')}</summary><code>{item.code}</code>{item.allowedAction&&<p>{item.allowedAction}</p>}{item.evidence&&<pre>{item.evidence}</pre>}</details>
      {allowed&&target?<ButtonLink tone="secondary" to={target+(target.includes('?')?'&':'?')+new URLSearchParams({cruiseId,targetType:item.targetType??'',targetId:item.targetId??'',returnTo:'/admin/cruises/'+cruiseId+'?section=checks'})}>{saleTerms?'Xem hồ sơ và thuế/phí':businessCopy('cruise.readiness.resolve')}</ButtonLink>:<p>{unavailable}</p>}
    </Notice></li>
  })}</ul>
}
