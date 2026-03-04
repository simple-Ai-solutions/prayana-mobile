// Nested route for place details: /destination/[location]/[place]
// Supports preview data for instant rendering + progressive enrichment
import React, { Component, useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { makeAPICall, getBaseURL } from '@prayana/shared-services';
import { resolveImageUrl } from '@prayana/shared-utils';

import { OverviewTab } from '../../../components/place-detail/OverviewTab';
import { VisitInfoTab } from '../../../components/place-detail/VisitInfoTab';
import { HowToReachTab } from '../../../components/place-detail/HowToReachTab';
import { NearbyTab } from '../../../components/place-detail/NearbyTab';
import { GalleryTab } from '../../../components/place-detail/GalleryTab';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'sparkles-outline' as const },
  { key: 'visit', label: 'Visit Info', icon: 'information-circle-outline' as const },
  { key: 'reach', label: 'How to Reach', icon: 'navigate-outline' as const },
  { key: 'nearby', label: 'Nearby', icon: 'location-outline' as const },
  { key: 'gallery', label: 'Gallery', icon: 'images-outline' as const },
];

// ============================================================
// ERROR BOUNDARY
// ============================================================
class PlaceErrorBoundary extends Component<
  { children: React.ReactNode; onReset?: () => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message || 'Unknown error' };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[PlaceDetail ErrorBoundary]', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937', marginTop: 16, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
            {this.state.errorMsg}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: '#3B82F6', borderRadius: 12 }}
            onPress={() => {
              this.setState({ hasError: false, errorMsg: '' });
              this.props.onReset?.();
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// MAIN SCREEN
// ============================================================
function PlaceDetailContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ location: string; place: string; preview?: string }>();
  const { themeColors, isDarkMode } = useTheme();

  const rawPlace = (Array.isArray(params.place) ? params.place[0] : params.place) || '';
  const rawLocation = (Array.isArray(params.location) ? params.location[0] : params.location) || '';
  const placeName = decodeURIComponent(rawPlace);
  const location = decodeURIComponent(rawLocation);

  // Parse preview data passed from destination page (instant display)
  const previewData = React.useMemo(() => {
    try {
      const raw = Array.isArray(params.preview) ? params.preview[0] : params.preview;
      if (raw) {
        // expo-router may already decode the param, try parsing directly first
        try { return JSON.parse(raw); } catch {}
        return JSON.parse(decodeURIComponent(raw));
      }
    } catch {}
    return null;
  }, [params.preview]);

  // Initialize placeData with preview so the page renders immediately
  const [placeData, setPlaceData] = useState<any>(() => {
    if (previewData) {
      return {
        name: previewData.name || placeName,
        category: previewData.category || '',
        rating: previewData.rating || null,
        description: previewData.shortDescription || '',
        shortDescription: previewData.shortDescription || '',
        image: previewData.image || '',
        imageUrls: previewData.image ? [previewData.image] : [],
        duration: previewData.duration || '',
      };
    }
    return null;
  });

  // loading=false if we have preview data (show immediately), true otherwise
  const [loading, setLoading] = useState(!previewData);
  const [enriching, setEnriching] = useState(true); // true while full data loads
  const [error, setError] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  const tabScrollRef = useRef<ScrollView>(null);

  const isFetchingRef = useRef(false);

  // Track which tiers have loaded for per-tab skeleton display
  const [tiersLoaded, setTiersLoaded] = useState<Set<string>>(new Set());

  console.log('[PlaceDetail] Rendering — placeName:', placeName, 'location:', location, 'hasPreview:', !!previewData);

  const fetchPlaceDetails = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (!placeName) {
      console.warn('[PlaceDetail] Missing placeName');
      setError('Missing place name');
      setLoading(false);
      setEnriching(false);
      return;
    }
    isFetchingRef.current = true;
    if (!previewData) setLoading(true);
    setError(null);

    const loc = location || placeName;
    const baseURL = getBaseURL(); // e.g. "http://192.168.31.185:5000/api"

    try {
      console.log('[PlaceDetail] Starting progressive stream for:', placeName, 'in', loc);

      const response = await fetch(`${baseURL}/destinations/unified-place-data-progressive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson, application/json' },
        body: JSON.stringify({ placeName: placeName.trim(), location: loc.trim() }),
        signal: AbortSignal.timeout(90000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Always try to stream the body — server uses res.write() with newline-delimited JSON
      // even when Content-Type is application/json
      if (response.body) {
        // --- STREAMING PATH: read line-delimited JSON tiers ---
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const envelope = JSON.parse(trimmed);
              // Server wraps each tier as: { success, data, metadata: { type, tier } }
              const tierData = envelope.data || envelope;
              const tierType: string = envelope.metadata?.type || envelope.metadata?.tier || envelope.tier || 'unknown';

              if (!envelope.success && envelope.error) {
                console.warn('[PlaceDetail] Server error tier:', envelope.message);
                continue;
              }

              console.log('[PlaceDetail] Tier received:', tierType);

              setPlaceData((prev: any) => {
                const base = prev || { name: placeName };
                // Deep merge: newer tier data wins, but don't wipe non-empty existing fields with empty values
                const merged = { ...base };
                Object.keys(tierData).forEach((k) => {
                  const val = tierData[k];
                  if (val === null || val === undefined || val === '') return;
                  if (Array.isArray(val) && val.length === 0) return;
                  if (typeof val === 'object' && !Array.isArray(val) && typeof merged[k] === 'object' && merged[k] && !Array.isArray(merged[k])) {
                    merged[k] = { ...merged[k], ...val };
                  } else {
                    merged[k] = val;
                  }
                });
                return merged;
              });

              setTiersLoaded((prev) => new Set([...prev, tierType]));
              // Unlock UI from loading state as soon as first tier arrives
              setLoading(false);
            } catch (parseErr) {
              console.warn('[PlaceDetail] Failed to parse tier line:', parseErr);
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const envelope = JSON.parse(buffer.trim());
            const tierData = envelope.data || envelope;
            const tierType: string = envelope.metadata?.type || envelope.metadata?.tier || 'final';
            setPlaceData((prev: any) => {
              const merged = { ...(prev || { name: placeName }) };
              Object.keys(tierData).forEach((k) => {
                const val = tierData[k];
                if (val !== null && val !== undefined && val !== '') merged[k] = val;
              });
              return merged;
            });
            setTiersLoaded((prev) => new Set([...prev, tierType]));
          } catch {}
        }

      } else {
        // response.body unavailable — shouldn't happen in React Native but handle gracefully
        throw new Error('Response body not available for streaming');
      }
    } catch (err: any) {
      console.warn('[PlaceDetail] Progressive stream failed, falling back to unified endpoint:', err?.message);
      // Fallback to non-streaming unified endpoint
      try {
        const response = await makeAPICall('/destinations/unified-place-data', {
          method: 'POST',
          body: JSON.stringify({ placeName: placeName.trim(), location: (location || placeName).trim() }),
          timeout: 60000,
        });
        const data = response?.data || response;
        if (data && typeof data === 'object' && (data.name || data.description)) {
          setPlaceData(data);
        } else if (!previewData) {
          setError('Could not load place details. Please try again.');
        }
      } catch (fallbackErr: any) {
        console.error('[PlaceDetail] All endpoints failed:', fallbackErr?.message);
        if (!previewData) setError(fallbackErr?.message || 'Failed to load details');
      }
    } finally {
      setLoading(false);
      setEnriching(false);
      isFetchingRef.current = false;
    }
  }, [placeName, location, previewData]);

  useEffect(() => {
    fetchPlaceDetails();
  }, [fetchPlaceDetails]);

  // Resolve images safely — unified endpoint returns [{url, caption}], legacy returns strings
  const resolveImages = (data: any): string[] => {
    try {
      const raw = data?.images || data?.imageUrls || (data?.image ? [data.image] : []);
      if (!Array.isArray(raw)) return [];
      const resolved = raw
        .map((img: any) => {
          if (typeof img === 'string') return resolveImageUrl(img) || img;
          if (img && typeof img === 'object') {
            const url = img?.url || img?.imageUrl || img?.src || '';
            return resolveImageUrl(url) || url || null;
          }
          return null;
        })
        .filter((u: any) => u && typeof u === 'string' && u.length > 0);
      return [...new Set(resolved)] as string[]; // deduplicate
    } catch (e) {
      console.warn('[PlaceDetail] resolveImages error:', e);
      return [];
    }
  };

  const allImages = placeData ? resolveImages(placeData) : [];

  const openInMaps = useCallback(() => {
    try {
      const coords = placeData?.coordinates || placeData?.location?.coordinates || placeData?.detailedInfo?.coordinates;
      if (coords?.lat && coords?.lng) {
        Linking.openURL(`https://maps.google.com/?q=${coords.lat},${coords.lng}`);
      } else if (placeData?.name) {
        Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(placeData.name + ' ' + (location || ''))}`);
      }
    } catch (e) {
      console.warn('[PlaceDetail] openInMaps error:', e);
    }
  }, [placeData, location]);

  const handleTabPress = (key: string, index: number) => {
    setActiveTab(key);
    tabScrollRef.current?.scrollTo({ x: Math.max(0, index * 110 - 40), animated: true });
  };

  // ============================================================
  // LOADING (only shown when we have NO preview data at all)
  // ============================================================
  if (loading && !placeData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
            {placeName || 'Loading...'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // ERROR (only if both preview and API failed)
  // ============================================================
  if (error && !placeData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Error</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: themeColors.text }]}>
            {error || 'Place not found'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPlaceDetails}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.back()}>
            <Text style={{ color: colors.primary[500], fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // DATA EXTRACTION
  // ============================================================
  const detailed = placeData?.detailedInfo || {};
  const category = placeData?.category || detailed.category || '';
  const rating = placeData?.rating || detailed.rating;
  const locationStr = typeof placeData?.location === 'string' ? placeData.location : '';
  const resolvedLocation = location || placeData?.city || locationStr || '';

  // ============================================================
  // TAB SKELETON — shown while enriching and tab has no data yet
  // ============================================================
  const TabSkeleton = () => {
    const skeletonColor = isDarkMode ? '#1F2937' : '#E5E7EB';
    const rows = [
      { w: '100%', h: 16 }, { w: '80%', h: 16 }, { w: '90%', h: 16 },
      { w: '60%', h: 16 }, { w: '100%', h: 16 }, { w: '70%', h: 16 },
    ];
    return (
      <View style={{ padding: spacing.xl, gap: spacing.md }}>
        {/* Section title skeleton */}
        <View style={{ width: 140, height: 18, borderRadius: 8, backgroundColor: skeletonColor, marginBottom: 4 }} />
        {rows.map((r, i) => (
          <View key={i} style={{ width: r.w as any, height: r.h, borderRadius: 6, backgroundColor: skeletonColor }} />
        ))}
        <View style={{ width: 140, height: 18, borderRadius: 8, backgroundColor: skeletonColor, marginTop: spacing.lg, marginBottom: 4 }} />
        {[{ w: '100%' }, { w: '75%' }, { w: '85%' }].map((r, i) => (
          <View key={i} style={{ width: r.w as any, height: 16, borderRadius: 6, backgroundColor: skeletonColor }} />
        ))}
      </View>
    );
  };

  // ============================================================
  // RENDER TAB CONTENT
  // ============================================================
  const renderTab = () => {
    // Show skeleton while data is still streaming AND the tab truly has no content yet
    const hasDetailedInfo = !!(placeData?.detailedInfo || placeData?.visitingInfo || placeData?.description);
    const showSkeleton = enriching && !hasDetailedInfo;

    try {
      switch (activeTab) {
        case 'overview':
          return showSkeleton ? <TabSkeleton /> : <OverviewTab placeData={placeData} />;
        case 'visit':
          return showSkeleton ? <TabSkeleton /> : <VisitInfoTab placeData={placeData} />;
        case 'reach':
          return (
            <HowToReachTab
              placeName={placeData?.name || placeName || ''}
              location={resolvedLocation}
              coordinates={placeData?.coordinates || placeData?.location?.coordinates || detailed.coordinates}
            />
          );
        case 'nearby':
          return (
            <NearbyTab
              placeName={placeData?.name || placeName || ''}
              location={resolvedLocation}
            />
          );
        case 'gallery':
          return (
            <GalleryTab
              placeName={placeData?.name || placeName || ''}
              location={resolvedLocation}
              initialImages={allImages}
            />
          );
        default:
          return null;
      }
    } catch (e: any) {
      console.error('[PlaceDetail] Tab render error:', e);
      return <Text style={{ padding: 20, color: '#EF4444' }}>Error rendering tab: {e?.message}</Text>;
    }
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ======== HERO IMAGE ======== */}
        <View style={styles.heroContainer}>
          {allImages.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setActiveImageIdx(idx);
                }}
              >
                {allImages.slice(0, 5).map((img, idx) => (
                  <Image key={idx} source={{ uri: img }} style={styles.heroImage} contentFit="cover" transition={200} cachePolicy="memory-disk" priority="high" />
                ))}
              </ScrollView>
              {allImages.length > 1 && (
                <View style={styles.imageDots}>
                  {allImages.slice(0, 5).map((_, idx) => (
                    <View
                      key={idx}
                      style={[styles.dot, idx === activeImageIdx && styles.dotActive]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <LinearGradient colors={[colors.primary[400], colors.primary[700]]} style={styles.heroImage}>
              <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.5)" />
            </LinearGradient>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.heroGradient}
          />

          {/* Floating back button */}
          <TouchableOpacity style={styles.floatingBack} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          {/* Floating maps button */}
          <TouchableOpacity style={styles.floatingShare} onPress={openInMaps}>
            <Ionicons name="navigate-outline" size={20} color="#ffffff" />
          </TouchableOpacity>

          {/* Hero title overlay */}
          <View style={styles.heroOverlay}>
            {category ? (
              <View style={styles.heroCategoryPill}>
                <Text style={styles.heroCategoryText}>{category}</Text>
              </View>
            ) : null}
            <Text style={styles.heroTitle} numberOfLines={2}>{placeData?.name || placeName}</Text>
            <View style={styles.heroMeta}>
              {resolvedLocation ? (
                <View style={styles.heroMetaItem}>
                  <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroMetaText}>{resolvedLocation}</Text>
                </View>
              ) : null}
              {rating ? (
                <View style={styles.heroMetaItem}>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={styles.heroMetaText}>{Number(rating).toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ======== STICKY TAB BAR ======== */}
        <View style={[styles.tabBarWrapper, { backgroundColor: themeColors.background }]}>
          <ScrollView
            ref={tabScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarContent}
          >
            {TABS.map((tab, index) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => handleTabPress(tab.key, index)}
                  activeOpacity={0.8}
                  style={[
                    styles.tabPill,
                    isActive
                      ? { backgroundColor: colors.primary[500] }
                      : { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' },
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={isActive ? '#ffffff' : themeColors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: isActive ? '#ffffff' : themeColors.textSecondary },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ======== PROGRESSIVE LOADING INDICATOR ======== */}
        {enriching && (
          <View style={[styles.enrichingBar, { backgroundColor: isDarkMode ? '#1F2937' : '#FFF7ED' }]}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
            <Text style={[styles.enrichingText, { color: themeColors.textSecondary }]}>
              {tiersLoaded.size === 0
                ? 'Discovering details...'
                : tiersLoaded.size < 2
                ? 'Loading visit info...'
                : tiersLoaded.size < 3
                ? 'Finding experiences...'
                : 'Almost ready...'}
            </Text>
          </View>
        )}

        {/* ======== TAB CONTENT ======== */}
        <View style={styles.tabContent}>
          <PlaceErrorBoundary onReset={() => setActiveTab('overview')}>
            {renderTab()}
          </PlaceErrorBoundary>
        </View>

        {/* ======== BOTTOM ACTION BUTTONS ======== */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={openInMaps} activeOpacity={0.8}>
            <Ionicons name="map-outline" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Open in Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButtonOutline, { borderColor: colors.primary[500] }]}
            onPress={() => router.push('/trip/setup' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
            <Text style={[styles.actionButtonOutlineText, { color: colors.primary[500] }]}>
              Add to Trip
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// EXPORTED SCREEN
// ============================================================
export default function PlaceDetailScreen() {
  return (
    <PlaceErrorBoundary>
      <PlaceDetailContent />
    </PlaceErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.md },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  errorTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.lg, textAlign: 'center' },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  retryText: { color: '#ffffff', fontWeight: fontWeight.semibold },

  heroContainer: {
    position: 'relative',
    height: 320,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  imageDots: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#ffffff', width: 20 },
  floatingBack: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingShare: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 16,
    left: spacing.xl,
    right: spacing.xl,
  },
  heroCategoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  heroCategoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },

  tabBarWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 10,
    zIndex: 10,
  },
  tabBarContent: {
    paddingHorizontal: spacing.xl,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  enrichingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  enrichingText: {
    fontSize: 12,
    fontWeight: '500',
  },

  tabContent: {
    minHeight: 400,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
  },
  actionButtonText: { color: '#ffffff', fontWeight: fontWeight.semibold, fontSize: fontSize.md },
  actionButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  actionButtonOutlineText: { fontWeight: fontWeight.semibold, fontSize: fontSize.md },
});
