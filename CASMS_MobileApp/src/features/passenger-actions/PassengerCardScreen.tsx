import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { brand, spacing } from '@/constants/ocevie';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { PassengerVoyageChooser } from '@/features/home/PassengerVoyageChooser';
import { useNow } from '@/hooks/use-now';
import { ApiError } from '@/lib/api';
import { LivePage, ErrorNotice, Loading } from './PassengerActionUI';
import { passengerApi, usePassengerAction, usePassengerQuery } from './passenger-hooks';
import { remainingClaimSeconds } from './card-contracts';

export function PassengerCardScreen() {
  const catalog = useSelectedItinerary();
  const { context, voyage, person, booking, cruise } = catalog;
  const id = voyage?.bookingPassengerId ?? '';
  const status = usePassengerQuery(['checkin', id], signal => passengerApi.checkin(id, signal), 'CHECKIN_READ', !!id);
  const action = usePassengerAction<void>();
  const [claim, setClaim] = useState<Awaited<ReturnType<typeof passengerApi.cardClaim>>>();
  const [assigned, setAssigned] = useState(false);
  const [choices, setChoices] = useState(false);
  const [expired, setExpired] = useState(false);
  const { width } = useWindowDimensions();
  const generation = useRef(0);
  const locked = useRef(false);
  const now = useNow();
  useFocusEffect(useCallback(() => {
    const ref = generation;
    return () => { ref.current++; locked.current = false; setClaim(undefined); };
  }, []));
  useEffect(() => {
    const ref = generation;
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { generation.current++; locked.current = false; setClaim(undefined); }
    });
    return () => { ref.current++; listener.remove(); };
  }, []);
  const remaining = claim ? remainingClaimSeconds(claim.expiresAt, now) : 0;
  useEffect(() => { if (!claim) return; const timer = setTimeout(() => { setClaim(undefined); setExpired(true); }, Math.max(0, Date.parse(claim.expiresAt) - Date.now())); return () => clearTimeout(timer); }, [claim]);
  const eligible = context.ready && context.can('CHECKIN_READ') && !!person && !booking.error && !catalog.error && !catalog.isFetching && !booking.isFetching
    && !status.error && !status.isFetching && status.data?.checkinStatus === 'BoardingReady';
  async function requestClaim() {
    if (!eligible || locked.current || assigned) return;
    locked.current = true; setClaim(undefined); setExpired(false);
    const version = ++generation.current;
    try {
      await action.mutateAsync(async assertCurrent => {
        const latest = await passengerApi.checkin(id);
        assertCurrent();
        if (version !== generation.current || latest.checkinStatus !== 'BoardingReady') throw new Error('Hồ sơ nhận thẻ đã thay đổi. Vui lòng kiểm tra lại.');
        const result = await passengerApi.cardClaim(id);
        assertCurrent();
        if (version === generation.current) setClaim(result);
      });
    } catch (error) {
      if (version === generation.current && error instanceof ApiError && error.code === 'PASSENGER_CARD_ALREADY_ASSIGNED') setAssigned(true);
    } finally { if (version === generation.current) locked.current = false; }
  }
  return <LivePage title="Nhận thẻ hành khách" permission="CHECKIN_READ">
    <ErrorNotice error={catalog.error ?? booking.error ?? status.error} retry={() => { void catalog.refetch(); if (id) void status.refetch(); }} />
    {catalog.isLoading || status.isLoading ? <Loading /> : null}
    {voyage && <View style={ui.card}>
      <Text style={ui.sectionTitle}>{person?.fullName ?? 'Đang xác minh hành khách'}</Text>
      <Text style={ui.body}>{voyage.cruiseName}</Text>
      {!!cruise?.shipName && <Text style={ui.body}>{cruise.shipName}</Text>}
      <Text style={ui.body}>{person?.cabinNumber ? 'Phòng ' + person.cabinNumber : 'Chưa có thông tin phòng'}</Text>
    </View>}
    {!eligible && !assigned && <Text style={ui.body}>Chọn chuyến đi và hoàn tất hồ sơ check-in để yêu cầu mã nhận thẻ.</Text>}
    {catalog.voyages.length > 0 && <PassengerButton label="Chọn chuyến đi" variant="secondary" onPress={() => setChoices(true)} />}
    {assigned ? <Text accessibilityLiveRegion="polite" style={ui.body}>Hồ sơ này đã được cấp thẻ. Liên hệ quầy nếu cần kiểm tra thẻ.</Text> : <>
      <ErrorNotice error={action.error} />
      {eligible && !claim && !expired && <Text style={ui.body}>Bạn chưa có mã nhận thẻ đang hiển thị. Yêu cầu mã khi sẵn sàng đến quầy.</Text>}
      {eligible && claim && remaining > 0 && <View style={[ui.card, { alignItems: 'center', padding: spacing.xxl, backgroundColor: brand.white }]}>
        <View accessible accessibilityLabel="Mã QR nhận thẻ hành khách. Đưa mã này cho nhân viên tại quầy.">
          <QRCode value={claim.code} size={Math.max(120, Math.min(260, width - 128))} quietZone={16} color={brand.midnight} backgroundColor={brand.white} />
        </View>
        <Text style={ui.body}>Còn hiệu lực {remaining} giây.</Text>
      </View>}
      {expired && <Text accessibilityLiveRegion="polite" style={ui.body}>Mã đã hết hạn. Yêu cầu mã mới để tiếp tục nhận thẻ.</Text>}
      <Text style={ui.body}>Đến quầy dịch vụ hành khách và đưa mã QR cho nhân viên. Mã mới sẽ thay thế mã trước đó.</Text>
      <PassengerButton label={claim || expired ? 'Yêu cầu mã mới' : 'Yêu cầu mã nhận thẻ'} disabled={!eligible}
        loading={action.isPending} onPress={() => { void requestClaim(); }} />
    </>}
    <PassengerVoyageChooser catalog={catalog} visible={choices} onClose={() => setChoices(false)} />
  </LivePage>;
}
