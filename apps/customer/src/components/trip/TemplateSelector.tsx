import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';
import { RAIL_GAP, RAIL_PAD, TWO_UP_W, usePairSnap } from '../../lib/railLayout';
import { useCreateTripStore } from '@prayana/shared-stores';
import { TRIP_TEMPLATES, TripTemplate } from '../../data/tripTemplates';

const TemplateSelector: React.FC = () => {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const snap = usePairSnap(2 * (TWO_UP_W + RAIL_GAP));

  const handleSelectTemplate = useCallback(
    (template: TripTemplate) => {
      const store = useCreateTripStore.getState();
      store.resetTrip();

      // Set basic trip info
      store.setName(template.name);
      store.setBudget(template.budget);
      store.setTripType(template.tripType);

      // Build destinations and days data
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + template.durationDays - 1);

      const destinations = [
        {
          name: template.destination,
          duration: template.durationDays,
          order: 0,
        },
      ];

      const days = template.days.map((day, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() + index);

        return {
          dayNumber: day.dayNumber,
          title: day.title,
          date: date.toISOString().split('T')[0],
          activities: day.activities.map((act, actIdx) => ({
            activityId: `template-${template.id}-d${index}-${actIdx}`,
            name: act.name,
            description: act.description,
            timeSlot: act.timeSlot,
            duration: act.duration,
            rating: act.rating,
            category: act.category,
            coordinates: { lat: 0, lng: 0 },
            image: '',
            notes: '',
            order: actIdx,
          })),
        };
      });

      // Set all data directly via setState
      useCreateTripStore.setState({
        destinations,
        days,
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        hasUnsavedChanges: true,
      });

      // Navigate directly to planner (skip setup/destinations since pre-filled)
      store.setCurrentStep(3);
      router.push('/trip/planner');
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Ready-made itineraries</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>Day-by-day plans you can edit</Text>
        </View>
      </View>

      {/* Two whole cards across, moved a pair at a time. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        ref={snap.setRef}
        {...snap.props}
      >
        {TRIP_TEMPLATES.map((template) => {
          const activities = template.days.reduce((n, d) => n + d.activities.length, 0);
          const photo = TEMPLATE_PHOTOS[template.id];
          return (
            <Pressable
              key={template.id}
              style={({ pressed }) => [styles.card, { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }, pressed && { transform: [{ scale: 0.98 }] }]}
              onPress={() => handleSelectTemplate(template)}
              accessibilityRole="button"
              accessibilityLabel={`${template.name}, ${template.duration}`}
            >
              <View style={styles.photo}>
                <LinearGradient colors={template.gradient} style={StyleSheet.absoluteFill} />
                {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" /> : null}
                <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
                <View style={styles.days}>
                  <Ionicons name="time" size={10} color="#f97316" />
                  <Text style={styles.daysText}>{template.duration}</Text>
                </View>
                <View style={styles.photoFoot}>
                  <Text style={styles.cardName} numberOfLines={2}>{template.name}</Text>
                </View>
              </View>
              <View style={styles.body}>
                <Text style={[styles.tagline, { color: themeColors.textSecondary }]} numberOfLines={2}>{template.tagline}</Text>
                <View style={styles.footRow}>
                  <Text style={[styles.count, { color: themeColors.textTertiary }]}>{activities} spots</Text>
                  <View style={styles.use}>
                    <Text style={styles.useText}>Use</Text>
                    <Ionicons name="arrow-forward" size={12} color="#fff" />
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

// Photos for each template (the web's TRAVEL_GUIDES images, same places).
const TEMPLATE_PHOTOS: Record<string, string> = {
  'hampi-2d': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=640&q=80',
  'goa-3d': 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=640&q=80',
  'shimla-manali-4d': 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=640&q=80',
  'rajasthan-5d': 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=640&q=80',
  'kerala-3d': 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=640&q=80',
};

const styles = StyleSheet.create({
  container: { marginTop: 28 },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: RAIL_PAD, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  sectionSubtitle: { fontSize: 13, marginTop: 2 },
  scrollContent: { paddingHorizontal: RAIL_PAD, gap: RAIL_GAP, paddingBottom: 8 },
  card: {
    width: TWO_UP_W, borderRadius: 20, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  photo: { height: Math.round(TWO_UP_W * 0.95), overflow: 'hidden' },
  days: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  daysText: { fontSize: 10.5, fontWeight: '800', color: '#111827' },
  photoFoot: { position: 'absolute', left: 12, right: 12, bottom: 10 },
  cardName: {
    color: '#fff', fontSize: 15.5, fontWeight: '900', lineHeight: 19, letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 },
  },
  body: { padding: 12, gap: 8 },
  tagline: { fontSize: 12, lineHeight: 16, minHeight: 32 },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: 11.5, fontWeight: '700' },
  use: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  useText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
});

export default TemplateSelector;
