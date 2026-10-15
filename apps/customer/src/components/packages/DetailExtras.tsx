// Package-detail pieces ported from the web's PackageDetailClient and
// components/packages/detail, sized for a phone:
//   DarshanaStrip  — DarshanaThemeBanner: back to Divya Darshana + Yatra Expert
//   DayPills       — DayPillsNav: jump straight to a day
//   TransferRow    — TransferCard: how you get from A to B that day
//   GoodToKnowCard — the operator's practical notes, important ones first
//   FaqCard        — lib/packageFaq, answered from the package's own fields
//   ReviewsCard    — star breakdown and the review cards themselves
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card, StarRating, spacing, fontSize, fontWeight, useTheme } from '@prayana/shared-ui';
import type { FaqItem } from '../../lib/packageFaq';

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const BLUE = '#2563eb';
export const YATRA_EXPERT_PHONE = '+919449753920';

/** The blue accent bar + title every section on this page starts with. */
function SectionHead({ title, sub, icon }: { title: string; sub?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { themeColors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={s.headRow}>
        {icon ? <Ionicons name={icon} size={16} color={BLUE} /> : <View style={s.accent} />}
        <Text style={[s.headTitle, { color: themeColors.text }]}>{title}</Text>
      </View>
      {!!sub && <Text style={[s.headSub, { color: themeColors.textSecondary }]}>{sub}</Text>}
    </View>
  );
}

// ─── Divya Darshana strip ────────────────────────────────────────────────

export function DarshanaStrip({ topInset, onBack }: { topInset: number; onBack: () => void }) {
  return (
    <LinearGradient
      colors={['#7A1F0A', '#B8410E', '#FF6F00']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[s.strip, { paddingTop: topInset + 8 }]}
    >
      <Pressable onPress={onBack} hitSlop={10} style={s.stripBack} accessibilityRole="button" accessibilityLabel="Back to Divya Darshana">
        <Ionicons name="chevron-back" size={20} color="#fff" />
        <View>
          <Text style={s.stripTitle}>Divya Darshana</Text>
          <Text style={s.stripSub}>BY PRAYANA AI</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => Linking.openURL(`tel:${YATRA_EXPERT_PHONE}`)}
        style={({ pressed }) => [s.stripCall, pressed && { backgroundColor: 'rgba(212,175,55,0.35)' }]}
        accessibilityRole="button"
        accessibilityLabel="Call a Yatra Expert"
      >
        <Ionicons name="call" size={13} color="#D4AF37" />
        <Text style={s.stripCallText}>Yatra Expert</Text>
      </Pressable>
    </LinearGradient>
  );
}

// ─── Day pills ───────────────────────────────────────────────────────────

