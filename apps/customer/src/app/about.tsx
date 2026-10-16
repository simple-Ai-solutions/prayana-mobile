// About — the app's version of the website's /about page: cinematic hero,
// stats, the story in four chapters, mission, journey timeline and values.
// Settings → About (/settings) renders this same screen.
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '@prayana/shared-ui';
import { InfoTopBar } from '../components/common/InfoTopBar';

type IconName = keyof typeof Ionicons.glyphMap;
type Grad = [string, string];

const TEAL = '#0d9488';
const HERO = 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80&fit=crop';
const CTA_IMG = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=80&fit=crop';

const STATS: Array<{ value: string; label: string; icon: IconName; g: Grad }> = [
  { value: '1M+', label: 'Destinations indexed', icon: 'globe-outline', g: ['#14b8a6', '#0891b2'] },
  { value: '200+', label: 'Travel partners', icon: 'people-outline', g: ['#8b5cf6', '#9333ea'] },
  { value: '10s', label: 'Trip planning time', icon: 'flash-outline', g: ['#f59e0b', '#ea580c'] },
  { value: '100%', label: 'AI-powered', icon: 'hardware-chip-outline', g: ['#f43f5e', '#db2777'] },
];

// **bold** spans are rendered in the heading colour.
const CHAPTERS: Array<{ n: string; title: string; icon: IconName; tint: string; paras: string[] }> = [
  {
    n: '01',
    title: 'The frustration that started it all',
    icon: 'rocket-outline',
    tint: '#f97316',
    paras: [
      "Every trip we'd ever planned looked the same: **30+ browser tabs**, half a dozen blogs, three flight apps, a hotel app, a maps app, a notes app, and somewhere in the middle a half-finished Google Doc trying to make sense of it all. By the time the trip started, we were exhausted before we'd even left home.",
      'Meanwhile, AI was quietly transforming everything else — writing our emails, debugging our code, summarizing our meetings. But trip planning? Still stuck in 2015. **That gap is where Prayana was born.**',
      'In July 2025, we started building. Not another listing aggregator, not another booking middleman — a true **AI travel companion** that does the heavy lifting end-to-end.',
    ],
  },
  {
    n: '02',
    title: 'Why we chose the name "Prayana"',
    icon: 'sparkles-outline',
    tint: '#8b5cf6',
    paras: [
      "**\"Prayana\" (प्रयाण)** means journey in Sanskrit — one of the world's oldest living languages. We picked it because travel was never about reaching the destination. It's about the messy, beautiful, in-between — the wrong turn that became the best meal of your life, the stranger who became a friend, the photograph you didn't plan but can't stop looking at.",
      "We're rooted in Bengaluru, India — a city where 1,500-year-old temples sit next to the world's busiest tech offices. That dual identity shapes how we build: **deeply local, unapologetically global**.",
    ],
  },
  {
    n: '03',
    title: "What we've shipped so far",
    icon: 'code-slash-outline',
    tint: '#059669',
    paras: [
      "We launched the public beta on **March 19, 2026**. Since then, we've been heads-down shipping. Not roadmap-slideshow shipping — actual production releases that travelers use today.",
      'Right now, you can **generate a complete trip itinerary in under 10 seconds**, discover the best food at every destination, and plan day-by-day with AI suggestions that learn from your preferences. Beyond planning, PrayanaAI is a full travel ecosystem: book **curated activities**, arrange **transport** for the whole trip, pick from **handcrafted holiday packages**, explore **global experiences** with partners like Headout, follow guided **Divya Darshan** spiritual journeys across India, and grab a **global eSIM data plan** before you fly. Real-time collaboration lets you plan trips together with friends — including a built-in trip chat.',
      'Under the hood: **1M+ destinations indexed**, AI itinerary generation with intelligent fallbacks, automated geocoding, smart image enrichment, Razorpay-powered checkout, and a marketplace that supports variants, time-slot pricing, and instant booking. We built this stack from scratch.',
    ],
  },
  {
    n: '04',
    title: "Where we're going",
    icon: 'trending-up',
    tint: '#f43f5e',
    paras: [
      "**Hotels are next on the roadmap** — the last big primitive of travel to land on PrayanaAI's stack, so a complete trip can be planned, booked, and paid for end-to-end in one place. After that: deeper integrations with airlines and rail, sharper personalization that learns from real trips, and an AI that doesn't just know where to go but when, how, and with whom.",
      'Our long-term bet is simple: **the best AI travel companion will replace the travel agent, the search engine, and the dozen apps you use today.** Not by being a chatbot bolted onto a search bar — but by being the product travelers reach for first, whether they\'re planning a weekend in Hampi, a Divya Darshan pilgrimage, or three months across Europe.',
      "Backed by **Simple AI Solutions Private Limited**, we're building the company we wished existed when we were planning our own trips. Try it, tell us what's broken, and help us shape what comes next.",
    ],
  },
];

