import { Link } from 'react-router'
import { usePlanning } from '../hooks'
import styles from '../Planning.module.css'

export function TripSteps({stage,tripId,compact=false}:{stage:'info'|'schedule';tripId?:string;compact?:boolean}){
  const {root}=usePlanning()
  const current=stage==='info'?0:1
  return <nav aria-label="Các bước lập lịch trình"><ol className={compact?`${styles.workflow} ${styles.workflowCompact}`:styles.workflow}>
    <li aria-current={current===0?'step':undefined} data-complete={current>0}><span>{current>0?'✓':'1'}</span><div>{tripId&&stage!=='info'?<Link to={`${root}/${tripId}/info`}>Khung chuyến</Link>:<strong>Khung chuyến</strong>}</div></li>
    <li aria-current={current===1?'step':undefined}><span>2</span><div>{tripId&&stage!=='schedule'?<Link to={`${root}/${tripId}/schedule`}>Lập lịch trình</Link>:<strong>Lập lịch trình</strong>}</div></li>
  </ol></nav>
}
