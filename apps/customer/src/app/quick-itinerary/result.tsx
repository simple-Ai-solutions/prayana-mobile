// Quick Itinerary result — renders a generated (or fetched) itinerary using the
// shared MarkdownItineraryView. Accepts either inline `data` (from generation),
// or an `id` to fetch, plus graceful loading/error states.
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Share2, AlertCircle } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  Button,
} from '@prayana/shared-ui';
import { itineraryAPI, makeAPICall } from '@prayana/shared-services';
import { parseMarkdown } from '../../utils/markdownParser';
import { MarkdownItineraryView } from '../../components/trip/MarkdownItineraryView';
import { StructuredTimelineView } from '../../components/trip/StructuredTimelineView';
import { TripEssentials } from '../../components/trip/TripEssentials';
import { downloadItineraryPdf } from '../../utils/itineraryPdf';
import { addRecentItinerary } from '../../utils/recentItineraries';

type TabType = 'guide' | 'timeline' | 'essentials';

// Pull a markdown string out of whatever shape the API returns.
function extractMarkdown(result: any): string {
  if (!result) return '';
  if (typeof result === 'string') return result;
  return (
    result.content ||
    result.markdown ||
    result.markdownContent ||
    result.data?.content ||
    result.data?.markdown ||
    result.itinerary?.content ||
    ''
  );
}

