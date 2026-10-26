import { Notice, Panel, PermissionLink, RecordFacts } from '@/shared/ui'
import type { CruiseRecord } from '../model/cruise-record'

export function CruiseSourceDetails({cruise}:{cruise:CruiseRecord}) {
  if(!cruise.sourceVersionId)return <p>Lần khởi hành được tạo trực tiếp, chưa liên kết phiên bản lịch trình nguồn.</p>
  return <Panel title="Lịch trình nguồn">
    <RecordFacts entries={[["Chuyến đi nguồn",cruise.sourceTripCode??'Chưa có mã chuyến trong phản hồi'],['Phiên bản',cruise.sourceVersionNumber==null?'Chưa có số phiên bản trong phản hồi':'Phiên bản '+cruise.sourceVersionNumber]]}/>
    {cruise.sourceTripId&&<PermissionLink to={'/admin/trips/'+encodeURIComponent(cruise.sourceTripId)+'/schedule?versionId='+encodeURIComponent(cruise.sourceVersionId)}>Xem đúng phiên bản nguồn</PermissionLink>}
    <Notice title="Đã liên kết nguồn">Liên kết này chưa tự chuyển các ngày, lần ghé cảng và chương trình sang lịch của lần khởi hành.</Notice>
  </Panel>
}
