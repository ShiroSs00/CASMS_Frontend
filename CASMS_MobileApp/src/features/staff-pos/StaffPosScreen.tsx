import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { OceVieBrand } from '@/components/passenger/OceVieBrand';
import { EmptyState, FilterChips, SearchField, ui } from '@/components/passenger/PassengerUI';
import { lightTheme } from '@/constants/ocevie';
import { api, getApiUrl } from '@/lib/api';
import { authActions, useAuth } from '@/features/auth/session-store';
import { ConfirmAction, ErrorNotice, Input, Loading, PageIntro, StatusBadge } from '../passenger-actions/PassengerActionUI';
import { passengerApi } from '../passenger-actions/passenger-hooks';
import { dateTime, money } from '../passenger-actions/passenger-model';
import { createStaffApi } from './staff-api';
import { isOnboardStaff, productInput, requestActionLabels, requestActions, staffPermissions, type Product, type ProductForm, type RequestAction, type StaffRequest } from './staff-model';

const staffApi = createStaffApi(api);
const blank: ProductForm = { code: '', name: '', type: '', description: '', price: '', currency: '' };
type Operation = { kind: 'product'; product?: Product } | { kind: 'status'; product: Product; action: 'activate' | 'discontinue' } | { kind: 'request'; request: StaffRequest; action: RequestAction };

