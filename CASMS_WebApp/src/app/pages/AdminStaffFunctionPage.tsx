import { useParams } from 'react-router'
import { PageHeader } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { FinanceBookingsPage, PassengerCheckinActions } from '@/features/booking'
import { DepartureManifestWorkspace } from '@/domain/cruise-manifest'
import { CruiseOperations } from '@/features/cruises'

export function AdminStaffFunctionPage() {
  const {area}=useParams()
  if(area==='finance')return <FinanceBookingsPage/>
  return <AdminShell><PageHeader breadcrumb="ĐÓN KHÁCH" title="Check-in"/>
    <DepartureManifestWorkspace renderCheckin={(person,onChanged)=><PassengerCheckinActions key={person.bookingPassengerId} passengerId={person.bookingPassengerId} fullName={person.fullName} bookingStatus={person.bookingStatus} onChanged={onChanged}/>} renderDeparture={cruiseId=><CruiseOperations key={cruiseId} cruiseId={cruiseId} view="guidance"/>}/>
  </AdminShell>
}
