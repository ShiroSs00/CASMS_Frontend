import { PassengerServiceRequestsScreen } from '@/features/passenger-actions/PassengerServiceRequestsScreen';
import { AccountBoundScreen } from '@/features/passenger-actions/AccountBoundScreen';
export default function ServiceRequestsRoute() { return <AccountBoundScreen component={PassengerServiceRequestsScreen} />; }
