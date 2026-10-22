import { PassengerActivitiesScreen } from '@/features/passenger-actions/PassengerActivitiesScreen';
import { AccountBoundScreen } from '@/features/passenger-actions/AccountBoundScreen';
export default function ActivitiesRoute() { return <AccountBoundScreen component={PassengerActivitiesScreen} />; }
