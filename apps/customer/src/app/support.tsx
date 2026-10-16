// Support — the app's version of the website's /support page: contact
// channels, a searchable FAQ and quick links. Settings → Help Center renders
// this same screen.
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Linking,
  LayoutAnimation,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { InfoTopBar } from '../components/common/InfoTopBar';

type IconName = keyof typeof Ionicons.glyphMap;

const TEAL = '#0d9488';
const SUPPORT_EMAIL = 'simpleaisolutions@prayanaai.com';
const SUPPORT_PHONE = '+919449753920';

const CHANNELS: Array<{ title: string; desc: string; detail: string; sub: string; url: string; icon: IconName; g: [string, string] }> = [
  { title: 'Call us', desc: 'Talk to our support team', detail: '+91 94497 53920', sub: 'Mon–Sat, 9 AM – 8 PM IST', url: `tel:${SUPPORT_PHONE}`, icon: 'call', g: ['#4ade80', '#10b981'] },
  { title: 'WhatsApp', desc: 'Quick chat support', detail: '+91 94497 53920', sub: 'Instant replies, 9 AM – 10 PM', url: 'https://wa.me/919449753920?text=Hi%20Prayana%20AI%2C%20I%20need%20help%20with%20my%20booking', icon: 'logo-whatsapp', g: ['#34d399', '#14b8a6'] },
  { title: 'Email us', desc: 'We reply within 24 hours', detail: SUPPORT_EMAIL, sub: 'For detailed queries & complaints', url: `mailto:${SUPPORT_EMAIL}`, icon: 'mail', g: ['#60a5fa', '#6366f1'] },
];

