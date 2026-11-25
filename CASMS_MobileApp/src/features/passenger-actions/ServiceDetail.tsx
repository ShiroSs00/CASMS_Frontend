import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerSheet, ui } from '@/components/passenger/PassengerUI';
import { lightTheme, spacing } from '@/constants/ocevie';
import { ErrorNotice } from './PassengerActionUI';
import { passengerApi, usePassengerQuery } from './passenger-hooks';
import { dateTime, money } from './passenger-model';
import { matchingEntitlements, type Entitlement } from './onboard-contracts';
import type { Service, ServiceSchedule } from './passenger-types';
export function scheduleText(slot: ServiceSchedule) {
  return `${dateTime(slot.startsAt, slot.timeZoneId ?? 'UTC')} – ${dateTime(slot.endsAt, slot.timeZoneId ?? 'UTC')} · ${slot.location}`;
}
export function CatalogueSkeleton() {
  return <View style={ui.card} accessibilityLabel="Đang tải danh mục" accessibilityState={{ busy: true }}>
    {[80, 100, 60].map((width, i) => <View key={i} style={{ width: `${width}%`, height: spacing.lg, backgroundColor: lightTheme.divider }} />)}
  </View>;
}
export function ServiceDetail({ serviceId, cruiseId, personId, entitlements, canRequest, beforeDeparture, onClose, onRequest }: {
  serviceId: string; cruiseId: string; personId: string; entitlements: Entitlement[];
  canRequest: boolean; beforeDeparture: boolean; onClose(): void; onRequest(service: Service): void;
}) {
  const service = usePassengerQuery(['service-detail', cruiseId, personId, serviceId], signal => passengerApi.service(serviceId, signal), 'SERVICE_READ');
  const slots = usePassengerQuery(['service-slots', cruiseId, personId, serviceId], signal => passengerApi.serviceSchedules(serviceId, signal), 'SERVICE_READ');
  const availability = usePassengerQuery(['service-availability', cruiseId, personId, serviceId, 1], signal => passengerApi.serviceAvailability(serviceId, 1, signal), 'SERVICE_READ');
  const item = service.data;
  const grants = matchingEntitlements(entitlements, personId, 'SERVICE', serviceId);
  return <PassengerSheet visible title={item?.name ?? 'Chi tiết dịch vụ'} onClose={onClose}>
    <ErrorNotice error={service.error ?? slots.error ?? availability.error} retry={() => { void service.refetch(); void slots.refetch(); void availability.refetch(); }} />
    {service.isLoading && <CatalogueSkeleton />}
    {service.fetchStatus === 'paused' && <Text style={ui.body}>Đang chờ kết nối để tải chi tiết dịch vụ.</Text>}
    {item && <>
      {!!item.description && <Text style={ui.body}>{item.description}</Text>}
      {!!item.categoryName && <Text style={ui.caption}>{item.categoryName}</Text>}
      <Text style={ui.amountValue}>{money(item.price, item.currency)}{item.unitCode ? ` / ${item.unitCode}` : ''}</Text>
      <Text style={ui.caption}>Giá niêm yết không thay cho quyền lợi và số lượng còn lại.</Text>
      {item.capacity != null && <Text style={ui.body}>Sức chứa cấu hình: {item.capacity}. Khả năng tiếp nhận được kiểm tra lại khi gửi.</Text>}
      {availability.data && <Text style={ui.body}>{availability.data.available ? 'Danh mục đang có khả năng tiếp nhận. Lịch và quyền lợi sẽ được kiểm tra riêng.' : 'Dịch vụ chưa đủ khả năng tiếp nhận số lượng đang kiểm tra.'}</Text>}
      {!!grants.length && <Text style={ui.sectionTitle}>Quyền lợi liên quan</Text>}
      {grants.map(grant => <View key={grant.grantId} style={{ gap: spacing.sm }}><Text style={ui.body}>{grant.benefitName}</Text><Text style={ui.caption}>Còn lại: {grant.remainingQuantity ?? 'Chưa có số liệu'} {grant.serviceUnitCode ?? ''}. {grant.canRegister ? 'Đủ điều kiện theo quyền lợi.' : 'Cần kiểm tra điều kiện quyền lợi.'}</Text>{grant.blockers.map((b, i) => <Text key={i} style={ui.body}>{b.message}</Text>)}</View>)}
      {!grants.length && <Text style={ui.body}>Chưa có quyền lợi được liên kết rõ với dịch vụ này. Nhân viên sẽ kiểm tra điều kiện sử dụng.</Text>}
      <Text style={ui.sectionTitle}>Lịch phục vụ của chuyến</Text>
      {slots.isLoading && <CatalogueSkeleton />}
      {slots.data?.filter(slot => slot.cruiseId === cruiseId).map(slot => <View key={slot.id} style={{ gap: spacing.xs }}><Text style={ui.body}>{scheduleText(slot)}</Text><Text style={ui.caption}>{slot.remainingCapacity ? `Còn ${slot.remainingCapacity} chỗ` : 'Hết chỗ'}{slot.portName ? ` · ${slot.portName}` : ''}</Text></View>)}
      {slots.isSuccess && !slots.data?.some(slot => slot.cruiseId === cruiseId) && <Text style={ui.body}>Chưa có lịch phục vụ được công bố cho chuyến này.</Text>}
      {!canRequest && <Text style={ui.body}>Cần hồ sơ hợp lệ trong chuyến đã chọn và quyền gửi yêu cầu.</Text>}
      {beforeDeparture && item.canBuyPreCruise === false && <Text style={ui.body}>Dịch vụ này không nhận yêu cầu trước chuyến.</Text>}
      <PassengerButton label="Gửi yêu cầu dịch vụ" disabled={beforeDeparture && item.canBuyPreCruise === false || !canRequest || !!service.error || service.isFetching || item.status !== 'ACTIVE'} onPress={() => onRequest(item)} />
    </>}
    <PassengerButton label="Đóng chi tiết" variant="text" onPress={onClose} />
  </PassengerSheet>;
}
