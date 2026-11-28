import {useState} from 'react'
import {SourceScheduleDialog} from './InheritedSourcePlan'
import { Panel, Button, ButtonLink } from '@/shared/ui'
import {useSessionAccess} from '@/shared/auth'
import styles from './DeparturePreparation.module.css'
import type { CruiseRecord } from '../model/cruise-record'

export function CruiseSourceDetails({cruise}:{cruise:CruiseRecord}) {
  const [preview,setPreview]=useState(false)
  const access=useSessionAccess()
  if(!cruise.sourceVersionId)return <p>Chuyến khởi hành được tạo trực tiếp, chưa liên kết phiên bản lịch trình nguồn.</p>
  return <Panel title="Lịch trình mẫu đang áp dụng">
    {preview&&<SourceScheduleDialog versionId={cruise.sourceVersionId} onClose={()=>setPreview(false)}/>}
    <div className={styles.sourceReference}>
      <p><strong>{cruise.sourceTripCode??'Chưa có mã lịch trình mẫu'}</strong> · {cruise.sourceVersionNumber==null?'Chưa có số phiên bản':'Phiên bản '+cruise.sourceVersionNumber}</p>
      <div className={styles.sourceReferenceActions}>
    {cruise.sourceTripId&&access.roles.includes('CRUISE_MANAGER')&&access.canDo('CRUISE_CREATE')&&<Button tone="secondary" size="compact" autoWidth onClick={()=>setPreview(true)}>Xem lịch trình mẫu</Button>}
    {access.has('CRUISE_READ')&&<ButtonLink tone="secondary" size="compact" autoWidth to={'/admin/cruises?'+new URLSearchParams({sourceVersionId:cruise.sourceVersionId,...(cruise.sourceTripId?{sourceTripId:cruise.sourceTripId}:{})})}>Các chuyến cùng mẫu</ButtonLink>}
      </div>
    </div>

  </Panel>
}