const PILLARS: Array<{ title: string; desc: string; icon: IconName; g: Grad }> = [
  { title: 'AI that actually plans', icon: 'bulb-outline', g: ['#14b8a6', '#0891b2'], desc: 'Most trip apps give you search results. PrayanaAI gives you a complete day-by-day itinerary — with timing, transit, food, and hidden gems — in under 10 seconds.' },
  { title: 'One app, full journey', icon: 'layers-outline', g: ['#8b5cf6', '#9333ea'], desc: 'Plan the trip, book the activities, grab a global eSIM, and (soon) book your hotel — all without leaving PrayanaAI.' },
  { title: 'Built for real travelers', icon: 'compass-outline', g: ['#f59e0b', '#ea580c'], desc: 'Solo backpackers, families on a budget, friends chasing adventure — the AI adapts to how you actually travel.' },
  { title: 'Smarter every trip', icon: 'sparkles-outline', g: ['#f43f5e', '#db2777'], desc: 'Every plan, booking and review teaches the AI more about Indian and global travel. Your next trip is better than your last.' },
];

const JOURNEY: Array<{ when: string; title: string; desc: string; icon: IconName; highlight?: boolean }> = [
  { when: 'Jul 2025', title: 'The Spark', icon: 'rocket-outline', desc: 'PrayanaAI founded with a bold vision — to make travel planning effortless using AI' },
  { when: 'Nov 2025', title: 'Building in Stealth', icon: 'bulb-outline', desc: 'Platform development begins — AI-powered destination discovery, smart itinerary planner, and 1M+ destinations indexed' },
  { when: 'Mar 2026', title: 'Official Launch 🚀', icon: 'sparkles', highlight: true, desc: 'PrayanaAI went live on March 19th! AI-powered trip planning, instant itinerary generation, and best cuisine recommendations' },
  { when: 'May 2026', title: 'Full Travel Ecosystem Live', icon: 'phone-portrait-outline', desc: 'Activities marketplace, transport, holiday packages, global experiences, Divya Darshan spiritual journeys, and global eSIM data plans — all live in one app' },
  { when: 'Coming Soon', title: 'Hotels & Beyond', icon: 'trending-up', desc: 'Hotel bookings, plus airline & rail integrations and deeper AI personalization across every journey' },
];

const VALUES: Array<{ title: string; desc: string; icon: IconName; g: Grad }> = [
  { title: 'Innovation First', icon: 'bulb-outline', g: ['#14b8a6', '#06b6d4'], desc: 'Pushing boundaries with AI to create magical travel experiences' },
  { title: 'Traveler Obsessed', icon: 'heart-outline', g: ['#f43f5e', '#ec4899'], desc: "Every feature is built with our travelers' joy in mind" },
  { title: 'Trust & Safety', icon: 'shield-checkmark-outline', g: ['#3b82f6', '#6366f1'], desc: 'Your data privacy and security are our top priorities' },
  { title: 'Global Vision', icon: 'globe-outline', g: ['#8b5cf6', '#a855f7'], desc: 'Making world-class travel accessible to everyone, everywhere' },
  { title: 'Speed & Quality', icon: 'flash-outline', g: ['#f59e0b', '#f97316'], desc: 'Lightning-fast AI recommendations without compromising accuracy' },
  { title: 'Continuous Growth', icon: 'trending-up', g: ['#10b981', '#22c55e'], desc: 'Learning and evolving every day to serve you better' },
];

const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/id6786644292',
  android: 'https://play.google.com/store/apps/details?id=com.prayanaai.customer',
  default: 'https://prayanaai.com',
});

function Rich({ text, style, boldColor }: { text: string; style: any; boldColor: string }) {
  const parts = text.split('**');
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        i % 2 === 1 ? <Text key={i} style={{ fontWeight: '800', color: boldColor }}>{p}</Text> : p,
      )}
    </Text>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <Text style={s.eyebrow}>· {children} ·</Text>;
}

