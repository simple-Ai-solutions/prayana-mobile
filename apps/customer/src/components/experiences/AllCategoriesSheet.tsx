// AllCategoriesSheet — the mobile port of the web "All categories" slide-in
// panel (components/common/AllCategoriesMenu.jsx). Opens as a right slide-over,
// groups the Activities taxonomy into cards, offers a grid/list toggle, and
// routes each tile to /experiences/<slug> — the same category results screen the
// web tiles open. Coming-soon categories render disabled.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Dimensions, Pressable,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { CATEGORY_MENU_GROUPS, categorySlug } from '../../lib/categoryMenuData';

const TEAL = '#4AC0CC';
const { width: SCREEN_W } = Dimensions.get('window');
const PANEL_W = Math.min(SCREEN_W, 560);

type Props = { open: boolean; onClose: () => void };

export function AllCategoriesSheet({ open, onClose }: Props) {
  const { themeColors, isDarkMode } = useTheme();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const slide = useRef(new Animated.Value(PANEL_W)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      slide.setValue(PANEL_W);
      fade.setValue(0);
    }
  }, [open, slide, fade]);

  const close = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: PANEL_W, duration: 200, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onClose());
  };

  const go = (slug: string) => {
    close();
    // Let the close animation start before navigating.
    setTimeout(() => router.push(`/experiences/${slug}` as any), 120);
  };

  const cardBg = isDarkMode ? '#111827' : '#FFFFFF';
  const panelBg = isDarkMode ? '#030712' : '#F9FAFB';

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            { width: PANEL_W, backgroundColor: panelBg, transform: [{ translateX: slide }] },
          ]}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            {/* Header: close · title · grid/list toggle */}
            <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: themeColors.border }]}>
              <TouchableOpacity onPress={close} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={themeColors.text} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: themeColors.text }]}>All categories</Text>
              <View style={[styles.toggle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}>
                {(['grid', 'list'] as const).map((k) => {
                  const active = view === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      onPress={() => setView(k)}
                      style={[styles.toggleBtn, active && { backgroundColor: cardBg, ...styles.toggleActive }]}
                      accessibilityLabel={`${k} view`}
                    >
                      <Ionicons
                        name={k === 'grid' ? 'grid-outline' : 'list-outline'}
                        size={16}
                        color={active ? themeColors.text : themeColors.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {CATEGORY_MENU_GROUPS.map((group) => (
                <View key={group.key} style={[styles.group, { backgroundColor: cardBg }]}>
                  {/* Group header → group results page */}
                  <TouchableOpacity style={styles.groupHead} onPress={() => go(group.slug)} activeOpacity={0.7}>
                    <Ionicons name={group.icon as any} size={20} color={TEAL} />
                    <Text style={[styles.groupTitle, { color: themeColors.text }]}>{group.title}</Text>
                    <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
                  </TouchableOpacity>

                  {view === 'grid' ? (
                    <View style={styles.grid}>
                      {group.categories.map((cat) => {
                        const disabled = !!cat.comingSoon;
                        return (
                          <TouchableOpacity
                            key={cat.value}
                            style={styles.tile}
                            disabled={disabled}
                            onPress={() => go(cat.slug)}
                            activeOpacity={0.75}
                          >
                            <View
                              style={[
                                styles.tileIcon,
                                {
                                  backgroundColor: disabled
                                    ? isDarkMode ? 'rgba(255,255,255,0.06)' : '#F3F4F6'
                                    : `${cat.color}1A`,
                                },
                              ]}
                            >
                              <Ionicons
                                name={cat.icon as any}
                                size={24}
                                color={disabled ? themeColors.textTertiary : cat.color}
                              />
                            </View>
                            <Text
                              style={[styles.tileLabel, { color: disabled ? themeColors.textTertiary : themeColors.text }]}
                              numberOfLines={2}
                            >
                              {cat.label}
                            </Text>
                            {disabled && <Text style={styles.soon}>SOON</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View>
                      {group.categories.map((cat, idx) => {
                        const disabled = !!cat.comingSoon;
                        return (
                          <View key={cat.value}>
                            <TouchableOpacity
                              style={styles.row}
                              disabled={disabled}
                              onPress={() => go(cat.slug)}
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.rowIcon,
                                  {
                                    backgroundColor: disabled
                                      ? isDarkMode ? 'rgba(255,255,255,0.06)' : '#F3F4F6'
                                      : `${cat.color}1A`,
                                  },
                                ]}
                              >
                                <Ionicons name={cat.icon as any} size={18} color={disabled ? themeColors.textTertiary : cat.color} />
                              </View>
                              <Text style={[styles.rowLabel, { color: disabled ? themeColors.textTertiary : themeColors.text }]}>
                                {cat.label}
                              </Text>
                              {disabled ? (
                                <Text style={styles.rowSoon}>Coming soon</Text>
                              ) : (
                                <Ionicons name="chevron-forward" size={16} color={themeColors.textTertiary} style={{ marginLeft: 'auto' }} />
                              )}
                            </TouchableOpacity>
                            {idx < group.categories.length - 1 && (
                              <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}

              <Text style={[styles.footer, { color: themeColors.textTertiary }]}>
                Tours, tickets &amp; activities across 80+ countries
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: { position: 'absolute', top: 0, bottom: 0, right: 0, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: -6, height: 0 }, elevation: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  toggle: { flexDirection: 'row', borderRadius: 999, padding: 3, gap: 2 },
  toggleBtn: { width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },

  body: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing['2xl'] },
  group: { borderRadius: borderRadius.xl, padding: spacing.lg },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  groupTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '25%', alignItems: 'center', paddingVertical: spacing.sm, gap: 6 },
  tileIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 11, textAlign: 'center', fontWeight: fontWeight.medium, lineHeight: 14 },
  soon: { fontSize: 8, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  rowSoon: { marginLeft: 'auto', fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 48 },

  footer: { textAlign: 'center', fontSize: fontSize.xs, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
