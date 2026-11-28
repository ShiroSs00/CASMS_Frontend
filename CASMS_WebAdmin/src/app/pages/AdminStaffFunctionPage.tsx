import { useParams } from 'react-router'
import { PageHeader } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { CheckinDesk, FinanceBookingsPage, PassengerCheckinActions } from '@/features/booking'
import { useSessionAccess } from '@/shared/auth'
import { DepartureManifestWorkspace } from '@/domain/cruise-manifest'
import { CruiseOperations } from '@/features/cruises'

export function AdminStaffFunctionPage() {
  const {area}=useParams()
  const access = useSessionAccess()
  if(area==='finance')return <FinanceBookingsPage/>
  if (area === 'checkin' && access.roles.includes('BOOKING_AGENT') && !access.has('CRUISE_MANIFEST_READ')) {
    return <AdminShell><PageHeader breadcrumb="Đặt chỗ / Làm thủ tục" title="Làm thủ tục hành khách" description="Tra cứu đặt chỗ và làm thủ tục cho từng hành khách thuộc chuyến được phân công." /><CheckinDesk /></AdminShell>
  }
  return <AdminShell><PageHeader breadcrumb="" title="Check-in" />
    <DepartureManifestWorkspace renderCheckin={(person,onChanged)=><PassengerCheckinActions key={person.bookingPassengerId} passengerId={person.bookingPassengerId} fullName={person.fullName} bookingStatus={person.bookingStatus} onChanged={onChanged}/>} renderDeparture={cruiseId=><CruiseOperations key={cruiseId} cruiseId={cruiseId} view="guidance"/>}/>
  </AdminShell>
}
