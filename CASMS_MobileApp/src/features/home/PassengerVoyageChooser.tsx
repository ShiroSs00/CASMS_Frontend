import { Text } from 'react-native';
import { PassengerSheet, ui } from '@/components/passenger/PassengerUI';
import { InfoRow } from '@/features/itinerary/ItineraryUI';
import { formatDay } from '@/features/itinerary/api-format';
import { selectVoyage, type useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { passengerApi, usePassengerQuery } from '@/features/passenger-actions/passenger-hooks';
import type { PersonalVoyage } from '@/features/passenger-actions/passenger-api';
import { voyagePassenger } from '@/features/passenger-actions/passenger-model';
import { ErrorNotice, Loading } from '@/features/passenger-actions/PassengerActionUI';
import { voyageLabel } from './voyage-home-model';

export function PassengerVoyageChooser({ catalog, visible, onClose }: {
  catalog: ReturnType<typeof useSelectedItinerary>; visible: boolean; onClose: () => void;
}) {
  return <PassengerSheet visible={visible} title="Chọn chuyến đi" onClose={onClose}>
    <ErrorNotice error={catalog.error} retry={() => { void catalog.refetch(); }} />
    {!catalog.error && catalog.voyages.map(item => <VoyageChoice key={item.bookingPassengerId} item={item}
      active={catalog.voyage?.bookingPassengerId === item.bookingPassengerId}
      verifyPerson={catalog.voyages.some(other => other.bookingId === item.bookingId && other.bookingPassengerId !== item.bookingPassengerId)}
      visible={visible} onSelect={() => {
        if (catalog.userId && selectVoyage(catalog.userId, item.bookingId, item.bookingPassengerId)) onClose();
      }} />)}
  </PassengerSheet>;
}

function VoyageChoice({ item, active, verifyPerson, visible, onSelect }: {
  item: PersonalVoyage; active: boolean; verifyPerson: boolean; visible: boolean; onSelect: () => void;
}) {
  const booking = usePassengerQuery(['booking', item.bookingId], signal => passengerApi.booking(item.bookingId, signal),
    'BOOKING_READ', verifyPerson && visible);
  const person = voyagePassenger(item, booking.data);
  if (verifyPerson && visible && booking.error) return <ErrorNotice error={booking.error} retry={() => { void booking.refetch(); }} />;
  if (verifyPerson && visible && booking.isPending) return <Loading text="Đang xác minh hồ sơ hành khách…" />;
  if (verifyPerson && !person) return <Text style={ui.body}>Chưa xác minh được hồ sơ cho {item.bookingReference}.</Text>;
  const description = [item.bookingReference, voyageLabel[item.cruiseStatus], item.startDate && formatDay(item.startDate),
    person?.fullName, person?.cabinNumber && `Phòng ${person.cabinNumber}`, active && 'Đang chọn'].filter(Boolean).join(' · ');
  return <InfoRow title={item.cruiseName} subtitle={description} icon={active ? 'check_circle' : 'sailing'} selected={active} onPress={onSelect} />;
}