export function StaffPosScreen() {
  const auth = useAuth();
  if (auth.status === 'restoring') return <Loading />;
  if (auth.status !== 'authenticated' || !auth.session) return <Redirect href="/login" />;
  if (!isOnboardStaff(auth.session.user.roles)) return <StaffFrame><EmptyState title="Dành cho nhân viên trên tàu" description="Đăng nhập tài khoản nhân viên được phân quyền để sử dụng." /><PassengerButton label="Đăng xuất" onPress={() => { void authActions.logout(); }} /></StaffFrame>;
  return <StaffWorkspace key={auth.session.user.id} owner={auth.session.user.id} />;
}
function StaffFrame({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.screen} onLayout={() => { void SplashScreen.hideAsync().catch(console.warn); }}><ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView></SafeAreaView>;
}
function StaffWorkspace({ owner }: { owner: string }) {
  const client = useQueryClient();
  const prefix = ['staff-pos', getApiUrl(), owner];
  const me = useQuery({ queryKey: [...prefix, 'me'], queryFn: ({ signal }) => passengerApi.me(signal) });
  const permissions = staffPermissions(owner, me.data);
  const can = (p: string) => !me.error && !!permissions?.includes(p);
  const products = useQuery({ queryKey: [...prefix, 'products'], queryFn: ({ signal }) => staffApi.products(signal), enabled: can('PRODUCT_MANAGE') });
  const requests = useQuery({ queryKey: [...prefix, 'requests'], queryFn: ({ signal }) => staffApi.requests(signal), enabled: can('SERVICE_REQUEST_READ') });
  const services = useQuery({ queryKey: [...prefix, 'services'], queryFn: ({ signal }) => staffApi.services(signal), enabled: can('SERVICE_READ') });
  const [tab, setTab] = useState<'requests' | 'products'>('requests');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'active' | 'all' | 'mine'>('active');
  const [operation, setOperation] = useState<Operation | null>(null);
  const [form, setForm] = useState<ProductForm>(blank);
  const [validation, setValidation] = useState<unknown>(null);
  const mutation = useMutation({ retry: false, mutationFn: async (work: () => Promise<unknown>) => {
    const session = useAuth.getState().session;
    if (!session || session.user.id !== owner || !isOnboardStaff(session.user.roles)) throw new Error('Phiên nhân viên đã thay đổi. Vui lòng đăng nhập lại.');
    const result = await work();
    if (useAuth.getState().session?.accessToken !== session.accessToken) throw new Error('Phiên đăng nhập đã thay đổi. Hãy tải lại để kiểm tra kết quả.');
    return result;
  }, onSettled: async () => { await client.invalidateQueries({ queryKey: prefix }); } });
  function open(value: Operation) {
    mutation.reset(); setValidation(null);
    if (value.kind === 'product') { const p = value.product; setForm(p ? { code: p.code, name: p.name, type: p.type, description: p.description ?? '', price: String(p.price), currency: p.currency } : blank); }
    setOperation(value);
  }
  function submit() {
    if (!operation || mutation.isPending) return;
    const captured = operation;
    try {
      if (!permissions || me.error) throw new Error('Vui lòng xác minh lại quyền tài khoản trước khi tiếp tục.');
      if (captured.kind === 'product') { if (!can('PRODUCT_MANAGE')) throw new Error('Bạn chưa có quyền quản lý sản phẩm.'); productInput(form); }
      if (captured.kind === 'status' && !can('PRODUCT_MANAGE')) throw new Error('Bạn chưa có quyền quản lý sản phẩm.');
      if (captured.kind === 'request' && !requestActions(captured.request, owner, permissions ?? []).includes(captured.action)) throw new Error('Yêu cầu không còn phù hợp để xử lý. Hãy tải lại.');
    } catch (error) { setValidation(error); return; }
    setValidation(null);
    mutation.mutate(() => captured.kind === 'product' ? staffApi.saveProduct(form, captured.product?.id) : captured.kind === 'status' ? staffApi.productStatus(captured.product.id, captured.action) : staffApi.requestAction(captured.request.id, captured.action), { onSuccess: () => setOperation(null) });
  }
  const query = search.trim().toLocaleLowerCase('vi-VN');
  const matchingProducts = (products.data ?? []).filter(p => `${p.code} ${p.name} ${p.type}`.toLocaleLowerCase('vi-VN').includes(query));
  const matchingRequests = (requests.data ?? []).filter(r => {
    const name = services.data?.find(s => s.id === r.serviceId)?.name ?? '';
    const matchesScope = filter === 'all' || (filter === 'mine' ? r.assignedUserId === owner : ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status));
    return matchesScope && `${name} ${r.note ?? ''}`.toLocaleLowerCase('vi-VN').includes(query);
  }).sort((a, b) => Date.parse(b.requestTime) - Date.parse(a.requestTime));
  const title = operation?.kind === 'product' ? operation.product ? 'Lưu sản phẩm' : 'Thêm sản phẩm' : operation?.kind === 'status' ? operation.action === 'activate' ? 'Kích hoạt sản phẩm' : 'Ngừng kinh doanh' : operation?.kind === 'request' ? requestActionLabels[operation.action] : '';
  const fields: { key: keyof ProductForm; label: string; max: number }[] = [{ key: 'code', label: 'Mã sản phẩm', max: 50 }, { key: 'name', label: 'Tên sản phẩm', max: 200 }, { key: 'type', label: 'Loại sản phẩm', max: 50 }, { key: 'price', label: 'Đơn giá', max: 17 }, { key: 'currency', label: 'Tiền tệ', max: 3 }, { key: 'description', label: 'Mô tả', max: 1000 }];
  return <StaffFrame>
    <View style={styles.header}><OceVieBrand /><PassengerButton label="Đăng xuất" variant="text" disabled={mutation.isPending} onPress={() => { void authActions.logout(); }} /></View>
    <PageIntro title="POS nhân viên" description={me.data?.username} icon="room_service" />
    {me.isPending ? <Loading text="Đang xác minh tài khoản…" /> : me.error ? <ErrorNotice error={me.error} retry={() => { void me.refetch(); }} /> : !permissions ? <EmptyState title="Không có quyền truy cập" description="Phiên hiện tại không khớp tài khoản nhân viên đang hoạt động." /> : <>
      <FilterChips items={[{ key: 'requests', label: 'Yêu cầu dịch vụ' }, { key: 'products', label: 'Sản phẩm' }]} selected={tab} onSelect={value => { setTab(value); setSearch(''); }} />
      <SearchField value={search} onChangeText={setSearch} placeholder={tab === 'products' ? 'Tìm tên hoặc mã sản phẩm' : 'Tìm dịch vụ hoặc ghi chú'} />
      {tab === 'products' ? !can('PRODUCT_MANAGE') ? <Text style={ui.body}>Bạn chưa có quyền quản lý sản phẩm.</Text> : <>
        <PassengerButton label="Thêm sản phẩm" onPress={() => open({ kind: 'product' })} />
        <ErrorNotice error={products.error} retry={() => { void products.refetch(); }} />{products.isPending && <Loading />}
        {!products.isPending && !products.error && !matchingProducts.length && <EmptyState title="Chưa có sản phẩm phù hợp" description="Thay đổi từ khóa hoặc thêm sản phẩm mới." />}
        {matchingProducts.map(p => <View key={p.id} style={ui.card}><Text style={ui.caption}>{p.code} · {p.type}</Text><Text style={ui.sectionTitle}>{p.name}</Text>{!!p.description && <Text style={ui.body}>{p.description}</Text>}<Text style={ui.body}>{money(p.price, p.currency)}</Text><Text style={ui.caption}>{p.status === 'ACTIVE' ? 'Đang kinh doanh' : p.status === 'INACTIVE' ? 'Chưa kích hoạt' : p.status === 'DISCONTINUED' ? 'Đã ngừng kinh doanh' : p.status}</Text>
          <PassengerButton label="Chỉnh sửa sản phẩm" variant="secondary" onPress={() => open({ kind: 'product', product: p })} />
          {p.status === 'ACTIVE' && <PassengerButton label="Ngừng kinh doanh" variant="text" onPress={() => open({ kind: 'status', product: p, action: 'discontinue' })} />}
          {p.status === 'INACTIVE' && <PassengerButton label="Kích hoạt sản phẩm" onPress={() => open({ kind: 'status', product: p, action: 'activate' })} />}
        </View>)}
        <PassengerButton label="Cập nhật sản phẩm" variant="text" loading={products.isFetching} onPress={() => { void products.refetch(); }} />
      </> : !can('SERVICE_REQUEST_READ') ? <Text style={ui.body}>Bạn chưa có quyền xem yêu cầu dịch vụ.</Text> : <>
        <FilterChips items={[{ key: 'active', label: 'Cần xử lý' }, { key: 'mine', label: 'Tôi phụ trách' }, { key: 'all', label: 'Tất cả' }]} selected={filter} onSelect={setFilter} />
        <ErrorNotice error={requests.error ?? services.error} retry={() => { void requests.refetch(); if (can('SERVICE_READ')) void services.refetch(); }} />{requests.isPending && <Loading />}
        {!requests.isPending && !requests.error && !matchingRequests.length && <EmptyState title="Không có yêu cầu phù hợp" description="Yêu cầu dịch vụ sẽ xuất hiện tại đây khi hành khách gửi." />}
        {matchingRequests.map(r => <View key={r.id} style={ui.card}><Text style={ui.sectionTitle}>{services.data?.find(s => s.id === r.serviceId)?.name ?? 'Yêu cầu dịch vụ'}</Text><StatusBadge status={r.status} /><Text style={ui.body}>Số lượng {r.quantity}</Text><Text style={ui.caption}>{dateTime(r.requestTime)}</Text><Text style={ui.caption}>{!r.assignedUserId ? 'Chưa phân công' : r.assignedUserId === owner ? 'Bạn phụ trách' : 'Nhân viên khác phụ trách'}</Text>{!!r.note && <Text style={ui.body}>{r.note}</Text>}{!!r.completedAt && <Text style={ui.caption}>Hoàn tất {dateTime(r.completedAt)}</Text>}
          {requestActions(r, owner, permissions).map(action => <PassengerButton key={action} label={requestActionLabels[action]} variant={action === 'reject' ? 'text' : 'secondary'} onPress={() => open({ kind: 'request', request: r, action })} />)}
        </View>)}
        <PassengerButton label="Cập nhật yêu cầu" variant="text" loading={requests.isFetching} onPress={() => { void requests.refetch(); }} />
      </>}
    </>}
    <ConfirmAction visible={!!operation} title={title} description={operation?.kind === 'status' ? operation.product.name : operation?.kind === 'request' ? services.data?.find(s => s.id === operation.request.serviceId)?.name ?? 'Yêu cầu dịch vụ' : ''} onClose={() => setOperation(null)} onConfirm={submit} pending={mutation.isPending} error={mutation.error}>
      {operation?.kind === 'product' && fields.map(field => <Input key={field.key} label={field.label} value={form[field.key]} onChange={value => setForm(previous => ({ ...previous, [field.key]: value }))} multiline={field.key === 'description'} maxLength={field.max} disabled={mutation.isPending} />)}
      <ErrorNotice error={validation} />
    </ConfirmAction>
  </StaffFrame>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: lightTheme.background }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 } });
