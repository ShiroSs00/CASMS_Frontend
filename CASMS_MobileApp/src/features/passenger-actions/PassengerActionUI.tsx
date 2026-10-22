import { type ReactNode, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type PassengerTab, PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, PassengerSheet, ui } from '@/components/passenger/PassengerUI';
import { brand, lightTheme, statusColors } from '@/constants/ocevie';
import { statusText } from './passenger-model';
import { usePassengerContext, type useBookingSelection } from './passenger-hooks';
import { ApiError } from '@/lib/api';
import { MaterialIcon, type MaterialIconName } from '@/components/passenger/MaterialIcon';
import { VoyageEntrance } from '@/components/passenger/VoyageEntrance';

export function PageIntro({ eyebrow, title, description, icon = 'sailing' }: {
  eyebrow?: string; title: string; description?: string; icon?: MaterialIconName;
}) {
  return <VoyageEntrance><View style={styles.intro}>
    <View style={styles.introTop}><View style={styles.introIcon}><MaterialIcon name={icon} color={brand.teal} size={25} /></View><View style={styles.goldLine} /></View>
    {!!eyebrow && <Text style={ui.eyebrow}>{eyebrow}</Text>}<Text accessibilityRole="header" style={ui.title}>{title}</Text>{!!description && <Text style={ui.body}>{description}</Text>}
  </View></VoyageEntrance>;
}
export function StatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase();
  const tone = ['CONFIRMED', 'COMPLETED', 'ACTIVE', 'FULFILLED'].includes(key) ? 'success'
    : ['CANCELLED', 'REJECTED'].includes(key) ? 'error'
      : ['PENDING', 'REQUESTED', 'DRAFT'].includes(key) ? 'warning' : 'neutral';
  const colors = statusColors[tone];
  return <View style={[styles.badge, { backgroundColor: colors.background }]}><View style={[styles.statusDot, { backgroundColor: colors.foreground }]} /><Text style={[styles.badgeText, { color: colors.foreground }]}>{statusText(status)}</Text></View>;
}

