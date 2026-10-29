import { useLocation } from 'react-router'
import { Panel, PermissionLink, RecordFacts } from '@/shared/ui'
import {businessCopy} from '@/shared/i18n/business-copy'
import type { CruiseRecord } from '../model/cruise-record'

export function CruiseSourceDetails({cruise}:{cruise:CruiseRecord}) {
  const location=useLocation()
  const returnTo=location.pathname+location.search
  if(!cruise.sourceVersionId)return <p>Lần khởi hành được tạo trực tiếp, chưa liên kết phiên bản lịch trình nguồn.</p>
  return <Panel title={businessCopy('cruise.source.applied')}>
    <RecordFacts entries={[["Chuyến đi nguồn",cruise.sourceTripCode??'Chưa có mã chuyến trong phản hồi'],['Phiên bản',cruise.sourceVersionNumber==null?'Chưa có số phiên bản trong phản hồi':'Phiên bản '+cruise.sourceVersionNumber]]}/>
    {cruise.sourceTripId&&<PermissionLink to={'/admin/trips/'+encodeURIComponent(cruise.sourceTripId)+'/schedule?'+new URLSearchParams({versionId:cruise.sourceVersionId,returnTo})}>Xem đúng phiên bản nguồn</PermissionLink>}
    <PermissionLink to={'/admin/cruises?'+new URLSearchParams({sourceVersionId:cruise.sourceVersionId,...(cruise.sourceTripId?{sourceTripId:cruise.sourceTripId}:{})})}>Các lần khởi hành cùng nguồn</PermissionLink>

  </Panel>
}
