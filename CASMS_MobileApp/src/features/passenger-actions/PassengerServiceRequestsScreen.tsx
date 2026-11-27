import { passengerCataloguePermissions } from './synced-contracts';
import { onboardError } from './onboard-errors';
import { EntitlementSummary } from './EntitlementSummary';
import { useOnboardKey, useOnboardSelection, useOnboardEntitlements, useOnboardGuard } from './onboard-context';
import { ownRequests, filterServices, matchingEntitlements, matchesRequestIntent, serviceNoteFingerprint } from './onboard-contracts';
import { ServiceDetail, CatalogueSkeleton, scheduleText } from './ServiceDetail';
import { ApiError, getApiUrl } from '@/lib/api';
import { useNow } from '@/hooks/use-now';
import { useAuth } from '@/features/auth/session-store';
import { readServiceOperation, beginServiceOperation, clearServiceOperation, newServiceOperationKey, type PendingServiceOperation } from './service-operation-store';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { Disclosure, EmptyState, FilterChips, SearchField, ui } from '@/components/passenger/PassengerUI';
import { Choice, BookingSelection, ConfirmAction, ErrorNotice, Input, LivePage, Loading, StatusBadge } from './PassengerActionUI';
import { passengerApi, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { dateTime, money, positiveQuantity, quantityError, serviceRequestActions, serviceRequestInput } from './passenger-model';
import type { Service, ServiceRequest } from './passenger-types';

type Operation = { kind: 'create'; service: Service } | { kind: 'edit'; request: ServiceRequest } | { kind: 'cancel'; request: ServiceRequest };
export function PassengerServiceRequestsScreen({ embedded = false }: { embedded?: boolean }) {
  return <ServiceRequestsWorkspace key={useOnboardKey()} embedded={embedded} />;
}

function ServiceRequestsWorkspace({ embedded }: { embedded: boolean }) {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const selection = useOnboardSelection(typeof params.bookingId === 'string' ? params.bookingId : '');
  const context = usePassengerContext();
  const assertScope = useOnboardGuard(selection);
  const entitlements = useOnboardEntitlements(selection);
  const [category, setCategory] = useState('');
  const [detailId, setDetailId] = useState('');
  const [requestFilter, setRequestFilter] = useState<'all' | 'active' | 'completed'>('all');
  const services = usePassengerQuery(['services', selection.bookingId, selection.bookingPassengerId, selection.cruiseId], signal => passengerApi.scopedServices(selection.bookingPassengerId, selection.cruiseId, signal), passengerCataloguePermissions, !!selection.bookingPassengerId && !!selection.cruiseId);
  const requestPermissions = ['SERVICE_REQUEST_READ', 'SERVICE_REQUEST_CREATE'] as const;
  const requests = usePassengerQuery(['service-requests', selection.bookingId, selection.bookingPassengerId, selection.cruiseId], passengerApi.requests, requestPermissions);
  const now = useNow();
  const [tab, setTab] = useState<'catalog' | 'requests'>('catalog'); const [search, setSearch] = useState('');
  const [operation, setOperation] = useState<Operation | null>(null); const [quantity, setQuantity] = useState('1'); const [note, setNote] = useState(''); const [validation, setValidation] = useState<unknown>(null);
  const action = usePassengerAction();
  const [slotId, setSlotId] = useState('');
  const [pendingOperation, setPendingOperation] = useState<PendingServiceOperation | null>(null);
  const [operationLoaded, setOperationLoaded] = useState(false);
  const pendingRef = useRef<PendingServiceOperation | null>(null);
  const payloadRef = useRef<string | null>(null), submitLock = useRef(false);
  const serviceId = operation?.kind === 'create' ? operation.service.id : '';
  const slots = usePassengerQuery(['service-slots', selection.cruiseId, selection.bookingPassengerId, serviceId],
    useCallback(signal => passengerApi.scopedSchedules(selection.bookingPassengerId, selection.cruiseId, serviceId, signal), [selection.bookingPassengerId, selection.cruiseId, serviceId]),
    passengerCataloguePermissions, Boolean(serviceId));
  const matchingSlots = slots.data?.filter(slot => slot.cruiseId === selection.cruiseId);
  useEffect(() => {
    let current = true;
    if (!context.ready || !context.owner) return;
    void readServiceOperation(context.owner).then(value => {
      if (!current) return;
      pendingRef.current = value;
      setPendingOperation(value);
      setOperationLoaded(true);
    }).catch(error => { if (current) setValidation(error); });
    return () => { current = false; };
  }, [context.ready, context.owner]);
  async function recover() {
    const owner = context.owner, pending = pendingRef.current;
    if (!owner || !pending || submitLock.current) return;
    submitLock.current = true;
    const epoch = context.auth.session?.signedInAt, backend = getApiUrl();
    setValidation(null);
    try {
      const saved = await passengerApi.requestByOperationKey(pending.key);
      assertScope();
      if (useAuth.getState().session?.user.id !== owner || useAuth.getState().session?.signedInAt !== epoch || getApiUrl() !== backend) return;
      if (saved.serviceId !== pending.serviceId || saved.bookingPassengerId !== pending.bookingPassengerId)
        throw new Error('Yêu cầu đã lưu chưa khớp thao tác của bạn.');
      await clearServiceOperation(owner, pending.key);
      assertScope();
      pendingRef.current = null; payloadRef.current = null; setPendingOperation(null);
      selection.choose(saved.bookingId ?? pending.bookingId, pending.bookingPassengerId);
      setOperation(null); setTab('requests'); await requests.refetch();
    } catch (error) {
      if (useAuth.getState().session?.user.id !== owner || useAuth.getState().session?.signedInAt !== epoch || getApiUrl() !== backend) return;
      setValidation(error instanceof ApiError && error.status === 404
        ? new Error('Chưa thấy yêu cầu đã lưu. Bạn có thể mở lại dịch vụ bên dưới và gửi lại với cùng mã thao tác.')
        : error);
    } finally { submitLock.current = false; }
  }

  const active = filterServices(services.data ?? [], search, category);
  const categories = [...new Map((services.data ?? []).filter(s => s.categoryId && s.categoryName).map(s => [s.categoryId!, s.categoryName!])).entries()];
  const own = ownRequests(requests.data ?? [], selection.bookingId, selection.bookingPassengerId);
  const visibleRequests = own.filter(row => requestFilter === 'all' || (requestFilter === 'active' ? ['REQUESTED','ACCEPTED','IN_PROGRESS'].includes(row.status) : row.status === 'COMPLETED'));
  const beforeDeparture = !!selection.booking.data && now < Date.parse(selection.booking.data.departureDatetime);
  const selectedPerson = selection.people.find(p => p.bookingPassengerId === selection.bookingPassengerId);
  const canCreate = selection.ready;
  function open(value: Operation) {
    if (submitLock.current) return;
    action.reset(); setValidation(null); setSlotId(''); setQuantity(value.kind === 'create' ? '1' : String(value.request.quantity)); setNote(value.kind === 'create' ? '' : value.request.note ?? ''); setOperation(value);
    const pending = pendingRef.current;
    if (value.kind === 'create' && pending?.serviceId === value.service.id && pending.bookingPassengerId === selection.bookingPassengerId && pending.payload) {
      setQuantity(String(pending.payload.quantity)); setNote(''); setSlotId(pending.payload.scheduleId ?? '');
    }
  }
  function submit() {
    if (!operation || action.isPending || submitLock.current || !operationLoaded || !context.can('SERVICE_REQUEST_CREATE')) return;
    let amount = 1;
    try { if (operation.kind !== 'cancel') amount = positiveQuantity(quantity); if (note.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.'); }
    catch (error) { setValidation(error); return; }
    const captured = operation; const person = selection.bookingPassengerId;
    if (captured.kind === 'create') {
      const service = captured.service;
      if (beforeDeparture && service.canBuyPreCruise === false) { setValidation(new Error('Dịch vụ không nhận yêu cầu trước chuyến.')); return; }
      if ((service.requiresSchedule || service.preCruiseUsagePolicy === 'PER_DAY') && !slotId) {
        setValidation(new Error('Chọn lịch phục vụ cho dịch vụ này.')); return;
      }
      if (slotId && (slots.isFetching || slots.error || !matchingSlots?.some(slot => slot.id === slotId
          && slot.status === 'OPEN' && slot.remainingCapacity >= amount && Date.parse(slot.endsAt) > Date.now()))) {
        setValidation(new Error('Lịch đã chọn không còn đủ chỗ hoặc đã kết thúc.')); return;
      }
    }
    if (captured.kind === 'create' && !canCreate) { setValidation(new Error('Vui lòng chọn hồ sơ trong đặt chỗ đã xác nhận.')); return; }
    if (captured.kind !== 'cancel') {
      const service = captured.kind === 'create' ? captured.service : services.data?.find(s => s.id === captured.request.serviceId);
      if (!service) { setValidation(new Error('Vui lòng tải lại thông tin dịch vụ trước khi sửa yêu cầu.')); return; }
      try { amount = serviceRequestInput(
        (captured.kind === 'create' ? Boolean(slotId) : Boolean(captured.request.scheduleId))
          ? { ...service, capacity: null } : service, quantity, note).quantity; } catch (error) { setValidation(error); return; }
    }
    setValidation(null);
    submitLock.current = true;
    action.mutate(async assertCurrent => {
      assertScope();
      const owner = context.owner;
      if (!owner || useAuth.getState().session?.user.id !== owner)
        throw new Error('Phiên hành khách đã thay đổi.');
      if (captured.kind !== 'create') {
        const latest = await passengerApi.request(captured.request.id); assertCurrent(); assertScope();
        if (latest.bookingId !== selection.bookingId || latest.bookingPassengerId !== person) throw new Error('Yêu cầu không thuộc hồ sơ đang chọn.');
        if (captured.kind === 'cancel' && latest.status === 'CANCELLED') return latest;
        if (!serviceRequestActions(latest.status).includes(captured.kind) || (captured.kind === 'edit' && latest.usageMode === 'ONBOARD')) throw new Error('Trạng thái yêu cầu vừa thay đổi. Hãy tải lại.');
        const result = captured.kind === 'cancel' ? await passengerApi.cancelRequest(latest.id) : await passengerApi.updateRequest(latest.id, amount, note);
        assertCurrent(); assertScope();
        if (result.id !== latest.id || result.bookingPassengerId !== person || result.bookingId !== selection.bookingId
          || (captured.kind === 'cancel' ? result.status !== 'CANCELLED' : result.status !== 'REQUESTED' || result.quantity !== amount)) throw new Error('Chưa xác nhận được kết quả cập nhật yêu cầu.');
        return result;
      }
      if (pendingRef.current) {
        let prior: ServiceRequest | undefined;
        try { prior = await passengerApi.requestByOperationKey(pendingRef.current.key); }
        catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; }
        assertCurrent(); assertScope();
        if (prior) {
          if (!matchesRequestIntent(prior, { serviceId: captured.service.id, bookingPassengerId: person, bookingId: selection.bookingId, quantity: amount, scheduleId: slotId, note }))
            throw new Error('Yêu cầu đang chờ không khớp hồ sơ. Hãy đối chiếu trước khi tạo yêu cầu mới.');
          await clearServiceOperation(owner, pendingRef.current.key); assertCurrent(); assertScope();
          pendingRef.current = null; payloadRef.current = null; setPendingOperation(null); return prior;
        }
      }
      const scoped = await passengerApi.scopedServices(person, selection.cruiseId); assertCurrent(); assertScope();
      const fresh = scoped.find(row => row.id === captured.service.id);
      if (!fresh) throw new Error('Dịch vụ không còn khả dụng trong chuyến đang chọn.');
      if (fresh.price !== captured.service.price || fresh.currency !== captured.service.currency || fresh.requiresSchedule !== captured.service.requiresSchedule)
        throw new Error('Giá hoặc điều kiện dịch vụ vừa thay đổi. Tải lại và mở lại xác nhận.');
      if (slotId) {
        const freshSlots = await passengerApi.scopedSchedules(person, selection.cruiseId, captured.service.id); assertCurrent(); assertScope();
        if (!freshSlots.some(slot => slot.id === slotId && slot.cruiseId === selection.cruiseId && slot.status === 'OPEN'
          && slot.remainingCapacity >= amount && Date.parse(slot.endsAt) > Date.now())) throw new Error('Lịch đã thay đổi hoặc không còn đủ chỗ. Vui lòng chọn lại.');
      }
      if (!slotId && !pendingRef.current) {
        if (fresh.capacity !== null && fresh.capacity < amount) {
          throw new Error('Dịch vụ không còn đủ khả năng tiếp nhận số lượng này.');
        }
      }
      const payload = JSON.stringify({ serviceId: captured.service.id, person, quantity: amount, note: note.trim(), slotId });
      if (payloadRef.current && payloadRef.current !== payload)
        throw new Error('Giữ nguyên nội dung của yêu cầu đang chờ đối chiếu.');
      let pending = pendingRef.current;
      if (pending && (pending.serviceId !== captured.service.id || pending.bookingPassengerId !== person))
        throw new Error('Đối chiếu yêu cầu trước trước khi tạo yêu cầu cho dịch vụ khác.');
      if (!pending) pending = { key: newServiceOperationKey(), serviceId: captured.service.id,
        bookingId: selection.bookingId, bookingPassengerId: person, payload: { quantity: amount, scheduleId: slotId || null, noteFingerprint: serviceNoteFingerprint(note) } };
      if (pending.payload && (pending.payload.quantity !== amount || (pending.payload.scheduleId ?? '') !== slotId || pending.payload.noteFingerprint !== serviceNoteFingerprint(note))) throw new Error('Giữ nguyên nội dung yêu cầu đang chờ đối chiếu.');
      pending = await beginServiceOperation(owner, pending);
      pendingRef.current = pending; setPendingOperation(pending);
      if (pending.serviceId !== captured.service.id || pending.bookingPassengerId !== person || pending.bookingId !== selection.bookingId
        || pending.payload && (pending.payload.quantity !== amount || (pending.payload.scheduleId ?? '') !== slotId || pending.payload.noteFingerprint !== serviceNoteFingerprint(note)))
        throw new Error('Đang có yêu cầu khác cần đối chiếu. Kiểm tra yêu cầu đã lưu trước khi gửi tiếp.');
      pendingRef.current = pending; payloadRef.current = payload; setPendingOperation(pending);
      if (useAuth.getState().session?.user.id !== owner)
        throw new Error('Phiên hành khách đã thay đổi.');
      assertCurrent(); assertScope();
      let saved: ServiceRequest;
      try {
        saved = await passengerApi.createRequest(captured.service.id, person, amount, note, slotId || undefined, pending.key);
        assertCurrent(); assertScope();
      } catch (error) {
        assertCurrent(); assertScope();
        if (error instanceof ApiError && [400, 403, 422].includes(error.status)) {
          await clearServiceOperation(owner, pending.key);
          pendingRef.current = null; payloadRef.current = null; setPendingOperation(null);
        }
        throw error;
      }
      if (saved.serviceId !== captured.service.id || saved.bookingPassengerId !== person
          || saved.quantity !== amount || (saved.scheduleId ?? '') !== slotId)
        throw new Error('Chưa đối chiếu được kết quả gửi yêu cầu.');
      await clearServiceOperation(owner, pending.key);
      pendingRef.current = null; payloadRef.current = null; setPendingOperation(null);
      return saved;
    }, { onSuccess: () => { setOperation(null); setTab('requests'); },
      onSettled: () => { submitLock.current = false; } });
  }

  return <LivePage title="Dịch vụ trên tàu" permission={passengerCataloguePermissions} detail={!embedded} selected="services"
    onRefresh={() => { void services.refetch(); void requests.refetch(); void entitlements.refetch(); void selection.source.refetch(); }} refreshing={services.isFetching || requests.isFetching}>
    <PassengerButton compact label="Hoạt động và tour" variant="text" onPress={() => router.push('/passenger-activities')} />
    <PassengerButton compact label="Quyền lợi đã mua" variant="text" onPress={() => router.push('/passenger-packages')} />
    <BookingSelection selection={selection} />
    <Text style={ui.caption}>Dịch vụ và lịch phục vụ dành cho hồ sơ trong chuyến đã chọn. Điều kiện được kiểm tra lại khi gửi yêu cầu.</Text>
    <ErrorNotice error={selection.booking.error ?? entitlements.error} />
    {selection.voyage && <Text style={ui.body}>{selection.voyage.cruiseName} · {selectedPerson?.fullName ?? 'Đang xác minh hồ sơ'} · {requests.isSuccess && !requests.error ? `${own.filter(r => ['REQUESTED','ACCEPTED','IN_PROGRESS'].includes(r.status)).length} yêu cầu đang xử lý` : 'Chưa cập nhật yêu cầu'}</Text>}
    {(services.fetchStatus === 'paused' || requests.fetchStatus === 'paused') && <Text style={ui.body}>Đang chờ kết nối. Kiểm tra mạng và kéo xuống để cập nhật; chưa gửi thêm yêu cầu khi kết quả cũ chưa rõ.</Text>}
    {pendingOperation && <View style={ui.card}>
      <Text style={ui.sectionTitle}>Yêu cầu cần đối chiếu</Text>
      <Text style={ui.body}>Lần gửi trước chưa rõ kết quả. Kiểm tra trước khi gửi tiếp. Nếu cần gửi lại, giữ nguyên số lượng, lịch và nhập lại đúng ghi chú trước đó.</Text>
      <PassengerButton label="Kiểm tra yêu cầu đã lưu" disabled={action.isPending} onPress={() => { void recover(); }} />
    </View>}
    <ErrorNotice error={onboardError(validation)} />
    <FilterChips items={[{ key: 'catalog', label: 'Dịch vụ' }, { key: 'requests', label: 'Yêu cầu của tôi' }]} selected={tab} onSelect={setTab} />
    {tab === 'catalog' ? <>
      <SearchField placeholder="Tìm dịch vụ trên tàu" value={search} onChangeText={setSearch} />
      {!!categories.length && <FilterChips items={[{ key: '', label: 'Tất cả danh mục' }, ...categories.map(([key, label]) => ({ key, label }))]} selected={category} onSelect={setCategory} />}
      <ErrorNotice error={onboardError(services.error)} retry={() => { void services.refetch(); }} />
      {services.isLoading && <CatalogueSkeleton />}
      {!services.isPending && !services.error && !active.length && <EmptyState title={search ? 'Không tìm thấy dịch vụ' : 'Chưa có dịch vụ'} />}
      {active.map(service => <View key={service.id} style={ui.card}><Text style={ui.caption}>{service.categoryName ?? 'Dịch vụ trên tàu'}</Text><Text style={ui.sectionTitle}>{service.name}</Text>
        <Text style={ui.amountValue}>{money(service.price, service.currency)}</Text>
        {!!service.description && <Disclosure title="Chi tiết dịch vụ"><Text style={ui.body}>{service.description}</Text></Disclosure>}
        <PassengerButton label="Xem dịch vụ và lịch phục vụ" variant="secondary" onPress={() => setDetailId(service.id)} />
      </View>)}
      <PassengerButton label="Cập nhật dịch vụ" variant="text" loading={services.isFetching} onPress={() => { void services.refetch(); }} />
    </> : !requestPermissions.some(context.can) ? <Text style={ui.body}>Tài khoản chưa có quyền xem yêu cầu dịch vụ.</Text> : <>
      <FilterChips items={[{ key: 'all', label: 'Tất cả' }, { key: 'active', label: 'Đang xử lý' }, { key: 'completed', label: 'Đã sử dụng' }]} selected={requestFilter} onSelect={setRequestFilter} />
      <ErrorNotice error={requests.error} retry={() => { void requests.refetch(); }} />{requests.isLoading && <Loading />}
      {!selection.source.isPending && !selection.source.error && !!selection.bookingId && !requests.isPending && !requests.error && !visibleRequests.length && <EmptyState title="Chưa có yêu cầu" />}
      {visibleRequests.map(request => <View key={request.id} style={ui.card}>
        <Text style={ui.sectionTitle}>{services.data?.find(s => s.id === request.serviceId)?.name ?? 'Yêu cầu dịch vụ'}</Text>
        <StatusBadge status={request.status} />{request.bookingPassengerId && <Text style={ui.caption}>{selection.booking.data?.passengers.find(p => p.bookingPassengerId === request.bookingPassengerId)?.fullName ?? 'Hành khách trong chuyến đi'}</Text>}<Text style={ui.body}>Số lượng {request.quantity}</Text><Text style={ui.caption}>{dateTime(request.requestTime)}</Text>
        {request.fareBenefitSnapshotId && <Text style={ui.body}>Đã liên kết quyền lợi gói du thuyền.</Text>}
        <Text style={ui.body}>Đã phục vụ {request.fulfilledQuantity ?? 'chưa ghi nhận'} {request.fulfillmentUnitCode ?? ''}</Text>
        {request.usageMode && request.usageMode !== 'LEGACY' && <Text style={ui.caption}>{request.usageMode === 'PRE_CRUISE' ? 'Trước chuyến' : 'Trên tàu'}</Text>}
        {!!request.usagePolicySnapshot && <Text style={ui.caption}>Định mức {request.usagePolicySnapshot === 'UNLIMITED' ? 'không giới hạn' : request.usagePolicySnapshot === 'PER_DAY' ? 'mỗi ngày' : 'mỗi chuyến'}{request.usageLimitSnapshot == null ? '' : ` · ${request.usageLimitSnapshot}`}{request.usageTimeZoneSnapshot ? ` · ${request.usageTimeZoneSnapshot}` : ''}</Text>}
        {request.unitPriceSnapshot != null && <Text style={ui.caption}>Giá tham chiếu lúc yêu cầu {money(request.unitPriceSnapshot, request.currencySnapshot ?? null)}</Text>}
        {!!request.completedAt && <Text style={ui.caption}>Hoàn tất {dateTime(request.completedAt)}</Text>}
        {!!request.note && <Text style={ui.body}>{request.note}</Text>}
        {context.can('SERVICE_REQUEST_CREATE') && request.usageMode !== 'ONBOARD' && serviceRequestActions(request.status).includes('edit') && !!services.data?.some(s => s.id === request.serviceId && s.status === 'ACTIVE') && <PassengerButton label="Sửa yêu cầu" variant="secondary" onPress={() => open({ kind: 'edit', request })} />}
        {context.can('SERVICE_REQUEST_CREATE') && serviceRequestActions(request.status).includes('cancel') && <PassengerButton label="Hủy yêu cầu" variant="text" onPress={() => open({ kind: 'cancel', request })} />}
      </View>)}
      <PassengerButton label="Cập nhật yêu cầu" variant="text" loading={requests.isFetching} onPress={() => { void requests.refetch(); }} />
    </>}
    {!!detailId && <ServiceDetail key={detailId} serviceId={detailId} cruiseId={selection.cruiseId} personId={selection.bookingPassengerId}
      entitlements={entitlements.data ?? []} beforeDeparture={beforeDeparture} canRequest={canCreate && context.can('SERVICE_REQUEST_CREATE') && operationLoaded && (!pendingOperation || pendingOperation.serviceId === detailId && pendingOperation.bookingPassengerId === selection.bookingPassengerId)}
      onClose={() => setDetailId('')} onRequest={service => { setDetailId(''); open({ kind: 'create', service }); }} />}
    <ConfirmAction visible={!!operation} dirty={!!operation && operation.kind !== 'cancel' && (quantity !== (operation.kind === 'create' ? '1' : String(operation.request.quantity)) || note !== (operation.kind === 'create' ? '' : operation.request.note ?? '') || !!slotId)} title={operation?.kind === 'create' ? 'Xác nhận gửi yêu cầu' : operation?.kind === 'edit' ? 'Lưu thay đổi yêu cầu' : 'Xác nhận hủy yêu cầu'} description={operation?.kind === 'cancel' ? 'Bạn muốn hủy yêu cầu dịch vụ này?' : 'Yêu cầu cần được nhân viên xác nhận. Chưa thu tiền ở bước này.'} onClose={() => { if (!submitLock.current) setOperation(null); }} onConfirm={submit} pending={action.isPending} disabled={!operationLoaded || !selection.ready} error={onboardError(action.error)}>
      {operation?.kind === 'create' && <View style={ui.card}><Text style={ui.sectionTitle}>{operation.service.name}</Text><Text style={ui.body}>{selectedPerson?.fullName}{selectedPerson?.cabinNumber ? ` · Phòng ${selectedPerson.cabinNumber}` : ''}</Text><Text style={ui.caption}>Đơn giá {money(operation.service.price, operation.service.currency)}</Text></View>}
      {operation?.kind === 'create' && <EntitlementSummary rows={matchingEntitlements(entitlements.data ?? [], selection.bookingPassengerId, 'SERVICE', operation.service.id)} />}
      {!!operation && operation.kind !== 'create' && <Text style={ui.sectionTitle}>{services.data?.find(s => s.id === operation.request.serviceId)?.name ?? 'Yêu cầu dịch vụ'}</Text>}
      {operation?.kind === 'create' && <>
        {slots.isPending && <Loading text="Đang tải lịch phục vụ…" />}
        <ErrorNotice error={slots.error} retry={() => { void slots.refetch(); }} />
        <Choice label="Lịch phục vụ của chuyến" value={slotId}
          items={[...(!operation.service.requiresSchedule && operation.service.preCruiseUsagePolicy !== 'PER_DAY'
            ? [{ id: '', label: 'Không chọn khung giờ' }] : []),
            ...(matchingSlots ?? []).filter(slot => slot.remainingCapacity >= Number(quantity) && Date.parse(slot.endsAt) > now && slot.status === 'OPEN')
              .map(slot => ({ id: slot.id, label: scheduleText(slot) }))]}
          onChange={setSlotId} disabled={!!pendingOperation?.payload || action.isPending || slots.isFetching || Boolean(slots.error)} />
      </>}
      {operation?.kind !== 'cancel' && <><Input label="Số lượng" value={quantity} onChange={setQuantity} numeric maxLength={10} disabled={action.isPending || !!pendingOperation?.payload} error={quantityError(quantity)} /><Input label="Ghi chú nếu có" value={note} onChange={setNote} multiline maxLength={500} disabled={action.isPending} /></>}
      <ErrorNotice error={onboardError(validation)} />
    </ConfirmAction>
  </LivePage>;
}
