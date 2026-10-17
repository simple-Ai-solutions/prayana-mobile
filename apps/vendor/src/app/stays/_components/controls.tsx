// Small controls the stays screens share: a dark-mode-aware palette, titled
// sections, tap-to-toggle chips, a segmented choice, a − / + stepper, yes/no
// rows, a rupee input, option cards, a picker sheet, banners and the screen
// header. Ported from the web wizard's controls.jsx.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, useTheme } from '../../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../../theme/vendorColors';
import { statusInfo } from './stayConfig';

type IconName = keyof typeof Ionicons.glyphMap;

// ─── Palette ──────────────────────────────────────────────────────────────────

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'gray';

/** Theme colors plus soft tinted surfaces that read in both light and dark mode. */
export function usePalette() {
  const { themeColors, isDarkMode } = useTheme();
  return useMemo(() => {
    const dark = isDarkMode;
    const soft: Record<Tone, { bg: string; fg: string; border: string }> = {
      blue: dark
        ? { bg: 'rgba(37,99,235,0.18)', fg: colors.primary[200], border: 'rgba(96,165,250,0.45)' }
        : { bg: colors.primary[50], fg: colors.primary[700], border: colors.primary[200] },
      green: dark
        ? { bg: 'rgba(34,197,94,0.15)', fg: '#86efac', border: 'rgba(34,197,94,0.4)' }
        : { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
      amber: dark
        ? { bg: 'rgba(245,158,11,0.15)', fg: '#fcd34d', border: 'rgba(245,158,11,0.4)' }
        : { bg: '#fffbeb', fg: '#92400e', border: '#fde68a' },
      red: dark
        ? { bg: 'rgba(239,68,68,0.15)', fg: '#fca5a5', border: 'rgba(239,68,68,0.4)' }
        : { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
      violet: dark
        ? { bg: 'rgba(139,92,246,0.18)', fg: '#c4b5fd', border: 'rgba(139,92,246,0.4)' }
        : { bg: '#f5f3ff', fg: '#6d28d9', border: '#ddd6fe' },
      gray: dark
        ? { bg: themeColors.surfaceElevated, fg: themeColors.textSecondary, border: themeColors.border }
        : { bg: themeColors.backgroundSecondary, fg: themeColors.textSecondary, border: themeColors.border },
    };
    return {
      c: themeColors,
      dark,
      soft,
      brand: dark ? colors.primary[300] : colors.primary[500],
      success: dark ? '#4ade80' : '#059669',
      warning: dark ? '#fbbf24' : '#d97706',
      danger: dark ? '#f87171' : '#dc2626',
    };
  }, [themeColors, isDarkMode]);
}

export type Palette = ReturnType<typeof usePalette>;

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Section({
  title,
  hint,
  aside,
  children,
  style,
}: {
  title?: string;
  hint?: string;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  style?: object;
}) {
  const p = usePalette();
  return (
    <View style={[styles.section, style]}>
      {(title || aside) && (
        <View style={styles.sectionHead}>
          <View style={styles.flex}>
            {title ? (
              <Text style={[styles.sectionTitle, { color: p.c.text }]} accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            {hint ? <Text style={[styles.sectionHint, { color: p.c.textSecondary }]}>{hint}</Text> : null}
          </View>
          {aside}
        </View>
      )}
      {!title && hint ? <Text style={[styles.sectionHint, { color: p.c.textSecondary }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** A label above a custom control (the shared TextInput has its own). */
export function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  const p = usePalette();
  return (
    <Text style={[styles.fieldLabel, { color: p.c.text }]}>
      {label}
      {optional ? <Text style={{ color: p.c.textTertiary, fontWeight: fontWeight.normal }}> (optional)</Text> : null}
    </Text>
  );
}

export function Banner({
  tone = 'blue',
  icon,
  children,
  style,
}: {
  tone?: Tone;
  icon?: IconName;
  children: React.ReactNode;
  style?: object;
}) {
  const p = usePalette();
  const t = p.soft[tone];
  const defaultIcon: IconName =
    tone === 'green' ? 'checkmark-circle' : tone === 'red' || tone === 'amber' ? 'alert-circle' : 'information-circle';
  return (
    <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Ionicons name={icon || defaultIcon} size={18} color={t.fg} style={styles.bannerIcon} />
      <View style={styles.flex}>
        {typeof children === 'string' ? <Text style={[styles.bannerText, { color: t.fg }]}>{children}</Text> : children}
      </View>
    </View>
  );
}

export function ProgressBar({ percent, tone = 'blue', height = 8 }: { percent: number; tone?: 'blue' | 'green'; height?: number }) {
  const p = usePalette();
  const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <View
      style={[styles.barTrack, { height, backgroundColor: p.dark ? p.c.surfaceElevated : p.c.backgroundSecondary }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: tone === 'green' ? p.success : colors.primary[500] }} />
    </View>
  );
}

export function StayStatusBadge({ status }: { status?: string | null }) {
  const info = statusInfo(status);
  return <Badge label={info.label} variant={info.variant} />;
}

/** The top bar of every stays screen: back chevron, title, optional right-side content. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  backLabel = 'Back',
}: {
  title: string;
  subtitle?: string | null;
  onBack: () => void;
  right?: React.ReactNode;
  backLabel?: string;
}) {
  const p = usePalette();
  return (
    <View style={[styles.header, { backgroundColor: p.c.surface, borderBottomColor: p.c.border }]}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.headerBtn}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={24} color={p.c.text} />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.headerTitle, { color: p.c.text }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: p.c.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

/** A compact outlined button with an icon (header links, card quick actions). */
export function LinkButton({
  icon,
  label,
  onPress,
  tone = 'blue',
  disabled,
  accessibilityLabel,
  compact,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
  tone?: 'blue' | 'red' | 'gray' | 'green';
  disabled?: boolean;
  accessibilityLabel?: string;
  compact?: boolean;
}) {
  const p = usePalette();
  const fg = tone === 'red' ? p.danger : tone === 'gray' ? p.c.textSecondary : tone === 'green' ? p.success : p.brand;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.linkBtn,
        compact && styles.linkBtnCompact,
        { borderColor: p.c.border, backgroundColor: p.c.surface },
        disabled && styles.disabled,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.linkBtnText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Choices ──────────────────────────────────────────────────────────────────

export function Chip({
  selected,
  onPress,
  label,
  icon,
  disabled,
}: {
  selected?: boolean;
  onPress: () => void;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={[
        styles.chip,
        { borderColor: p.c.border, backgroundColor: p.c.surface },
        selected && { borderColor: p.soft.blue.border, backgroundColor: p.soft.blue.bg },
        disabled && styles.disabled,
      ]}
    >
      {selected ? (
        <Ionicons name="checkmark" size={14} color={p.soft.blue.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={14} color={p.c.textSecondary} />
      ) : null}
      <Text style={[styles.chipText, { color: selected ? p.soft.blue.fg : p.c.text }, selected && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

/** options: [{ id, label }]; `allowClear` lets a second tap unset it. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  allowClear = false,
  size = 'md',
  label,
  stretch = false,
}: {
  options: { id: T; label: string }[];
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  allowClear?: boolean;
  size?: 'sm' | 'md';
  label: string;
  stretch?: boolean;
}) {
  const p = usePalette();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[
        styles.segmented,
        stretch && styles.segmentedStretch,
        { borderColor: p.c.border, backgroundColor: p.dark ? p.c.surfaceElevated : p.c.backgroundSecondary },
      ]}
    >
      {options.map((o) => {
        const on = value === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => onChange(on && allowClear ? null : o.id)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            style={[
              styles.segment,
              size === 'sm' && styles.segmentSm,
              stretch && styles.flexGrow,
              on && [styles.segmentOn, { backgroundColor: p.c.surface }],
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                size === 'sm' && styles.segmentTextSm,
                { color: on ? p.brand : p.c.textSecondary },
                on && styles.segmentTextOn,
              ]}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  hint,
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  hint?: string;
}) {
  const p = usePalette();
  const n = Number(value) || 0;
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  const btn = (dir: -1 | 1) => {
    const disabled = dir < 0 ? n <= min : n >= max;
    return (
      <TouchableOpacity
        onPress={() => set(n + dir)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${dir < 0 ? 'Fewer' : 'More'}: ${label}`}
        accessibilityState={{ disabled }}
        hitSlop={6}
        style={[styles.stepBtn, { borderColor: p.c.border }, disabled && styles.disabled]}
      >
        <Ionicons name={dir < 0 ? 'remove' : 'add'} size={18} color={p.c.text} />
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.stepperRow}>
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, { color: p.c.text }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: p.c.textTertiary }]}>{hint}</Text> : null}
      </View>
      <View style={styles.stepperCtl}>
        {btn(-1)}
        <Text style={[styles.stepValue, { color: p.c.text }]} accessibilityLiveRegion="polite" accessibilityLabel={`${label}: ${n}`}>
          {n}
        </Text>
        {btn(1)}
      </View>
    </View>
  );
}

/** Yes / No / not said, for house rules. */
export function YesNo({
  value,
  onChange,
  label,
  hint,
  allowClear = true,
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
  label: string;
  hint?: string;
  allowClear?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={styles.yesNoRow}>
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, { color: p.c.text }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: p.c.textTertiary }]}>{hint}</Text> : null}
      </View>
      <Segmented
        size="sm"
        label={label}
        allowClear={allowClear}
        value={value === true ? 'yes' : value === false ? 'no' : null}
        onChange={(v) => onChange(v === 'yes' ? true : v === 'no' ? false : null)}
        options={[
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ]}
      />
    </View>
  );
}

export function SwitchRow({
  value,
  onChange,
  label,
  hint,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={styles.yesNoRow}>
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, { color: p.c.text }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: p.c.textTertiary }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: p.dark ? '#404040' : '#d4d4d4', true: colors.primary[500] }}
        thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
      />
    </View>
  );
}

/** A rupee amount: digits only, "₹" prefix, optional unit after. */
export function RupeeInput({
  value,
  onChange,
  label,
  hint,
  unit = '/ night',
  error,
  placeholder = '0',
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  label?: string;
  hint?: string;
  unit?: string;
  error?: string | null;
  placeholder?: string;
}) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.rupeeWrap}>
      {label ? <Text style={[styles.fieldLabel, { color: p.c.text }]}>{label}</Text> : null}
      <View
        style={[
          styles.rupeeField,
          { backgroundColor: p.c.field, borderColor: p.c.fieldBorder },
          focused && { borderColor: colors.primary[500] },
          !!error && { borderColor: p.danger },
        ]}
      >
        <Text style={[styles.rupeeSign, { color: p.c.textSecondary }]}>₹</Text>
        <RNTextInput
          value={value == null ? '' : String(value)}
          onChangeText={(t) => {
            const digits = t.replace(/[^\d]/g, '').slice(0, 7);
            onChange(digits === '' ? null : Number(digits));
          }}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor={p.c.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label ? `${label}${unit ? ` ${unit}` : ''}` : 'Amount in rupees'}
          style={[styles.rupeeInput, { color: p.c.text }]}
        />
        {unit ? <Text style={[styles.rupeeUnit, { color: p.c.textTertiary }]}>{unit}</Text> : null}
      </View>
      {error ? (
        <Text style={[styles.fieldHint, { color: p.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.fieldHint, { color: p.c.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Big tappable option card (radio-like). */
export function OptionCard({
  selected,
  onPress,
  title,
  hint,
  icon,
  badge,
}: {
  selected?: boolean;
  onPress: () => void;
  title: string;
  hint?: string;
  icon?: IconName;
  badge?: string;
}) {
  const p = usePalette();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="radio"
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
      accessibilityState={{ checked: !!selected }}
      style={[
        styles.optionCard,
        { borderColor: p.c.border, backgroundColor: p.c.surface },
        selected && { borderColor: colors.primary[500], backgroundColor: p.soft.blue.bg },
      ]}
    >
      {icon ? (
        <View style={[styles.optionIcon, { backgroundColor: selected ? colors.primary[500] : p.soft.gray.bg }]}>
          <Ionicons name={icon} size={20} color={selected ? '#fff' : p.c.textSecondary} />
        </View>
      ) : (
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={selected ? p.brand : p.c.textTertiary}
          style={styles.optionRadio}
        />
      )}
      <View style={styles.flex}>
        <View style={styles.optionTitleRow}>
          <Text style={[styles.optionTitle, { color: p.c.text }]}>{title}</Text>
          {badge ? (
            <View style={[styles.miniBadge, { backgroundColor: p.soft.green.bg }]}>
              <Text style={[styles.miniBadgeText, { color: p.soft.green.fg }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {hint ? <Text style={[styles.optionHint, { color: p.c.textSecondary }]}>{hint}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Sheets ───────────────────────────────────────────────────────────────────

/** A bottom sheet (Modal) with a title, scrollable body and an optional footer. */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  scroll = true,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetRoot}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: p.c.overlay }]} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: p.c.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={[styles.sheetHandle, { backgroundColor: p.c.border }]} />
          <View style={styles.sheetHead}>
            <View style={styles.flex}>
              <Text style={[styles.sheetTitle, { color: p.c.text }]} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={[styles.sheetSubtitle, { color: p.c.textSecondary }]}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={p.c.textSecondary} />
            </TouchableOpacity>
          </View>
          {scroll ? (
            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.sheetBody}>{children}</View>
          )}
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface ChoiceOption {
  label: string;
  icon?: IconName;
  onPress: () => void;
  destructive?: boolean;
}

/** An action sheet: more than the 3 buttons an Android Alert can show. */
export function ChoiceSheet({
  visible,
  title,
  message,
  options,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  options: ChoiceOption[];
  onClose: () => void;
}) {
  const p = usePalette();
  return (
    <Sheet visible={visible} title={title} subtitle={message} onClose={onClose}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.label}
          style={[styles.choiceRow, { borderBottomColor: p.c.border }]}
          onPress={() => {
            onClose();
            // Let the sheet finish closing before a system picker opens (iOS
            // won't present one over a modal that's still on screen).
            setTimeout(o.onPress, 450);
          }}
          accessibilityRole="button"
          accessibilityLabel={o.label}
        >
          {o.icon ? <Ionicons name={o.icon} size={20} color={o.destructive ? p.danger : p.brand} /> : null}
          <Text style={[styles.choiceText, { color: o.destructive ? p.danger : p.c.text }]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </Sheet>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  hint?: string;
}

/** A select: a field showing the choice, opening a list sheet. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  hint,
  sheetTitle,
  compact,
}: {
  label?: string;
  value: string | null | undefined;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  sheetTitle?: string;
  compact?: boolean;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={compact ? undefined : styles.selectWrap}>
      {label ? <Text style={[styles.fieldLabel, { color: p.c.text }]}>{label}</Text> : null}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label || sheetTitle || 'Choose'}: ${current?.label || placeholder}`}
        accessibilityHint="Opens a list to choose from"
        style={[styles.selectField, compact && styles.selectCompact, { backgroundColor: p.c.field, borderColor: p.c.fieldBorder }]}
      >
        <Text style={[styles.selectText, { color: current ? p.c.text : p.c.textTertiary }]} numberOfLines={1}>
          {current?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={p.c.textTertiary} />
      </TouchableOpacity>
      {hint ? <Text style={[styles.fieldHint, { color: p.c.textTertiary }]}>{hint}</Text> : null}
      <Sheet visible={open} title={sheetTitle || label || 'Choose'} onClose={() => setOpen(false)}>
        {options.map((o, i) => {
          const on = o.value === value;
          const newGroup = o.group && o.group !== options[i - 1]?.group;
          return (
            <View key={`${o.group || ''}:${o.value}`}>
              {newGroup ? <Text style={[styles.selectGroup, { color: p.c.textTertiary }]}>{o.group}</Text> : null}
              <TouchableOpacity
                style={[styles.selectRow, { borderBottomColor: p.c.border }]}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={o.label}
              >
                <View style={styles.flex}>
                  <Text style={[styles.selectRowText, { color: on ? p.brand : p.c.text }, on && styles.chipTextOn]}>{o.label}</Text>
                  {o.hint ? <Text style={[styles.rowHint, { color: p.c.textTertiary }]}>{o.hint}</Text> : null}
                </View>
                {on ? <Ionicons name="checkmark" size={20} color={p.brand} /> : null}
              </TouchableOpacity>
            </View>
          );
        })}
      </Sheet>
    </View>
  );
}

/** A small "label: value" line in summaries. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: p.c.textTertiary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: p.c.text }]}>{value || '—'}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

export const sharedStyles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  muted: { fontSize: fontSize.sm, lineHeight: 19 },
  small: { fontSize: fontSize.xs, lineHeight: 16 },
});

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexGrow: { flexGrow: 1, alignItems: 'center' },
  disabled: { opacity: 0.45 },

  section: { marginBottom: spacing['2xl'], gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sectionHint: { fontSize: fontSize.sm, lineHeight: 19, marginTop: 2 },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.xs },
  fieldHint: { fontSize: fontSize.xs, marginTop: spacing.xs, lineHeight: 16 },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  bannerIcon: { marginTop: 1 },
  bannerText: { fontSize: fontSize.sm, lineHeight: 19 },

  barTrack: { width: '100%', borderRadius: 999, overflow: 'hidden' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 52,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, minWidth: 0, paddingHorizontal: spacing.xs },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 40, justifyContent: 'flex-end' },

  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  linkBtnCompact: { minHeight: 34, paddingHorizontal: spacing.sm },
  linkBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flexShrink: 1 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  chipText: { fontSize: fontSize.sm },
  chipTextOn: { fontWeight: fontWeight.semibold },

  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: 3,
    gap: 2,
  },
  segmentedStretch: { alignSelf: 'stretch' },
  segment: { borderRadius: borderRadius.md, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center' },
  segmentSm: { paddingHorizontal: spacing.md, minHeight: 32 },
  segmentOn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  segmentTextSm: { fontSize: fontSize.sm },
  segmentTextOn: { fontWeight: fontWeight.semibold },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  stepperCtl: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 34, textAlign: 'center', fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  rowLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  rowHint: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
  yesNoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, flexWrap: 'wrap' },

  rupeeWrap: { width: '100%' },
  rupeeField: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, minHeight: 48 },
  rupeeSign: { fontSize: fontSize.md },
  rupeeInput: { flex: 1, fontSize: fontSize.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  rupeeUnit: { fontSize: fontSize.xs },

  optionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1.5, borderRadius: borderRadius.xl, padding: spacing.lg },
  optionIcon: { width: 40, height: 40, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  optionRadio: { marginTop: 1 },
  optionTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  optionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  optionHint: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
  miniBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  miniBadgeText: { fontSize: 10, fontWeight: fontWeight.semibold },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '88%',
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sheetSubtitle: { fontSize: fontSize.sm, marginTop: 2, lineHeight: 19 },
  sheetBody: { flexGrow: 0, flexShrink: 1 },
  sheetFooter: { paddingTop: spacing.md, gap: spacing.sm },

  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  choiceText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },

  selectWrap: { marginBottom: spacing.lg },
  selectField: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, minHeight: 48, gap: spacing.sm },
  selectCompact: { minHeight: 40, paddingHorizontal: spacing.md },
  selectText: { flex: 1, fontSize: fontSize.md },
  selectGroup: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.xs },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 48 },
  selectRowText: { fontSize: fontSize.md },

  infoRow: { paddingVertical: spacing.xs },
  infoLabel: { fontSize: fontSize.xs },
  infoValue: { fontSize: fontSize.sm, marginTop: 1, lineHeight: 19 },
});

export default Section;
