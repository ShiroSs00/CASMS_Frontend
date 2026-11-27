import { recoverPendingSale } from './sale-journal-contract';
import { samePosScope, usePosScopeGuard } from './pos-scope';
import { verifySaleIntent, verifySalePreflight } from './pos-lifecycle';
import { PosCardAction } from './PosCardAction';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { uuid as nativeUuid } from 'expo';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { AmountRow, Disclosure, ui } from '@/components/passenger/PassengerUI';
import { Choice } from '@/features/passenger-actions/PassengerActionUI';
import { dateTime } from '@/features/passenger-actions/passenger-model';
import { ApiError } from '@/lib/api';
import { usePos, usePosRequests } from './PosLayout';
import { passengerReference, passengersFromRequests } from './pos-access';
import { uuid, salePrice, type Sale } from './pos-api';
import { clearPendingSale, readPendingSale, savePendingSale, type PendingRecord, type PendingSale } from './pos-storage';
import { Field, Notice, PosPage, PosReveal, QueryState, posError, uncertainWrite, usePosConfirmation } from './pos-ui';

const saleLocks = new Set<string>();
const historyLabels: Record<string, string> = {
  CHARGE: 'Sử dụng dịch vụ', ADJUSTMENT: 'Điều chỉnh', VOID: 'Đảo ghi nhận', REFUND: 'Hoàn hạn mức',
};

function money(value: number, currency: string) {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 4 }) + ' ' + currency;
}