export function DayPills({ days, active, onPick }: {
  days: { label: string; title?: string }[]; active: number; onPick: (i: number) => void;
}) {
  const { themeColors } = useTheme();
  if (days.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pills} style={{ marginBottom: spacing.sm }}>
      {days.map((d, i) => {
        const on = i === active;
        return (
          <Pressable
            key={i}
            onPress={() => onPick(i)}
            style={[s.pill, on ? s.pillOn : { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${d.label}${d.title ? `, ${d.title}` : ''}`}
          >
            <Text style={[s.pillText, { color: on ? '#fff' : themeColors.text }]}>{d.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Transfer ────────────────────────────────────────────────────────────

const MODE: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  car: { icon: 'car-outline', label: 'Private Vehicle' },
  bus: { icon: 'bus-outline', label: 'AC Bus' },
  flight: { icon: 'airplane-outline', label: 'Flight' },
  train: { icon: 'train-outline', label: 'Train' },
  ferry: { icon: 'boat-outline', label: 'Ferry' },
  self: { icon: 'walk-outline', label: 'Self-arranged' },
};

export function TransferRow({ transport }: { transport: any }) {
  const { themeColors } = useTheme();
  if (!transport?.mode) return null;
  const m = MODE[transport.mode] || { icon: 'car-outline' as const, label: transport.mode };
  return (
    <View style={[s.transfer, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
      <View style={s.transferIcon}>
        <Ionicons name={m.icon} size={18} color="#7c3aed" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.transferMode, { color: themeColors.text }]}>{m.label}</Text>
        {!!transport.description && (
          <Text style={[s.small, { color: themeColors.textSecondary }]}>{transport.description}</Text>
        )}
        {(transport.fromLocation || transport.toLocation) && (
          <View style={s.routeRow}>
            <Text style={[s.small, s.bold, { color: themeColors.text }]} numberOfLines={1}>{transport.fromLocation}</Text>
            <Ionicons name="arrow-forward" size={12} color={themeColors.textTertiary} />
            <Text style={[s.small, s.bold, { color: themeColors.text, flexShrink: 1 }]} numberOfLines={1}>{transport.toLocation}</Text>
            {!!transport.estimatedDuration && (
              <Text style={[s.small, { color: themeColors.textTertiary }]}>· {transport.estimatedDuration}</Text>
            )}
          </View>
        )}
        {transport.isIncluded === false && <Text style={s.notIncluded}>Not included in package price</Text>}
      </View>
    </View>
  );
}

/** The operator's note for a day, in a soft tinted box. */
export function DayNote({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <View style={s.note}>
      <Ionicons name="information-circle-outline" size={15} color="#0369a1" />
      <Text style={s.noteText}>{text}</Text>
    </View>
  );
}

// ─── Good to know ────────────────────────────────────────────────────────

export function GoodToKnowCard({ items, cardStyle }: { items: any[]; cardStyle: any }) {
  const { themeColors } = useTheme();
  if (!items?.length) return null;
  const sorted = [...items].sort((a, b) => (b.isImportant ? 1 : 0) - (a.isImportant ? 1 : 0));
  return (
    <Card style={cardStyle}>
      <SectionHead title="Good to know" sub="Practical notes from the operator before you book" />
      <View style={{ gap: 8 }}>
        {sorted.map((g, i) => (
          <View
            key={g._id || i}
            style={[s.gtk, g.isImportant ? s.gtkImportant : { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
          >
            <View style={s.gtkHead}>
              {g.isImportant && <Ionicons name="alert-circle" size={14} color="#b45309" />}
              <Text style={[s.gtkTitle, { color: g.isImportant ? '#78350f' : themeColors.text }]}>{g.title}</Text>
            </View>
            <Text style={[s.small, s.lh, { color: themeColors.textSecondary }]}>{g.detail}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────

export function FaqCard({ items, cardStyle }: { items: FaqItem[]; cardStyle: any }) {
  const { themeColors } = useTheme();
  const [open, setOpen] = useState<number | null>(0);
  if (!items.length) return null;
  return (
    <Card style={cardStyle}>
      <SectionHead title="Frequently asked questions" sub="Answered from this package's own details" />
      {items.map((f, i) => {
        const on = open === i;
        return (
          <View key={f.q} style={[s.faq, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: themeColors.border }]}>
            <Pressable
              onPress={() => setOpen(on ? null : i)}
              style={s.faqQ}
              accessibilityRole="button"
              accessibilityState={{ expanded: on }}
            >
              <Text style={[s.faqQText, { color: on ? BLUE : themeColors.text }]}>{f.q}</Text>
              <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={16} color={themeColors.textTertiary} />
            </Pressable>
            {on && <Text style={[s.small, s.lh, s.faqA, { color: themeColors.textSecondary }]}>{f.a}</Text>}
          </View>
        );
      })}
    </Card>
  );
}

// ─── Reviews ─────────────────────────────────────────────────────────────

const ago = (iso?: string) => {
  if (!iso) return '';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
};

export function ReviewsCard({ rating, reviews, cardStyle }: {
  rating?: any; reviews: any[]; cardStyle: any;
}) {
  const { themeColors } = useTheme();
  const count = rating?.count || 0;
  const dist = rating?.distribution || {};
  const bars = [
    { l: '5', c: dist.five || 0 }, { l: '4', c: dist.four || 0 }, { l: '3', c: dist.three || 0 },
    { l: '2', c: dist.two || 0 }, { l: '1', c: dist.one || 0 },
  ];
  return (
    <Card style={cardStyle}>
      <SectionHead title="Traveller reviews" icon="star" />
      {count > 0 ? (
        <>
          <View style={[s.summary, { borderColor: themeColors.border }]}>
            <View style={s.avgCol}>
              <Text style={[s.avg, { color: themeColors.text }]}>{Number(rating.average || 0).toFixed(1)}</Text>
              <StarRating rating={rating.average || 0} size={12} />
              <Text style={[s.tiny, { color: themeColors.textSecondary }]}>{count} review{count === 1 ? '' : 's'}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {bars.map((b) => (
                <View key={b.l} style={s.barRow}>
                  <Text style={[s.tiny, s.bold, { color: themeColors.text, width: 10 }]}>{b.l}</Text>
                  <Ionicons name="star" size={9} color="#fbbf24" />
                  <View style={[s.track, { backgroundColor: themeColors.border }]}>
                    <View style={[s.fill, { width: `${(b.c / count) * 100}%` }]} />
                  </View>
                  <Text style={[s.tiny, { color: themeColors.textSecondary, width: 20, textAlign: 'right' }]}>{b.c}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ gap: 8, marginTop: spacing.md }}>
            {reviews.map((r, i) => {
              const who = r.reviewer?.name || 'Traveller';
              return (
                <View key={r._id || i} style={[s.review, { borderColor: themeColors.border }]}>
                  <View style={s.reviewHead}>
                    <LinearGradient colors={['#3b82f6', '#4f46e5']} style={s.avatar}>
                      <Text style={s.avatarText}>{who[0]?.toUpperCase()}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.small, s.bold, { color: themeColors.text }]}>{who}</Text>
                      <StarRating rating={r.rating || 0} size={10} />
                    </View>
                    <Text style={[s.tiny, { color: themeColors.textTertiary }]}>{ago(r.createdAt)}</Text>
                  </View>
                  {!!r.content && <Text style={[s.small, s.lh, { color: themeColors.textSecondary }]}>{r.content}</Text>}
                  {/* A review of the operator elsewhere is not a verified
                      Prayana booking, and saying so keeps it honest. */}
                  <Text style={[s.tiny, { color: themeColors.textTertiary, marginTop: 6 }]}>
                    {r.isVerifiedBooking ? 'Verified Prayana booking' : 'Review of the tour operator'}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={s.empty}>
          <Ionicons name="star-outline" size={26} color={themeColors.textTertiary} />
          <Text style={[s.small, { color: themeColors.textSecondary, textAlign: 'center' }]}>
            No reviews yet. Be the first to review after your trip!
          </Text>
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accent: { width: 4, height: 20, borderRadius: 2, backgroundColor: '#3b82f6' },
  headTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  headSub: { fontSize: 12, marginTop: 2, marginLeft: 12 },
  small: { fontSize: 13 },
  tiny: { fontSize: 11 },
  bold: { fontWeight: '600' },
  lh: { lineHeight: 19 },

  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 },
  stripBack: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stripTitle: { color: '#fff', fontFamily: SERIF, fontWeight: '700', fontSize: 16, lineHeight: 19 },
  stripSub: { color: '#D4AF37', fontSize: 8, fontWeight: '800', letterSpacing: 2.4 },
  stripCall: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(212,175,55,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
  },
  stripCallText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  pills: { gap: 8, paddingRight: 4 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  pillOn: { backgroundColor: BLUE, borderColor: BLUE },
  pillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },

  transfer: { marginTop: 10, flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  transferIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' },
  transferMode: { fontSize: 13, fontWeight: '700' },
  routeRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  notIncluded: { marginTop: 4, fontSize: 11, color: '#d97706' },
  note: { marginTop: 10, flexDirection: 'row', gap: 6, borderRadius: 10, padding: 10, backgroundColor: '#f0f9ff' },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#0c4a6e' },

  gtk: { borderWidth: 1, borderRadius: 12, padding: 12 },
  gtkImportant: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  gtkHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  gtkTitle: { flex: 1, fontSize: 13, fontWeight: '700' },

  faq: { paddingVertical: 2 },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  faqQText: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  faqA: { paddingBottom: 12 },

  summary: { flexDirection: 'row', gap: 14, borderWidth: 1, borderRadius: 12, padding: 12 },
  avgCol: { alignItems: 'center', justifyContent: 'center', paddingRight: 4, gap: 2 },
  avg: { fontSize: 30, fontWeight: '800' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#f59e0b' },
  review: { borderWidth: 1, borderRadius: 12, padding: 12 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 18 },
});
