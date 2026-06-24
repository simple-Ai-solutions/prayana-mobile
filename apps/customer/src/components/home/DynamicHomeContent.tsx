// DynamicHomeContent.tsx - Dynamic country-aware home content for non-India users
// Fetches content from countryContentAPI and renders sections matching web design
// Enhanced: Masonry visa-free grid, rich interest cards, tabbed regions

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow, useTheme } from '@prayana/shared-ui';
import { countryContentAPI } from '@prayana/shared-services';
import { resolveImageUrl } from '@prayana/shared-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 20;
const GAP = 12;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;

interface DynamicHomeContentProps {
  countryCode: string;
  countryName: string;
  region: string;
  isEuropean: boolean;
}

interface DestinationItem {
  name: string;
  description?: string;
  desc?: string;
  image?: string;
  imageUrl?: string;
  rank?: number;
}

interface VisaFreeItem {
  country: string;
  name?: string;
  flag?: string;
  description?: string;
  desc?: string;
  image?: string;
  imageUrl?: string;
  stayDuration?: string;
  visaPolicy?: string;
}

interface InterestItem {
  id?: string;
  title?: string;
  label?: string;
  name?: string;
  subtitle?: string;
  category?: string;
  icon?: string;
  destinations?: any[];
  featuredImage?: string;
  image?: string;
  imageUrl?: string;
  gradient?: string[];
  count?: number;
}

interface TrekkingItem {
  name: string;
  country?: string;
  difficulty?: string;
  duration?: string;
  altitude?: string;
  bestSeason?: string;
  highlights?: string[];
  image?: string;
  imageUrl?: string;
}

interface RegionData {
  name: string;
  destinations?: DestinationItem[];
}

// Helper to get image URL
const getImg = (item: any): string | null => {
  const url =
    item?.featuredImage ||
    item?.image ||
    item?.imageUrl ||
    item?.images?.[0] ||
    item?.destinations?.[0]?.images?.[0];
  if (!url) return null;
  if (typeof url === 'string') return resolveImageUrl(url) || url;
  if (typeof url === 'object' && url.url) return resolveImageUrl(url.url) || url.url;
  return null;
};

// Default gradients for interest categories
const INTEREST_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#F97316', '#EA580C'],
  ['#06B6D4', '#0891B2'],
  ['#EC4899', '#DB2777'],
  ['#8B5CF6', '#7C3AED'],
  ['#10B981', '#059669'],
  ['#EF4444', '#DC2626'],
  ['#3B82F6', '#2563EB'],
  ['#14B8A6', '#0D9488'],
  ['#F59E0B', '#D97706'],
];

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#10B981',
  Moderate: '#F59E0B',
  Hard: '#EF4444',
};

// Interest icon mapping
const INTEREST_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  mountain: 'snow-outline',
  beach: 'sunny-outline',
  adventure: 'rocket-outline',
  culture: 'color-palette-outline',
  heritage: 'library-outline',
  romantic: 'heart-outline',
  food: 'restaurant-outline',
  nightlife: 'moon-outline',
  nature: 'leaf-outline',
  wildlife: 'paw-outline',
  wellness: 'fitness-outline',
  spiritual: 'sparkles-outline',
  shopping: 'bag-outline',
  architecture: 'business-outline',
  photography: 'camera-outline',
  island: 'boat-outline',
  desert: 'trail-sign-outline',
  winter: 'snow-outline',
};

