import { PassengerPackagesScreen } from '@/features/passenger-actions/PassengerPackagesScreen';
import { AccountBoundScreen } from '@/features/passenger-actions/AccountBoundScreen';
export default function PackagesRoute() { return <AccountBoundScreen component={PassengerPackagesScreen} />; }
