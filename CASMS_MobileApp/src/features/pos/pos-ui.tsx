import { useRef, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerSheet, ui } from '@/components/passenger/PassengerUI';
import { useMotionPreference } from '@/components/passenger/useMotionPreference';
import { Loading } from '@/features/passenger-actions/PassengerActionUI';
import { brand, lightTheme, statusColors } from '@/constants/ocevie';
import { motion } from '@/constants/motion';
import { ApiError } from '@/lib/api';

const errors: Record<string, string> = {
  POS_FULFILLMENT_REQUIRED: 'Nhập đúng số lượng đã phục vụ và kiểm tra đơn vị trước khi hoàn tất.',
  POS_CRUISE_SELECTION_REQUIRED: 'Có nhiều chuyến phù hợp. Nhập mã chuyến do quản lý cung cấp.',
  POS_ALLOWANCE_EXCEEDED: 'Tài khoản trên tàu không còn đủ hạn mức.',
  POS_SPENDING_LIMIT_EXCEEDED: 'Hành khách không còn đủ hạn mức sử dụng.',
  POS_PASSENGER_NOT_ELIGIBLE: 'Hồ sơ hành khách hoặc tài khoản chưa đủ điều kiện ghi nhận dịch vụ.',
  POS_IDEMPOTENCY_CONFLICT: 'Mã giao dịch đã gắn với một nội dung khác. Liên hệ quản lý để đối soát.',
  POS_PRICE_REQUIRED: 'Dịch vụ chưa có giá hợp lệ.',
  POS_ALLOWANCE_NOT_ALLOCATED: 'Tài khoản trên tàu chưa được cấp hạn mức.',
  POS_ACCOUNT_CURRENCY_MISMATCH: 'Sao kê có nhiều loại tiền tệ. Liên hệ quản lý để đối soát.',
  POS_STORAGE: 'Không xóa được phiên đã lưu trên iPhone. Vui lòng thử lại.',
  POS_SALE_BUSY: 'Thiết bị đang xử lý giao dịch này. Hãy kiểm tra lại kết quả.',
  POS_REVERIFY: 'Phiên POS hoặc dữ liệu cần được kiểm tra lại. Hãy đóng xác nhận và tải lại trước khi thực hiện tiếp.',
  POS_JOURNAL: 'Không truy cập được hồ sơ chờ trên iPhone. Chưa gửi yêu cầu ghi nhận lần này.',
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

export function PosPage({ title, children, refresh, refreshing = false, standalone = false }: {
  title: string; children: ReactNode; refresh?: () => void; refreshing?: boolean; standalone?: boolean;
}) {
  return <SafeAreaView edges={standalone ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}
    style={styles.page} onLayout={() => { void SplashScreen.hideAsync().catch(() => {}); }}>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={brand.teal} /> : undefined}>
      <Text accessibilityRole="header" style={ui.title}>{title}</Text>
      {children}
    </ScrollView>
  </SafeAreaView>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}>
    <Text style={ui.body}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} autoCapitalize={props.autoCapitalize ?? 'none'}
      autoCorrect={false} placeholderTextColor={lightTheme.placeholder} style={styles.input} />
  </View>;
}

type Operation = { title: string; description: string; content?: (pending: boolean) => ReactNode; run: () => Promise<unknown> };
export function usePosConfirmation(after: () => void, enabled = true, showSuccess = true) {
  const [operation, setOperation] = useState<Operation | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [success, setSuccess] = useState(false);
  const lock = useRef(false);
  return {
    open(next: Operation) {
      if (lock.current) return;
      setFailure(undefined); setSuccess(false); setOperation(next);
    },
    pending,
    ui: <>
      {success && <Notice tone="success">Hệ thống đã xác nhận thao tác.</Notice>}
      <PassengerSheet visible={operation !== null} title={operation?.title ?? 'Xác nhận'}
        dismissible={!pending} onClose={() => { if (!lock.current) setOperation(null); }}>
        <Text style={ui.body}>{operation?.description}</Text>
        {operation?.content?.(pending)}
        {!!failure && <Notice tone="error">{failure}</Notice>}
        <PassengerButton label="Xác nhận" loading={pending} disabled={!!failure || !enabled} onPress={async () => {
          if (!operation || lock.current || failure || !enabled) return;
          lock.current = true;
          setPending(true);
          try { await operation.run(); setOperation(null); setSuccess(showSuccess); }
          catch (error) {
            setFailure(uncertainWrite(error)
              ? 'Chưa xác nhận được kết quả. Đóng cửa sổ và kiểm tra danh sách đã tải lại trước khi thực hiện tiếp.'
              : posError(error));
          } finally { lock.current = false; setPending(false); after(); }
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
  content: { ...ui.content, gap: 16, paddingTop: 16 },
  notice: { padding: 14, borderRadius: 14, borderCurve: 'continuous', gap: 8 },
  skeleton: { width: '65%', height: 10, borderRadius: 5, backgroundColor: brand.navySoft },
  field: { gap: 6 },
  reveal: { gap: 8 },
  input: {
    minHeight: 50, borderWidth: 1, borderColor: lightTheme.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: brand.navy, backgroundColor: lightTheme.surface,
  },
});
