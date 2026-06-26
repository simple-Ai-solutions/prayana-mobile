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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Share2, AlertCircle } from 'lucide-react-native';
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
import { itineraryAPI } from '@prayana/shared-services';
import { parseMarkdown } from '../../utils/markdownParser';
import { MarkdownItineraryView } from '../../components/trip/MarkdownItineraryView';

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
        <MarkdownItineraryView
          parsed={parsed}
          destination={destination}
          duration={duration}
          transportMode="mixed"
        />
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
