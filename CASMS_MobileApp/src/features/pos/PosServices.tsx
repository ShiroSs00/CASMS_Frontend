import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { Choice, StatusBadge } from '@/features/passenger-actions/PassengerActionUI';
import { dateTime, money } from '@/features/passenger-actions/passenger-model';
import { ApiError } from '@/lib/api';
import { usePos, usePosRequests } from './PosLayout';
import type { PosRequest, RequestAction } from './pos-api';
import { fulfillmentInput } from './pos-lifecycle';
import { Field, Notice, PosPage, QueryState, posError, usePosConfirmation } from './pos-ui';

const requestLabels: Record<RequestAction, string> = {
  assign: 'Nhận phân công', accept: 'Tiếp nhận', reject: 'Từ chối',
  start: 'Bắt đầu', complete: 'Hoàn tất', cancel: 'Hủy yêu cầu',
};
const filters = [
  { id: 'open', label: 'Đang xử lý' },
  { id: 'mine', label: 'Của tôi' },
  { id: 'all', label: 'Tất cả' },
];
const serviceFilters = [
  { id: 'all', label: 'Tất cả dịch vụ' },
  { id: 'usage', label: 'Ghi nhận sử dụng' },
];
const openStates = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'];
const normalize = (value: string) => value.trim().toLocaleLowerCase('vi-VN');

function actions(row: PosRequest, owner: string, permissions: string[]): RequestAction[] {
  if (row.status === 'REQUESTED' && !row.assignedUserId) {
    return permissions.includes('SERVICE_REQUEST_ASSIGN') ? ['assign'] : [];
  }
  if (row.assignedUserId !== owner || !permissions.includes('SERVICE_REQUEST_EXECUTE')) return [];
  if (row.status === 'REQUESTED') return ['accept', 'reject', 'cancel'];
  if (row.status === 'ACCEPTED') return ['start', 'cancel'];
  return row.status === 'IN_PROGRESS' ? ['complete'] : [];
}

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
  function send(row: PosRequest, action: RequestAction) {
    const service = pos.assertReady().services.find(item => item.serviceId === row.serviceId);
    const state = cache.getQueryState<PosRequest[]>([...pos.key, 'requests']);
    const current = state?.data?.find(item => item.id === row.id && item.serviceId === row.serviceId);
    if (!state || state.error || state.isInvalidated || state.fetchStatus !== 'idle' || !current
      || !service?.permissions.includes('SERVICE_REQUEST_READ') || !actions(current, pos.owner, service.permissions).includes(action)) {
      throw new ApiError('Yêu cầu hoặc quyền đã thay đổi.', 409, 'POS_REVERIFY');
    }
    return pos.client.requestAction(row.id, action, action === 'complete' ? fulfillmentInput(current, fulfilled.current) : undefined);
  }
  if (!services.size) return <PosPage title="Yêu cầu dịch vụ"><Notice tone="warning">Bạn chưa có quyền xem yêu cầu trong phiên này.</Notice></PosPage>;
  const rows = query.error instanceof ApiError && query.error.status === 403 ? [] : query.data?.flatMap(row => {
    const service = services.get(row.serviceId);
    if (!service || (filter === 'open' && !openStates.includes(row.status))
      || (filter === 'mine' && row.assignedUserId !== pos.owner)
      || !normalize(`${service.name} ${service.code} ${row.note ?? ''}`).includes(normalize(search))) return [];
    return [{ row, service }];
  }) ?? [];
  return <PosPage title="Yêu cầu dịch vụ" refresh={reload} refreshing={query.isRefetching}>
    {!!pos.sessionError && <Notice tone="error" retry={pos.refreshSession}>{posError(pos.sessionError)}</Notice>}
    <Field label="Tìm dịch vụ hoặc ghi chú" value={search} onChangeText={setSearch} returnKeyType="search" />
    <Choice label="Trạng thái yêu cầu" value={filter} items={filters} onChange={setFilter} />
    <QueryState query={query} empty={!rows.length ? 'Không có yêu cầu phù hợp với bộ lọc.' : undefined} />
    {rows.map(({ row, service }) => <View style={ui.card} key={row.id}>
      <Text style={ui.sectionTitle}>{service.name}</Text>
      <StatusBadge status={row.status} />
      <Text style={ui.body}>Số lượng {row.quantity} · {dateTime(row.requestTime)}</Text>
      <Text style={ui.caption}>{row.assignedUserId === pos.owner ? 'Đã giao cho bạn' : row.assignedUserId ? 'Đã phân công' : 'Chưa phân công'}</Text>
      {!!row.note && <Text style={ui.body}>{row.note}</Text>}
      {actions(row, pos.owner, service.permissions).map(action => <PassengerButton compact key={action}
        label={requestLabels[action]} variant={action === 'cancel' || action === 'reject' ? 'text' : 'secondary'}
        disabled={!pos.verified || query.isFetching || !!query.error || confirm.pending}
        onPress={() => { fulfilled.current = ''; confirm.open({
          title: requestLabels[action], description: `${service.name} · Số lượng ${row.quantity}`,
          content: action === 'complete' && row.fareBenefitSnapshotId ? pending =>
            <FulfillmentField key={row.id} unit={row.fulfillmentUnitCode} quantity={row.quantity} disabled={pending}
              onChange={value => { fulfilled.current = value; }} /> : undefined,
          run: () => send(row, action),
        }); }} />)}
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
