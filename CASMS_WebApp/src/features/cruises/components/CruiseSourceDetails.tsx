import { useLocation } from 'react-router'
import { Panel, ButtonLink, RecordFacts } from '@/shared/ui'
import {useSessionAccess} from '@/shared/auth'
import styles from './DeparturePreparation.module.css'
import {businessCopy} from '@/shared/i18n/business-copy'
import type { CruiseRecord } from '../model/cruise-record'

export function CruiseSourceDetails({cruise}:{cruise:CruiseRecord}) {
  const location=useLocation()
  const access=useSessionAccess()
  const returnTo=location.pathname+location.search
  if(!cruise.sourceVersionId)return <p>Lần khởi hành được tạo trực tiếp, chưa liên kết phiên bản lịch trình nguồn.</p>
  return <Panel title={businessCopy('cruise.source.applied')}>
    <RecordFacts entries={[["Chuyến đi nguồn",cruise.sourceTripCode??'Chưa có mã chuyến trong phản hồi'],['Phiên bản',cruise.sourceVersionNumber==null?'Chưa có số phiên bản trong phản hồi':'Phiên bản '+cruise.sourceVersionNumber]]}/>
    <div className={styles.links}>
    {cruise.sourceTripId&&access.canDo('TRIP_READ')&&<div className={styles.linkRow}><div><strong>Lịch trình mẫu đang áp dụng</strong><p>Xem tuyến, ngày và chương trình của đúng phiên bản mẫu đã dùng để tạo lần khởi hành này.</p></div><ButtonLink tone="secondary" to={'/admin/trips/'+encodeURIComponent(cruise.sourceTripId)+'/schedule?'+new URLSearchParams({versionId:cruise.sourceVersionId,returnTo})}>Xem lịch trình mẫu</ButtonLink></div>}
    {access.has('CRUISE_READ')&&<div className={styles.linkRow}><div><strong>Các lần khởi hành từ cùng mẫu</strong><p>Mở danh sách các đợt tổ chức dùng cùng phiên bản mẫu để đối chiếu ngày đi và tàu được phân công.</p></div><ButtonLink tone="secondary" to={'/admin/cruises?'+new URLSearchParams({sourceVersionId:cruise.sourceVersionId,...(cruise.sourceTripId?{sourceTripId:cruise.sourceTripId}:{})})}>Xem các lần khởi hành cùng mẫu</ButtonLink></div>}
    </div>
    <p>Lịch thực tế và chương trình của lần tổ chức này được đối chiếu với nguồn trên. Thay đổi hồ sơ lần khởi hành không tự sửa phiên bản nguồn.</p>
  </Panel>
}
