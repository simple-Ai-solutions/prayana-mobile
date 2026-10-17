// First screen of a new stay. Already listed elsewhere? Paste the link (or
// upload screenshots) and the server fills a draft from it; the wizard shows
// the import's progress. Or start from scratch: what kind of property is it?
// Two taps (group, then type) — the type picks the defaults the draft starts
// with on the server (a hostel starts with a dorm, a villa is rented whole, a
// resort has a pool …).

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { staysAPI } from './_components/api';
import { Button } from '../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme/vendorColors';
import { usePalette, ScreenHeader } from './_components/controls';
import { CATEGORIES, Category, apiError, typesIn } from './_components/stayConfig';
import { ImportListingCard } from './_components/ImportListing';

function TypeCard({
  type,
  selected,
  onSelect,
}: {
  type: ReturnType<typeof typesIn>[number];
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const p = usePalette();
  return (
    <TouchableOpacity
      onPress={() => onSelect(type.id)}
      activeOpacity={0.75}
      accessibilityRole="radio"
      accessibilityLabel={`${type.label}. ${type.hint}`}
      accessibilityState={{ checked: selected }}
      style={[
        styles.typeCard,
        { borderColor: p.c.border, backgroundColor: p.c.card },
        selected && { borderColor: colors.primary[500], backgroundColor: p.soft.blue.bg },
      ]}
    >
      <Ionicons name={type.icon} size={24} color={selected ? p.brand : p.c.textSecondary} />
      <Text style={[styles.typeLabel, { color: p.c.text }]}>{type.label}</Text>
      <Text style={[styles.typeHint, { color: p.c.textSecondary }]}>{type.hint}</Text>
    </TouchableOpacity>
  );
}

export default function NewStayScreen() {
  const router = useRouter();
  const p = usePalette();
  const [category, setCategory] = useState<Category | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Android back on the type list goes back to the groups first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (category) {
        setCategory(null);
        setType(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [category]);

  const back = () => {
    if (category) {
      setCategory(null);
      setType(null);
    } else if (router.canGoBack()) router.back();
    else router.replace('/stays');
  };

  const create = async () => {
    if (!type) return;
    setBusy(true);
    try {
      const res: any = await staysAPI.create(type);
      const id = res?.data?._id;
      if (!id) throw new Error(res?.message || "Couldn't start the listing");
      router.replace(`/stays/${id}`);
    } catch (e) {
      Toast.show({ type: 'error', text1: "Couldn't start the listing", text2: apiError(e, 'Try again.') });
      setBusy(false);
    }
  };

  const types = category ? typesIn(category) : [];
  const common = types.filter((t) => t.common);
  const others = types.filter((t) => !t.common);
  const group = CATEGORIES.find((c) => c.id === category);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.c.backgroundSecondary }]} edges={['top', 'bottom']}>
      <ScreenHeader title="List your property" onBack={back} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!category ? (
          <>
            <ImportListingCard onStarted={(s) => router.replace(`/stays/${s._id}`)} />
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: p.c.border }]} />
              <Text style={[styles.orText, { color: p.c.textTertiary }]}>Or start from scratch</Text>
              <View style={[styles.orLine, { backgroundColor: p.c.border }]} />
            </View>
            <Text style={[styles.lead, { color: p.c.textSecondary }]}>
              About 10 minutes. Everything saves as you go, so you can stop and come back.
            </Text>
            <Text style={[styles.question, { color: p.c.text }]} accessibilityRole="header">
              What kind of property is it?
            </Text>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategory(c.id)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${c.label}. ${c.hint}`}
                style={[styles.groupCard, { borderColor: p.c.border, backgroundColor: p.c.card }]}
              >
                <View style={[styles.groupIcon, { backgroundColor: p.soft.blue.bg }]}>
                  <Ionicons name={c.icon} size={24} color={p.soft.blue.fg} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.groupLabel, { color: p.c.text }]}>{c.label}</Text>
                  <Text style={[styles.groupHint, { color: p.c.textSecondary }]}>{c.hint}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={p.c.textTertiary} />
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <TouchableOpacity onPress={back} accessibilityRole="button" accessibilityLabel={`Back to groups. ${group?.label || ''}`} style={styles.crumb}>
              <Ionicons name="arrow-back" size={16} color={p.c.textSecondary} />
              <Text style={[styles.crumbText, { color: p.c.textSecondary }]}>{group?.label}</Text>
            </TouchableOpacity>
            <Text style={[styles.question, { color: p.c.text }]} accessibilityRole="header">
              Which one fits your place best?
            </Text>
            <Text style={[styles.groupHeading, { color: p.c.textTertiary }]}>MOST COMMON</Text>
            <View style={styles.grid} accessibilityRole="radiogroup">
              {common.map((t) => (
                <TypeCard key={t.id} type={t} selected={type === t.id} onSelect={setType} />
              ))}
            </View>
            {others.length > 0 ? (
              <>
                <Text style={[styles.groupHeading, { color: p.c.textTertiary }]}>OTHERS</Text>
                <View style={styles.grid} accessibilityRole="radiogroup">
                  {others.map((t) => (
                    <TypeCard key={t.id} type={t} selected={type === t.id} onSelect={setType} />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      {category ? (
        <View style={[styles.footer, { backgroundColor: p.c.surface, borderTopColor: p.c.border }]}>
          <Text style={[styles.footerHint, { color: p.c.textTertiary }]}>You can change this later.</Text>
          <Button title="Continue" onPress={create} disabled={!type} loading={busy} style={styles.footerBtn} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  lead: { fontSize: fontSize.sm, lineHeight: 19, marginBottom: spacing.lg },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, marginBottom: spacing.lg },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },
  question: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  groupCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md },
  groupIcon: { width: 48, height: 48, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  groupHint: { fontSize: fontSize.sm, marginTop: 2, lineHeight: 19 },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, minHeight: 32, alignSelf: 'flex-start' },
  crumbText: { fontSize: fontSize.sm },
  groupHeading: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: 0.5, marginTop: spacing.sm, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  typeCard: { flexBasis: '47%', flexGrow: 1, borderWidth: 1.5, borderRadius: borderRadius.xl, padding: spacing.md, gap: 6, minHeight: 120 },
  typeLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  typeHint: { fontSize: fontSize.xs, lineHeight: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1 },
  footerHint: { flex: 1, fontSize: fontSize.xs },
  footerBtn: { minWidth: 140 },
});
