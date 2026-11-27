import { useFocusEffect } from 'expo-router';
import { useRef, useState, useCallback, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerSheet, ui } from '@/components/passenger/PassengerUI';
import { useMotionPreference } from '@/components/passenger/useMotionPreference';
import { Loading } from '@/features/passenger-actions/PassengerActionUI';
import { brand, contentLayout, controls, lightTheme, spacing, statusColors } from '@/constants/ocevie';
import { posColumns } from './pos-layout-metrics';
import { motion } from '@/constants/motion';
import { ApiError } from '@/lib/api';
import { OceVieBrand } from '@/components/passenger/OceVieBrand';

const errors: Record<string, string> = {
  PASSENGER_CARD_CLAIM_INVALID: 'Mã nhận thẻ không hợp lệ, đã hết hạn hoặc đã dùng. Hành khách cần yêu cầu mã mới.',
  PASSENGER_CARD_ALREADY_ASSIGNED: 'Hồ sơ này đã được cấp thẻ. Tra cứu thẻ hoặc liên hệ quản lý.',
  INVALID_NFC_CARD_IDENTIFIER: 'Mã đọc từ thẻ không hợp lệ. Vui lòng đọc lại thẻ phù hợp.',
  POS_STALE_RESULT: 'Kết quả đến sau khi phiên hoặc môi trường đã thay đổi. Giữ hồ sơ chờ và đối soát trước khi thực hiện lại.',
  BENEFIT_FULFILLMENT_QUANTITY_INVALID: 'Cần phục vụ đủ toàn bộ số lượng và đúng đơn vị của quyền lợi. Không hỗ trợ phục vụ một phần ở bước này.',
  ENTITLEMENT_EXHAUSTED: 'Quyền lợi đã hết định mức. Kiểm tra hồ sơ và các yêu cầu đang xử lý.',
  SERVICE_USAGE_LIMIT_EXCEEDED: 'Số lượng sử dụng vượt định mức được hệ thống cho phép.',
  POS_AMOUNT_TOO_LARGE: 'Số tiền vượt độ chính xác được hỗ trợ. Liên hệ quản lý để kiểm tra.',
  POS_FULFILLMENT_REQUIRED: 'Nhập đúng số lượng đã phục vụ và kiểm tra đơn vị trước khi hoàn tất.',
  POS_CRUISE_SELECTION_REQUIRED: 'Có nhiều chuyến phù hợp. Nhập mã chuyến do quản lý cung cấp.',
  POS_ALLOWANCE_EXCEEDED: 'Tài khoản trên tàu không còn đủ hạn mức.',
  POS_SPENDING_LIMIT_EXCEEDED: 'Hành khách không còn đủ hạn mức sử dụng.',
  POS_PASSENGER_NOT_ELIGIBLE: 'Hồ sơ hành khách hoặc tài khoản chưa đủ điều kiện ghi nhận dịch vụ.',
  POS_IDEMPOTENCY_CONFLICT: 'Mã giao dịch đã gắn với một nội dung khác. Liên hệ quản lý để đối soát.',
  POS_PRICE_REQUIRED: 'Dịch vụ chưa có giá hợp lệ.',
  POS_REVIEWED_PRICE_REQUIRED: 'Cần xem lại và xác nhận đơn giá trước khi bán.',
  POS_PRICE_CONFIRMATION_INVALID: 'Đơn giá xác nhận chưa hợp lệ. Tải lại danh mục và kiểm tra giao dịch.',
  POS_ALLOWANCE_NOT_ALLOCATED: 'Tài khoản trên tàu chưa được cấp hạn mức.',
  POS_ACCOUNT_CURRENCY_MISMATCH: 'Sao kê có nhiều loại tiền tệ. Liên hệ quản lý để đối soát.',
  POS_STORAGE: 'Không xóa được phiên trên thiết bị. Vui lòng thử lại.',
  POS_SALE_BUSY: 'Thiết bị đang xử lý giao dịch này. Hãy kiểm tra lại kết quả.',
  POS_REVERIFY: 'Phiên POS hoặc dữ liệu cần được kiểm tra lại. Hãy đóng xác nhận và tải lại trước khi thực hiện tiếp.',
  POS_JOURNAL: 'Không đọc được hồ sơ chờ trên thiết bị. Chưa gửi giao dịch này.',
  POS_DEVICE_ROLE: 'Hãy dùng tài khoản thiết bị chỉ có vai trò POS.',
  POS_PRICE_CHANGED: 'Đơn giá đã thay đổi. Hãy mở lại bước xác nhận để xem giá mới.',
  POS_ALLOWANCE_RECHECK: 'Cần tra lại sao kê và kiểm tra hạn mức trước khi ghi nhận.',
  SERVICE_NOT_RETAIL_ONBOARD: 'Dịch vụ này chưa được phép ghi nhận riêng trên tàu.',
  POS_INVALID_RESPONSE: 'Dữ liệu hệ thống trả về chưa hợp lệ. Hãy tải lại để kiểm tra.',
  POS_TIMEOUT: 'Yêu cầu quá thời gian. Kiểm tra kết nối rồi tải lại.',
  POS_NETWORK: 'Không kết nối được với hệ thống. Kiểm tra mạng rồi thử lại.',
  INVALID_CREDENTIALS: 'Tên đăng nhập hoặc mật khẩu thiết bị không đúng.',
  ACCOUNT_DISABLED: 'Tài khoản thiết bị đã bị khóa hoặc ngừng hoạt động.',
};

