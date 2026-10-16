import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { MaterialIcon, type MaterialIconName } from './MaterialIcon';

import { PassengerNavigation, type PassengerTab } from './PassengerNavigation';

export type { PassengerTab } from './PassengerNavigation';

export function PassengerScaffold({ children, selected = 'home', title = 'aurora', detail = false, locked = false }: {
  children: ReactNode;
  selected?: PassengerTab;
  title?: string;
  detail?: boolean;
  locked?: boolean;
}) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}
      onLayout={() => { void SplashScreen.hideAsync().catch(console.warn); }}>
      <View style={styles.appBar}>
        <IconAction icon={detail ? 'arrow_back' : 'sailing'} label={detail ? 'Quay lại' : 'Thông tin chuyến đi'}
          disabled={locked}
          onPress={() => {
            if (detail) {
              if (router.canGoBack()) router.back();
              else router.replace('/home');
            } else router.push('/cruise');
          }} />
        <Text style={styles.appTitle} accessibilityRole="header">{title}{title === 'aurora' && <Text style={{ color: colors.tertiaryContainer }}>.</Text>}</Text>
        <IconAction icon="notifications" label="Thông báo" disabled={locked}
          onPress={() => router.push('/notifications')} />
      </View>
      <View style={styles.body}>{children}</View>
      {detail && <PassengerNavigation selected={selected} locked={locked}
        onSelect={(_key, href) => router.dismissTo(href)} />}
    </SafeAreaView>
  );
}

function IconAction({ icon, label, onPress, disabled }: {
  icon: MaterialIconName; label: string; onPress: () => void; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    android_ripple={{ color: colors.secondaryContainer, borderless: true }}
    style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
    <MaterialIcon name={icon} color={disabled ? colors.outline : colors.onSurface} />
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1 },
  appBar: { minHeight: 70, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 0 },
  appTitle: { flex: 1, fontSize: 27, lineHeight: 36, letterSpacing: -1.3, fontWeight: '700', color: colors.onSurface },
  iconAction: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.96 }], backgroundColor: colors.secondaryContainer },
});
