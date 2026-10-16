import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { MaterialIcon } from './MaterialIcon';

export function OutlinedField({ label, value, onChangeText, helper, error, password = false, username = false, disabled = false, onBlur, onSubmitEditing, inputRef }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  helper: string;
  error?: string;
  password?: boolean;
  username?: boolean;
  disabled?: boolean;
  onBlur: () => void;
  onSubmitEditing: () => void;
  inputRef?: Ref<TextInput>;
}) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const floated = focused || value.length > 0;
  const accent = error ? colors.error : focused ? colors.primary : colors.outline;

  return (
    <View style={styles.group}>
      <View style={[styles.field, { borderColor: accent, borderWidth: focused ? 2 : 1 }]}>
        <MaterialIcon name={password ? 'lock' : username ? 'assignment_ind' : 'mail'} color={colors.onSurfaceVariant} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur(); }}
          onSubmitEditing={onSubmitEditing}
          editable={!disabled}
          accessibilityLabel={label}
          accessibilityHint={error || helper}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={password || username ? 'default' : 'email-address'}
          autoComplete={password ? 'current-password' : username ? 'username' : 'email'}
          textContentType={password ? 'password' : username ? 'username' : 'emailAddress'}
          secureTextEntry={password && !visible}
          returnKeyType={password ? 'go' : 'next'}
          submitBehavior={password ? 'blurAndSubmit' : 'submit'}
          selectionColor={colors.primary}
        />
        <Text pointerEvents="none" style={[
          styles.label,
          floated ? styles.floated : styles.resting,
          { color: floated ? accent : colors.onSurfaceVariant },
        ]}>{label}</Text>
        {password && (
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onPress={() => setVisible(!visible)}
            android_ripple={{ color: colors.secondaryContainer, borderless: true }}
            style={({ pressed }) => [styles.eye, pressed && styles.eyePressed]}>
            <MaterialIcon name={visible ? 'visibility_off' : 'visibility'} color={colors.onSurfaceVariant} />
          </Pressable>
        )}
      </View>
      <Text style={[styles.helper, error && styles.error]} accessibilityLiveRegion="polite">
        {error || helper}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  field: { minHeight: 56, borderRadius: 16, backgroundColor: colors.surfaceContainerLow, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { flex: 1, minWidth: 0, minHeight: 54, color: colors.onSurface, fontSize: 16, paddingVertical: 12 },
  label: { position: 'absolute' },
  resting: { left: 52, fontSize: 16 },
  floated: { left: 12, top: -10, paddingHorizontal: 4, fontSize: 12, lineHeight: 18, backgroundColor: colors.surfaceContainerLow },
  helper: { paddingHorizontal: 16, fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant },
  error: { color: colors.error },
  eye: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  eyePressed: { backgroundColor: colors.secondaryContainer, transform: [{ scale: 0.96 }] },
});
