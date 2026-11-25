import { samePosScope, usePosScopeGuard } from './pos-scope';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { Choice, StatusBadge } from '@/features/passenger-actions/PassengerActionUI';
import { dateTime, money } from '@/features/passenger-actions/passenger-model';
import { ApiError } from '@/lib/api';
import { usePos, usePosRequests } from './PosLayout';
import { readRequestEntitlement, type PosRequest, type RequestAction } from './pos-api';
import { EntitlementSummary } from '../passenger-actions/EntitlementSummary';
import { fulfillmentInput, requestActions as actions, verifyRequestOutcome } from './pos-lifecycle';
import { Field, Notice, PosColumns, posPane, PosPage, QueryState, posError, usePosConfirmation } from './pos-ui';

const requestLabels: Record<RequestAction, string> = {
  assign: 'Nhận phân công', accept: 'Tiếp nhận', reject: 'Từ chối',
  start: 'Bắt đầu', complete: 'Hoàn tất', cancel: 'Hủy yêu cầu',
};
const filters = [
  { id: 'open', label: 'Đang xử lý' },
  { id: 'mine', label: 'Của tôi' },
  { id: 'all', label: 'Tất cả' },
  { id: 'REQUESTED', label: 'Chờ tiếp nhận' },
  { id: 'ACCEPTED', label: 'Đã tiếp nhận' },
  { id: 'IN_PROGRESS', label: 'Đang phục vụ' },
  { id: 'COMPLETED', label: 'Đã hoàn tất' },
  { id: 'REJECTED', label: 'Đã từ chối' },
  { id: 'CANCELLED', label: 'Đã hủy' },
];
const serviceFilters = [
  { id: 'all', label: 'Tất cả dịch vụ' },
  { id: 'usage', label: 'Ghi nhận sử dụng' },
];
const openStates = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'];
const normalize = (value: string) => value.trim().toLocaleLowerCase('vi-VN');

export function PosServices() {
  const pos = usePos();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const allowed = pos.scope.services.some(service => service.permissions.includes('SERVICE_READ'));
  const query = useQuery({
    queryKey: [...pos.key, 'services'], queryFn: ({ signal }) => pos.client.services(signal), enabled: allowed, retry: false,
  });
  if (!allowed) return <PosPage title="Dịch vụ"><Notice tone="warning">Bạn chưa có quyền xem dịch vụ trong phiên này.</Notice></PosPage>;
  const readable = new Map(pos.scope.services.filter(service => service.permissions.includes('SERVICE_READ'))
    .map(service => [service.serviceId, service.permissions]));
  const canFilterUsage = [...readable.values()].some(permissions => permissions.includes('SERVICE_SALE'));
  const rows = query.error instanceof ApiError && query.error.status === 403 ? [] :
    query.data?.filter(item => readable.has(item.serviceId)
      && (filter !== 'usage' || !canFilterUsage || readable.get(item.serviceId)?.includes('SERVICE_SALE'))
      && normalize(`${item.name} ${item.code}`).includes(normalize(search))) ?? [];
  return <PosPage title="Dịch vụ" refresh={() => { pos.refreshSession(); void query.refetch(); }} refreshing={query.isRefetching}>
    <Field label="Tìm tên hoặc mã dịch vụ" value={search} onChangeText={setSearch} returnKeyType="search" />
    {canFilterUsage && <Choice label="Lọc dịch vụ" value={filter} items={serviceFilters} onChange={setFilter} />}
    <QueryState query={query} empty={!rows.length ? 'Không có dịch vụ phù hợp.' : undefined} />
    {rows.map(item => <View key={item.serviceId} style={ui.card}>
      <Text style={ui.eyebrow}>{item.code}</Text>
      <Text style={ui.sectionTitle}>{item.name}</Text>
      <Text style={ui.body}>{money(item.unitPrice, item.currency)}</Text>
    </View>)}
  </PosPage>;
}