export function PosUsage() {
  const pos = usePos();
  const cache = useQueryClient();
  const assertScope = usePosScopeGuard();
  const [serviceId, setServiceId] = useState('');
  const [account, setAccount] = useState('');
  const [passenger, setPassenger] = useState('');
  const [identified, setIdentified] = useState<{ bookingPassengerId: string; passengerName: string }>();
  const [schedule, setSchedule] = useState('');
  const [lookup, setLookup] = useState<{ account: string; passenger: string }>();
  const [receipt, setReceipt] = useState<Sale>();
  const [selectedSale, setSelectedSale] = useState('');
  const [issue, setIssue] = useState<string>();
  const sellable = pos.scope.services.filter(service => service.permissions.includes('SERVICE_SALE'));
  const service = sellable.find(item => item.serviceId === serviceId);
  const { terminalId, areaId } = pos.scope.terminal;
  const saleScope = { owner: pos.owner, terminalId, areaId, cruiseId: pos.scope.cruiseId, signedInAt: pos.signedInAt };
  const pendingKey = [...pos.key, 'pending-sale'];
  const pending = useQuery({
    queryKey: pendingKey, queryFn: () => readPendingSale(saleScope), enabled: !!sellable.length, retry: false, staleTime: 0,
  });
  const canReadRequests = pos.scope.services.some(item => item.permissions.includes('SERVICE_REQUEST_READ'));
  const requests = usePosRequests(pos, sellable.length > 0);
  const passengerOptions = requests.error ? [] : passengersFromRequests(pos.scope.services, requests.data ?? []);
  const statement = useQuery({
    queryKey: [...pos.key, 'statement', lookup?.account, lookup?.passenger],
    queryFn: ({ signal }) => pos.client.statement(lookup!.account, lookup!.passenger, signal),
    enabled: !!lookup && !!sellable.length, retry: false, staleTime: 0,
  });
  const detail = useQuery({
    queryKey: [...pos.key, 'sale', selectedSale], queryFn: ({ signal }) => pos.client.sale(selectedSale, signal),
    enabled: !!selectedSale && !!sellable.length, retry: false,
  });
  const accountId = account.trim().toLowerCase();
  const bookingPassengerId = passenger.trim().toLowerCase();
  const existingRequest = !requests.error && requests.data?.some(row => row.serviceId === serviceId
    && row.bookingPassengerId === bookingPassengerId && ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(row.status));
  const validIds = uuid.safeParse(accountId).success && uuid.safeParse(bookingPassengerId).success;
  const matched = lookup?.account === accountId && lookup?.passenger === bookingPassengerId;
  const recovery = pending.data?.kind === 'own' ? pending.data.sale : undefined;
  const canReplay = !!recovery && sellable.some(item => item.serviceId === recovery.input.serviceId);
  const budget = matched && !statement.error ? statement.data?.budget : undefined;
  const price = service?.unitPrice;
  const selectedPrice = salePrice.safeParse({ amount: price, currency: service?.currency });
  const fundsIssue = budget && service && price != null && price > 0 && (
    service.currency !== budget.currency ? 'Đơn giá và hạn mức dùng khác loại tiền.'
      : price > budget.accountRemaining || price > budget.remainingAmount ? 'Hạn mức còn lại không đủ cho một lượt sử dụng.' : undefined
  );
  const canReview = !!service && selectedPrice.success
    && validIds && !!budget && !fundsIssue && !statement.isFetching
    && pending.data === null && !pending.error && !pending.isFetching && (!schedule.trim() || uuid.safeParse(schedule.trim()).success);
  const confirm = usePosConfirmation(pos.refreshSession, pos.verified && !pending.error && !pending.isFetching && (canReplay || canReview), false);

  function updatePending(work: PendingRecord | null) {
    if (cache.getQueryState(pendingKey)) cache.setQueryData(pendingKey, work);
  }

  async function submit(work: PendingSale) {
    if (saleLocks.has(terminalId)) throw new ApiError('Giao dịch đang được xử lý.', 409, 'POS_SALE_BUSY');
    saleLocks.add(terminalId);
    setIssue(undefined);
    setReceipt(undefined);
    setSelectedSale('');
    try {
      assertScope();
      const saved = await readPendingSale(saleScope).catch(() => {
        throw new ApiError('Không đọc được hồ sơ chờ.', 409, 'POS_JOURNAL');
      });
      if (saved) {
        void pending.refetch();
        throw new ApiError('Hồ sơ chờ đã thay đổi.', 409, 'POS_SALE_BUSY');
      }
      const input = work;
      if (input.endpoint !== 'reviewed') throw new ApiError('Hồ sơ cần đối soát trước khi tiếp tục.', 409, 'POS_JOURNAL');
      if (!input.reviewPrice) throw new ApiError('Hồ sơ cũ chưa có đơn giá và loại tiền đã xác nhận. Liên hệ quản lý để đối soát; hồ sơ vẫn được giữ.', 409, 'POS_PRICE_CONFIRMATION_REQUIRED');
      const context = await pos.client.context(); assertScope();
      if (!samePosScope(context, pos.scope)) throw new ApiError('Ngữ cảnh đã thay đổi.', 409, 'POS_REVERIFY');
      cache.setQueryData([...pos.key, 'context'], context);
      const current = context.services.find(item => item.serviceId === work.input.serviceId);
      if (!current?.permissions.includes('SERVICE_SALE')) throw new ApiError('Quyền sử dụng dịch vụ đã thay đổi.', 403);
      const latest = await pos.client.statement(input.input.onboardAccountId, input.input.bookingPassengerId); assertScope();
      cache.setQueryData([...pos.key, 'statement', input.input.onboardAccountId, input.input.bookingPassengerId], latest);
      verifySalePreflight(current, latest.budget, input.reviewPrice, false);
      // Persist the exact reviewed request before its first and only POST.
      try { await savePendingSale(saleScope, input); }
      catch {
        void pending.refetch();
        throw new ApiError('Không lưu được hồ sơ chờ.', 409, 'POS_JOURNAL');
      }
      updatePending({ kind: 'own', sale: input });
      let result: Sale;
      try {
        assertScope();
        result = await pos.client.recordSale(input.input, input.reviewPrice);
        verifySaleIntent(result, input.input, { terminalId, areaId, owner: pos.owner }, input.reviewPrice);
        assertScope();
      } catch (error) {
        if (error instanceof ApiError && error.code === 'POS_PRICE_CHANGED') {
          void cache.invalidateQueries({ queryKey: pos.key });
        }
        if (uncertainWrite(error) || (error instanceof ApiError && error.code === 'POS_REVERIFY') || (error instanceof ApiError && error.code === 'POS_IDEMPOTENCY_CONFLICT')) {
          setIssue('Kết quả giao dịch chưa được xác nhận. Hồ sơ chờ giữ nguyên nội dung và mã giao dịch.');
        } else {
          try { await clearPendingSale(saleScope, input.input.idempotencyKey); updatePending(null); }
          catch { setIssue('Không xóa được hồ sơ chờ trên thiết bị. Liên hệ quản lý để đối soát.'); }
        }
        throw error;
      }
      setReceipt(result);
      setServiceId('');
      setSchedule('');
      setAccount(result.onboardAccountId);
      setPassenger(result.bookingPassengerId);
      setLookup({ account: result.onboardAccountId, passenger: result.bookingPassengerId });
      void cache.invalidateQueries({ queryKey: pos.key });
      try {
        await clearPendingSale(saleScope, input.input.idempotencyKey);
        updatePending(null);
      } catch {
        setIssue('Giao dịch đã được xác nhận nhưng còn hồ sơ chờ trên thiết bị. Đọc lại kết quả để đối soát.');
      }
    } finally { saleLocks.delete(terminalId); }
  }

  function review() {
    if (!canReview || !service || !selectedPrice.success) return;
    const work: PendingSale = {
      version: 2, endpoint: 'reviewed', state: 'PENDING_VERIFICATION',
      serviceName: service.name,
      reviewPrice: selectedPrice.data,
      input: {
        serviceId, onboardAccountId: accountId, bookingPassengerId, quantity: 1,
        scheduleId: schedule.trim() || undefined,
        idempotencyKey: nativeUuid.v4(),
      },
    };
    work.originalRequest = { ...work.input, expectedUnitPrice: selectedPrice.data.amount, expectedCurrency: selectedPrice.data.currency };
    confirm.open({
      title: 'Bán dịch vụ mới',
      description: [work.serviceName + ' · 1 lượt · ' + money(selectedPrice.data.amount, selectedPrice.data.currency) + ' theo danh mục hiện tại.', identified?.bookingPassengerId === work.input.bookingPassengerId ? identified.passengerName : passengerReference(work.input.bookingPassengerId, passengerOptions), 'Tài khoản …' + work.input.onboardAccountId.slice(-8), ...(work.input.scheduleId ? ['Lịch dịch vụ …' + work.input.scheduleId.slice(-8)] : [])].join('\n'),
      run: () => submit(work),
    });
  }

  function reconcile(work: PendingSale) {
    confirm.open({
      title: 'Đối soát giao dịch đang chờ',
      description: `${work.serviceName}. Đọc lại kết quả giao dịch gốc. Hồ sơ chờ được giữ nếu chưa tìm thấy hoặc chưa xác minh được.`,
      run: async () => {
        if (saleLocks.has(terminalId)) throw new ApiError('Giao dịch đang được xử lý.', 409, 'POS_SALE_BUSY');
        saleLocks.add(terminalId);
        try {
          assertScope();
          const saved = await readPendingSale(saleScope); assertScope();
          if (saved?.kind !== 'own' || saved.sale.input.idempotencyKey !== work.input.idempotencyKey)
            throw new ApiError('Hồ sơ chờ đã thay đổi.', 409, 'POS_JOURNAL');
          const result = await recoverPendingSale(pos.client, saved.sale, { terminalId, areaId, owner: pos.owner }); assertScope();
          await clearPendingSale(saleScope, saved.sale.input.idempotencyKey); assertScope();
          updatePending(null); setReceipt(result); setIssue(undefined);
          void cache.invalidateQueries({ queryKey: pos.key });
        } catch (error) {
          setIssue(error instanceof ApiError && error.status === 404
            ? 'Chưa tìm thấy giao dịch gốc. Hồ sơ được giữ để quản lý đối soát; chưa thể tạo giao dịch thay thế.'
            : 'Chưa xác minh được giao dịch gốc. Hồ sơ chờ được giữ nguyên.');
          throw error;
        } finally { saleLocks.delete(terminalId); }
      },
    });
  }

  function updateAccount(value: string) {
    setAccount(value);
    setLookup(undefined);
    setSelectedSale('');
  }
  function updatePassenger(value: string) {
    setPassenger(value);
    setIdentified(undefined);
    setLookup(undefined);
    setSelectedSale('');
    setSchedule('');
  }
  function reload() {
    pos.refreshSession();
    void pending.refetch();
    if (lookup) void statement.refetch();
    if (selectedSale) void detail.refetch();
  }

  if (!sellable.length) return <PosPage title="Hạn mức nội bộ"><Notice tone="warning">Bạn chưa có quyền ghi nhận sử dụng hoặc xem sao kê trong phiên này.</Notice></PosPage>;
  return <PosPage title="Hạn mức nội bộ" refresh={reload} refreshing={pending.isRefetching || statement.isRefetching || detail.isRefetching}>
    {!!pos.sessionError && <Notice tone="error" retry={pos.refreshSession}>{posError(pos.sessionError)}</Notice>}
    <QueryState query={pending} />
    {pending.data?.kind === 'blocked' &&
      <Notice tone="warning">Thiết bị còn giao dịch chờ thuộc phiên khác. Nhờ nhân viên đã lập giao dịch hoặc quản lý đối soát trước khi ghi nhận thêm.</Notice>}
    {!!issue && <Notice tone="warning">{issue}</Notice>}
    {pending.data?.kind === 'own' && pending.data.previousSession && <Notice tone="warning">Giao dịch được lập trong lần đăng nhập trước của bạn. Kiểm tra hồ sơ trước khi đối soát cùng mã.</Notice>}
    {recovery && <View style={ui.card}>
      <Text style={ui.sectionTitle}>Giao dịch chờ đối soát</Text>
      <Text style={ui.sectionTitle}>{recovery.serviceName}</Text>
      <Disclosure title="Chi tiết đối soát"><Text selectable style={ui.caption}>Hành khách: {recovery.input.bookingPassengerId}{'\n'}Mã giao dịch: {recovery.input.idempotencyKey}</Text></Disclosure>
      {!recovery.reviewPrice && <Notice tone="warning">Hồ sơ cũ chưa có đơn giá và loại tiền đã xác nhận. Liên hệ quản lý để đối soát; hồ sơ vẫn được giữ.</Notice>}
      {!!recovery.reviewPrice && !canReplay && <Notice tone="warning">Quyền ghi nhận dịch vụ này đã thay đổi. Liên hệ quản lý để đối soát.</Notice>}
      <PassengerButton label="Đọc lại kết quả giao dịch" disabled={!pos.verified || !canReplay || confirm.pending || pending.isFetching}
        onPress={() => reconcile(recovery)} />
    </View>}
    {receipt && <SaleSummary sale={receipt} confirmed />}
    <View style={ui.card}>
      <Text style={ui.sectionTitle}>Bán dịch vụ mới</Text>
      <Text style={ui.body}>Bán mới tạo yêu cầu dịch vụ và ghi nhận phí. Yêu cầu đã có cần được xử lý tại mục Yêu cầu dịch vụ.</Text>
      {pos.employeePermissions.includes('CHECKIN_BOARDING') && <PosCardAction onIdentified={result => { updatePassenger(result.bookingPassengerId); setIdentified(result); }} />}
      {canReadRequests && <QueryState query={requests} />}
      {passengerOptions.length > 0 && <Choice label="Hành khách từ yêu cầu trong phiên" value={bookingPassengerId}
        onChange={updatePassenger} disabled={!pos.verified || confirm.pending}
        items={passengerOptions} />}
      <Field label="Mã hồ sơ hành khách" value={passenger} onChangeText={updatePassenger} maxLength={36} />
      <Field label="Mã tài khoản trên tàu" value={account} onChangeText={updateAccount} maxLength={36} />
      <PassengerButton label="Tra sao kê" variant="secondary" disabled={!validIds || !pos.verified || confirm.pending}
        loading={statement.isFetching} onPress={() => {
          if (matched) void statement.refetch();
          else { setSelectedSale(''); setLookup({ account: accountId, passenger: bookingPassengerId }); }
        }} />
      {lookup && <QueryState query={statement} />}
      {budget && <AmountRow label="Hạn mức còn lại" value={money(budget.remainingAmount, budget.currency)} prominent />}
      <Choice label="Dịch vụ" value={serviceId} onChange={value => { setServiceId(value); setSchedule(''); }}
        disabled={!budget || !!pending.data || confirm.pending}
        items={sellable.map(item => ({ id: item.serviceId, label: item.name }))} />
      {!!service && <Text style={ui.body}>{service.unitPrice !== null && service.currency
        ? `Đơn giá hiện tại ${money(service.unitPrice, service.currency)} · 1 lượt` : 'Dịch vụ chưa có giá hợp lệ.'}</Text>}
      {existingRequest && <Notice tone="warning">Hành khách đang có yêu cầu cho dịch vụ này. Kiểm tra mục Yêu cầu dịch vụ trước khi bán thêm; thao tác này tạo khoản phí mới.</Notice>}
      <Disclosure title="Nhập mã lịch phục vụ"><Field label="Mã lịch phục vụ (tùy chọn)" value={schedule} onChangeText={setSchedule} maxLength={36}
        editable={!!service && !pending.data && !confirm.pending} /></Disclosure>
      {!!fundsIssue && <Notice tone="warning">{fundsIssue}</Notice>}
      {!!service && !selectedPrice.success && <Notice tone="warning">Đơn giá hoặc loại tiền chưa được xác nhận để ghi nhận giao dịch. Không tự quy đổi tiền tệ.</Notice>}
      <PassengerButton label="Xem lại giao dịch bán mới" disabled={!canReview || !pos.verified || confirm.pending} onPress={review} />
    </View>
    {lookup && <>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Hạn mức hành khách và lịch sử tài khoản</Text>
      <Notice tone="neutral">Hạn mức theo hành khách đã tra cứu. Lịch sử bên dưới gồm toàn bộ giao dịch của tài khoản trên tàu, có thể gồm các hành khách khác trong tài khoản.</Notice>
      {statement.data && !statement.error && <>
        <View style={ui.card}>
          <AmountRow label="Hạn mức tài khoản" value={money(statement.data.budget.allocatedAmount, statement.data.budget.currency)} />
          <AmountRow label="Tài khoản đã sử dụng" value={money(statement.data.budget.usedAmount, statement.data.budget.currency)} />
          <AmountRow label="Tài khoản còn khả dụng" value={money(statement.data.budget.accountRemaining, statement.data.budget.currency)} />
          <AmountRow label="Hành khách còn khả dụng" value={money(statement.data.budget.remainingAmount, statement.data.budget.currency)} prominent />
        </View>
        {!statement.data.history.length && <Notice tone="neutral">Chưa có giao dịch sử dụng hạn mức.</Notice>}
        {[...statement.data.history].reverse().map(row => <View style={ui.card} key={row.transactionId}>
          <Text style={ui.sectionTitle}>{historyLabels[row.type] ?? row.type}</Text>
          <Text style={ui.body}>{money(row.amount, statement.data.budget.currency)} · {dateTime(row.recordedAt)}</Text>
          {row.sourceType === 'POS_SALE' && row.sourceReferenceId &&
            <PassengerButton label="Xem bản ghi POS" variant="text" disabled={!pos.verified}
              onPress={() => setSelectedSale(row.sourceReferenceId ?? '')} />}
          {row.sourceType === 'POS_SALE' && row.sourceReferenceId === selectedSale && <>
            <QueryState query={detail} />
            {detail.data && !detail.error && <SaleSummary sale={detail.data} />}
          </>}
        </View>)}
      </>}
    </>}
    {confirm.ui}
  </PosPage>;
}

function SaleSummary({ sale, confirmed = false }: { sale: Sale; confirmed?: boolean }) {
  return <View style={ui.card}>
    {confirmed && <Notice tone="success">Đã ghi nhận sử dụng dịch vụ.</Notice>}
    <PosReveal>
      <Text selectable style={ui.amount}>{money(sale.amount, sale.currency)}</Text>
      <Text style={ui.body}>{sale.reversedAt ? `Đã đảo ghi nhận · ${dateTime(sale.reversedAt)}` : dateTime(sale.createdAt)}</Text>
      <Text style={ui.caption}>{passengerReference(sale.bookingPassengerId)}</Text>
      <Disclosure title="Mã giao dịch">
        <Text selectable style={ui.caption}>{sale.saleId}</Text>
        <Text selectable style={ui.caption}>Hồ sơ hành khách: {sale.bookingPassengerId}</Text>
        <Text selectable style={ui.caption}>Yêu cầu dịch vụ: {sale.serviceRequestId}</Text>
      </Disclosure>
    </PosReveal>
  </View>;
}