export default function QuickItineraryResultScreen() {
  const { themeColors } = useTheme();
  const params = useLocalSearchParams<{
    data?: string;
    id?: string;
    destination?: string;
    duration?: string;
    error?: string;
  }>();

  const destination = params.destination || 'Your Trip';
  const duration = params.duration || '3';

  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.error || null);
  const [activeTab, setActiveTab] = useState<TabType>('guide');
  const [structuredData, setStructuredData] = useState<any>(null);
  const [structuredLoading, setStructuredLoading] = useState(false);

  // Resolve content: inline data first, otherwise fetch by id.
  useEffect(() => {
    if (params.error) return;
    if (params.data) {
      try {
        const parsedData = JSON.parse(params.data);
        setMarkdown(extractMarkdown(parsedData));
      } catch {
        setMarkdown(String(params.data));
      }
      return;
    }
    if (params.id) {
      let active = true;
      setLoading(true);
      (async () => {
        try {
          const res = await itineraryAPI.getById(params.id!);
          const item = res?.data?.[0] || res?.data || res;
          const md =
            extractMarkdown(item) ||
            (item?.markdownItineraryId
              ? extractMarkdown(await itineraryAPI.getMarkdown(item.markdownItineraryId))
              : '');
          if (active) setMarkdown(md);
        } catch (e: any) {
          if (active) setError(e?.message || 'Failed to load itinerary');
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }
  }, [params.data, params.id, params.error]);

  const parsed = useMemo(() => parseMarkdown(markdown || ''), [markdown]);

  // Auto-save to local "Recent Itineraries" history once content is ready.
  useEffect(() => {
    if (!markdown || !destination) return;
    addRecentItinerary({
      title: parsed.title || `${destination} Trip`,
      destination,
      duration,
      markdown,
      markdownItineraryId: params.id,
    });
  }, [markdown, destination, duration, parsed.title, params.id]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: parsed.title || `${destination} Itinerary`,
        message:
          markdown || `Check out my ${duration}-day ${destination} itinerary on Prayana!`,
      });
    } catch (e) {
      // user cancelled — ignore
    }
  }, [parsed.title, markdown, destination, duration]);

  const handleDownloadPdf = useCallback(async () => {
    const res = await downloadItineraryPdf({
      markdown: markdown || '',
      title: parsed.title || `${destination} Trip`,
      destination,
      duration,
    });
    if (!res.ok) {
      Alert.alert('Download failed', res.error || 'Could not create the PDF. Please try again.');
    }
  }, [markdown, parsed.title, destination, duration]);

  // Generate structured timeline data on first switch to the Timeline tab.
  const handleGenerateStructured = useCallback(async () => {
    setStructuredLoading(true);
    try {
      const VALID_MODES = ['car_bus', 'bike', 'flight'];
      const safeMode = 'car_bus';
      const response = await makeAPICall('/itinerary/generate', {
        method: 'POST',
        body: JSON.stringify({
          destination,
          duration: Number(duration),
          transportMode: safeMode,
          preferences: { budget: 'moderate', interests: [], travelStyle: 'relaxed', groupType: 'general' },
        }),
        timeout: 60000,
      });
      const extractItinerary = (payload: any) =>
        payload?.data?.data?.itinerary || payload?.data?.itinerary || payload?.itinerary || payload?.data;
      const inline = extractItinerary(response);
      if (inline && (inline.days || inline.itinerary)) {
        setStructuredData(inline.itinerary || inline);
        return;
      }
      const pollUrl: string | undefined = response?.pollUrl;
      const interval = response?.pollInterval || 2000;
      if (pollUrl) {
        const endpoint = pollUrl.replace(/^\/api/, '');
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, interval));
          let poll: any;
          try { poll = await makeAPICall(endpoint); } catch { continue; }
          if (poll?.status === 'completed') {
            const it = extractItinerary(poll);
            setStructuredData(it?.days ? it : (it?.itinerary || it));
            return;
          }
          if (poll?.status === 'failed') break;
        }
      }
    } catch (e: any) {
      // leave structuredData null — the Timeline view shows a generate prompt
    } finally {
      setStructuredLoading(false);
    }
  }, [destination, duration]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'timeline' && !structuredData && !structuredLoading) {
      handleGenerateStructured();
    }
  }, [structuredData, structuredLoading, handleGenerateStructured]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
          {destination}
        </Text>
        <TouchableOpacity onPress={handleDownloadPdf} style={styles.iconBtn} disabled={!markdown}>
          <Ionicons
            name="download-outline"
            size={20}
            color={markdown ? themeColors.text : themeColors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.iconBtn} disabled={!markdown}>
          <Share2
            size={22}
            color={markdown ? themeColors.text : themeColors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary[500]} size="large" />
          <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
            Loading your itinerary…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <AlertCircle size={48} color={colors.error} />
          <Text style={[styles.centerTitle, { color: themeColors.text }]}>
            Couldn’t generate itinerary
          </Text>
          <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
            {error}
          </Text>
          <Button
            title="Try Again"
            onPress={() => router.back()}
            variant="primary"
            style={{ marginTop: spacing.lg }}
          />
        </View>
      ) : !markdown ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary[500]} size="large" />
          <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
            Preparing your plan…
          </Text>
        </View>
      ) : (
        <>
          {/* Tab Bar — Travel Guide · Timeline · Essentials */}
          <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'guide' && styles.tabActive]}
              onPress={() => handleTabChange('guide')}
              activeOpacity={0.7}
            >
              <Ionicons name="book-outline" size={16} color={activeTab === 'guide' ? '#06B6D4' : themeColors.textSecondary} />
              <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === 'guide' && styles.tabTextActive]}>
                Travel Guide
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'timeline' && styles.tabActive]}
              onPress={() => handleTabChange('timeline')}
              activeOpacity={0.7}
            >
              <Ionicons name="git-branch-outline" size={16} color={activeTab === 'timeline' ? '#06B6D4' : themeColors.textSecondary} />
              <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === 'timeline' && styles.tabTextActive]}>
                Timeline
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'essentials' && styles.tabActive]}
              onPress={() => handleTabChange('essentials')}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase-outline" size={16} color={activeTab === 'essentials' ? '#06B6D4' : themeColors.textSecondary} />
              <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === 'essentials' && styles.tabTextActive]}>
                Essentials
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'guide' ? (
            <MarkdownItineraryView
              parsed={parsed}
              destination={destination}
              duration={duration}
              transportMode="mixed"
            />
          ) : activeTab === 'essentials' ? (
            <TripEssentials destination={destination} />
          ) : (
            <StructuredTimelineView
              structuredData={structuredData}
              destination={destination}
              loading={structuredLoading}
              onGenerateStructured={handleGenerateStructured}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  iconBtn: { padding: spacing.xs },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginHorizontal: spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
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
  tabActive: { borderBottomColor: '#06B6D4' },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  tabTextActive: { color: '#06B6D4', fontWeight: fontWeight.semibold },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  centerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.md,
  },
  centerText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
