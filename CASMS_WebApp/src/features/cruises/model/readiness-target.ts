import {validCruiseContextId} from '@/shared/lib/cruise-context'
import type {ReadinessIssueDto} from '../api/dto'

export function readinessTarget(issue:ReadinessIssueDto,cruiseId:string,shipId:string|null) {
  if(!validCruiseContextId(issue.targetId))return null
  const id=encodeURIComponent(issue.targetId)
  if(issue.targetType==='CRUISE')return issue.targetId===cruiseId?'/admin/cruises/'+id+'?section='+(['CRUISE_ASSIGN_SHIP','CRUISE_STAFF_ASSIGN'].includes(issue.requiredPermission??'')?'resources':'checks'):null
  if(issue.targetType==='SHIP')return issue.targetId===shipId?(issue.requiredPermission==='CRUISE_CHANGE_SHIP'?'/admin/cruises/'+encodeURIComponent(cruiseId)+'?section=resources':'/admin/ships/'+id+'/edit'):null
  if(issue.targetType==='SUPPLIER'&&issue.requiredPermission==='SUPPLIER_VERIFY')return '/admin/suppliers/'+id
  const sections:Record<string,string>={CABIN:'cabins',PACKAGE:'service-packages',SUPPLIER:'suppliers'}
  const section=sections[issue.targetType??'']
  return section?'/admin/'+section+'/'+id+'/edit':null
}
