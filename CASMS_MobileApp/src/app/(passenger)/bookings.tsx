import { PassengerBookingsScreen } from '@/features/passenger-actions/PassengerBookingScreens';
import { AccountBoundScreen } from '@/features/passenger-actions/AccountBoundScreen';
function BookingsContent() { return <PassengerBookingsScreen embedded />; }
export default function BookingsTab() { return <AccountBoundScreen component={BookingsContent} />; }