export function PosRequests() {
  const pos = usePos();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('open');
  const services = new Map(pos.scope.services.filter(service => service.permissions.includes('SERVICE_REQUEST_READ'))
    .map(service => [service.serviceId, service]));
  const query = usePosRequests(pos, true);
  const reload = () => { pos.refreshSession(); void query.refetch(); };
  const confirm = usePosConfirmation(reload, pos.verified && !query.error && !query.isFetching);
  const fulfilled = useRef('');
  const assertScope = usePosScopeGuard();
  async function send(row: PosRequest, action: RequestAction) {
    assertScope();
    const freshContext = await pos.client.context(); assertScope();
    if (!samePosScope(freshContext, pos.scope)) throw new ApiError('Ngữ cảnh POS đã thay đổi.', 409, 'POS_REVERIFY');
    cache.setQueryData([...pos.key, 'context'], freshContext);
    const freshRows = await pos.client.requests(); assertScope();
    cache.setQueryData([...pos.key, 'requests'], freshRows);
    const current = freshRows.find(item => item.id === row.id);
    const service = freshContext.services.find(item => item.serviceId === row.serviceId);
    if (!current || !current.bookingPassengerId || current.serviceId !== row.serviceId || current.bookingPassengerId !== row.bookingPassengerId
      || current.scheduleId !== row.scheduleId || current.quantity !== row.quantity || current.fareBenefitSnapshotId !== row.fareBenefitSnapshotId || current.fulfillmentUnitCode !== row.fulfillmentUnitCode || current.status !== row.status || current.assignedUserId !== row.assignedUserId
      || !service?.permissions.includes('SERVICE_REQUEST_READ') || !actions(current, pos.owner, service.permissions).includes(action))
      throw new ApiError('Yêu cầu hoặc phân công đã thay đổi. Kiểm tra lại danh sách.', 409, 'POS_REVERIFY');
    const result = await pos.client.requestAction(row.id, action, action === 'complete' ? fulfillmentInput(current, fulfilled.current) : undefined);
    verifyRequestOutcome(current, result, action, pos.owner);
    await cache.invalidateQueries({ queryKey: pos.key });
    return result;
  }

  if (!services.size) return <PosPage title="Yêu cầu dịch vụ"><Notice tone="warning">Bạn chưa có quyền xem yêu cầu trong phiên này.</Notice></PosPage>;
  const rows = query.error instanceof ApiError && query.error.status === 403 ? [] : query.data?.flatMap(row => {
    const service = services.get(row.serviceId);
    if (!service || (filter === 'open' && !openStates.includes(row.status))
      || (filter === 'mine' && row.assignedUserId !== pos.owner) || (!['all','open','mine'].includes(filter) && row.status !== filter)
      || !normalize(`${service.name} ${service.code} ${row.note ?? ''}`).includes(normalize(search))) return [];
    return [{ row, service }];
  }) ?? [];
  return <PosPage title="Yêu cầu dịch vụ" wide refresh={reload} refreshing={query.isRefetching}>
    <Text style={ui.caption}>{pos.scope.terminal.name} · {pos.username}</Text>
    {!!pos.sessionError && <Notice tone="error" retry={pos.refreshSession}>{posError(pos.sessionError)}</Notice>}
    <Field label="Tìm dịch vụ hoặc ghi chú" value={search} onChangeText={setSearch} returnKeyType="search" />
    <Choice label="Trạng thái yêu cầu" value={filter} items={filters} onChange={setFilter} />
    <QueryState query={query} empty={!rows.length ? 'Không có yêu cầu phù hợp với bộ lọc.' : undefined} />
    {rows.map(({ row, service }) => <View style={ui.card} key={row.id}>
      <PosColumns><View style={posPane}>
      <Text style={ui.sectionTitle}>{service.name}</Text>
      <StatusBadge status={row.status} />
      <Text style={ui.body}>Số lượng {row.quantity} · {dateTime(row.requestTime)}</Text>
      <Text style={ui.caption}>{row.assignedUserId === pos.owner ? 'Đã giao cho bạn' : row.assignedUserId ? 'Đã phân công' : 'Chưa phân công'}</Text>
      <Text selectable style={ui.caption}>Hồ sơ hành khách: {row.bookingPassengerId ?? 'Chưa có liên kết'}</Text>
      {!!row.scheduleId && <Text selectable style={ui.caption}>Lịch phục vụ: {row.scheduleId}</Text>}
      <Text style={ui.body}>Đã phục vụ: {row.fulfilledQuantity ?? 'Chưa có số liệu'} {row.fulfillmentUnitCode ?? ''}</Text>
      {row.unitPriceSnapshot !== null && <Text style={ui.caption}>Giá tham chiếu: {money(row.unitPriceSnapshot, row.currencySnapshot)}</Text>}
      {row.completedAt && <Text style={ui.caption}>Hoàn tất: {dateTime(row.completedAt)}</Text>}
      {row.usageMode === 'ONBOARD' && <Notice>Yêu cầu được ghi nhận tại quầy. Hoàn tất yêu cầu này không phải bán thêm dịch vụ.</Notice>}
      {!!row.fareBenefitSnapshotId && !!row.bookingPassengerId && <RequestEntitlement row={row} />}
      {!!row.note && <Text style={ui.body}>{row.note}</Text>}
      </View>{actions(row, pos.owner, service.permissions).length > 0 && <View style={posPane}>
      {actions(row, pos.owner, service.permissions).map(action => <PassengerButton compact key={action}
        label={requestLabels[action]} variant={action === 'cancel' || action === 'reject' ? 'text' : 'secondary'}
        disabled={!pos.verified || query.isFetching || !!query.error || confirm.pending}
        onPress={() => { fulfilled.current = ''; confirm.open({
          title: requestLabels[action], description: `${service.name} · Số lượng ${row.quantity}. ${action === 'complete' ? 'Xác nhận đã cung cấp toàn bộ dịch vụ. Hệ thống ghi nhận usage và quyền lợi theo yêu cầu, không tạo sale mới tại bước này.' : 'Hệ thống sẽ kiểm tra lại trạng thái và phân công trước khi ghi.'}`,
          content: action === 'complete' && row.fareBenefitSnapshotId ? pending =>
            <FulfillmentField key={row.id} unit={row.fulfillmentUnitCode} quantity={row.quantity} disabled={pending}
              onChange={value => { fulfilled.current = value; }} /> : undefined,
          run: () => send(row, action),
        }); }} />)}
      </View>}</PosColumns>
    </View>)}
    {confirm.ui}
  </PosPage>;
}

