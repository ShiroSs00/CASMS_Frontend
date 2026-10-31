import {useState} from 'react'
import {SourceScheduleDialog} from './InheritedSourcePlan'
import { Panel, Button, ButtonLink, RecordFacts } from '@/shared/ui'
import {useSessionAccess} from '@/shared/auth'
import styles from './DeparturePreparation.module.css'
import {businessCopy} from '@/shared/i18n/business-copy'
import type { CruiseRecord } from '../model/cruise-record'

export function CruiseSourceDetails({cruise}:{cruise:CruiseRecord}) {
  const [preview,setPreview]=useState(false)
  const access=useSessionAccess()
  if(!cruise.sourceVersionId)return <p>Chuyến khởi hành được tạo trực tiếp, chưa liên kết phiên bản lịch trình nguồn.</p>
  return <Panel title={businessCopy('cruise.source.applied')}>
    {preview&&<SourceScheduleDialog versionId={cruise.sourceVersionId} onClose={()=>setPreview(false)}/>}
    <RecordFacts entries={[["Chuyến đi nguồn",cruise.sourceTripCode??'Chưa có mã chuyến trong phản hồi'],['Phiên bản',cruise.sourceVersionNumber==null?'Chưa có số phiên bản trong phản hồi':'Phiên bản '+cruise.sourceVersionNumber]]}/>
    <div className={styles.links}>
    {cruise.sourceTripId&&access.canDo('TRIP_READ')&&<div className={styles.linkRow}><div><strong>Lịch trình mẫu đang áp dụng</strong></div><Button tone="secondary" onClick={()=>setPreview(true)}>Xem lịch trình đã chốt</Button></div>}
    {access.has('CRUISE_READ')&&<div className={styles.linkRow}><div><strong>Các chuyến khởi hành từ cùng mẫu</strong></div><ButtonLink tone="secondary" to={'/admin/cruises?'+new URLSearchParams({sourceVersionId:cruise.sourceVersionId,...(cruise.sourceTripId?{sourceTripId:cruise.sourceTripId}:{})})}>Xem các chuyến khởi hành cùng mẫu</ButtonLink></div>}
    </div>

  </Panel>
}
