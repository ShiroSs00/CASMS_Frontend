import { CruiseDetailPage } from '@/features/cruises'
import { CruiseRegulationAssign } from '@/features/regulations'

export function AdminCruiseDetailPage() {
  return <CruiseDetailPage renderRegulationAssignment={(cruiseId, onAssigned) =>
    <CruiseRegulationAssign cruiseId={cruiseId} onAssigned={onAssigned} />
  } />
}
