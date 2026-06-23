import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Share,
  StyleSheet,
  Platform,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { colors, spacing, fontSize, fontWeight, shadow, useTheme } from '@prayana/shared-ui';
import {
  makeAPICall,
  tripPlanningAPI,
  generateShareLink,
  generateICalendar,
} from '@prayana/shared-services';
import { parseMarkdown } from '../../utils/markdownParser';
import { MarkdownItineraryView } from '../../components/trip/MarkdownItineraryView';
import { StructuredTimelineView } from '../../components/trip/StructuredTimelineView';

type TabType = 'guide' | 'timeline';

export default function ItineraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    markdown: string;
    title: string;
    destination: string;
    duration: string;
    transportMode: string;
    startingPoint: string;
    markdownItineraryId: string;
  }>();

  const { themeColors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('guide');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [structuredData, setStructuredData] = useState<any>(null);
  const [structuredLoading, setStructuredLoading] = useState(false);

  const parsed = useMemo(
    () => parseMarkdown(params.markdown || ''),
    [params.markdown]
  );

  const shareItinerary = useCallback(async () => {
    try {
      await Share.share({
        title: parsed.title || `${params.destination} Itinerary`,
        message: params.markdown || `Check out my ${params.duration}-day ${params.destination} itinerary!`,
      });
    } catch (_) {
      // User cancelled
    }
  }, [parsed.title, params.markdown, params.destination, params.duration]);

  const sharePublicLink = useCallback(async () => {
    try {
      // Server returns { shareUrl, slug, expiresAt }. If the trip isn't yet
      // saved server-side, fall back to sharing the markdown directly.
      const tripId = params.markdownItineraryId;
      if (!tripId) {
        await shareItinerary();
        return;
      }
      const res: any = await generateShareLink(tripId, { duration: 7 });
      const url = res?.shareUrl || res?.url;
      if (!url) {
        await shareItinerary();
        return;
      }
      await Share.share({
        title: parsed.title || `${params.destination} Itinerary`,
        message: `${parsed.title || params.destination} — ${url}`,
        url,
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not share', text2: err?.message });
    }
  }, [params.markdownItineraryId, params.destination, parsed.title, shareItinerary]);

  const copyAsCalendar = useCallback(async () => {
    try {
      const ics = generateICalendar({
        title: parsed.title || `${params.destination} Trip`,
        destination: params.destination,
        startDate: new Date().toISOString(),
        days: [],
        markdown: params.markdown,
      } as any);
      await Clipboard.setStringAsync(typeof ics === 'string' ? ics : String(ics));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Calendar (.ics) copied',
        text2: 'Paste into Apple Calendar / Google Calendar.',
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not copy', text2: err?.message });
    }
  }, [parsed.title, params.destination, params.markdown]);

  // Show a share action sheet (iOS) or alert menu (Android) with the 3 options.
  const handleShare = useCallback(() => {
    const options = ['Share itinerary', 'Share public link', 'Copy as Calendar (.ics)', 'Cancel'];
    const cancelButtonIndex = options.length - 1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        (idx) => {
          if (idx === 0) shareItinerary();
          else if (idx === 1) sharePublicLink();
          else if (idx === 2) copyAsCalendar();
        },
      );
    } else {
      Alert.alert('Share', 'Choose how to share this itinerary', [
        { text: 'Share text', onPress: shareItinerary },
        { text: 'Share public link', onPress: sharePublicLink },
        { text: 'Copy as Calendar', onPress: copyAsCalendar },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [shareItinerary, sharePublicLink, copyAsCalendar]);

  const handleBookmark = useCallback(async () => {
    try {
      await tripPlanningAPI.saveTrip({
        id: params.markdownItineraryId || `plan_${Date.now()}`,
        destination: params.destination,
        duration: Number(params.duration),
        transportMode: params.transportMode,
        markdown: params.markdown,
        title: parsed.title || `${params.destination} Trip`,
        savedAt: new Date().toISOString(),
        type: 'plan-a-trip',
      });
      setIsBookmarked(true);
    } catch (_) {
      // Silently fail
    }
  }, [params, parsed.title]);

  const handleGenerateStructured = useCallback(async () => {
    setStructuredLoading(true);
    try {
      const response = await makeAPICall('/itinerary/generate', {
        method: 'POST',
        body: JSON.stringify({
          destination: params.destination,
          duration: Number(params.duration),
          startingPoint: params.startingPoint || undefined,
          transportMode: params.transportMode === 'car' ? 'car_bus' : params.transportMode,
          preferences: {
            budget: 'moderate',
            interests: [],
            travelStyle: 'relaxed',
            groupType: 'general',
          },
        }),
        timeout: 60000,
      });

      if (response?.success && response.data) {
        const itinerary = response.data.data?.itinerary || response.data.itinerary || response.data;
        setStructuredData(itinerary);
      }
    } catch (_) {
      // Silently fail
    } finally {
      setStructuredLoading(false);
    }
  }, [params]);

  // Auto-switch to timeline tab triggers generation
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'timeline' && !structuredData && !structuredLoading) {
      handleGenerateStructured();
    }
  }, [structuredData, structuredLoading, handleGenerateStructured]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, shadow.sm, { backgroundColor: themeColors.surface }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={themeColors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
            {parsed.title || params.destination || 'Itinerary'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
            {params.duration} {Number(params.duration) === 1 ? 'day' : 'days'} {'\u2022'} {params.destination}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleShare}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={20} color={themeColors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleBookmark}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isBookmarked ? '#FF6B6B' : themeColors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'guide' && styles.tabActive]}
          onPress={() => handleTabChange('guide')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="book-outline"
            size={16}
            color={activeTab === 'guide' ? '#FF6B6B' : themeColors.textSecondary}
          />
          <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === 'guide' && styles.tabTextActive]}>
            Travel Guide
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'timeline' && styles.tabActive]}
          onPress={() => handleTabChange('timeline')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="git-branch-outline"
            size={16}
            color={activeTab === 'timeline' ? '#FF6B6B' : themeColors.textSecondary}
          />
          <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === 'timeline' && styles.tabTextActive]}>
            Timeline
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'guide' ? (
        <MarkdownItineraryView
          parsed={parsed}
          destination={params.destination || ''}
          duration={params.duration || '5'}
          transportMode={params.transportMode || 'flight'}
        />
      ) : (
        <StructuredTimelineView
          structuredData={structuredData}
          destination={params.destination || ''}
          loading={structuredLoading}
          onGenerateStructured={handleGenerateStructured}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    gap: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#FF6B6B',
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FF6B6B',
    fontWeight: fontWeight.semibold,
  },
});
