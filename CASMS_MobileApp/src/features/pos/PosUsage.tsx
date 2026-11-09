import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { uuid as nativeUuid } from 'expo';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { Choice } from '@/features/passenger-actions/PassengerActionUI';
import { dateTime } from '@/features/passenger-actions/passenger-model';
import { ApiError } from '@/lib/api';
import { usePos, usePosRequests } from './PosLayout';
import { passengersFromRequests } from './pos-access';
import { uuid, type PosStatement, type Sale } from './pos-api';
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
  const [serviceId, setServiceId] = useState('');
  const [account, setAccount] = useState('');
  const [passenger, setPassenger] = useState('');
  const [schedule, setSchedule] = useState('');
  const [lookup, setLookup] = useState<{ account: string; passenger: string }>();
  const [receipt, setReceipt] = useState<Sale>();
  const [selectedSale, setSelectedSale] = useState('');
  const [issue, setIssue] = useState<string>();
  const sellable = pos.scope.services.filter(service => service.permissions.includes('SERVICE_SALE'));
  const service = sellable.find(item => item.serviceId === serviceId);
  const { terminalId, areaId } = pos.scope.terminal;
  const saleScope = { owner: pos.owner, terminalId, areaId, cruiseId: pos.scope.cruiseId };
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
  const scheduleOptions = new Map<string, string>();
  if (!requests.error && service?.permissions.includes('SERVICE_REQUEST_READ')) {
    for (const row of requests.data ?? []) {
      if (row.serviceId === serviceId && row.bookingPassengerId === bookingPassengerId && row.scheduleId
        && ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(row.status) && !scheduleOptions.has(row.scheduleId)) {
        scheduleOptions.set(row.scheduleId, `Yêu cầu lúc ${dateTime(row.requestTime)} · …${row.scheduleId.slice(-8)}`);
      }
    }
  }
  const validIds = uuid.safeParse(accountId).success && uuid.safeParse(bookingPassengerId).success;
  const matched = lookup?.account === accountId && lookup?.passenger === bookingPassengerId;
  const recovery = pending.data?.kind === 'own' ? pending.data.sale : undefined;
  const canReplay = !!recovery && sellable.some(item => item.serviceId === recovery.input.serviceId);
  const budget = matched && !statement.error ? statement.data?.budget : undefined;
  const price = service?.unitPrice;
  const fundsIssue = budget && service && price != null && price > 0 && (
    service.currency !== budget.currency ? 'Đơn giá và hạn mức dùng khác loại tiền.'
      : price > budget.accountRemaining || price > budget.remainingAmount ? 'Hạn mức còn lại không đủ cho một lượt sử dụng.' : undefined
  );
  const canReview = !!service && service.unitPrice !== null && service.unitPrice > 0 && !!service.currency
    && validIds && !!budget && !fundsIssue && !statement.isFetching
    && pending.data === null && !pending.error && !pending.isFetching && (!schedule.trim() || uuid.safeParse(schedule.trim()).success);
  const confirm = usePosConfirmation(pos.refreshSession, pos.verified && !pending.error && !pending.isFetching && (canReplay || canReview), false);

  function updatePending(work: PendingRecord | null) {
    if (cache.getQueryState(pendingKey)) cache.setQueryData(pendingKey, work);
  }

  async function submit(work: PendingSale, reviewPrice?: { amount: number; currency: string }) {
    const replay = !reviewPrice;
    if (saleLocks.has(terminalId)) throw new ApiError('Giao dịch đang được xử lý.', 409, 'POS_SALE_BUSY');
    saleLocks.add(terminalId);
    setIssue(undefined);
    setReceipt(undefined);
    setSelectedSale('');
    try {
      const saved = await readPendingSale(saleScope).catch(() => {
        throw new ApiError('Không đọc được hồ sơ chờ.', 409, 'POS_JOURNAL');
      });
      if (replay ? saved?.kind !== 'own' || saved.sale.input.idempotencyKey !== work.input.idempotencyKey : !!saved) {
        void pending.refetch();
        throw new ApiError('Hồ sơ chờ đã thay đổi.', 409, 'POS_SALE_BUSY');
      }
      const current = pos.assertReady().services.find(item => item.serviceId === work.input.serviceId);
      if (!current?.permissions.includes('SERVICE_SALE')) throw new ApiError('Quyền sử dụng dịch vụ đã thay đổi.', 403);
      if (reviewPrice && (current.unitPrice !== reviewPrice.amount || current.currency !== reviewPrice.currency)) {
        throw new ApiError('Đơn giá đã thay đổi.', 409, 'POS_PRICE_CHANGED');
      }
      if (reviewPrice) {
        const state = cache.getQueryState<PosStatement>([...pos.key, 'statement', work.input.onboardAccountId, work.input.bookingPassengerId]);
        const checked = state?.data?.budget;
        if (!state || !checked || state.error || state.isInvalidated || state.fetchStatus !== 'idle'
          || checked.currency !== reviewPrice.currency || reviewPrice.amount > checked.accountRemaining
          || reviewPrice.amount > checked.remainingAmount) {
          throw new ApiError('Cần kiểm tra lại hạn mức.', 409, 'POS_ALLOWANCE_RECHECK');
        }
      }
      // Replaying an older record promotes it to the terminal journal before sending.
      const input = saved?.kind === 'own' ? saved.sale : work;
      try { await savePendingSale(saleScope, input); }
      catch {
        void pending.refetch();
        throw new ApiError('Không lưu được hồ sơ chờ.', 409, 'POS_JOURNAL');
      }
      updatePending({ kind: 'own', sale: input });
      let result: Sale;
      try {
        pos.assertReady();
        result = await pos.client.recordSale(input.input);
        if (result.serviceId !== input.input.serviceId || result.bookingPassengerId !== input.input.bookingPassengerId
          || result.onboardAccountId !== input.input.onboardAccountId || result.terminalId !== terminalId
          || result.areaId !== areaId || result.employeeId !== pos.owner) {
          throw new ApiError('Dữ liệu giao dịch không khớp.', 502, 'POS_INVALID_RESPONSE');
        }
      } catch (error) {
        if (replay || uncertainWrite(error) || (error instanceof ApiError && error.code === 'POS_IDEMPOTENCY_CONFLICT')) {
          setIssue('Kết quả giao dịch chưa được xác nhận. Hồ sơ chờ giữ nguyên nội dung và mã giao dịch.');
        } else {
          try { await clearPendingSale(saleScope); updatePending(null); }
          catch { setIssue('Không xóa được hồ sơ chờ trên iPhone. Liên hệ quản lý để đối soát.'); }
        }
        throw error;
      }
      setReceipt(result);
      setServiceId('');
      setSchedule('');
      setAccount(result.onboardAccountId);
      setPassenger(result.bookingPassengerId);
      setLookup({ account: result.onboardAccountId, passenger: result.bookingPassengerId });
      void cache.invalidateQueries({ queryKey: [...pos.key, 'statement'] });
      try {
        await clearPendingSale(saleScope);
        updatePending(null);
      } catch {
        setIssue('Hệ thống đã xác nhận giao dịch nhưng iPhone chưa xóa được hồ sơ chờ. Dùng lại cùng mã để hoàn tất đối soát.');
      }
    } finally { saleLocks.delete(terminalId); }
  }

  function review() {
    if (!canReview || !service || service.unitPrice === null || !service.currency) return;
    const work: PendingSale = {
      serviceName: service.name,
      input: {
        serviceId, onboardAccountId: accountId, bookingPassengerId, quantity: 1,
        scheduleId: schedule.trim() || undefined,
        idempotencyKey: nativeUuid.v4(),
      },
    };
    const reviewPrice = { amount: service.unitPrice, currency: service.currency };
    confirm.open({
      title: 'Ghi nhận sử dụng dịch vụ',
      description: `${work.serviceName} · 1 lượt · ${money(service.unitPrice, service.currency)} theo danh mục hiện tại.\nHành khách ${work.input.bookingPassengerId}\nTài khoản ${work.input.onboardAccountId}${work.input.scheduleId ? `\nLịch dịch vụ ${work.input.scheduleId}` : ''}`,
      run: () => submit(work, reviewPrice),
    });
  }

  function reconcile(work: PendingSale) {
    confirm.open({
      title: 'Gửi lại cùng mã giao dịch',
      description: `${work.serviceName} · 1 lượt · Hành khách ${work.input.bookingPassengerId}. Hệ thống sẽ trả lại giao dịch đã lưu hoặc ghi nhận một lần nếu yêu cầu trước chưa được lưu.`,
      run: () => submit(work),
    });
  }

  function updateAccount(value: string) {
    setAccount(value);
    setLookup(undefined);
    setSelectedSale('');
  }
  function updatePassenger(value: string) {
    setPassenger(value);
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
    <Text style={ui.body}>Ghi nhận sử dụng dịch vụ trên tàu để đối soát sau chuyến.</Text>
    {!!pos.sessionError && <Notice tone="error" retry={pos.refreshSession}>{posError(pos.sessionError)}</Notice>}
    <QueryState query={pending} />
    {pending.data?.kind === 'blocked' &&
      <Notice tone="warning">Thiết bị còn giao dịch chờ thuộc phiên khác. Nhờ nhân viên đã lập giao dịch hoặc quản lý đối soát trước khi ghi nhận thêm.</Notice>}
    {!!issue && <Notice tone="warning">{issue}</Notice>}
    {recovery && <View style={ui.card}>
      <Text style={ui.sectionTitle}>Giao dịch chờ đối soát</Text>
      <Text style={ui.body}>{recovery.serviceName} · Hành khách {recovery.input.bookingPassengerId}</Text>
      <Text style={ui.caption}>{recovery.input.idempotencyKey}</Text>
      {!canReplay && <Notice tone="warning">Quyền ghi nhận dịch vụ này đã thay đổi. Liên hệ quản lý để đối soát.</Notice>}
      <PassengerButton label="Gửi lại cùng mã" disabled={!pos.verified || !canReplay || confirm.pending || pending.isFetching}
        onPress={() => reconcile(recovery)} />
    </View>}
    {receipt && <SaleSummary sale={receipt} confirmed />}
    <View style={ui.card}>
      <Text style={ui.sectionTitle}>Hồ sơ sử dụng</Text>
      {canReadRequests && <QueryState query={requests} />}
      {passengerOptions.length > 0 && <Choice label="Hành khách từ yêu cầu trong phiên" value={bookingPassengerId}
        onChange={updatePassenger} disabled={!pos.verified || confirm.pending}
        items={passengerOptions} />}
      <Text style={ui.body}>Nếu không có yêu cầu phù hợp, dùng hồ sơ đã kiểm tra. ID tài khoản trên tàu lấy từ hồ sơ được cấp.</Text>
      <Field label="ID hành khách trong đặt chỗ" value={passenger} onChangeText={updatePassenger} maxLength={36} />
      <Field label="ID tài khoản trên tàu" value={account} onChangeText={updateAccount} maxLength={36} />
      <PassengerButton label="Tra sao kê" variant="secondary" disabled={!validIds || !pos.verified || confirm.pending}
        loading={statement.isFetching} onPress={() => {
          if (matched) void statement.refetch();
          else { setSelectedSale(''); setLookup({ account: accountId, passenger: bookingPassengerId }); }
        }} />
      {lookup && <QueryState query={statement} />}
      {budget && <Notice tone="info">Đã đối chiếu hồ sơ với chuyến trong phiên và xác nhận quyền chi tiêu trên tài khoản. Hạn mức hành khách còn {money(budget.remainingAmount, budget.currency)}.</Notice>}
      <Choice label="Dịch vụ" value={serviceId} onChange={value => { setServiceId(value); setSchedule(''); }}
        disabled={!budget || !!pending.data || confirm.pending}
        items={sellable.map(item => ({ id: item.serviceId, label: item.name }))} />
      {!!service && <Text style={ui.body}>{service.unitPrice !== null && service.currency
        ? `Đơn giá hiện tại ${money(service.unitPrice, service.currency)} · 1 lượt` : 'Dịch vụ chưa có giá hợp lệ.'}</Text>}
      {scheduleOptions.size > 0 && <Choice label="Lịch từ yêu cầu trong phiên" value={schedule}
        onChange={setSchedule} disabled={!!pending.data || confirm.pending}
        items={[...scheduleOptions].map(([id, label]) => ({ id, label }))} />}
      <Field label="ID lịch dịch vụ (nếu có)" value={schedule} onChangeText={setSchedule} maxLength={36}
        editable={!!service && !pending.data && !confirm.pending} />
      {!!fundsIssue && <Notice tone="warning">{fundsIssue}</Notice>}
      <PassengerButton label="Xem lại ghi nhận" disabled={!canReview || !pos.verified || confirm.pending} onPress={review} />
    </View>
    {lookup && <>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Sao kê hạn mức</Text>
      {statement.data && !statement.error && <>
        <View style={ui.card}>
          <Text style={ui.body}>Hạn mức được cấp {money(statement.data.budget.allocatedAmount, statement.data.budget.currency)}</Text>
          <Text style={ui.body}>Đã dùng {money(statement.data.budget.usedAmount, statement.data.budget.currency)}</Text>
          <Text style={ui.body}>Tài khoản còn {money(statement.data.budget.accountRemaining, statement.data.budget.currency)}</Text>
          <Text style={ui.sectionTitle}>Hành khách còn {money(statement.data.budget.remainingAmount, statement.data.budget.currency)}</Text>
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
    {confirmed && <Notice tone="success">Hệ thống đã xác nhận ghi nhận sử dụng.</Notice>}
    <PosReveal>
      <Text selectable style={ui.sectionTitle}>{money(sale.amount, sale.currency)}</Text>
      <Text style={ui.body}>{sale.reversedAt ? `Đã đảo ghi nhận · ${dateTime(sale.reversedAt)}` : dateTime(sale.createdAt)}</Text>
      <Text selectable style={ui.caption}>Mã bản ghi {sale.saleId}</Text>
    </PosReveal>
  </View>;
}
