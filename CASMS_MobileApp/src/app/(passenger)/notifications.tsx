import { PassengerNotificationsScreen } from '@/features/notifications/PassengerNotificationsScreen';
import { AccountBoundScreen } from '@/features/passenger-actions/AccountBoundScreen';
function Inbox() { return <PassengerNotificationsScreen embedded />; }
export default function NotificationsTab() { return <AccountBoundScreen component={Inbox} />; }
