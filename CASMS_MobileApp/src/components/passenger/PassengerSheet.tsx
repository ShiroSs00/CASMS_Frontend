import { type ReactNode, useLayoutEffect, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, lightTheme, overlays } from '@/constants/ocevie';
import { motion } from '@/constants/motion';
import { MaterialIcon } from './MaterialIcon';
import { useMotionPreference } from './useMotionPreference';
import { startSheetTransition } from './sheet-presence';

export function PassengerSheet({ visible, title, children, onClose, dismissible = true, expanded = false, contentKey }: {
  visible: boolean; title: string; children: ReactNode; onClose: () => void; dismissible?: boolean; expanded?: boolean; contentKey?: string;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  const [snapshot, setSnapshot] = useState({ title, children, contentKey });

  // Retain the last visible content while exiting, including when callers clear
  // their selection in the same update. A reopening cancels the previous exit.
  if (visible && (!mounted || snapshot.title !== title || snapshot.children !== children || snapshot.contentKey !== contentKey)) {
    if (!mounted) setMounted(true);
    setSnapshot({ title, children, contentKey });
  }
  useLayoutEffect(() => {
    if (!mounted && !visible) return;
    const curve = visible ? motion.easeOut : motion.easeIn;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduced ? 0 : visible ? motion.sheetIn : motion.sheetOut,
      easing: Easing.bezier(curve[0], curve[1], curve[2], curve[3]),
      useNativeDriver: Platform.OS !== 'web',
    });
    return startSheetTransition(visible, complete => {
      animation.start(({ finished }) => complete(finished));
      return () => animation.stop();
    }, () => setMounted(false));
  }, [visible, mounted, reduced, progress]);

  const displayed = visible ? { title, children, contentKey } : snapshot;
  function close() { if (visible && dismissible) onClose(); }
  return <Modal visible={visible || mounted} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlays.modal, opacity: progress }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Đóng bảng thông tin" accessibilityState={{ disabled: !dismissible || !visible }} disabled={!dismissible || !visible} onPress={close} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal role="dialog" aria-label={displayed.title}
        accessibilityElementsHidden={!visible} pointerEvents={visible ? 'auto' : 'none'} style={[styles.sheet, expanded && { height: '90%' }, {
          paddingBottom: Math.max(insets.bottom, 16), opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 48, 0] }) }],
        }]}>
        <View style={styles.handle} />
        <View style={styles.header}><View style={styles.heading}><Text style={styles.eyebrow}>OCEVIE</Text><Text accessibilityRole="header" style={styles.title}>{displayed.title}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng" accessibilityState={{ disabled: !dismissible || !visible }} disabled={!dismissible || !visible} onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressed, !dismissible && { opacity: .4 }]}><MaterialIcon name="close" color={brand.navy} size={22} /></Pressable>
        </View>
        <ScrollView key={displayed.contentKey} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>{displayed.children}</ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 600, alignSelf: 'center', maxHeight: '90%', backgroundColor: lightTheme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, overflow: 'hidden' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: lightTheme.border, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: lightTheme.divider },
  heading: { flex: 1, gap: 6 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.4, color: brand.teal, fontWeight: '600' },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: brand.navy, letterSpacing: -.3 },
  close: { width: 44, height: 44, borderRadius: 14, backgroundColor: lightTheme.surfaceHover, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: brand.tealSoft },
  content: { gap: 18, paddingTop: 20, paddingBottom: 16 },
});
