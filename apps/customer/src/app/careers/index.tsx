// Careers — the app's version of the website's /careers page. Listings live
// in lib/careers.ts (ported from the web's OPENINGS).
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  LayoutAnimation,
  useWindowDimensions,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { makeAPICall } from '@prayana/shared-services';
import { InfoTopBar } from '../../components/common/InfoTopBar';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { isGuest } from '../../lib/guestSession';
import { CareerRole, OPENINGS, OPEN_APPLICATION, PERKS, PROCESS, TOTAL_OPENINGS } from '../../lib/careers';

type IconName = keyof typeof Ionicons.glyphMap;

const TEAL = '#0d9488';
const HERO = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&fit=crop';
const CTA_IMG = 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80&fit=crop';

function Bullets({ title, items, color }: { title: string; items?: string[]; color: string }) {
  const { themeColors } = useTheme();
  if (!items?.length) return null;
  return (
    <View style={{ gap: 7 }}>
      <Text style={[s.bulletHead, { color: themeColors.textTertiary }]}>{title.toUpperCase()}</Text>
      {items.map((it) => (
        <View key={it} style={s.bulletRow}>
          <View style={[s.bulletDot, { backgroundColor: color }]} />
          <Text style={[s.bulletText, { color: themeColors.textSecondary }]}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

export default function CareersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { themeColors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const signedIn = !isGuest(user);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [appCount, setAppCount] = useState(0);
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const card = { backgroundColor: themeColors.surface, borderColor: line };
  const half = (width - 16 * 2 - 12) / 2;

  // Only surface "My applications" once the user actually has one; refreshed
  // on focus so it appears right after a first application.
  useFocusEffect(
    useCallback(() => {
      if (!signedIn) {
        setAppCount(0);
        return;
      }
      let cancelled = false;
      makeAPICall('/careers/my-applications')
        .then((res: any) => {
          if (!cancelled && res?.success && Array.isArray(res.data)) setAppCount(res.data.length);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [signedIn]),
  );

  const apply = (role: CareerRole) => {
    if (!requireAuth({ title: 'Sign in to apply', reason: "It takes a minute, and it's the same account you use to explore Prayana.", redirectAfter: '/careers' })) return;
    router.push({ pathname: '/careers/apply', params: { role: role.slug } } as never);
  };

  const toggle = (slug: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((cur) => (cur === slug ? null : slug));
  };

  return (
    <View style={[s.safe, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <InfoTopBar floating />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ====== HERO ====== */}
        <View style={s.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} cachePolicy="memory-disk" />
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
          <View style={s.heroBody}>
            <View style={s.pill}>
              <Ionicons name="sparkles" size={12} color="#fcd34d" />
              <Text style={s.pillText}>WE'RE HIRING</Text>
            </View>
            <Text style={s.heroTitle}>
              Build the future of <Text style={{ color: '#5eead4' }}>Indian travel.</Text>
            </Text>
            <Text style={s.heroSub}>
              We're a small team building an AI travel platform used across India. If you want real ownership and work that ships in days, not quarters — we should talk.
            </Text>
          </View>
        </View>

        <View style={s.body}>
          {/* ====== OPEN ROLES ====== */}
          <View style={s.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.h2, { color: themeColors.text }]}>Open roles</Text>
              <Text style={[s.sub, { color: themeColors.textSecondary }]}>
                {TOTAL_OPENINGS} positions across {OPENINGS.length} roles, open right now.
              </Text>
            </View>
          </View>
          {signedIn && appCount > 0 ? (
            <Pressable
              onPress={() => router.push('/careers/my-applications' as never)}
              style={({ pressed }) => [s.myApps, card, pressed && { opacity: 0.8 }]}
            >
              <View style={[s.myAppsIcon, { backgroundColor: TEAL + (isDarkMode ? '26' : '14') }]}>
                <Ionicons name="documents-outline" size={18} color={TEAL} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.myAppsTitle, { color: themeColors.text }]}>My applications</Text>
                <Text style={[s.myAppsSub, { color: themeColors.textTertiary }]}>
                  {appCount} submitted · track status or withdraw
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </Pressable>
          ) : null}

          {OPENINGS.map((role) => {
            const open = expanded === role.slug;
            const g = role.gradient ?? ['#14b8a6', '#0891b2'];
            const chips: Array<{ icon: IconName; label?: string }> = [
              { icon: 'location-outline', label: role.location },
              { icon: 'time-outline', label: role.schedule },
              { icon: 'hourglass-outline', label: role.duration },
              { icon: 'cash-outline', label: role.compensation },
            ];
            return (
              <View key={role.slug} style={[s.role, card]}>
                <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.roleAccent} />
                <View style={s.roleHead}>
                  <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.roleIcon}>
                    <Ionicons name={role.icon ?? 'briefcase'} size={20} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.roleTitle, { color: themeColors.text }]}>{role.title}</Text>
                    <Text style={[s.roleMeta, { color: themeColors.textTertiary }]}>
                      {role.team} · {role.type}{role.openings ? ` · ${role.openings} openings` : ''}
                    </Text>
                  </View>
                </View>
                <Text style={[s.blurb, { color: themeColors.textSecondary }]}>{role.blurb}</Text>
                <View style={s.chips}>
                  {chips.filter((c) => c.label).map((c) => (
                    <View key={c.label} style={[s.chip, { backgroundColor: themeColors.inputBackground, borderColor: line }]}>
                      <Ionicons name={c.icon} size={12} color={themeColors.textTertiary} />
                      <Text style={[s.chipText, { color: themeColors.textSecondary }]}>{c.label}</Text>
                    </View>
                  ))}
                </View>

                {open ? (
                  <View style={s.details}>
                    <Bullets title="What you'll do" items={role.responsibilities} color={g[0]} />
                    <Bullets title="What we're looking for" items={role.requirements} color={g[0]} />
                    <Bullets title="Nice to have" items={role.niceToHave} color={g[0]} />
                    {role.compensationNote ? (
                      <View style={[s.comp, { backgroundColor: isDarkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb', borderColor: isDarkMode ? 'rgba(245,158,11,0.25)' : '#fde68a' }]}>
                        <View style={s.compIcon}>
                          <Ionicons name="cash" size={14} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.compTitle, { color: themeColors.text }]}>{role.compensation}</Text>
                          <Text style={[s.compText, { color: themeColors.textSecondary }]}>{role.compensationNote}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={s.roleActions}>
                  <Pressable onPress={() => toggle(role.slug)} style={[s.ghostBtn, { borderColor: line }]} accessibilityRole="button">
                    <Text style={[s.ghostText, { color: themeColors.text }]}>{open ? 'Hide details' : 'View details'}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={themeColors.text} />
                  </Pressable>
                  <Pressable onPress={() => apply(role)} style={({ pressed }) => [s.applyBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                    <Text style={s.applyText}>Apply now</Text>
                    <Ionicons name="arrow-forward" size={15} color="#fff" />
                  </Pressable>
                </View>
              </View>
            );
          })}

          {/* ====== OPEN APPLICATION ====== */}
          <View style={[s.openApp, { borderColor: isDarkMode ? '#33333F' : '#d4d4d4', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#fafafa' }]}>
            <LinearGradient colors={['#fb7185', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.openIcon}>
              <Ionicons name="heart" size={20} color="#fff" />
            </LinearGradient>
            <Text style={[s.openTitle, { color: themeColors.text }]}>Don't see your role?</Text>
            <Text style={[s.openText, { color: themeColors.textSecondary }]}>
              We're always open to hearing from exceptional people — engineers, designers, marketers, operators. Tell us what you'd want to build here.
            </Text>
            <Pressable
              onPress={() => apply(OPEN_APPLICATION)}
              style={({ pressed }) => [s.darkBtn, { backgroundColor: isDarkMode ? '#fff' : '#111827' }, pressed && { opacity: 0.85 }]}
            >
              <Text style={[s.darkBtnText, { color: isDarkMode ? '#111827' : '#fff' }]}>Send an open application</Text>
              <Ionicons name="arrow-forward" size={15} color={isDarkMode ? '#111827' : '#fff'} />
            </Pressable>
          </View>

          {/* ====== PERKS ====== */}
          <Text style={[s.h2, { color: themeColors.text, marginTop: 12 }]}>Why work with us</Text>
          <Text style={[s.sub, { color: themeColors.textSecondary }]}>
            We're early. That means less process, more ownership, and your work in front of real travellers within days.
          </Text>
          <View style={s.grid}>
            {PERKS.map((p) => (
              <View key={p.title} style={[s.perk, card, { width: half }]}>
                <LinearGradient colors={p.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.perkIcon}>
                  <Ionicons name={p.icon} size={18} color="#fff" />
                </LinearGradient>
                <Text style={[s.perkTitle, { color: themeColors.text }]}>{p.title}</Text>
                <Text style={[s.perkDesc, { color: themeColors.textSecondary }]}>{p.desc}</Text>
              </View>
            ))}
          </View>

          {/* ====== PROCESS ====== */}
          <Text style={[s.h2, { color: themeColors.text, marginTop: 12 }]}>How hiring works</Text>
          <Text style={[s.sub, { color: themeColors.textSecondary }]}>
            Four steps, about a week end to end. No ghosting — you'll hear back either way.
          </Text>
          <View style={[s.processCard, card]}>
            {PROCESS.map((p, i) => (
              <View key={p.step} style={s.step}>
                <View style={s.stepRail}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>{p.step}</Text>
                  </View>
                  {i < PROCESS.length - 1 ? <View style={[s.stepLine, { backgroundColor: line }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: i < PROCESS.length - 1 ? 18 : 0 }}>
                  <View style={s.stepHead}>
                    <Ionicons name={p.icon} size={15} color={TEAL} />
                    <Text style={[s.stepTitle, { color: themeColors.text }]}>{p.title}</Text>
                  </View>
                  <Text style={[s.stepDesc, { color: themeColors.textSecondary }]}>{p.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ====== CTA ====== */}
          <View style={s.cta}>
            <Image source={{ uri: CTA_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} cachePolicy="memory-disk" />
            <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
            <View style={s.pill}>
              <Ionicons name="flash" size={12} color="#fcd34d" />
              <Text style={s.pillText}>JOIN THE JOURNEY</Text>
            </View>
            <Text style={s.ctaTitle}>
              Come build something <Text style={{ color: '#5eead4' }}>people actually use.</Text>
            </Text>
            <Text style={s.ctaSub}>Curious about the team and where we're headed? Read our story first.</Text>
            <Pressable onPress={() => router.push('/about' as never)} style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.85 }]}>
              <Text style={s.ctaBtnText}>About Prayana</Text>
              <Ionicons name="arrow-forward" size={15} color="#111827" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  hero: { height: 420, justifyContent: 'flex-end', overflow: 'hidden' },
  heroBody: { paddingHorizontal: 20, paddingBottom: 28, alignItems: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', marginBottom: 14 },
  pillText: { color: 'rgba(255,255,255,0.92)', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { color: '#fff', fontSize: 36, lineHeight: 41, fontWeight: '900', letterSpacing: -0.8 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14.5, lineHeight: 21, marginTop: 12 },
  body: { paddingHorizontal: 16, paddingTop: 24, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'flex-end' },
  h2: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  myApps: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12 },
  myAppsIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  myAppsTitle: { fontSize: 15, fontWeight: '800' },
  myAppsSub: { fontSize: 12, marginTop: 1 },
  role: { borderWidth: 1, borderRadius: 22, padding: 16, paddingTop: 20, overflow: 'hidden', gap: 12 },
  roleAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  roleHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  roleMeta: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  blurb: { fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  details: { gap: 16, paddingTop: 4 },
  bulletHead: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  comp: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14 },
  compIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  compTitle: { fontSize: 14, fontWeight: '800' },
  compText: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  roleActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  ghostBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 12 },
  ghostText: { fontSize: 14, fontWeight: '700' },
  applyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 12 },
  applyText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  openApp: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 22, padding: 20, alignItems: 'center' },
  openIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  openTitle: { fontSize: 19, fontWeight: '900' },
  openText: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  darkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, marginTop: 14 },
  darkBtnText: { fontSize: 14, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  perk: { borderWidth: 1, borderRadius: 18, padding: 14 },
  perkIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  perkTitle: { fontSize: 14.5, fontWeight: '800', marginBottom: 4 },
  perkDesc: { fontSize: 12.5, lineHeight: 18 },
  processCard: { borderWidth: 1, borderRadius: 20, padding: 16 },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center' },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  stepLine: { flex: 1, width: 2, marginTop: 4 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  stepTitle: { fontSize: 15, fontWeight: '800' },
  stepDesc: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  cta: { borderRadius: 26, overflow: 'hidden', padding: 22, paddingTop: 70, marginTop: 8, alignItems: 'flex-start' },
  ctaTitle: { color: '#fff', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5 },
  ctaSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20, marginTop: 8 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 999, marginTop: 18 },
  ctaBtnText: { color: '#111827', fontSize: 15, fontWeight: '800' },
});
