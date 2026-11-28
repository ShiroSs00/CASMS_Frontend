import type { DepartureSection } from '../model/preparation'
import type { CruiseDetailView } from '../model/cruise-view'
import { CruisePlanReview } from './CruisePlanReview'
import { PreparationEvidence } from './PreparationEvidence'
import styles from './ManagerWorkspace.module.css'

export function CruisePlanSubmission({detail,refreshKey,onChanged,onSection}: {
  detail:CruiseDetailView;refreshKey:string;onChanged:()=>void;onPrepare:()=>void;onSection:(section:DepartureSection)=>void
}) {
  return <section className={styles.dossierWorkspace} aria-label="Hồ sơ kế hoạch chuyến và xác nhận trước xuất bến">
    <CruisePlanReview itineraryMode={detail.cruise.itineraryMode} cruiseId={detail.cruise.cruiseId}
      refreshKey={refreshKey} onChanged={onChanged} mode="dossier" onSection={onSection}
      preparationContent={<PreparationEvidence cruiseId={detail.cruise.cruiseId} refreshKey={detail.cruise.revision??0}
        onChanged={onChanged} onNavigateSection={onSection}/>} />
  </section>
}
