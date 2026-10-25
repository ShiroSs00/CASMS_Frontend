import { Link, useLocation } from 'react-router'
import { Notice } from '@/shared/ui'
import { PlanningProvider } from './context'
import { usePlanning } from './hooks'
import { TripListPage } from './pages/TripListPage'
import { TripInfoPage } from './pages/TripInfoPage'
import { TripSchedulePage } from './pages/TripSchedulePage'
import styles from './Planning.module.css'
import { TripReviewPage } from './pages/TripReviewPage'

export function TripPlanningPage(){return <PlanningProvider><PlanningRoutes/></PlanningProvider>}
function PlanningRoutes(){
  const {root,gateway,actorId}=usePlanning(),location=useLocation(),parts=location.pathname.slice(root.length).split('/').filter(Boolean)
  let page
  if(!parts.length)page=new URLSearchParams(location.search).get('view')==='review'?<TripReviewPage/>:<TripListPage/>
  else if(parts.length===1&&parts[0]==='new')page=<TripInfoPage/>
  else if(parts.length===2&&parts[1]==='info')page=<TripInfoPage id={parts[0]}/>
  else if(parts.length===2&&parts[1]==='schedule')page=<TripSchedulePage id={parts[0]}/>
  else page=<Notice title="Không tìm thấy màn hình"><Link to={root}>Về danh sách chuyến</Link></Notice>
  return <div className={styles.page} key={gateway.mode==='api'?actorId:gateway.mode}>{page}</div>
}