function getInterestIcon(label: string): keyof typeof Ionicons.glyphMap {
  const lower = label.toLowerCase();
  for (const [key, icon] of Object.entries(INTEREST_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return 'compass-outline';
}

// ─── Skeleton placeholder ──────────────────────────────────
function SkeletonSection({ title }: { title: string }) {
  const { themeColors, isDarkMode } = useTheme();
  return (
    <View style={st.section}>
      <Text style={[st.sectionTitle, { color: themeColors.text }]}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: H_PAD }}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: 160,
              height: 120,
              borderRadius: 16,
              backgroundColor: isDarkMode ? '#1F2937' : '#E5E7EB',
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Masonry Image Card (reusable) ─────────────────────────
function ImageCard({
  imgUrl,
  gradientFallback,
  height,
  children,
  onPress,
  style,
}: {
  imgUrl: string | null;
  gradientFallback?: readonly [string, string];
  height: number;
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
}) {
  return (
    <TouchableOpacity
      style={[{ height, borderRadius: 16, overflow: 'hidden' }, style]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      {imgUrl ? (
        <Image source={{ uri: imgUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[...(gradientFallback || ['#3B82F6', '#1D4ED8'])]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: 12 }}>{children}</View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Visa Badge sub-component ──────────────────────────────
function VisaBadge({ policy }: { policy?: string }) {
  const isOnArrival = policy?.toLowerCase().includes('arrival');
  return (
    <View style={[st.visaPolicyBadge, { backgroundColor: isOnArrival ? '#3B82F6' : '#10B981' }]}>
      <Ionicons
        name={isOnArrival ? 'document-text-outline' : 'checkmark-circle'}
        size={10}
        color="#ffffff"
      />
      <Text style={st.visaPolicyText}>{isOnArrival ? 'On Arrival' : 'Visa-Free'}</Text>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export default function DynamicHomeContent({
  countryCode,
  countryName,
  region,
  isEuropean,
}: DynamicHomeContentProps) {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [visaFree, setVisaFree] = useState<VisaFreeItem[]>([]);
  const [trekking, setTrekking] = useState<TrekkingItem[]>([]);
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [activeRegionIdx, setActiveRegionIdx] = useState(0);
  const [showAllVisa, setShowAllVisa] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchContent = async () => {
      setLoading(true);
      setError(false);

      try {
        // Match web: interests, regions, visa-free, trekking (EU only)
        const promises: Promise<any>[] = [
          countryContentAPI.getInterestContent(region).catch(() => null),
          countryContentAPI.getVisaFreeCountries(countryCode, countryName).catch(() => null),
          countryContentAPI
            .getCountryContent(countryCode, countryName)
            .then((data: any) => data?.regionalDestinations || data?.regions || [])
            .catch(() => []),
        ];

        if (isEuropean) {
          promises.push(countryContentAPI.getEuropeanTrekking().catch(() => null));
        }

        const results = await Promise.all(promises);
        if (cancelled) return;

        const interestsData = results[0];
        const visaFreeData = results[1];
        const regionsData = results[2];
        const trekkingData = isEuropean ? results[3] : null;

        if (Array.isArray(interestsData?.categories || interestsData?.interests || interestsData)) {
          setInterests(interestsData?.categories || interestsData?.interests || interestsData);
        }
        if (Array.isArray(visaFreeData?.countries || visaFreeData)) {
          setVisaFree(visaFreeData?.countries || visaFreeData);
        }
        if (Array.isArray(regionsData)) {
          setRegions(regionsData);
        }
        if (trekkingData && Array.isArray(trekkingData?.destinations || trekkingData)) {
          setTrekking((trekkingData?.destinations || trekkingData).slice(0, 6));
        }
      } catch (err) {
        console.error('Failed to fetch dynamic content:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchContent();
    return () => {
      cancelled = true;
    };
  }, [countryCode, countryName, region, isEuropean]);

  const handleDestinationPress = useCallback(
    (name: string, preview?: { image?: string; desc?: string }) => {
      const params = new URLSearchParams();
      if (preview?.image) params.set('previewImage', preview.image);
      if (preview?.desc) params.set('previewDesc', preview.desc);
      const qs = params.toString();
      router.push(`/destination/${encodeURIComponent(name)}${qs ? '?' + qs : ''}` as any);
    },
    [router]
  );

  // ── Loading state ────────────────────────────────────────
  if (loading) {
    return (
      <View>
        <SkeletonSection title="Discover by Interest" />
        <SkeletonSection title={`Explore ${countryName} by Region`} />
        <SkeletonSection title="Visa-Free Destinations" />
      </View>
    );
  }

  // ── Error state ──────────────────────────────────────────
  if (error && regions.length === 0 && interests.length === 0) {
    return (
      <View style={[st.section, { alignItems: 'center', paddingVertical: 40 }]}>
        <Ionicons name="globe-outline" size={48} color={themeColors.textSecondary} />
        <Text style={[st.sectionTitle, { color: themeColors.text, textAlign: 'center' }]}>
          Explore the World
        </Text>
        <Text style={[st.sectionSubtitle, { color: themeColors.textSecondary, textAlign: 'center' }]}>
          Search for any destination to start planning
        </Text>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.push('/search')}>
          <LinearGradient colors={['#F97316', '#EA580C']} style={st.ctaButton}>
            <Ionicons name="search-outline" size={18} color="#ffffff" />
            <Text style={st.ctaText}>Search Destinations</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const visibleVisa = showAllVisa ? visaFree : visaFree.slice(0, 6);
  const activeRegion = regions[activeRegionIdx];

  return (
    <View>
      {/* ============================================================ */}
      {/* SECTION 1: DISCOVER BY INTEREST                              */}
      {/* ============================================================ */}
      {interests.length > 0 && (
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: themeColors.text }]}>Discover by Interest</Text>
          <Text style={[st.sectionSubtitle, { color: themeColors.textSecondary }]}>
            Find your perfect destination based on what you love
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.horizontalScroll}
          >
            {interests.map((item, idx) => {
              const grad = INTEREST_GRADIENTS[idx % INTEREST_GRADIENTS.length];
              const label = item.title || item.label || item.name || item.category || 'Explore';
              const imgUrl = getImg(item);
              const icon = getInterestIcon(label);
              const destCount = item.destinations?.length || item.count || 0;
              const categoryLabel = item.category || item.icon || '';
              const extraCount = destCount > 2 ? destCount - 2 : 0;

              return (
                <TouchableOpacity
                  key={label + idx}
                  style={st.interestCard}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/interest/${encodeURIComponent(label)}` as any)}
                >
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={st.interestImage} />
                  ) : (
                    <LinearGradient colors={[...grad]} style={st.interestImage} />
                  )}
                  {/* Category badge — top-left (matches web) */}
                  {categoryLabel ? (
                    <View style={st.categoryBadge}>
                      <Text style={st.categoryBadgeText}>{categoryLabel}</Text>
                    </View>
                  ) : null}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={st.interestOverlay}>
                    <View style={[st.interestIconBadge, { backgroundColor: `${String(grad[0])}CC` }]}>
                      <Ionicons name={icon} size={14} color="#ffffff" />
                    </View>
                    <Text style={st.interestLabel} numberOfLines={2}>{label}</Text>
                    {item.subtitle ? (
                      <Text style={st.interestSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                    ) : destCount > 0 ? (
                      <Text style={st.interestCount}>
                        {destCount} destination{destCount !== 1 ? 's' : ''}
                      </Text>
                    ) : null}
                    {item.destinations && item.destinations.length > 0 && (
                      <View style={st.interestTags}>
                        {item.destinations.slice(0, 2).map((d: any, i: number) => {
                          const name = typeof d === 'string' ? d : d?.name || '';
                          if (!name) return null;
                          return (
                            <View key={name + i} style={st.interestTag}>
                              <Text style={st.interestTagText} numberOfLines={1}>{name}</Text>
                            </View>
                          );
                        })}
                        {extraCount > 0 && (
                          <View style={[st.interestTag, st.interestTagExtra]}>
                            <Text style={st.interestTagText}>+{extraCount}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ============================================================ */}
      {/* SECTION 2: EXPLORE BY REGION (matching web order)            */}
      {/* ============================================================ */}
      {regions.length > 0 && (
        <LinearGradient
          colors={isDarkMode ? ['#000000', '#0a0a0a', '#000000'] : ['#EFF6FF', '#ffffff', '#EFF6FF']}
          style={st.regionSection}
        >
          <View style={st.sectionHeader}>
            <View style={[st.sectionTitleRow, { justifyContent: 'center' }]}>
              <Ionicons name="map-outline" size={22} color={colors.primary[500]} />
              <Text style={[st.sectionTitleInline, { color: themeColors.text }]}>
                Explore {countryName} by Region
              </Text>
            </View>
            <Text
              style={[st.sectionSubtitleInline, { color: themeColors.textSecondary, textAlign: 'center' }]}
            >
              Discover the diverse beauty of {countryName}
            </Text>
          </View>

          {/* Region Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.regionTabs}
          >
            {regions.map((reg, idx) => {
              const isActive = activeRegionIdx === idx;
              return (
                <TouchableOpacity
                  key={reg.name + idx}
                  style={[st.regionTab, isActive && st.regionTabActive]}
                  onPress={() => setActiveRegionIdx(idx)}
                  activeOpacity={0.7}
                >
                  {isActive ? (
                    <LinearGradient colors={['#F97316', '#EA580C']} style={st.regionTabGradient}>
                      <Text style={st.regionTabTextActive}>{reg.name}</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={[st.regionTabText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                      {reg.name}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Region Destination Grid */}
          {activeRegion?.destinations && activeRegion.destinations.length > 0 && (
            <View style={st.destGrid}>
              {activeRegion.destinations.slice(0, 4).map((dest, idx) => {
                const imgUrl = getImg(dest);
                return (
                  <TouchableOpacity
                    key={dest.name + idx}
                    style={[st.regionDestCard, shadow.md, { width: CARD_W }]}
                    activeOpacity={0.9}
                    onPress={() => handleDestinationPress(dest.name, { image: imgUrl || undefined })}
                  >
                    {imgUrl ? (
                      <Image source={{ uri: imgUrl }} style={st.regionDestImage} />
                    ) : (
                      <LinearGradient colors={['#F97316', '#EA580C']} style={st.regionDestImage} />
                    )}
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={st.regionDestOverlay}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="location" size={14} color="#ffffff" />
                        <Text style={st.regionDestName} numberOfLines={1}>{dest.name}</Text>
                      </View>
                      {(dest.description || dest.desc) && (
                        <Text style={st.regionDestDesc} numberOfLines={2}>
                          {dest.description || dest.desc}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* View More for region */}
          {activeRegion?.destinations && activeRegion.destinations.length > 4 && (
            <TouchableOpacity
              style={[st.showAllBtn, { marginTop: 12 }]}
              onPress={() =>
                router.push(`/search?q=${encodeURIComponent(activeRegion.name + ' ' + countryName)}` as any)
              }
              activeOpacity={0.85}
            >
              <View style={[st.outlineBtn, { borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}>
                <Ionicons name="compass-outline" size={16} color={themeColors.text} />
                <Text style={[st.outlineBtnText, { color: themeColors.text }]}>
                  View All {activeRegion.name}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={themeColors.text} />
              </View>
            </TouchableOpacity>
          )}
        </LinearGradient>
      )}

      {/* ============================================================ */}
      {/* SECTION 3: VISA-FREE — MASONRY GRID (matching web)           */}
      {/* ============================================================ */}
      {visaFree.length > 0 && (
        <View style={st.section}>
          <View style={st.sectionHeader}>
            <View style={st.sectionTitleRow}>
              <Ionicons name="airplane-outline" size={22} color="#10B981" />
              <Text style={[st.sectionTitleInline, { color: themeColors.text }]}>
                Visa-Free Destinations
              </Text>
            </View>
            <Text style={[st.sectionSubtitleInline, { color: themeColors.textSecondary }]}>
              Travel hassle-free with your {countryName} passport
            </Text>
          </View>

          {/* Row 1: 1 large + 2 stacked */}
          {visaFree.length >= 3 && (
            <View style={st.masonryRow1}>
              <ImageCard
                imgUrl={getImg(visaFree[0])}
                gradientFallback={['#10B981', '#059669']}
                height={220}
                style={{ flex: 1 }}
                onPress={() => handleDestinationPress(visaFree[0].country || visaFree[0].name || '')}
              >
                <VisaBadge policy={visaFree[0].visaPolicy} />
                {visaFree[0].flag ? <Text style={st.visaFlag}>{visaFree[0].flag}</Text> : null}
                <Text style={st.visaNameLg} numberOfLines={1}>
                  {visaFree[0].country || visaFree[0].name}
                </Text>
                {visaFree[0].stayDuration && (
                  <View style={st.visaDurationRow}>
                    <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.8)" />
                    <Text style={st.visaDuration}>{visaFree[0].stayDuration}</Text>
                  </View>
                )}
                {(visaFree[0].description || visaFree[0].desc) && (
                  <Text style={st.visaDesc} numberOfLines={2}>
                    {visaFree[0].description || visaFree[0].desc}
                  </Text>
                )}
              </ImageCard>

              <View style={st.masonryStackedRight}>
                {visaFree.slice(1, 3).map((item, idx) => (
                  <ImageCard
                    key={(item.country || item.name || '') + idx}
                    imgUrl={getImg(item)}
                    gradientFallback={['#3B82F6', '#1D4ED8']}
                    height={104}
                    style={{ flex: 1 }}
                    onPress={() => handleDestinationPress(item.country || item.name || '')}
                  >
                    <VisaBadge policy={item.visaPolicy} />
                    <Text style={st.visaNameSm} numberOfLines={1}>
                      {item.flag ? `${item.flag} ` : ''}{item.country || item.name}
                    </Text>
                    {item.stayDuration && (
                      <Text style={st.visaDurationSm}>{item.stayDuration}</Text>
                    )}
                  </ImageCard>
                ))}
              </View>
            </View>
          )}

          {/* Row 2: 3 equal cards */}
          {visibleVisa.length >= 6 && (
            <View style={st.masonryRow2}>
              {visibleVisa.slice(3, 6).map((item, idx) => (
                <ImageCard
                  key={(item.country || item.name || '') + idx}
                  imgUrl={getImg(item)}
                  gradientFallback={INTEREST_GRADIENTS[(idx + 3) % INTEREST_GRADIENTS.length]}
                  height={150}
                  style={{ flex: 1 }}
                  onPress={() => handleDestinationPress(item.country || item.name || '')}
                >
                  <VisaBadge policy={item.visaPolicy} />
                  <Text style={st.visaNameSm} numberOfLines={1}>
                    {item.flag ? `${item.flag} ` : ''}{item.country || item.name}
                  </Text>
                  {item.stayDuration && (
                    <Text style={st.visaDurationSm}>{item.stayDuration}</Text>
                  )}
                </ImageCard>
              ))}
            </View>
          )}

          {/* Row 3+: expanded cards */}
          {showAllVisa && visaFree.length > 6 && (
            <View style={st.masonryRow3}>
              {visaFree.slice(6).map((item, idx) => (
                <ImageCard
                  key={(item.country || item.name || '') + idx}
                  imgUrl={getImg(item)}
                  gradientFallback={INTEREST_GRADIENTS[(idx + 6) % INTEREST_GRADIENTS.length]}
                  height={140}
                  style={{ width: CARD_W }}
                  onPress={() => handleDestinationPress(item.country || item.name || '')}
                >
                  <VisaBadge policy={item.visaPolicy} />
                  <Text style={st.visaNameSm} numberOfLines={1}>
                    {item.flag ? `${item.flag} ` : ''}{item.country || item.name}
                  </Text>
                  {item.stayDuration && (
                    <Text style={st.visaDurationSm}>{item.stayDuration}</Text>
                  )}
                </ImageCard>
              ))}
            </View>
          )}

          {visaFree.length > 6 && (
            <TouchableOpacity
              style={st.showAllBtn}
              onPress={() => setShowAllVisa(!showAllVisa)}
              activeOpacity={0.85}
            >
              <View style={[st.outlineBtn, { borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}>
                <Text style={[st.outlineBtnText, { color: themeColors.text }]}>
                  {showAllVisa ? 'Show Less' : `View All ${visaFree.length} Countries`}
                </Text>
                <Ionicons
                  name={showAllVisa ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={themeColors.text}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ============================================================ */}
      {/* SECTION 4: EUROPEAN TREKKING (only for EU users)             */}
      {/* ============================================================ */}
      {isEuropean && trekking.length > 0 && (
        <View style={st.section}>
          <View style={st.sectionHeader}>
            <View style={st.sectionTitleRow}>
              <Text style={{ fontSize: 20 }}>🏔️</Text>
              <Text style={[st.sectionTitleInline, { color: themeColors.text }]}>
                Top Trekking Destinations
              </Text>
            </View>
            <Text style={[st.sectionSubtitleInline, { color: themeColors.textSecondary }]}>
              Best trails across Europe
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.horizontalScroll}
          >
            {trekking.map((trek, idx) => {
              const imgUrl = getImg(trek);
              const diffColor = DIFFICULTY_COLORS[trek.difficulty || ''] || '#6B7280';
              return (
                <TouchableOpacity
                  key={trek.name + idx}
                  style={st.trekCard}
                  activeOpacity={0.9}
                  onPress={() => handleDestinationPress(trek.name)}
                >
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={st.trekImage} />
                  ) : (
                    <LinearGradient colors={['#10B981', '#059669']} style={st.trekImage} />
                  )}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={st.trekOverlay}>
                    {trek.difficulty && (
                      <View style={[st.diffBadge, { backgroundColor: diffColor }]}>
                        <Text style={st.diffText}>{trek.difficulty}</Text>
                      </View>
                    )}
                    <Text style={st.trekName} numberOfLines={1}>{trek.name}</Text>
                    {trek.country && <Text style={st.trekCountry}>{trek.country}</Text>}
                    <View style={st.trekMeta}>
                      {trek.duration && (
                        <View style={st.trekMetaItem}>
                          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.8)" />
                          <Text style={st.trekMetaText}>{trek.duration}</Text>
                        </View>
                      )}
                      {trek.altitude && (
                        <View style={st.trekMetaItem}>
                          <Ionicons name="trending-up-outline" size={12} color="rgba(255,255,255,0.8)" />
                          <Text style={st.trekMetaText}>{trek.altitude}</Text>
                        </View>
                      )}
                    </View>
                    {trek.bestSeason && (
                      <Text style={st.trekSeason}>Best: {trek.bestSeason}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  section: {
    paddingVertical: 24,
  },
  sectionHeader: {
    paddingHorizontal: H_PAD,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    paddingHorizontal: H_PAD,
    marginBottom: 4,
  },
  sectionTitleInline: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  sectionSubtitle: {
    fontSize: 14,
    paddingHorizontal: H_PAD,
    marginBottom: 16,
  },
  sectionSubtitleInline: {
    fontSize: 14,
    marginBottom: 0,
  },
  horizontalScroll: {
    paddingHorizontal: H_PAD,
    gap: 12,
  },

  // ── Interest cards (enhanced) ─────────────────────────────
  interestCard: {
    width: 170,
    height: 230,
    borderRadius: 20,
    overflow: 'hidden',
  },
  interestImage: {
    width: '100%',
    height: '100%',
  },
  interestOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 14,
  },
  interestIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  interestLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  interestCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 6,
  },
  interestTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  interestTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  interestTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  interestTagExtra: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  interestSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 6,
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 2,
  },
  categoryBadgeText: {
    color: '#1a1a1a',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  // ── Destination grid ──────────────────────────────────────
  destGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    gap: GAP,
    justifyContent: 'center',
  },
  // ── CTA buttons ───────────────────────────────────────────
  showAllBtn: {
    paddingHorizontal: H_PAD,
    marginTop: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Visa-free masonry ─────────────────────────────────────
  masonryRow1: {
    flexDirection: 'row',
    paddingHorizontal: H_PAD,
    gap: GAP,
    marginBottom: GAP,
  },
  masonryStackedRight: {
    flex: 1,
    gap: GAP,
  },
  masonryRow2: {
    flexDirection: 'row',
    paddingHorizontal: H_PAD,
    gap: GAP,
    marginBottom: GAP,
  },
  masonryRow3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    gap: GAP,
    justifyContent: 'center',
    marginBottom: GAP,
  },
  visaPolicyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    marginBottom: 6,
  },
  visaPolicyText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  visaFlag: {
    fontSize: 22,
    marginBottom: 4,
  },
  visaNameLg: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  visaNameSm: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  visaDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  visaDuration: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  visaDurationSm: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 2,
  },
  visaDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 4,
  },

  // ── Trekking cards (enhanced) ─────────────────────────────
  trekCard: {
    width: 190,
    height: 250,
    borderRadius: 20,
    overflow: 'hidden',
  },
  trekImage: {
    width: '100%',
    height: '100%',
  },
  trekOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 14,
  },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  diffText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  trekName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  trekCountry: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  trekMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  trekMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trekMetaText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  trekSeason: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // ── Region section ────────────────────────────────────────
  regionSection: {
    paddingVertical: 32,
  },
  regionTabs: {
    paddingHorizontal: H_PAD,
    gap: 8,
    marginBottom: 16,
  },
  regionTab: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  regionTabActive: {},
  regionTabGradient: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  regionTabText: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  regionTabTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  regionDestCard: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
  },
  regionDestImage: {
    width: '100%',
    height: '100%',
  },
  regionDestOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
  },
  regionDestName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  regionDestDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 4,
  },
});
