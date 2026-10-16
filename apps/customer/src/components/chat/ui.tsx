// Small pieces the chat's cards share: Ink buttons, chips, section labels and
// a notice box. Everything presses with a gentle dim, the same everywhere.
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsha } from './ishaTheme';

export const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Tap({
  style,
  pressedStyle,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && (pressedStyle || { opacity: 0.72 }), rest.disabled && { opacity: 0.5 }]}
    >
      {children}
    </Pressable>
  );
}

export function InkButton({
  label,
  icon,
  iconRight,
  onPress,
  disabled,
  busy,
  style,
  size = 'md',
  accessibilityLabel,
}: {
  label: string;
  icon?: IconName;
  iconRight?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
  accessibilityLabel?: string;
}) {
  const t = useIsha();
  const off = disabled || busy;
  const h = size === 'lg' ? 50 : size === 'sm' ? 36 : 44;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [
        styles.btn,
        { height: h, borderRadius: size === 'lg' ? 15 : 12, backgroundColor: disabled ? t.inkDisabledBg : t.ink },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={t.onInk} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'sm' ? 14 : 16} color={disabled ? t.inkDisabledText : t.onInk} />
      ) : null}
      <Text style={[styles.btnText, { color: disabled ? t.inkDisabledText : t.onInk, fontSize: size === 'lg' ? 15 : size === 'sm' ? 13 : 14 }]}>
        {label}
      </Text>
      {iconRight && !busy ? (
        <Ionicons name={iconRight} size={size === 'sm' ? 14 : 16} color={disabled ? t.inkDisabledText : t.onInk} />
      ) : null}
    </Pressable>
  );
}

export function OutlineButton({
  label,
  icon,
  onPress,
  style,
  disabled,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const t = useIsha();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        { height: 36, borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: pressed ? t.pressed : t.surface },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={t.text} /> : null}
      <Text style={[styles.btnText, { color: t.text, fontSize: 13, fontWeight: '500' }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, onPress, style }: { label: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useIsha();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.chip,
        { borderColor: t.border, backgroundColor: pressed ? t.pressed : t.surface },
        style,
      ]}
    >
      <Text style={[styles.chipText, { color: t.body }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const t = useIsha();
  return <Text style={[styles.section, { color: t.muted }]}>{children}</Text>;
}

/** A careful note with what to do about it (errors, dropped replies). */
export function Notice({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  const t = useIsha();
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: t.border, backgroundColor: t.surfaceMuted }]}>
      <View style={styles.noticeRow}>
        <Ionicons name="alert-circle-outline" size={18} color={t.warnIcon} style={{ marginTop: 1 }} />
        <Text style={[styles.noticeText, { color: t.body }]}>{children}</Text>
      </View>
      {actions ? <View style={styles.noticeActions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  btnText: { fontWeight: '600' },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: 280,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  section: { fontSize: 12.5, fontWeight: '600' },
  notice: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  noticeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 28 },
});
