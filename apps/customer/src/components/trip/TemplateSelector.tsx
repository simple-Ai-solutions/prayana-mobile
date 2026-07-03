import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { TRIP_TEMPLATES, TripTemplate } from '../../data/tripTemplates';

const TemplateSelector: React.FC = () => {
  const router = useRouter();

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
      <Text style={styles.sectionTitle}>Destination Templates</Text>
      <Text style={styles.sectionSubtitle}>Pre-planned itineraries ready to customize</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TRIP_TEMPLATES.map((template) => (
          <TouchableOpacity
            key={template.id}
            style={[styles.card, shadow.md]}
            activeOpacity={0.85}
            onPress={() => handleSelectTemplate(template)}
          >
            <LinearGradient
              colors={template.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              <Text style={styles.cardEmoji}>{template.emoji}</Text>
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{template.duration}</Text>
              </View>
            </LinearGradient>

            <View style={styles.cardContent}>
              <Text style={styles.cardName} numberOfLines={1}>
                {template.name}
              </Text>
              <Text style={styles.cardTagline} numberOfLines={1}>
                {template.tagline}
              </Text>

              <View style={styles.tagsRow}>
                {template.tags.slice(0, 3).map((tag, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.activityCount}>
                  <Ionicons name="list-outline" size={12} color={colors.textTertiary} />
                  <Text style={styles.activityCountText}>
                    {template.days.reduce((sum, d) => sum + d.activities.length, 0)} activities
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={20} color={colors.primary[500]} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing['2xl'],
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    paddingHorizontal: spacing.xl,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  card: {
    width: 200,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardGradient: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardEmoji: {
    fontSize: 36,
  },
  durationBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  durationText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  cardContent: {
    padding: spacing.md,
  },
  cardName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  cardTagline: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 9,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  activityCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityCountText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
});

export default TemplateSelector;