export function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Tài khoản chưa có quyền thực hiện thao tác hoặc hồ sơ này không thuộc bạn.';
    if (error.status === 0) return 'Chưa xác nhận được kết quả do mất kết nối. Hãy tải lại danh sách trước khi gửi lại để tránh trùng yêu cầu.';
  }
  return error instanceof Error ? error.message : 'Không xử lý được yêu cầu. Vui lòng thử lại.';
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return <View accessibilityLiveRegion="polite" style={styles.error}><Text style={styles.errorText}>{errorText(error)}</Text>{retry && <PassengerButton label="Tải lại" variant="text" onPress={retry} />}</View>;
}
export function Loading({ text = 'Đang tải dữ liệu…' }: { text?: string }) { return <View style={styles.row}><ActivityIndicator color={brand.teal} /><Text style={ui.body}>{text}</Text></View>; }
export function LivePage({ title, permission, children, detail = true, selected = 'services' }: { title: string; permission: string; children: ReactNode; detail?: boolean; selected?: PassengerTab }) {
  const context = usePassengerContext();
  if (context.auth.status !== 'restoring' && context.auth.status !== 'authenticated') return <Redirect href="/login" />;
  return <PassengerScaffold detail={detail} selected={detail ? 'account' : selected} title={title}><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={ui.content}>
    {context.auth.status === 'restoring' ? <Loading text="Đang khôi phục phiên…" /> : !context.live ? <EmptyState title="Đăng nhập tài khoản hành khách" description="Vui lòng đăng nhập tài khoản hành khách để tiếp tục." />
      : context.error ? <ErrorNotice error={context.error} retry={() => { void context.me.refetch(); }} />
        : !context.ready ? <Loading text="Đang xác minh tài khoản…" />
          : !context.can(permission) ? <EmptyState title="Chưa có quyền truy cập" description="Vui lòng liên hệ đội ngũ hỗ trợ nếu bạn cần sử dụng tính năng này." /> : children}
  </ScrollView></PassengerScaffold>;
}
export function BookingSelection({ selection, draft = false }: { selection: ReturnType<typeof useBookingSelection>; draft?: boolean }) {
  const context = usePassengerContext();
  if (!context.can('BOOKING_READ')) return <Text style={ui.body}>Tài khoản cần quyền xem đặt chỗ để chọn hồ sơ hành khách.</Text>;
  const error = selection.bookings.error ?? selection.booking.error;
  return <View style={ui.card}><Text style={ui.sectionTitle}>Chuyến đi và hành khách</Text>
    <ErrorNotice error={error} retry={() => { void selection.bookings.refetch(); if (selection.bookingId) void selection.booking.refetch(); }} />
    {selection.bookings.isPending || (selection.bookingId && selection.booking.isPending) ? <Loading /> : null}
    {!selection.bookings.isPending && !selection.bookings.error && !selection.options.length ? <Text style={ui.body}>{draft ? 'Bạn chưa có đơn nháp để chọn gói dịch vụ.' : 'Bạn cần đặt chỗ đã xác nhận để sử dụng tính năng này.'}</Text> : null}
    {!!selection.options.length && <Choice label="Đặt chỗ" value={selection.bookingId} items={selection.options.map(b => ({ id: b.bookingId, label: `${b.bookingReference} · ${b.cruiseName}` }))} onChange={selection.choose} />}
    {!!selection.booking.data && !selection.booking.error && <Choice label="Hành khách" value={selection.bookingPassengerId} items={selection.people.map(p => ({ id: p.bookingPassengerId, label: `${p.fullName}${p.cabinNumber ? ` · Phòng ${p.cabinNumber}` : ''}` }))} onChange={selection.choosePerson} />}

  </View>;
}
export function Input({ label, value, onChange, multiline = false, numeric = false, maxLength, disabled = false, email = false }: {
  label: string; value: string; onChange: (text: string) => void; multiline?: boolean; numeric?: boolean; maxLength?: number; disabled?: boolean; email?: boolean;
}) {
  return <View style={{ gap: 6 }}><Text style={ui.caption}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} keyboardType={numeric ? 'number-pad' : email ? 'email-address' : 'default'} autoCapitalize={email ? 'none' : 'sentences'} autoCorrect={!email} maxLength={maxLength} editable={!disabled} style={[styles.input, multiline && { minHeight: 86, textAlignVertical: 'top' }, disabled && { opacity: .6 }]} /></View>;
}
export function Choice({ label, value, items, onChange, disabled = false }: { label: string; value: string; items: { id: string; label: string }[]; onChange: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = items.find(i => i.id === value);
  return <View style={{ gap: 6 }}><Text style={ui.caption}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded: open }} disabled={disabled} onPress={() => setOpen(true)} style={({ pressed }) => [styles.input, styles.choice, pressed && { borderColor: brand.teal, backgroundColor: brand.tealSoft }, disabled && { opacity: .6 }]}><Text style={[ui.body, { flex: 1, color: selected ? brand.navy : lightTheme.placeholder }]}>{selected?.label ?? 'Chọn…'}</Text><MaterialIcon name="expand_more" color={brand.teal} size={20} /></Pressable>
    <PassengerSheet visible={open} title={label} onClose={() => setOpen(false)}>
      {!items.length && <Text style={ui.body}>Chưa có lựa chọn phù hợp.</Text>}
      {items.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: item.id === value }} onPress={() => { onChange(item.id); setOpen(false); }} style={({ pressed }) => [styles.option, (pressed || item.id === value) && { borderColor: brand.teal, backgroundColor: brand.tealSoft }]}><Text style={[ui.body, { flex: 1, color: brand.navy }]}>{item.label}</Text><MaterialIcon name={item.id === value ? 'check_circle' : 'chevron_right'} color={brand.teal} size={22} /></Pressable>)}
    </PassengerSheet>
  </View>;
}
export function ConfirmAction({ visible, title, description, onClose, onConfirm, pending, error, children, disabled = false }: {
  visible: boolean; title: string; description: string; onClose: () => void; onConfirm: () => void; pending: boolean; error: unknown; children?: ReactNode; disabled?: boolean;
}) {
  return <PassengerSheet visible={visible} dismissible={!pending} title={title} onClose={() => { if (!pending) onClose(); }}>{!!description && <Text style={ui.body}>{description}</Text>}{children}<ErrorNotice error={error} /><PassengerButton label={title} loading={pending} disabled={disabled} onPress={onConfirm} /><PassengerButton label="Quay lại" variant="text" disabled={pending} onPress={onClose} /></PassengerSheet>;
}
export const styles = StyleSheet.create({
  intro: { gap: 10, paddingTop: 6 },
  introTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  introIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.tealSoft },
  goldLine: { width: 40, height: 2, borderRadius: 1, backgroundColor: brand.gold },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: lightTheme.border, borderRadius: 12, padding: 14, minHeight: 50, color: brand.navy, backgroundColor: lightTheme.surface, fontSize: 15 },
  option: { minHeight: 56, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: lightTheme.divider, flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { padding: 14, gap: 8, borderRadius: 12, backgroundColor: '#FFF0ED' }, errorText: { fontSize: 14, lineHeight: 22, color: '#8A3024' },
});