export function posError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code && errors[error.code]) return errors[error.code];
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.status === 403) return 'Phiên, hồ sơ hoặc thao tác này nằm ngoài quyền được cấp.';
    if (error.status === 404) return 'Không tìm thấy hồ sơ trong phạm vi POS.';
    if (error.status === 409 || error.status === 400 || error.status === 422) return 'Hệ thống từ chối thao tác ở trạng thái hiện tại. Kiểm tra dữ liệu và tải lại.';
    if (error.status === 0) return error.message;
    return 'Không nhận được kết quả hợp lệ từ hệ thống. Vui lòng kiểm tra lại.';
  }
  return 'Không thể hoàn tất thao tác trên thiết bị. Vui lòng thử lại.';
}

export function Notice({ children, tone = 'info', retry }: { children: ReactNode; tone?: keyof typeof statusColors; retry?: () => void }) {
  const reduced = useMotionPreference();
  const color = statusColors[tone];
  return <Animated.View entering={reduced ? undefined : FadeIn.duration(motion.content)}
    style={[styles.notice, { backgroundColor: color.background }]}>
    <Text accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite"
      selectable style={[ui.body, { color: color.foreground }]}>{children}</Text>
    {retry && <PassengerButton label="Tải lại" variant="text" onPress={retry} />}
  </Animated.View>;
}

export function PosReveal({ children }: { children: ReactNode }) {
  const reduced = useMotionPreference();
  return <Animated.View entering={reduced ? undefined : FadeIn.duration(motion.content)} style={styles.reveal}>
    {children}
  </Animated.View>;
}

export function QueryState({ query, empty }: {
  query: { isPending: boolean; fetchStatus: 'fetching' | 'paused' | 'idle'; error: unknown; refetch: () => unknown };
  empty?: string;
}) {
  const reduced = useMotionPreference();
  if (query.fetchStatus === 'paused') return <Notice tone="warning">Đang chờ kết nối để tải dữ liệu.</Notice>;
  if (query.isPending && !query.error) return <View style={ui.card} accessibilityState={{ busy: true }}>
    <Animated.View entering={reduced ? undefined : FadeIn.duration(motion.content)}
      style={styles.skeleton} accessible={false} />
    <Loading />
  </View>;
  if (query.error) return <Notice tone="error" retry={() => { void query.refetch(); }}>{posError(query.error)}</Notice>;
  return empty ? <Notice tone="neutral">{empty}</Notice> : null;
}

