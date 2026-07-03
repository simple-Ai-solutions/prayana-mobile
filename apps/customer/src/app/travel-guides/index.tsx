// Travel Guides — curated day-by-day itinerary templates. Mirrors the PWA
// /travel-guides: grid of guide cards -> modal with day plan -> "Use This Itinerary".
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Clock, X, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { itineraryAPI } from '@prayana/shared-services';

const GUIDES = [
  {
    id: 'hampi', city: 'Hampi', title: 'Hampi Heritage Trail', spots: 8, duration: 3, emoji: '🏛️',
    tagline: 'Ancient ruins & boulder landscapes', tags: ['Heritage', 'Photography'],
    image: 'https://images.unsplash.com/photo-1600100397608-f010fbdb3a6a?w=800',
    days: [
      { title: 'Day 1 — Royal Center', activities: ['Virupaksha Temple', 'Hampi Bazaar', 'Hemakuta Hill sunset'] },
      { title: 'Day 2 — Sacred Center', activities: ['Vittala Temple & Stone Chariot', 'Lotus Mahal', 'Elephant Stables'] },
      { title: 'Day 3 — Across the River', activities: ['Anegundi village', 'Hanuman Temple', 'Coracle ride'] },
    ],
  },
  {
    id: 'goa', city: 'Goa', title: 'Goa Beaches & Vibes', spots: 10, duration: 5, emoji: '🏖️',
    tagline: 'Beaches, nightlife & Portuguese charm', tags: ['Beach', 'Nightlife'],
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800',
    days: [
      { title: 'Day 1 — North Goa', activities: ['Baga Beach', 'Tito\'s Lane', 'Calangute'] },
      { title: 'Day 2 — Heritage', activities: ['Old Goa churches', 'Fontainhas', 'Mandovi cruise'] },
      { title: 'Day 3 — South Goa', activities: ['Palolem Beach', 'Cabo de Rama', 'Butterfly Beach'] },
    ],
  },
  {
    id: 'shimla-manali', city: 'Shimla–Manali', title: 'Himalayan Hill Stations', spots: 12, duration: 6, emoji: '🏔️',
    tagline: 'Snow, valleys & mountain air', tags: ['Adventure', 'Nature'],
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800',
    days: [
      { title: 'Day 1-2 — Shimla', activities: ['The Ridge', 'Mall Road', 'Kufri', 'Jakhoo Temple'] },
      { title: 'Day 3-4 — Manali', activities: ['Solang Valley', 'Hadimba Temple', 'Old Manali'] },
      { title: 'Day 5-6 — Rohtang', activities: ['Rohtang Pass', 'Atal Tunnel', 'Sissu'] },
    ],
  },
  {
    id: 'varanasi', city: 'Varanasi', title: 'Spiritual Varanasi', spots: 7, duration: 3, emoji: '🕉️',
    tagline: 'Ghats, aartis & ancient lanes', tags: ['Spiritual', 'Culture'],
    image: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800',
    days: [
      { title: 'Day 1 — Ghats', activities: ['Dashashwamedh Ghat', 'Ganga Aarti', 'Boat ride'] },
      { title: 'Day 2 — Temples', activities: ['Kashi Vishwanath', 'Sarnath', 'BHU campus'] },
      { title: 'Day 3 — Lanes', activities: ['Sunrise boat ride', 'Silk weaving', 'Local food trail'] },
    ],
  },
  {
    id: 'coorg', city: 'Coorg', title: 'Coorg Coffee Country', spots: 6, duration: 3, emoji: '☕',
    tagline: 'Coffee estates & misty hills', tags: ['Nature', 'Relax'],
    image: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800',
    days: [
      { title: 'Day 1 — Madikeri', activities: ['Raja\'s Seat', 'Abbey Falls', 'Omkareshwara Temple'] },
      { title: 'Day 2 — Estates', activities: ['Coffee plantation tour', 'Dubare Elephant Camp', 'Cauvery Nisargadhama'] },
      { title: 'Day 3 — Nature', activities: ['Talacauvery', 'Mandalpatti viewpoint', 'Namdroling Monastery'] },
    ],
  },
];

export default function TravelGuidesScreen() {
  const { themeColors } = useTheme();
  const [selected, setSelected] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const useItinerary = useCallback(async (guide: any) => {
    setGenerating(true);
    try {
      const result: any = await itineraryAPI.generateMarkdown({
        destination: guide.city,
        duration: guide.duration,
        startingPoint: '',
        transportMode: 'mixed',
        preferences: { budget: 'moderate', interests: guide.tags, travelStyle: 'balanced', groupType: 'solo' },
      });
      const markdown = result?.content || result?.markdown || result?.data?.markdown || '';
      setSelected(null);
      router.push({
        pathname: '/trip/itinerary',
        params: { markdown, title: guide.title, destination: guide.city, duration: String(guide.duration), transportMode: 'mixed' },
      });
    } catch (e: any) {
      console.warn('[TravelGuides] generate failed:', e?.message);
    } finally {
      setGenerating(false);
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Travel Guides</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}>
        <Text style={[styles.intro, { color: themeColors.textSecondary }]}>
          Hand-crafted day-by-day plans for India’s most-loved destinations.
        </Text>
        {GUIDES.map((g) => (
          <TouchableOpacity key={g.id} activeOpacity={0.9} style={[styles.card, shadow.md]} onPress={() => setSelected(g)}>
            <Image source={{ uri: g.image }} style={styles.cardImg} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={styles.cardOverlay} />
            <View style={styles.cardContent}>
              <Text style={styles.cardEmoji}>{g.emoji}</Text>
              <Text style={styles.cardTitle}>{g.title}</Text>
              <Text style={styles.cardTagline}>{g.tagline}</Text>
              <View style={styles.cardMetaRow}>
                <View style={styles.metaItem}><MapPin size={12} color="#fff" /><Text style={styles.metaText}>{g.spots} spots</Text></View>
                <View style={styles.metaItem}><Clock size={12} color="#fff" /><Text style={styles.metaText}>{g.duration} days</Text></View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Guide detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]} numberOfLines={1}>{selected?.title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}><X size={24} color={themeColors.text} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {selected?.days.map((d: any, i: number) => (
                <View key={i} style={styles.dayBlock}>
                  <Text style={[styles.dayTitle, { color: colors.primary[600] }]}>{d.title}</Text>
                  {d.activities.map((a: string, j: number) => (
                    <View key={j} style={styles.activityRow}>
                      <View style={styles.bullet} />
                      <Text style={[styles.activityText, { color: themeColors.textSecondary }]}>{a}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.useBtn, { backgroundColor: colors.primary[500] }]}
              activeOpacity={0.9}
              disabled={generating}
              onPress={() => selected && useItinerary(selected)}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Sparkles size={18} color="#fff" />
              )}
              <Text style={styles.useBtnText}>{generating ? 'Generating…' : 'Use This Itinerary'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  intro: { fontSize: fontSize.sm, marginBottom: spacing.lg },
  card: { height: 200, marginBottom: spacing.lg, borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: colors.gray[200] },
  cardImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  cardOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '75%' },
  cardContent: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  cardEmoji: { fontSize: 28 },
  cardTitle: { color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: 4 },
  cardTagline: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.sm, marginTop: 2 },
  cardMetaRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing['2xl'] },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginRight: spacing.md },
  dayBlock: { marginBottom: spacing.lg },
  dayTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary[400] },
  activityText: { fontSize: fontSize.sm, flex: 1 },
  useBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.lg, borderRadius: borderRadius.lg, marginTop: spacing.md,
  },
  useBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
