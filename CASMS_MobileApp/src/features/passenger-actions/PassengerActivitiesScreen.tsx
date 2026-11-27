import { uuid as nativeUuid } from 'expo';
import { verifyRegistrationOperation, type RegistrationOperation } from './registration-operation';
import { readRegistrationOperation, beginRegistrationOperation, clearRegistrationOperation } from './registration-operation-store';
import { onboardError } from './onboard-errors';
import { useOnboardKey, useOnboardSelection, useOnboardEntitlements, useOnboardGuard } from './onboard-context';
import { matchingEntitlements } from './onboard-contracts';
import { EntitlementSummary } from './EntitlementSummary';
import { CatalogueSkeleton } from './ServiceDetail';
import { useNow } from '@/hooks/use-now';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ApiError, getApiUrl } from '@/lib/api';
import { EmptyState, FilterChips, ui } from '@/components/passenger/PassengerUI';
import { BookingSelection, ConfirmAction, ErrorNotice, Input, LivePage, Loading, StatusBadge } from './PassengerActionUI';
import { passengerApi, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { canRegister, dateTime, money, positiveQuantity, quantityError, registrationActions, statusText } from './passenger-model';
import type { Registration } from './passenger-types';

type Target = { id: string; name: string; kind: 'activity' | 'excursion'; endTime: string; status: string; available: number | null; cruiseStopId?: string };
type Operation = { kind: 'register'; target: Target } | { kind: 'confirm' | 'edit' | 'cancel'; registration: Registration };
export function PassengerActivitiesScreen() { return <ActivitiesWorkspace key={useOnboardKey()} />; }
function ActivitiesWorkspace() {
  const params = useLocalSearchParams<{ bookingId?: string; view?: string }>();
  const selection = useOnboardSelection(typeof params.bookingId === 'string' ? params.bookingId : '');
  const context = usePassengerContext(); const cruiseId = selection.cruiseId;
  const assertScope = useOnboardGuard(selection);
  const now = useNow();
  const entitlements = useOnboardEntitlements(selection);
  const [detail, setDetail] = useState<{ kind: 'ACTIVITY' | 'EXCURSION'; id: string }>();
  const [reconciling, setReconciling] = useState(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const activities = usePassengerQuery(['activities', cruiseId, selection.bookingPassengerId], passengerApi.activities, 'ACTIVITY_READ');
  const excursions = usePassengerQuery(['excursions', cruiseId, selection.voyage?.itineraryId, selection.bookingPassengerId], signal => passengerApi.excursions(cruiseId, signal), 'EXCURSION_READ', !!cruiseId && context.can('ITINERARY_READ') && context.can('CRUISE_STOP_READ'));
  const registrations = usePassengerQuery(['registrations', cruiseId, selection.bookingPassengerId], passengerApi.registrations, 'ACTIVITY_REGISTRATION');
  const [tab, setTab] = useState<'activities' | 'excursions' | 'registrations'>(params.view === 'excursions' ? 'excursions' : 'activities');
  const [operation, setOperation] = useState<Operation | null>(null); const [quantity, setQuantity] = useState('1'); const [reason, setReason] = useState(''); const [validation, setValidation] = useState<unknown>(null);
  const action = usePassengerAction();
  const lock = useRef(false);
  const [success, setSuccess] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<RegistrationOperation | null>(null);
  const [journalLoaded, setJournalLoaded] = useState(false);
  const owner = context.owner, backend = getApiUrl(), signedInAt = context.auth.session?.signedInAt;
  useEffect(() => {
    let live = true;
    if (!owner || !context.ready) return;
    void readRegistrationOperation(owner, backend).then(saved => {
      if (live) { setPendingOperation(saved); setJournalLoaded(true); }
    }).catch(error => { if (live) setValidation(error); });
    return () => { live = false; };
  }, [owner, backend, context.ready]);
  const uncertain = outcomeUnknown || !!pendingOperation || !journalLoaded;
  const activityId = operation?.kind === 'register' && operation.target.kind === 'activity' ? operation.target.id : '';
  const availability = usePassengerQuery(['activity-availability', cruiseId, selection.bookingPassengerId, activityId],
    signal => passengerApi.activityAvailability(activityId, signal), 'ACTIVITY_READ', !!activityId);
  const activeActivities = (activities.data ?? []).filter(a => a.cruiseId === cruiseId);
  const hasBooking = selection.ready;
  const mine = (registrations.data ?? []).filter(row => row.bookingPassengerId === selection.bookingPassengerId);
  async function reconcile() {
    if (lock.current) return;
    lock.current = true; setReconciling(true);
    try {
      assertScope();
      if (pendingOperation) {
        if (pendingOperation.owner !== owner || pendingOperation.backend !== backend || pendingOperation.bookingId !== selection.bookingId
          || pendingOperation.cruiseId !== cruiseId || pendingOperation.bookingPassengerId !== selection.bookingPassengerId)
          throw new Error('Chọn đúng chuyến và hồ sơ của đăng ký đang chờ để đối soát.');
        const result = await passengerApi.registrationByOperationKey(pendingOperation.key); assertScope();
        verifyRegistrationOperation(result, pendingOperation);
        if (context.can('ACTIVITY_REGISTRATION')) {
          const detail = await passengerApi.registration(result.id); assertScope();
          verifyRegistrationOperation(detail, pendingOperation);
          if (detail.id !== result.id) throw new Error('Đăng ký chưa khớp kết quả đối soát.');
        }
        await clearRegistrationOperation(pendingOperation); assertScope();
        setPendingOperation(null);
      }
      const result = await registrations.refetch(); assertScope();
      if (result.error || !result.data) throw new Error('Chưa cập nhật được đăng ký.');
      if (context.can('ACTIVITY_READ')) void activities.refetch();
      if (context.can('EXCURSION_READ') && context.can('ITINERARY_READ') && context.can('CRUISE_STOP_READ')) void excursions.refetch();
      setOutcomeUnknown(false); setOperation(null); setTab('registrations'); setValidation(null); action.reset();
    } catch (error) { setValidation(error); } finally { lock.current = false; setReconciling(false); }
  }
  function open(value: Operation) {
    if (lock.current || uncertain) return;
    action.reset(); setSuccess(false); setValidation(null); setQuantity(value.kind === 'register' ? '1' : String(value.registration.quantity)); setReason(''); setOperation(value);
  }
  function duplicate(target: Target) { return (registrations.data ?? []).some(r => r.bookingPassengerId === selection.bookingPassengerId && ['PENDING', 'CONFIRMED'].includes(r.status) && (target.kind === 'activity' ? r.activityId === target.id : r.excursionId === target.id)); }
  async function submit() {
    if (!operation || lock.current || uncertain) return;
    let amount = 1;
    try { if (operation.kind === 'register' || operation.kind === 'edit') amount = positiveQuantity(quantity); }
    catch (error) { setValidation(error); return; }
    const captured = operation; const person = selection.bookingPassengerId;
    lock.current = true;
    setValidation(null);
    let sent = false;
    try { await action.mutateAsync(async assertCurrent => {
      assertScope();
      if (captured.kind === 'register') {
        if (!hasBooking || !person) throw new Error('Chọn hồ sơ trong đặt chỗ đã xác nhận.');
        if (!context.can(captured.target.kind === 'activity' ? 'ACTIVITY_REGISTRATION' : 'EXCURSION_BOOKING')) throw new Error('Tài khoản chưa có quyền đăng ký.');
        let available = captured.target.available; let status = captured.target.status;
        const existing = context.can('ACTIVITY_REGISTRATION') ? await passengerApi.registrations() : []; assertCurrent(); assertScope();
        if (existing.some(r => r.bookingPassengerId === person && ['PENDING','CONFIRMED'].includes(r.status) && (captured.target.kind === 'activity' ? r.activityId === captured.target.id : r.excursionId === captured.target.id))) throw new Error('Hồ sơ đã có đăng ký cho hoạt động hoặc tour này. Hãy cập nhật Đăng ký của tôi.');
        if (captured.target.kind === 'activity') {
          const current = await passengerApi.activity(captured.target.id); assertCurrent(); assertScope();
          if (current.cruiseId !== cruiseId || current.endTime !== captured.target.endTime) throw new Error('Lịch hoạt động đã thay đổi. Hãy tải lại và xác nhận lịch mới.');
          const latest = await passengerApi.activityAvailability(captured.target.id);
          if (latest.activityId !== captured.target.id) throw new Error('Không kiểm tra được chỗ trống.');
          available = latest.availableSeats; status = latest.status;
        } else {
          const current = await passengerApi.excursions(cruiseId); assertCurrent(); assertScope();
          if (!current.some(e => e.shoreExcursionId === captured.target.id && e.cruiseStopId === captured.target.cruiseStopId && e.plannedReturnTime === captured.target.endTime)) throw new Error('Tour hoặc lịch cảng đã thay đổi. Hãy tải lại trước khi đăng ký.');
          const latest = await passengerApi.excursionAvailability(captured.target.id, amount);
          if (latest.shoreExcursionId !== captured.target.id) throw new Error('Không kiểm tra được chỗ trống của tour.');
          if (latest.cruiseStopId !== captured.target.cruiseStopId || latest.plannedReturnTime !== captured.target.endTime) throw new Error('Tour đã thay đổi điểm dừng hoặc lịch. Vui lòng tải lại.');
          available = latest.availableCapacity ?? null; status = latest.status;
        }
        if (!canRegister(status, captured.target.endTime, available, amount)) throw new Error('Hoạt động hoặc tour không còn mở hoặc không đủ chỗ cho số lượng này.');
        assertCurrent(); assertScope();
        if (!owner || signedInAt === undefined) throw new Error('Phiên đăng nhập đã thay đổi.');
        const journal = await beginRegistrationOperation({ version: 1, key: nativeUuid.v4(), backend, owner, signedInAt,
          bookingId: selection.bookingId, cruiseId, bookingPassengerId: person, kind: captured.target.kind,
          resourceId: captured.target.id, quantity: amount }).catch(async error => {
            const saved = await readRegistrationOperation(owner, backend); assertCurrent(); assertScope();
            setPendingOperation(saved); throw error;
          });
        assertCurrent(); assertScope(); setPendingOperation(journal);
        sent = true;
        const result = await passengerApi.register(captured.target.kind, captured.target.id, person, amount, journal.key);
        assertCurrent(); assertScope();
        verifyRegistrationOperation(result, journal);
        const targetId = captured.target.kind === 'activity' ? result?.activityId : result?.excursionId;
        if (!result?.id || result.bookingPassengerId !== person || result.quantity !== amount || targetId !== captured.target.id) {
          throw new ApiError('Chưa xác nhận được đăng ký đã gửi.', 502);
        }
        await clearRegistrationOperation(journal); assertCurrent(); assertScope(); setPendingOperation(null);
        return result;
      }
      if (!context.can('ACTIVITY_REGISTRATION')) throw new Error('Tài khoản chưa có quyền sửa đăng ký.');
      const latest = await passengerApi.registration(captured.registration.id); assertCurrent(); assertScope();
      if (latest.id !== captured.registration.id || latest.bookingPassengerId !== person || latest.activityId !== captured.registration.activityId || latest.excursionId !== captured.registration.excursionId) throw new Error('Đăng ký không khớp hồ sơ.');
      if (captured.kind === 'cancel' && latest.status === 'CANCELLED' || captured.kind === 'confirm' && latest.status === 'CONFIRMED') return latest;
      if (!registrationActions(latest).includes(captured.kind)) throw new Error('Trạng thái đăng ký đã thay đổi. Hãy tải lại.');
      sent = true;
      const result = captured.kind === 'confirm' ? await passengerApi.confirmRegistration(captured.registration.id)
        : captured.kind === 'edit' ? await passengerApi.updateRegistration(captured.registration.id, amount)
          : await passengerApi.cancelRegistration(captured.registration.id, reason);
      if (result?.id !== captured.registration.id || result.bookingPassengerId !== person || result.status !== (captured.kind === 'confirm' ? 'CONFIRMED' : captured.kind === 'cancel' ? 'CANCELLED' : 'PENDING') || (captured.kind === 'edit' && result.quantity !== amount)) throw new ApiError('Chưa xác nhận được đăng ký đã cập nhật.', 502);
      return result;
    });
      setSuccess(true); setOperation(null); setTab('registrations');
    } catch (error) { if (sent && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500)) setOutcomeUnknown(true); }
    finally { lock.current = false; }
  }
  return <LivePage title="Hoạt động và tour" onRefresh={() => { void activities.refetch(); void excursions.refetch(); void registrations.refetch(); void entitlements.refetch(); void selection.source.refetch(); }} refreshing={activities.isFetching || excursions.isFetching || registrations.isFetching}>
    <Text style={ui.caption}>Hoạt động hiển thị giờ UTC khi chưa có múi giờ từ lịch. Tour dùng múi giờ của cảng nếu có.</Text>
    <BookingSelection selection={selection} />
    <ErrorNotice error={selection.booking.error ?? entitlements.error} />
    {(activities.fetchStatus === 'paused' || excursions.fetchStatus === 'paused' || registrations.fetchStatus === 'paused') && <Text style={ui.body}>Đang chờ kết nối để cập nhật danh mục và đăng ký.</Text>}
    {!journalLoaded && <Loading text="Đang kiểm tra đăng ký đang chờ…" />}
    {(outcomeUnknown || !!pendingOperation) && <View style={ui.card}><Text style={ui.body}>Đăng ký đang chờ được kiểm tra. Đối soát kết quả gốc trước khi tiếp tục. Nếu chưa tìm thấy, hồ sơ được giữ để quầy hỗ trợ kiểm tra.</Text><PassengerButton label="Đối soát đăng ký" loading={reconciling} onPress={() => { void reconcile(); }} /></View>}
    {!operation && <ErrorNotice error={onboardError(validation)} />}
    {success && <Text accessibilityLiveRegion="polite" style={ui.body}>Đã cập nhật đăng ký của bạn.</Text>}
    <FilterChips items={[{ key: 'activities', label: 'Trên tàu' }, { key: 'excursions', label: 'Tour trên bờ' }, { key: 'registrations', label: 'Đăng ký của tôi' }]} selected={tab} onSelect={setTab} />
    {tab === 'activities' && (!context.can('ACTIVITY_READ') ? <Text style={ui.body}>Tài khoản chưa có quyền xem hoạt động trên tàu.</Text> : <>
      <ErrorNotice error={activities.error} retry={() => { void activities.refetch(); }} />
      {activities.isLoading && <CatalogueSkeleton />}
      {!!cruiseId && !activities.isPending && !activities.error && !activeActivities.length && <EmptyState title="Chưa có hoạt động" />}
      {activeActivities.map(item => {
        const target: Target = { id: item.id, name: item.name, kind: 'activity', endTime: item.endTime, status: item.status, available: null };
        return <View key={item.id} style={ui.card}><StatusBadge status={item.status} /><Text style={ui.sectionTitle}>{item.name}</Text>
          <Text style={ui.body}>{dateTime(item.startTime, 'UTC')} – {dateTime(item.endTime, 'UTC')}</Text><Text style={ui.body}>{item.location ?? 'Địa điểm chưa cập nhật'}</Text>
          {!!item.description && <Text style={ui.body}>{item.description}</Text>}<Text style={ui.body}>Giá niêm yết: {money(item.price, item.currencyCode)}</Text><Text style={ui.caption}>Sức chứa: {item.capacity}. Chỗ còn lại được kiểm tra khi đăng ký.</Text>{item.meetingPoint && <Text style={ui.body}>Điểm tập trung: {item.meetingPoint}</Text>}{item.deckNumber != null && <Text style={ui.caption}>Tầng {item.deckNumber}{item.cabinNumber ? ` · Phòng ${item.cabinNumber}` : ''}</Text>}<PassengerButton label="Xem quyền lợi liên quan" variant="text" onPress={() => setDetail({ kind: 'ACTIVITY', id: item.id })} />
          {context.can('ACTIVITY_REGISTRATION') && <PassengerButton label={duplicate(target) ? 'Đã có đăng ký' : 'Đăng ký hoạt động'} disabled={!hasBooking || duplicate(target) || !canRegister(item.status, item.endTime, null, 1, now) || uncertain || registrations.isFetching || !!registrations.error} onPress={() => open({ kind: 'register', target })} />}
        </View>;
      })}
      <PassengerButton label="Cập nhật hoạt động" variant="text" loading={activities.isFetching} onPress={() => { void activities.refetch(); }} />
    </>)}
    {tab === 'excursions' && <>
      {!context.can('EXCURSION_READ') || !context.can('ITINERARY_READ') || !context.can('CRUISE_STOP_READ') ? <Text style={ui.body}>Tài khoản chưa có đủ quyền xem tour theo hải trình.</Text> : <>
        <ErrorNotice error={excursions.error} retry={() => { void excursions.refetch(); }} />
        {!!cruiseId && excursions.isLoading && <CatalogueSkeleton />}
        {!!cruiseId && !excursions.isPending && !excursions.error && !excursions.data?.length && <EmptyState title="Chưa có tour" />}
        {excursions.data?.map(item => {
          const target: Target = { id: item.shoreExcursionId, name: item.excursionName, kind: 'excursion', endTime: item.plannedReturnTime, status: item.status, available: item.availableCapacity ?? null, cruiseStopId: item.cruiseStopId };
          return <View key={item.shoreExcursionId} style={ui.card}><StatusBadge status={item.status} /><Text style={ui.sectionTitle}>{item.excursionName}</Text>
            <Text style={ui.body}>{dateTime(item.startTime, item.portTimeZoneId ?? 'UTC')} – {dateTime(item.plannedReturnTime, item.portTimeZoneId ?? 'UTC')}</Text><Text style={ui.body}>{item.meetingPoint ?? 'Điểm tập trung chưa cập nhật'}</Text>{item.portName && <Text style={ui.body}>Cảng {item.portName}</Text>}
            <PassengerButton label="Xem quyền lợi liên quan" variant="text" onPress={() => setDetail({ kind: 'EXCURSION', id: item.shoreExcursionId })} /><Text style={ui.body}>Giá niêm yết: {money(item.price, item.currencyCode)}</Text>{item.availableCapacity != null && <Text style={ui.caption}>Còn {item.availableCapacity} chỗ</Text>}
            {context.can('EXCURSION_BOOKING') && <PassengerButton label={duplicate(target) ? 'Đã có đăng ký' : 'Đăng ký tour'} disabled={!hasBooking || duplicate(target) || !canRegister(item.status, item.plannedReturnTime, item.availableCapacity ?? null, 1, now) || uncertain || registrations.isFetching || !!registrations.error} onPress={() => open({ kind: 'register', target })} />}
          </View>;
        })}
        {!!cruiseId && <PassengerButton label="Cập nhật tour" variant="text" loading={excursions.isFetching} onPress={() => { void excursions.refetch(); }} />}
      </>}
    </>}
    {tab === 'registrations' && (!context.can('ACTIVITY_REGISTRATION') ? <Text style={ui.body}>Tài khoản chưa có quyền xem đăng ký.</Text> : <>
      <ErrorNotice error={registrations.error} retry={() => { void registrations.refetch(); }} />{registrations.isLoading && <Loading />}
      {!!selection.bookingPassengerId && !registrations.isPending && !registrations.error && !mine.length && <EmptyState title="Chưa có đăng ký" />}
      {mine.map(row => <View key={row.id} style={ui.card}>
        <Text style={ui.sectionTitle}>{row.activityId ? activities.data?.find(a => a.id === row.activityId)?.name ?? 'Hoạt động trên tàu' : excursions.data?.find(e => e.shoreExcursionId === row.excursionId)?.excursionName ?? 'Tour trên bờ'}</Text>
        <Text style={ui.body}>{statusText(row.status)} · {row.quantity} chỗ</Text><Text style={ui.caption}>{dateTime(row.registeredAt)}</Text>
        {registrationActions(row).includes('confirm') && <PassengerButton label="Xác nhận tham gia" onPress={() => open({ kind: 'confirm', registration: row })} />}
        {registrationActions(row).includes('edit') && <PassengerButton label="Sửa số lượng" variant="secondary" onPress={() => open({ kind: 'edit', registration: row })} />}
        {registrationActions(row).includes('cancel') && <PassengerButton label="Hủy đăng ký" variant="text" onPress={() => open({ kind: 'cancel', registration: row })} />}
      </View>)}
      <PassengerButton label="Cập nhật đăng ký" variant="text" loading={registrations.isFetching} onPress={() => { void registrations.refetch(); }} />
    </>)}
    {detail && <View style={ui.card}><Text style={ui.sectionTitle}>Quyền lợi liên quan</Text><EntitlementSummary rows={matchingEntitlements(entitlements.data ?? [], selection.bookingPassengerId, detail.kind, detail.id)} />{!matchingEntitlements(entitlements.data ?? [], selection.bookingPassengerId, detail.kind, detail.id).length && <Text style={ui.body}>Chưa có quyền lợi được liên kết rõ cho mục này. Giá niêm yết và điều kiện đăng ký cần được kiểm tra riêng.</Text>}<PassengerButton label="Đóng quyền lợi" variant="text" onPress={() => setDetail(undefined)} /></View>}
    <ConfirmAction visible={!!operation} title={operation?.kind === 'register' ? 'Gửi đăng ký' : operation?.kind === 'confirm' ? 'Xác nhận tham gia' : operation?.kind === 'edit' ? 'Lưu số lượng' : 'Xác nhận hủy đăng ký'} description={operation?.kind === 'register' ? `${operation.target.name}. Sau khi gửi, bạn có thể xác nhận tham gia trong Đăng ký của tôi.` : operation?.kind === 'cancel' ? 'Đăng ký sẽ được hủy theo điều kiện của hoạt động hoặc tour.' : 'Hệ thống sẽ kiểm tra trạng thái và số chỗ hiện tại trước khi lưu.'} onClose={() => { if (!lock.current) setOperation(null); }} onConfirm={() => { void submit(); }} pending={action.isPending} error={onboardError(action.error)}
      dirty={!!operation && (((operation.kind === 'register' || operation.kind === 'edit') && quantity !== (operation.kind === 'register' ? '1' : String(operation.registration.quantity))) || (operation.kind === 'cancel' && !!reason))}
      disabled={!selection.ready || uncertain || (!!activityId && (availability.isPending || !!availability.error || availability.data?.availableSeats === 0))}>
      {!!activityId && <>
        {availability.isLoading && <Loading text="Đang kiểm tra chỗ trống…" />}
        {availability.fetchStatus === 'paused' && <Text style={ui.body}>Đang chờ kết nối để kiểm tra chỗ trống.</Text>}
        <ErrorNotice error={availability.error} retry={() => { void availability.refetch(); }} />
        {availability.data && <Text style={ui.body}>Còn {availability.data.availableSeats} chỗ</Text>}
      </>}
      {(operation?.kind === 'register' || operation?.kind === 'edit') && <><Text style={ui.caption}>Chỉ xác nhận đăng ký theo kết quả hệ thống. Giá niêm yết không phải xác nhận khoản phí đã phát sinh.</Text><Input label="Số chỗ đăng ký" value={quantity} onChange={setQuantity} numeric maxLength={10} disabled={action.isPending} error={quantityError(quantity)} /></>}
      {operation?.kind === 'cancel' && <Input label="Lý do hủy nếu có" value={reason} onChange={setReason} multiline maxLength={500} disabled={action.isPending} />}
      <ErrorNotice error={onboardError(validation)} />
    </ConfirmAction>
  </LivePage>;
}