export function PosPage({ title, children, refresh, refreshing = false, standalone = false, wide = false }: {
  title: string; children: ReactNode; refresh?: () => void; refreshing?: boolean; standalone?: boolean; wide?: boolean;
}) {
  return <SafeAreaView edges={standalone ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}
    style={styles.page} onLayout={() => { void SplashScreen.hideAsync().catch(() => {}); }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.content, wide && { maxWidth: contentLayout.pos }]}
      refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={brand.teal} /> : undefined}>
      {standalone && <><OceVieBrand /><Text accessibilityRole="header" style={ui.title}>{title}</Text></>}
      {children}
    </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function PosColumns({ children }: { children: ReactNode }) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={{ flexDirection: posColumns(width, fontScale) === 2 ? 'row' : 'column', alignItems: 'stretch', gap: spacing.lg }}>{children}</View>;
}
// Auto basis retains intrinsic height in a phone's unbounded scroll column.
// Shrink/grow share available row width without forcing a zero-height flex basis.
export const posPane = { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: spacing.lg } as const;

export function Field({ label, error, helper, ...props }: TextInputProps & { label: string; error?: string; helper?: string }) {
  return <View style={styles.field}>
    <Text style={ui.body}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} autoCapitalize={props.autoCapitalize ?? 'none'}
      accessibilityHint={error || helper || props.accessibilityHint}
      autoCorrect={false} placeholderTextColor={lightTheme.placeholder} style={[styles.input, error && { borderColor: statusColors.error.foreground }, props.style]} />
    {!!(error || helper) && <Text accessibilityLiveRegion="polite" style={[ui.caption, error && { color: statusColors.error.foreground }]}>{error || helper}</Text>}
  </View>;
}

type Operation = { title: string; description: string; content?: (pending: boolean) => ReactNode; run: () => Promise<unknown> };
export function usePosConfirmation(after: () => void, enabled = true, showSuccess = true) {
  const [operation, setOperation] = useState<Operation | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [success, setSuccess] = useState(false);
  const lock = useRef(false), generation = useRef(0);
  useFocusEffect(useCallback(() => {
    const ref = generation;
    return () => { ref.current++; setOperation(null); setFailure(undefined); setSuccess(false); };
  }, []));
  return {
    open(next: Operation) {
      if (lock.current) return;
      setFailure(undefined); setSuccess(false); setOperation(next);
    },
    pending,
    ui: <>
      {success && <Notice tone="success">Đã hoàn tất.</Notice>}
      <PassengerSheet visible={operation !== null} title={operation?.title ?? 'Xác nhận'}
        dismissible={!pending} onClose={() => { if (!lock.current) setOperation(null); }}>
        <Text style={ui.body}>{operation?.description}</Text>
        {operation?.content?.(pending)}
        {!!failure && <Notice tone="error">{failure}</Notice>}
        <PassengerButton label="Xác nhận" loading={pending} disabled={!!failure || !enabled} onPress={async () => {
          if (!operation || lock.current || failure || !enabled) return;
          lock.current = true;
          setPending(true);
          const version = generation.current;
          try { await operation.run(); if (version === generation.current) { setOperation(null); setSuccess(showSuccess); } }
          catch (error) {
            if (version !== generation.current) return;
            setFailure(uncertainWrite(error)
              ? 'Chưa xác nhận được kết quả. Đóng cửa sổ và kiểm tra danh sách đã tải lại trước khi thực hiện tiếp.'
              : posError(error));
          } finally { lock.current = false; setPending(false); if (version === generation.current) after(); }
        }} />
        <PassengerButton label="Quay lại" variant="text" disabled={pending} onPress={() => { if (!lock.current) setOperation(null); }} />
      </PassengerSheet>
    </>,
  };
}

export function uncertainWrite(error: unknown) {
  return !(error instanceof ApiError) || [0, 408, 429].includes(error.status) || error.status >= 500
    || (error.status >= 200 && error.status < 300);
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: lightTheme.background },
  content: { ...ui.content, gap: spacing.lg, paddingTop: spacing.lg },
  notice: { padding: 14, borderRadius: 14, borderCurve: 'continuous', gap: 8 },
  skeleton: { width: '65%', height: 10, borderRadius: 5, backgroundColor: brand.navySoft },
  field: { gap: 6 },
  reveal: { gap: 8 },
  input: {
    minHeight: controls.touch, borderWidth: 1, borderColor: lightTheme.controlBorder, borderRadius: controls.radius,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: brand.navy, backgroundColor: lightTheme.surface,
  },
});