interface FAQ { q: string; a: string }
const FAQ_CATEGORIES: Array<{ id: string; title: string; icon: IconName; faqs: FAQ[] }> = [
  {
    id: 'booking',
    title: 'Booking',
    icon: 'calendar-outline',
    faqs: [
      { q: 'How do I book an activity?', a: 'Browse Things to do, select an experience you like, choose your date and number of participants, then proceed to checkout. You can pay online via UPI, cards, or net banking.' },
      { q: 'Can I book for someone else?', a: 'Yes! During checkout, you can enter the participant details of the person who will be attending the activity. Just make sure to provide their correct contact information.' },
      { q: 'How far in advance should I book?', a: 'We recommend booking at least 24-48 hours in advance. Some popular activities may require earlier booking, especially during weekends and holidays.' },
      { q: 'What is instant confirmation?', a: "Activities marked with 'Instant Confirmation' are confirmed immediately after payment. No waiting needed — you'll receive your booking confirmation right away." },
    ],
  },
  {
    id: 'payment',
    title: 'Payments',
    icon: 'card-outline',
    faqs: [
      { q: 'What payment methods do you accept?', a: 'We accept UPI (Google Pay, PhonePe, Paytm), credit/debit cards (Visa, Mastercard, RuPay), net banking, and wallets through our secure Razorpay payment gateway.' },
      { q: 'Is my payment secure?', a: "Absolutely. All payments are processed through Razorpay's PCI DSS Level 1 certified payment gateway. We never store your card details on our servers." },
      { q: 'Are there any hidden charges?', a: 'No hidden charges. The price you see on the activity page is what you pay. All taxes and fees (if any) are clearly shown before checkout.' },
      { q: 'When will I get my refund?', a: 'Refunds are processed within 5-7 business days back to your original payment method. The exact timeline depends on your bank.' },
    ],
  },
  {
    id: 'cancellation',
    title: 'Cancellation',
    icon: 'shield-checkmark-outline',
    faqs: [
      { q: 'How do I cancel my booking?', a: "Go to 'My Bookings' in your profile, find the booking you want to cancel, and tap 'Cancel Booking'. The refund will be processed based on the activity's cancellation policy." },
      { q: 'What is the cancellation policy?', a: 'Each activity has its own cancellation policy — Flexible (free cancellation up to 24h before), Moderate (free up to 48h before), or Strict (50% refund up to 7 days before). Check the activity page for details.' },
      { q: 'Can I reschedule my booking?', a: "Yes, you can reschedule confirmed bookings to a different date (subject to availability). Go to 'My Bookings' and select 'Modify Booking'. Rescheduling must be done at least 48 hours before the activity." },
      { q: 'What if the activity gets cancelled by the operator?', a: "If an operator cancels, you'll receive a full refund automatically within 3-5 business days. We'll also notify you via email and SMS immediately." },
    ],
  },
  {
    id: 'activity',
    title: 'Activities',
    icon: 'location-outline',
    faqs: [
      { q: 'How do I find activities near me?', a: 'Search by city in Things to do, or use the category filters to browse by type — Adventure, Cultural, Food & Dining, Water Sports, and more.' },
      { q: 'Are the activities safe?', a: 'All activity operators on Prayana AI are verified and vetted. Adventure activities include certified instructors, safety equipment, and first aid kits. Safety details are listed on each activity page.' },
      { q: 'What should I bring to the activity?', a: "Each activity page has a 'What's Included' and 'What to Bring' section. Check the activity details before your visit. Generally, carry water, sunscreen, and wear comfortable clothing." },
      { q: 'Can I leave a review?', a: "Yes! After completing an activity, you'll receive an email to rate and review your experience. You can also leave a review from the 'My Bookings' page." },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    icon: 'person-circle-outline',
    faqs: [
      { q: 'How do I create an account?', a: 'Tap Sign in, then sign up with your email, Google account, or phone number. It takes less than a minute.' },
      { q: 'I forgot my password. How do I reset it?', a: "On the sign-in screen, tap 'Forgot Password'. Enter your registered email and we'll send a password reset link." },
      { q: 'How do I update my profile?', a: 'Open the Profile tab and tap Edit Profile. You can update your name, photo, phone number, and other details from there.' },
      { q: 'How do I delete my account?', a: `Please email us at ${SUPPORT_EMAIL} with your account deletion request. We'll process it within 48 hours. Note that this action is irreversible.` },
    ],
  },
];

const QUICK_LINKS: Array<{ title: string; desc: string; icon: IconName; route: string; color: string }> = [
  { title: 'My bookings', desc: 'View, manage, or cancel bookings', icon: 'receipt-outline', route: '/bookings', color: '#f97316' },
  { title: 'Things to do', desc: 'Explore experiences across India', icon: 'compass-outline', route: '/activities', color: TEAL },
  { title: 'Send feedback', desc: 'Help us improve Prayana AI', icon: 'chatbubble-ellipses-outline', route: '/profile/feedback', color: '#8b5cf6' },
];

function FAQRow({ faq, open, onToggle, last, line }: { faq: FAQ; open: boolean; onToggle: () => void; last: boolean; line: string }) {
  const { themeColors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={[s.faqRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <View style={s.faqHead}>
        <Text style={[s.faqQ, { color: open ? TEAL : themeColors.text }]}>{faq.q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={open ? TEAL : themeColors.textTertiary} />
      </View>
      {open ? <Text style={[s.faqA, { color: themeColors.textSecondary }]}>{faq.a}</Text> : null}
    </Pressable>
  );
}

export default function SupportScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const card = { backgroundColor: themeColors.surface, borderColor: line };
  const [category, setCategory] = useState(FAQ_CATEGORIES[0].id);
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) {
      const cat = FAQ_CATEGORIES.find((c) => c.id === category) ?? FAQ_CATEGORIES[0];
      return cat.faqs.map((faq) => ({ key: `${cat.id}:${faq.q}`, faq, cat: cat.title }));
    }
    return FAQ_CATEGORIES.flatMap((c) =>
      c.faqs
        .filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
        .map((faq) => ({ key: `${c.id}:${faq.q}`, faq, cat: c.title })),
    );
  }, [q, category]);

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKey((cur) => (cur === key ? null : key));
  };

  return (
    <View style={[s.safe, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <InfoTopBar title="Help & support" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
        {/* ====== HERO ====== */}
        <LinearGradient
          colors={isDarkMode ? ['#0f2e2b', '#16161E'] : ['#ecfdf5', '#f0fdfa']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.hero, { borderColor: line }]}
        >
          <LinearGradient colors={['#fb923c', '#fb7185']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroIcon}>
            <Ionicons name="headset" size={26} color="#fff" />
          </LinearGradient>
          <Text style={[s.heroTitle, { color: themeColors.text }]}>How can we help you?</Text>
          <Text style={[s.heroSub, { color: themeColors.textSecondary }]}>
            Find answers to common questions or reach out to our support team.
          </Text>
          <View style={[s.search, { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder }]}>
            <Ionicons name="search" size={17} color={themeColors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search refunds, cancellation, payments…"
              placeholderTextColor={themeColors.textTertiary}
              style={[s.searchInput, { color: themeColors.text }]}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={17} color={themeColors.textTertiary} />
              </Pressable>
            ) : null}
          </View>
        </LinearGradient>

        {/* ====== CONTACT ====== */}
        <Text style={[s.section, { color: themeColors.text }]}>Get in touch</Text>
        <View style={{ gap: 10 }}>
          {CHANNELS.map((c) => (
            <Pressable
              key={c.title}
              onPress={() => Linking.openURL(c.url).catch(() => {})}
              style={({ pressed }) => [s.channel, card, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel={`${c.title}: ${c.detail}`}
            >
              <LinearGradient colors={c.g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.channelIcon}>
                <Ionicons name={c.icon} size={21} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.channelTitle, { color: themeColors.text }]}>{c.title}</Text>
                <Text style={s.channelDetail} numberOfLines={1}>{c.detail}</Text>
                <Text style={[s.channelSub, { color: themeColors.textTertiary }]}>{c.desc} · {c.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </Pressable>
          ))}
        </View>

        {/* ====== FAQ ====== */}
        <Text style={[s.section, { color: themeColors.text }]}>Frequently asked questions</Text>
        {!q ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsWrap} contentContainerStyle={s.chips}>
            {FAQ_CATEGORIES.map((c) => {
              const active = c.id === category;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => { setCategory(c.id); setOpenKey(null); }}
                  style={[s.chip, active ? s.chipActive : { backgroundColor: themeColors.surface, borderColor: line }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={c.icon} size={14} color={active ? '#fff' : themeColors.textSecondary} />
                  <Text style={[s.chipText, { color: active ? '#fff' : themeColors.textSecondary }]}>{c.title}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={[s.resultCount, { color: themeColors.textTertiary }]}>
            {results.length} result{results.length === 1 ? '' : 's'} for "{query.trim()}"
          </Text>
        )}
        <View style={[s.faqCard, card]}>
          {results.length ? (
            results.map((r, i) => (
              <View key={r.key}>
                {q ? <Text style={s.faqCat}>{r.cat.toUpperCase()}</Text> : null}
                <FAQRow faq={r.faq} open={openKey === r.key} onToggle={() => toggle(r.key)} last={i === results.length - 1} line={line} />
              </View>
            ))
          ) : (
            <View style={s.empty}>
              <Ionicons name="help-buoy-outline" size={28} color={themeColors.textTertiary} />
              <Text style={[s.emptyText, { color: themeColors.textSecondary }]}>
                No answers match that. Call, WhatsApp or email us — a real person will help.
              </Text>
            </View>
          )}
        </View>

        {/* ====== QUICK LINKS ====== */}
        <Text style={[s.section, { color: themeColors.text }]}>Quick links</Text>
        <View style={[s.faqCard, card]}>
          {QUICK_LINKS.map((l, i) => (
            <Pressable
              key={l.title}
              onPress={() => router.push(l.route as never)}
              style={({ pressed }) => [s.linkRow, i < QUICK_LINKS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line }, pressed && { opacity: 0.7 }]}
            >
              <View style={[s.linkIcon, { backgroundColor: l.color + (isDarkMode ? '26' : '14') }]}>
                <Ionicons name={l.icon} size={18} color={l.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.linkTitle, { color: themeColors.text }]}>{l.title}</Text>
                <Text style={[s.linkDesc, { color: themeColors.textTertiary }]}>{l.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => router.push('/legal' as never)} style={s.legal} accessibilityRole="link">
          <Ionicons name="document-text-outline" size={16} color={TEAL} />
          <Text style={s.legalText}>Terms, privacy & policies</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: 16, paddingBottom: 40, gap: 12 },
  hero: { borderRadius: 24, borderWidth: 1, padding: 20, alignItems: 'center' },
  heroIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4 },
  heroSub: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, height: 46, marginTop: 16 },
  searchInput: { flex: 1, fontSize: 14.5, paddingVertical: 0 },
  section: { fontSize: 18, fontWeight: '900', marginTop: 10 },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  channelIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  channelTitle: { fontSize: 15.5, fontWeight: '800' },
  channelDetail: { fontSize: 14, fontWeight: '700', color: '#ea580c', marginTop: 2 },
  channelSub: { fontSize: 12, marginTop: 2 },
  chipsWrap: { marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  chipActive: { backgroundColor: TEAL, borderColor: TEAL },
  chipText: { fontSize: 13, fontWeight: '700' },
  resultCount: { fontSize: 12.5, fontWeight: '600' },
  faqCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  faqCat: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: TEAL, paddingHorizontal: 16, paddingTop: 12 },
  faqRow: { paddingHorizontal: 16, paddingVertical: 15 },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqQ: { flex: 1, fontSize: 14.5, fontWeight: '700', lineHeight: 20 },
  faqA: { fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  empty: { alignItems: 'center', gap: 8, padding: 24 },
  emptyText: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  linkIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { fontSize: 15, fontWeight: '700' },
  linkDesc: { fontSize: 12, marginTop: 1 },
  legal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  legalText: { color: TEAL, fontSize: 14, fontWeight: '700' },
});