function FulfillmentField({ unit, quantity, disabled, onChange }: {
  unit: string | null; quantity: number; disabled: boolean; onChange: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  return <View style={ui.card}>
    <Text style={ui.body}>Xác nhận đã phục vụ đủ {quantity} {unit ?? '(chưa có đơn vị)'}.</Text>
    <Field label={`Số lượng đã phục vụ (${unit ?? 'chưa có đơn vị'})`} value={value} keyboardType="number-pad"
      editable={!disabled} onChangeText={next => { setValue(next); onChange(next); }} />
  </View>;
}

function RequestEntitlement({ row }: { row: PosRequest }) {
  const pos = usePos();
  const allowed = ['SERVICE_REQUEST_READ','SERVICE_REQUEST_CREATE','SERVICE_REQUEST_EXECUTE'].some(permission => pos.employeePermissions.includes(permission));
  const query = useQuery({ queryKey: [...pos.key, 'entitlement', row.id, row.bookingPassengerId],
    queryFn: ({ signal }) => readRequestEntitlement(pos.owner, pos.signedInAt, row.id, row.bookingPassengerId!, signal),
    enabled: allowed && pos.verified, retry: false });
  if (!allowed) return <Text style={ui.caption}>Quyền lợi và định mức được Backend kiểm tra khi hoàn tất. Tài khoản chưa có quyền xem projection quyền lợi.</Text>;
  return <>
    <QueryState query={query} />
    {!query.error && query.data?.entitlement && <EntitlementSummary rows={[query.data.entitlement]} />}
    {!query.error && query.data && !query.data.entitlement && <Notice tone="warning">Hệ thống chưa trả projection quyền lợi cho yêu cầu này. Không tự tính quota; Backend kiểm tra khi phục vụ.</Notice>}
  </>;
}
