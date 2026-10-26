import { Link } from 'react-router'
import { usePlanning } from '../hooks'
import styles from '../Planning.module.css'

export function TripSteps({stage,tripId,status,compact=false}:{stage:'info'|'schedule';tripId?:string;status?:'DRAFT'|'IN_REVIEW'|'PUBLISHED'|'CANCELLED';compact?:boolean}){
  const {root}=usePlanning()
  const current=stage==='info'?0:status==='IN_REVIEW'?2:status==='PUBLISHED'?3:1
  return <nav aria-label="Các bước lập lịch trình"><ol className={compact?`${styles.workflow} ${styles.workflowCompact}`:styles.workflow}>
    <li aria-current={current===0?'step':undefined} data-complete={current>0}><span>{current>0?'✓':'1'}</span><div>{tripId&&stage!=='info'?<Link to={`${root}/${tripId}/info`}>Thông tin chuyến</Link>:<strong>Thông tin chuyến</strong>}</div></li>
    <li aria-current={current===1?'step':undefined} data-complete={current>1}><span>{current>1?'✓':'2'}</span><div>{tripId&&stage!=='schedule'?<Link to={`${root}/${tripId}/schedule`}>Lập lịch trình</Link>:<strong>Lập lịch trình</strong>}</div></li>
    <li aria-current={current===2?'step':undefined} data-complete={current>2}><span>{current>2?'✓':'3'}</span><div><strong>{status==='IN_REVIEW'?'Đang chờ duyệt':'Duyệt lịch trình'}</strong></div></li>
    <li aria-current={current===3?'step':undefined}><span>4</span><div><strong>{status==='PUBLISHED'?'Đã phát hành':'Phát hành'}</strong></div></li>
  </ol></nav>
}