export default function AboutScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const { width } = useWindowDimensions();
  const half = (width - 16 * 2 - 12) / 2;
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const card = { backgroundColor: themeColors.surface, borderColor: line };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = String(
    (Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode) ?? '—',
  );

  const links: Array<{ label: string; icon: IconName; color: string; onPress: () => void }> = [
    { label: 'Legal & policies', icon: 'document-text-outline', color: '#3b82f6', onPress: () => router.push('/legal' as never) },
    { label: 'Help & support', icon: 'headset-outline', color: TEAL, onPress: () => router.push('/support' as never) },
    { label: 'Careers at Prayana', icon: 'briefcase-outline', color: '#8b5cf6', onPress: () => router.push('/careers' as never) },
    { label: 'Rate the app', icon: 'star-outline', color: '#f59e0b', onPress: () => { if (STORE_URL) Linking.openURL(STORE_URL).catch(() => {}); } },
  ];

  return (
    <View style={[s.safe, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <InfoTopBar floating />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ====== HERO ====== */}
        <View style={s.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} cachePolicy="memory-disk" />
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />
          <View style={s.heroBody}>
            <View style={s.heroPill}>
              <Ionicons name="sparkles" size={12} color="#fcd34d" />
              <Text style={s.heroPillText}>THE JOURNEY BEHIND PRAYANAAI</Text>
            </View>
            <Text style={s.heroTitle}>
              Travel,{'\n'}<Text style={{ color: '#fdba74' }}>reimagined.</Text>
            </Text>
            <Text style={s.heroSub}>
              We're building the AI travel companion we always wished existed — one that plans, books, and remembers, so you can focus on the journey itself.
            </Text>
          </View>
        </View>

        <View style={s.body}>
          {/* ====== OUR STORY ====== */}
          <View style={s.center}>
            <Eyebrow>OUR STORY</Eyebrow>
            <Text style={[s.h2, { color: themeColors.text }]}>
              We are <Text style={{ color: '#f97316' }}>PrayanaAI</Text>
            </Text>
            <Text style={[s.lead, { color: themeColors.textSecondary }]}>
              A small team of engineers from Bengaluru, building the AI travel companion we always wanted for ourselves.
            </Text>
          </View>

          {/* ====== STATS ====== */}
          <View style={s.grid}>
            {STATS.map((st) => (
              <View key={st.label} style={[s.statCard, card, { width: half }]}>
                <LinearGradient colors={st.g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconTile}>
                  <Ionicons name={st.icon} size={18} color="#fff" />
                </LinearGradient>
                <Text style={[s.statValue, { color: themeColors.text }]}>{st.value}</Text>
                <Text style={[s.statLabel, { color: themeColors.textSecondary }]}>{st.label}</Text>
              </View>
            ))}
          </View>

          {/* ====== CHAPTERS ====== */}
          {CHAPTERS.map((c) => (
            <View key={c.n} style={[s.chapter, card]}>
              <View style={s.chapterHead}>
                <Text style={[s.chapterNum, { color: c.tint }]}>{c.n}</Text>
                <View style={[s.chapterRule, { backgroundColor: c.tint }]} />
                <Ionicons name={c.icon} size={18} color={c.tint} />
              </View>
              <Text style={[s.h3, { color: themeColors.text }]}>{c.title}</Text>
              {c.paras.map((p, i) => (
                <Rich key={i} text={p} style={[s.para, { color: themeColors.textSecondary }]} boldColor={themeColors.text} />
              ))}
            </View>
          ))}

          {/* ====== PILLARS ====== */}
          <View style={[s.center, { marginTop: 12 }]}>
            <Eyebrow>THE DIFFERENCE</Eyebrow>
            <Text style={[s.h2, { color: themeColors.text }]}>
              What makes <Text style={{ color: TEAL }}>PrayanaAI</Text> different
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail} style={s.railWrap} decelerationRate="fast" snapToInterval={width * 0.72 + 12}>
            {PILLARS.map((p) => (
              <View key={p.title} style={[s.pillar, card, { width: width * 0.72 }]}>
                <LinearGradient colors={p.g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconTileLg}>
                  <Ionicons name={p.icon} size={22} color="#fff" />
                </LinearGradient>
                <Text style={[s.cardTitle, { color: themeColors.text }]}>{p.title}</Text>
                <Text style={[s.cardDesc, { color: themeColors.textSecondary }]}>{p.desc}</Text>
              </View>
            ))}
          </ScrollView>

          {/* ====== MISSION ====== */}
          <LinearGradient colors={['#111827', '#1f2937', '#7c2d12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.mission}>
            <View style={s.missionPill}>
              <Ionicons name="locate" size={12} color="#fdba74" />
              <Text style={s.missionPillText}>OUR MISSION</Text>
            </View>
            <Text style={s.missionTitle}>
              Make world-class travel feel <Text style={{ color: '#fdba74' }}>effortless</Text> for everyone.
            </Text>
            <Text style={s.missionText}>
              Travel should never feel like a second job. We're building the AI that does the heavy lifting — research, planning, booking, remembering — so every traveler can focus on the experience itself.
            </Text>
          </LinearGradient>

          {/* ====== JOURNEY ====== */}
          <View style={s.center}>
            <Eyebrow>OUR JOURNEY</Eyebrow>
            <Text style={[s.h2, { color: themeColors.text }]}>
              The <Text style={{ color: TEAL }}>PrayanaAI</Text> story
            </Text>
            <Text style={[s.lead, { color: themeColors.textSecondary }]}>
              From a Bengaluru garage idea to a full travel ecosystem in under a year.
            </Text>
          </View>
          <View style={s.timeline}>
            <View style={[s.timelineLine, { backgroundColor: isDarkMode ? 'rgba(45,212,191,0.25)' : '#99f6e4' }]} />
            {JOURNEY.map((j) => (
              <View key={j.when} style={s.tlRow}>
                <View style={[s.tlDot, j.highlight && s.tlDotHi]} />
                <View
                  style={[
                    s.tlCard,
                    card,
                    j.highlight && {
                      backgroundColor: isDarkMode ? 'rgba(249,115,22,0.12)' : '#fff7ed',
                      borderColor: isDarkMode ? 'rgba(249,115,22,0.35)' : '#fed7aa',
                    },
                  ]}
                >
                  <View style={[s.tlBadge, { backgroundColor: j.highlight ? 'rgba(249,115,22,0.12)' : isDarkMode ? 'rgba(20,184,166,0.14)' : '#f0fdfa' }]}>
                    <Ionicons name={j.icon} size={11} color={j.highlight ? '#f97316' : TEAL} />
                    <Text style={[s.tlBadgeText, { color: j.highlight ? '#f97316' : TEAL }]}>{j.when}</Text>
                  </View>
                  <Text style={[s.tlTitle, { color: themeColors.text }]}>{j.title}</Text>
                  <Text style={[s.cardDesc, { color: themeColors.textSecondary }]}>{j.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ====== VALUES ====== */}
          <View style={s.center}>
            <Eyebrow>WHAT DRIVES US</Eyebrow>
            <Text style={[s.h2, { color: themeColors.text }]}>
              The principles we <Text style={{ color: '#f43f5e' }}>live by</Text>
            </Text>
          </View>
          <View style={s.grid}>
            {VALUES.map((v) => (
              <View key={v.title} style={[s.valueCard, card, { width: half }]}>
                <LinearGradient colors={v.g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconTile}>
                  <Ionicons name={v.icon} size={18} color="#fff" />
                </LinearGradient>
                <Text style={[s.valueTitle, { color: themeColors.text }]}>{v.title}</Text>
                <Text style={[s.valueDesc, { color: themeColors.textSecondary }]}>{v.desc}</Text>
              </View>
            ))}
          </View>

          {/* ====== CTA ====== */}
          <View style={s.cta}>
            <Image source={{ uri: CTA_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} cachePolicy="memory-disk" />
            <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
            <View style={s.heroPill}>
              <Ionicons name="airplane" size={12} color="#fcd34d" />
              <Text style={s.heroPillText}>YOUR NEXT TRIP AWAITS</Text>
            </View>
            <Text style={s.ctaTitle}>
              Start planning the <Text style={{ color: '#fdba74' }}>journey of a lifetime.</Text>
            </Text>
            <Text style={s.ctaSub}>Generate a complete itinerary in seconds — free.</Text>
            <Pressable
              onPress={() => router.replace('/(tabs)' as never)}
              style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Text style={s.ctaBtnText}>Explore PrayanaAI</Text>
              <Ionicons name="arrow-forward" size={16} color="#111827" />
            </Pressable>
          </View>

          {/* ====== LINKS ====== */}
          <View style={[s.listCard, card]}>
            {links.map((l, i) => (
              <Pressable
                key={l.label}
                onPress={l.onPress}
                style={({ pressed }) => [s.linkRow, i < links.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line }, pressed && { opacity: 0.7 }]}
              >
                <View style={[s.linkIcon, { backgroundColor: l.color + (isDarkMode ? '26' : '14') }]}>
                  <Ionicons name={l.icon} size={18} color={l.color} />
                </View>
                <Text style={[s.linkLabel, { color: themeColors.text }]}>{l.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
              </Pressable>
            ))}
          </View>

          {/* ====== VERSION ====== */}
          <View style={[s.versionCard, card]}>
            {[
              { k: 'Version', v: version },
              { k: 'Build', v: build },
              { k: 'Platform', v: Platform.OS === 'ios' ? 'iOS' : 'Android' },
            ].map((row, i) => (
              <React.Fragment key={row.k}>
                {i > 0 && <View style={[s.versionDivider, { backgroundColor: line }]} />}
                <View style={s.versionCell}>
                  <Text style={[s.versionLabel, { color: themeColors.textTertiary }]}>{row.k}</Text>
                  <Text style={[s.versionValue, { color: themeColors.text }]}>{row.v}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <Text style={[s.copy, { color: themeColors.textTertiary }]}>
            {'©'} 2024–2026 Prayana AI. All rights reserved.{'\n'}Simple AI Solutions Pvt. Ltd. · Bengaluru
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  hero: { height: 460, justifyContent: 'flex-end', overflow: 'hidden' },
  heroBody: { paddingHorizontal: 20, paddingBottom: 32, alignItems: 'flex-start' },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', marginBottom: 14 },
  heroPillText: { color: 'rgba(255,255,255,0.92)', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { color: '#fff', fontSize: 46, lineHeight: 50, fontWeight: '900', letterSpacing: -1 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22, marginTop: 12 },
  body: { paddingHorizontal: 16, paddingTop: 28, gap: 16 },
  center: { alignItems: 'center', paddingHorizontal: 8, marginTop: 8 },
  eyebrow: { color: '#f97316', fontSize: 11.5, fontWeight: '800', letterSpacing: 2.4, marginBottom: 8 },
  h2: { fontSize: 28, lineHeight: 34, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  lead: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { borderWidth: 1, borderRadius: 20, padding: 16 },
  iconTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  iconTileLg: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  statValue: { fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  statLabel: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  chapter: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 10 },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chapterNum: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  chapterRule: { height: 2, width: 28, borderRadius: 1, opacity: 0.6 },
  h3: { fontSize: 20, lineHeight: 26, fontWeight: '900', letterSpacing: -0.3 },
  para: { fontSize: 14.5, lineHeight: 23 },
  railWrap: { marginHorizontal: -16 },
  rail: { paddingHorizontal: 16, gap: 12 },
  pillar: { borderWidth: 1, borderRadius: 22, padding: 18 },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  cardDesc: { fontSize: 13.5, lineHeight: 20 },
  mission: { borderRadius: 26, padding: 24, marginVertical: 8 },
  missionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 14 },
  missionPillText: { color: '#fdba74', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6 },
  missionTitle: { color: '#fff', fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.5 },
  missionText: { color: 'rgba(255,255,255,0.75)', fontSize: 14.5, lineHeight: 22, marginTop: 12 },
  timeline: { position: 'relative', paddingLeft: 26, gap: 12 },
  timelineLine: { position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, borderRadius: 1 },
  tlRow: { position: 'relative' },
  tlDot: { position: 'absolute', left: -24, top: 18, width: 12, height: 12, borderRadius: 6, backgroundColor: '#14b8a6', borderWidth: 2, borderColor: '#ccfbf1' },
  tlDotHi: { left: -26, width: 16, height: 16, borderRadius: 8, backgroundColor: '#f97316', borderColor: '#fed7aa' },
  tlCard: { borderWidth: 1, borderRadius: 16, padding: 14 },
  tlBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  tlBadgeText: { fontSize: 11, fontWeight: '800' },
  tlTitle: { fontSize: 15.5, fontWeight: '800', marginBottom: 4 },
  valueCard: { borderWidth: 1, borderRadius: 20, padding: 14 },
  valueTitle: { fontSize: 14.5, fontWeight: '800', marginBottom: 4 },
  valueDesc: { fontSize: 12.5, lineHeight: 18 },
  cta: { borderRadius: 26, overflow: 'hidden', padding: 22, paddingTop: 80, marginTop: 8, alignItems: 'flex-start' },
  ctaTitle: { color: '#fff', fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.5 },
  ctaSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 8 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 999, marginTop: 18 },
  ctaBtnText: { color: '#111827', fontSize: 15, fontWeight: '800' },
  listCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  linkIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  versionCard: { borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  versionCell: { flex: 1, alignItems: 'center' },
  versionDivider: { width: 1, height: 28 },
  versionLabel: { fontSize: 11.5, fontWeight: '600', marginBottom: 3 },
  versionValue: { fontSize: 15, fontWeight: '800' },
  copy: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
