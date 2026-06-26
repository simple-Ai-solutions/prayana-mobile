// Theme Itineraries — browse curated itinerary templates by theme, then
// instantly generate a full itinerary. Mirrors the PWA /theme-itineraries.
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Star, Sparkles, Heart, Mountain, Church, UtensilsCrossed, Waves, Landmark } from 'lucide-react-native';
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

// Curated theme collections (parity with PWA quickItinerariesEnhanced themes).
const THEMES = [
  {
    id: 'romantic', title: 'Romantic Getaways', Icon: Heart, color: '#EC4899',
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',
    items: [
      { name: 'Udaipur Romance', destination: 'Udaipur', days: 3, rating: 4.8, image: 'https://images.unsplash.com/photo-1609766857041-ed402ea8069a?w=600' },
      { name: 'Goa Honeymoon', destination: 'Goa', days: 4, rating: 4.7, image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600' },
    ],
  },
  {
    id: 'adventure', title: 'Adventure & Trekking', Icon: Mountain, color: '#F97316',
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
    items: [
      { name: 'Manali Adventure', destination: 'Manali', days: 5, rating: 4.9, image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=600' },
      { name: 'Ladakh Expedition', destination: 'Ladakh', days: 7, rating: 4.9, image: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=600' },
    ],
  },
  {
    id: 'spiritual', title: 'Spiritual Journeys', Icon: Church, color: '#8B5CF6',
    image: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800',
    items: [
      { name: 'Varanasi Pilgrimage', destination: 'Varanasi', days: 3, rating: 4.7, image: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=600' },
      { name: 'Rishikesh Retreat', destination: 'Rishikesh', days: 4, rating: 4.8, image: 'https://images.unsplash.com/photo-1591018533299-9c6a3a96d3e3?w=600' },
    ],
  },
  {
    id: 'food', title: 'Food & Culture', Icon: UtensilsCrossed, color: '#EF4444',
    image: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=800',
    items: [
      { name: 'Delhi Food Trail', destination: 'Delhi', days: 2, rating: 4.6, image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600' },
      { name: 'Lucknow Nawabi', destination: 'Lucknow', days: 3, rating: 4.7, image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600' },
    ],
  },
  {
    id: 'beach', title: 'Beach Escapes', Icon: Waves, color: '#06B6D4',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    items: [
      { name: 'Andaman Islands', destination: 'Andaman', days: 5, rating: 4.9, image: 'https://images.unsplash.com/photo-1589979481223-deb893043163?w=600' },
      { name: 'Goa Beaches', destination: 'Goa', days: 4, rating: 4.7, image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600' },
    ],
  },
  {
    id: 'heritage', title: 'Heritage & History', Icon: Landmark, color: '#D97706',
    image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800',
    items: [
      { name: 'Golden Triangle', destination: 'Delhi Agra Jaipur', days: 6, rating: 4.8, image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600' },
      { name: 'Hampi Heritage', destination: 'Hampi', days: 3, rating: 4.8, image: 'https://images.unsplash.com/photo-1600100397608-f010fbdb3a6a?w=600' },
    ],
  },
];

export default function ThemeItinerariesScreen() {
  const { themeColors } = useTheme();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const generate = useCallback(async (item: any) => {
    const id = `${item.destination}-${item.days}`;
    setGeneratingId(id);
    try {
      const result: any = await itineraryAPI.generateMarkdown({
        destination: item.destination,
        duration: item.days,
        startingPoint: '',
        transportMode: 'mixed',
        preferences: { budget: 'moderate', interests: [], travelStyle: 'balanced', groupType: 'couple' },
      });
      const markdown = result?.content || result?.markdown || result?.data?.markdown || '';
      router.push({
        pathname: '/trip/itinerary',
        params: {
          markdown,
          title: item.name,
          destination: item.destination,
          duration: String(item.days),
          transportMode: 'mixed',
        },
      });
    } catch (e: any) {
      console.warn('[ThemeItineraries] generate failed:', e?.message);
    } finally {
      setGeneratingId(null);
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Theme Itineraries</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing['3xl'] }}>
        {THEMES.map((theme) => {
          const ThemeIcon = theme.Icon;
          return (
            <View key={theme.id} style={{ marginTop: spacing.lg }}>
              <View style={styles.themeHeader}>
                <View style={[styles.themeIconWrap, { backgroundColor: theme.color + '22' }]}>
                  <ThemeIcon size={18} color={theme.color} />
                </View>
                <Text style={[styles.themeTitle, { color: themeColors.text }]}>{theme.title}</Text>
              </View>
              {theme.items.map((item) => {
                const id = `${item.destination}-${item.days}`;
                const isGen = generatingId === id;
                return (
                  <TouchableOpacity
                    key={item.name}
                    activeOpacity={0.9}
                    style={[styles.card, shadow.md]}
                    onPress={() => !isGen && generate(item)}
                  >
                    <Image source={{ uri: item.image }} style={styles.cardImg} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardOverlay} />
                    <View style={styles.ratingBadge}>
                      <Star size={11} color="#fbbf24" fill="#fbbf24" />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                    <View style={styles.cardContent}>
                      <Text style={styles.cardName}>{item.name}</Text>
                      <Text style={styles.cardMeta}>{item.destination} · {item.days} days</Text>
                      <View style={styles.exploreBtn}>
                        {isGen ? (
                          <>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={styles.exploreText}>Generating…</Text>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} color="#fff" />
                            <Text style={styles.exploreText}>Explore Now</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
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
  themeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  themeIconWrap: { width: 34, height: 34, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  themeTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  card: { height: 180, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: colors.gray[200] },
  cardImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  cardOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  ratingBadge: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full,
  },
  ratingText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  cardContent: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  cardName: { color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  cardMeta: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.sm, marginTop: 2 },
  exploreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: colors.primary[500], paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: borderRadius.full, marginTop: spacing.md,
  },
  exploreText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
