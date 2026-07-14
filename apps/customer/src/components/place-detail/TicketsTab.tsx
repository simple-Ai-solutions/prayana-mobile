// "Tickets" tab for the place-detail page — the mobile port of the PWA's
// components/common/pages/tabs/TicketsTab.jsx.
//
// It shows every way to book this place, from two sources fetched in parallel:
//   1. activityMarketplaceAPI.searchActivities({ city }) — OUR OWN onboarded
//      Prayana activities. These are internal: tapping one routes in-app to
//      /activity/:id rather than kicking the user out to a browser.
//   2. ticketsAPI.getOfficialBookingLinks() — third-party + official portals
//      (Viator / Headout / government / trust sites). These are external
//      affiliate links, so they open with Linking.openURL.
//
// Promise.allSettled, exactly as on the web: one source failing must never
// blank out the other.
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
// From gesture-handler, NOT react-native: this tab renders inside the place
// page's gesture-handler ScrollView, and a plain RN Touchable nested in one
// never receives the tap.
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { ticketsAPI, activityMarketplaceAPI } from '@prayana/shared-services';
import { resolveImageUrl } from '@prayana/shared-utils';

// ===== BRAND =====
// PRAYANA_DESIGN_SYSTEM.pdf: the LOGO is the canonical palette — teal #4AC0CC
// primary, red #E61417 secondary — and "new brand surfaces should use the logo
// values" (existing orange/#2EC4B6-bound components are left alone, which is
// why we don't touch shared-ui's `colors.primary` orange ramp here). The
// Tickets tab is a new surface, so it paints in the logo colours.
const BRAND_TEAL = '#4AC0CC';
const BRAND_TEAL_DARK = '#2F9BA6'; // pressed / text-on-light variant
const BRAND_RED = '#E61417';

// ===== SOURCE IDENTITY =====
// The web gives each partner its own accent so Headout, Viator and the
// official/government portals are instantly distinguishable. We keep that idea
// but anchor it to the Prayana palette: teal for our own inventory, red for our
// affiliate ticket partners, and verified/neutral tones for the official portals.
type SourceKey = 'prayana' | 'headout' | 'viator' | 'government' | 'trust' | 'official';

interface SourceMeta {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
}

const SOURCE_META: Record<SourceKey, SourceMeta> = {
  prayana: { label: 'Prayana', icon: 'sparkles', accent: BRAND_TEAL },
  headout: { label: 'Headout', icon: 'ticket', accent: BRAND_RED },
  viator: { label: 'Viator', icon: 'ticket', accent: '#4F46E5' },
  government: { label: 'Government', icon: 'shield-checkmark', accent: '#16A34A' },
  trust: { label: 'Official Trust', icon: 'checkmark-circle', accent: '#2563EB' },
  official: { label: 'Official', icon: 'shield', accent: '#475569' },
};

// Shape of a booking card, whatever it was built from.
interface BookingLink {
  name?: string;
  url?: string;
  internal?: boolean;
  description?: string;
  bookingFor?: string[];
  authority?: string;
  source?: string;
  type?: string;
  domain?: string;
  image?: string;
  thumbnail?: string;
  priceFrom?: { amount?: number; currency?: string } | null;
  rating?: { value?: number; count?: number } | null;
  bookable?: boolean;
  isGovernment?: boolean;
  isTrust?: boolean;
  priority?: number;
  activityId?: string;
}

// Resolve a link to one of the source keys above. Same detection rules as the
// web (source / authority / bookable / domain).
function resolveSourceKey(link: BookingLink): SourceKey {
  const s = (link.source || '').toLowerCase();
  if (s === 'prayana' || s === 'internal' || link.internal === true || link.authority === 'Prayana') return 'prayana';
  if (s === 'headout' || link.authority === 'Headout') return 'headout';
  if (s === 'viator' || link.authority === 'Viator') return 'viator';
  if (link.isGovernment || link.type === 'Government' || link.domain?.includes('.gov.in')) return 'government';
  if (link.isTrust || link.type === 'Trust' || link.domain?.includes('.org.in')) return 'trust';
  return 'official';
}

function isBookableLink(link: BookingLink): boolean {
  const s = (link.source || '').toLowerCase();
  return link.bookable === true || s === 'headout' || s === 'viator' || s === 'prayana' || s === 'internal';
}

// Map a Prayana-onboarded ActivityListing (from /activities/search) into the
// shared BookingLink shape the cards render. Mirrors the web's
// mapActivityToLink — these link INTERNALLY to /activity/:id.
function mapActivityToLink(activity: any): BookingLink | null {
  if (!activity || typeof activity !== 'object') return null;

  const img =
    (Array.isArray(activity.images) &&
      (activity.images.find((i: any) => i?.isPrimary)?.url || activity.images[0]?.url)) ||
    null;

  // Customer-facing price after platform markup/discount; fall back to base price.
  const amount = activity.platformSellingPrice || activity.pricing?.basePrice || null;
  const priceFrom = amount
    ? { amount: Math.round(amount), currency: activity.pricing?.currency || 'INR' }
    : null;

  const ratingValue = Number(activity.rating?.average) || null;
  const rating = ratingValue ? { value: ratingValue, count: activity.rating?.count || 0 } : null;
  const categories = Array.isArray(activity.category) ? activity.category.slice(0, 2) : [];

  return {
    name: activity.title || 'Prayana Activity',
    url: activity._id ? `/activity/${activity._id}` : '',
    activityId: activity._id,
    internal: true,
    description: activity.shortDescription || '',
    bookingFor: categories.length > 0 ? categories : ['Activity'],
    authority: 'Prayana',
    source: 'prayana',
    image: img,
    priceFrom,
    rating,
    bookable: true,
  };
}

interface TicketsTabProps {
  placeData: any;
  placeName: string;
  location: string;
  imageGallery?: string[];
}

export const TicketsTab: React.FC<TicketsTabProps> = ({
  placeData,
  placeName,
  location,
  imageGallery = [],
}) => {
  const { themeColors, isDarkMode } = useTheme();
  const router = useRouter();

  const [links, setLinks] = useState<BookingLink[]>([]);
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);

  const resolvedName = placeData?.name || placeName || '';
  const category = placeData?.category || placeData?.detailedInfo?.category || '';

  useEffect(() => {
    let cancelled = false;

    const fetchBookingLinks = async () => {
      if (!resolvedName || !location) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Parallel, allSettled: one source failing never blanks out the other.
        const [bookingSettled, activitySettled] = await Promise.allSettled([
          ticketsAPI.getOfficialBookingLinks(resolvedName, location, category),
          activityMarketplaceAPI.searchActivities({
            city: location,
            limit: 6,
            sort: 'recommended',
          }),
        ]);
        if (cancelled) return;

        // --- Third-party / official portal links ---
        let bookingLinks: BookingLink[] = [];
        if (bookingSettled.status === 'fulfilled') {
          const result: any = bookingSettled.value;
          if (Array.isArray(result)) {
            bookingLinks = result;
          } else if (result && typeof result === 'object') {
            if (Array.isArray(result.links)) bookingLinks = result.links;
            else if (Array.isArray(result.data)) bookingLinks = result.data;
          }
          setCity(result?.city || location);
        } else {
          setCity(location);
        }

        // --- Our own Prayana activities (shown first) ---
        let activityLinks: BookingLink[] = [];
        if (activitySettled.status === 'fulfilled') {
          const activities = (activitySettled.value as any)?.data;
          if (Array.isArray(activities)) {
            activityLinks = activities
              .map(mapActivityToLink)
              .filter((l): l is BookingLink => !!l);
          }
        }

        setLinks([...activityLinks, ...bookingLinks]);
      } catch (err: any) {
        if (cancelled) return;
        console.warn('[TicketsTab] Failed to load booking links:', err?.message);
        setLinks([]);
        setCity(location);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBookingLinks();
    return () => {
      cancelled = true;
    };
  }, [resolvedName, location, category]);

  const openLink = useCallback(
    (link: BookingLink) => {
      const url = link.url || '';
      if (!url) return;

      // Our own inventory routes in-app; partner links are external affiliate
      // URLs and open in the browser.
      if (link.internal || link.activityId) {
        const id = link.activityId || url.replace('/activity/', '');
        if (id) router.push(`/activity/${id}` as any);
        return;
      }

      const full = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      Linking.openURL(full).catch((e) =>
        console.warn('[TicketsTab] Could not open URL:', full, e?.message)
      );
    },
    [router]
  );

  // ===== LOADING =====
  if (loading) {
    const skeletonColor = isDarkMode ? '#1F2937' : '#E5E7EB';
    return (
      <View style={styles.container}>
        <View style={styles.loadingHero}>
          <View style={[styles.loadingBadge, { backgroundColor: BRAND_TEAL }]}>
            <Ionicons name="ticket" size={26} color="#ffffff" />
          </View>
          <Text style={[styles.loadingTitle, { color: themeColors.text }]}>
            Getting your tickets ready
          </Text>
          <Text style={[styles.loadingSub, { color: themeColors.textTertiary }]}>
            Checking Prayana, Headout, Viator &amp; official partners…
          </Text>
          <ActivityIndicator
            size="small"
            color={BRAND_TEAL}
            style={{ marginTop: spacing.md }}
          />
        </View>

        {/* Skeletons mirror the real card: image on top, body below. */}
        {[0, 1, 2].map((i) => (
          <View
            key={`sk-${i}`}
            style={[
              styles.card,
              shadow.sm,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            ]}
          >
            <View style={[styles.cardImage, { backgroundColor: skeletonColor }]} />
            <View style={styles.cardBody}>
              <View style={[styles.skelLine, { width: '40%', backgroundColor: skeletonColor }]} />
              <View style={[styles.skelLine, { width: '80%', backgroundColor: skeletonColor }]} />
              <View style={[styles.skelLine, { width: '60%', backgroundColor: skeletonColor }]} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  // ===== EMPTY =====
  if (links.length === 0) {
    return <NoBookingRequired placeData={placeData} placeName={resolvedName} city={city || location} />;
  }

  // ===== SUCCESS =====
  const hasBookable = links.some(isBookableLink);
  const hasOfficial = links.some((l) => !isBookableLink(l));
  const trustSubline = hasBookable && hasOfficial
    ? 'Instantly bookable tickets + official partner portals'
    : hasBookable
      ? 'Instantly bookable tickets via trusted partners'
      : 'Verified official & government portals';

  const presentKeys = [...new Set(links.map(resolveSourceKey))];

  return (
    <View style={styles.container}>
      {/* Trust strip */}
      <View
        style={[
          styles.trustStrip,
          shadow.sm,
          { backgroundColor: themeColors.surface, borderColor: themeColors.border },
        ]}
      >
        <View style={[styles.trustIcon, { backgroundColor: BRAND_TEAL }]}>
          <Ionicons name="shield-checkmark" size={20} color="#ffffff" />
        </View>
        <View style={styles.trustText}>
          <Text style={[styles.trustTitle, { color: themeColors.text }]}>
            {links.length} way{links.length > 1 ? 's' : ''} to book
            {resolvedName ? ` ${resolvedName}` : ''}
          </Text>
          <Text style={[styles.trustSub, { color: themeColors.textTertiary }]} numberOfLines={2}>
            {trustSubline}
          </Text>
        </View>
      </View>

      {/* Source legend */}
      <View style={styles.legend}>
        {presentKeys.map((key) => {
          const meta = SOURCE_META[key];
          return (
            <View
              key={key}
              style={[
                styles.legendChip,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              ]}
            >
              <View style={[styles.legendDot, { backgroundColor: meta.accent }]} />
              <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>
                {meta.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Booking cards */}
      {links.map((link, index) => (
        <BookingCard
          key={`${link.url || 'link'}-${index}`}
          link={link}
          index={index}
          placeData={placeData}
          imageGallery={imageGallery}
          onPress={() => openLink(link)}
        />
      ))}

      {/* Bottom note — same copy as the web */}
      <View
        style={[
          styles.footerNote,
          { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB', borderColor: themeColors.border },
        ]}
      >
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={themeColors.textTertiary}
          style={{ marginTop: 1 }}
        />
        <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>
          <Text style={{ fontWeight: fontWeight.semibold, color: themeColors.text }}>
            Compare before you book.
          </Text>
          {' '}Prices and inclusions vary across partners — bookable tickets confirm instantly, while
          official portals may offer package deals. Always verify the final price on the provider's
          site before paying.
        </Text>
      </View>
    </View>
  );
};

// ===== BOOKING CARD =====
const BookingCard: React.FC<{
  link: BookingLink;
  index: number;
  placeData: any;
  imageGallery: string[];
  onPress: () => void;
}> = ({ link, index, placeData, imageGallery, onPress }) => {
  const { themeColors, isDarkMode } = useTheme();

  const sourceKey = resolveSourceKey(link);
  const meta = SOURCE_META[sourceKey];
  const bookable = isBookableLink(link);
  const isPrimary = index === 0 && link.priority === 1;

  // Image priority mirrors the web: link image → gallery (rotated by index) →
  // place image → link thumbnail → placeholder.
  const cardImage =
    resolveImageUrl(link.image || '') ||
    (imageGallery.length > 0 ? imageGallery[index % imageGallery.length] : '') ||
    resolveImageUrl(placeData?.image || '') ||
    resolveImageUrl(link.thumbnail || '') ||
    '';

  const disabled = !link.url;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.card,
        shadow.sm,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {/* Image */}
      <View style={styles.cardImageWrap}>
        {cardImage ? (
          <Image
            source={{ uri: cardImage }}
            style={styles.cardImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={[
              styles.cardImage,
              styles.cardImageEmpty,
              { backgroundColor: isDarkMode ? '#1F2937' : '#E5E7EB' },
            ]}
          >
            <Ionicons name="camera-outline" size={28} color={themeColors.textTertiary} />
          </View>
        )}

        {/* Source badge */}
        <View style={[styles.sourceBadge, { backgroundColor: meta.accent }]}>
          <Ionicons name={meta.icon} size={12} color="#ffffff" />
          <Text style={styles.sourceBadgeText}>{meta.label}</Text>
        </View>

        {/* Popular badge */}
        {isPrimary && (
          <View style={styles.popularBadge}>
            <Ionicons name="star" size={11} color="#D97706" />
            <Text style={styles.popularText}>POPULAR</Text>
          </View>
        )}

        {/* Rating chip */}
        {link.rating?.value ? (
          <View style={styles.ratingChip}>
            <Ionicons name="star" size={12} color="#FBBF24" />
            <Text style={styles.ratingText}>{Number(link.rating.value).toFixed(1)}</Text>
            {link.rating.count ? (
              <Text style={styles.ratingCount}>({link.rating.count})</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        {/* Type tags */}
        {Array.isArray(link.bookingFor) && link.bookingFor.length > 0 && (
          <View style={styles.tagRow}>
            {link.bookingFor.slice(0, 2).map((service, idx) => (
              <View
                key={idx}
                style={[styles.tag, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
              >
                <Text style={[styles.tagText, { color: themeColors.textTertiary }]}>
                  {String(service)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
          {link.name || 'Official Booking'}
        </Text>

        {link.description ? (
          <Text style={[styles.cardDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {link.description}
          </Text>
        ) : null}

        {/* Trust line */}
        <View style={styles.trustLine}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text style={[styles.trustLineText, { color: themeColors.textTertiary }]}>
            {bookable ? 'Verified · Instant confirmation' : 'Verified official portal'}
          </Text>
        </View>

        {/* Footer: price + CTA */}
        <View style={styles.cardFooter}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {link.priceFrom?.amount ? (
              <>
                <Text style={[styles.fromLabel, { color: themeColors.textTertiary }]}>FROM</Text>
                <Text style={[styles.priceText, { color: themeColors.text }]}>
                  {(link.priceFrom.currency || 'INR') === 'INR'
                    ? `₹${link.priceFrom.amount}`
                    : `${link.priceFrom.currency} ${link.priceFrom.amount}`}
                </Text>
              </>
            ) : (
              <View style={styles.viaRow}>
                <View style={[styles.legendDot, { backgroundColor: meta.accent }]} />
                <Text style={[styles.viaText, { color: meta.accent }]}>via {meta.label}</Text>
              </View>
            )}
          </View>

          <View style={[styles.ctaButton, { backgroundColor: BRAND_TEAL }]}>
            <Text style={styles.ctaText}>{bookable ? 'Book' : 'Visit'}</Text>
            <Ionicons name="arrow-forward" size={15} color="#ffffff" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ===== NO BOOKING REQUIRED =====
// Same three place archetypes (beach / nature / default) and the same copy as
// the web's NoBookingRequired.
interface PlaceTypeInfo {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tips: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; description: string }[];
  expectations: string[];
}

function determinePlaceType(placeData: any, placeName: string): PlaceTypeInfo {
  const category = (placeData?.category || '').toLowerCase();
  const name = (placeData?.name || placeName || '').toLowerCase();

  if (category.includes('beach') || name.includes('beach')) {
    return {
      title: 'No Advance Booking Required',
      description: 'This is a public beach - visit freely without tickets!',
      icon: 'camera',
      tips: [
        { icon: 'time-outline', title: 'Best Time', description: 'Early morning or sunset for stunning views' },
        { icon: 'information-circle-outline', title: 'Entry', description: 'Free entry, no tickets needed' },
        { icon: 'location-outline', title: 'Parking', description: 'Public parking available nearby' },
        { icon: 'sparkles-outline', title: 'Activities', description: 'Water sports and beach games available' },
      ],
      expectations: [
        'Free public access - no entry fees or advance booking',
        'Parking may have nominal charges (₹20-50)',
        'Food and beverage vendors available on the beach',
        'Ideal for photography, picnics, and relaxation',
        'Please respect local regulations and keep the beach clean',
      ],
    };
  }

  if (
    category.includes('nature') ||
    category.includes('park') ||
    name.includes('garden') ||
    name.includes('park')
  ) {
    return {
      title: 'Open to Public - No Tickets Required',
      description: 'This is a public space that welcomes visitors without advance booking.',
      icon: 'sparkles',
      tips: [
        { icon: 'time-outline', title: 'Timings', description: 'Usually open from sunrise to sunset' },
        { icon: 'information-circle-outline', title: 'Entry', description: 'Free or minimal entry fee at gate' },
        { icon: 'camera-outline', title: 'Photography', description: 'Perfect for nature photography' },
        { icon: 'location-outline', title: 'Facilities', description: 'Benches and walking paths available' },
      ],
      expectations: [
        'No advance booking or reservations needed',
        'Minimal or no entry fees (₹0-20)',
        'Perfect for morning walks and evening strolls',
        'Family-friendly environment with play areas',
        'Follow park rules and maintain cleanliness',
      ],
    };
  }

  return {
    title: 'No Online Booking Available',
    description: 'Visit directly and purchase tickets at the entrance if required.',
    icon: 'ticket',
    tips: [
      { icon: 'time-outline', title: 'Arrive Early', description: 'Beat the crowds by visiting early' },
      { icon: 'information-circle-outline', title: 'Tickets at Gate', description: 'Purchase entry tickets at counter' },
      { icon: 'card-outline', title: 'ID Proof', description: 'Carry valid identification' },
      { icon: 'cash-outline', title: 'Cash Ready', description: 'Keep cash handy for tickets' },
    ],
    expectations: [
      'No advance booking required - walk-in entry',
      'Tickets available at the entrance counter',
      'Carry valid ID proof for verification',
      'Check opening hours before visiting',
      'Peak season may have longer queues - arrive early',
    ],
  };
}

const NoBookingRequired: React.FC<{ placeData: any; placeName: string; city: string }> = ({
  placeData,
  placeName,
  city,
}) => {
  const { themeColors, isDarkMode } = useTheme();
  const info = determinePlaceType(placeData, placeName);

  return (
    <View style={styles.container}>
      {/* Hero */}
      <View
        style={[
          styles.emptyHero,
          { backgroundColor: isDarkMode ? '#0F172A' : '#F0FDFA', borderColor: themeColors.border },
        ]}
      >
        <View style={[styles.emptyIcon, { backgroundColor: BRAND_TEAL }]}>
          <Ionicons name={info.icon} size={30} color="#ffffff" />
        </View>
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>{info.title}</Text>
        <Text style={[styles.emptyDesc, { color: themeColors.textSecondary }]}>
          {info.description}
        </Text>
        {city ? (
          <View
            style={[
              styles.emptyCityPill,
              { backgroundColor: themeColors.surface, borderColor: BRAND_TEAL },
            ]}
          >
            <Ionicons name="location" size={14} color={BRAND_TEAL} />
            <Text style={[styles.emptyCityText, { color: BRAND_TEAL_DARK }]}>
              Located in {city}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Tips */}
      <View style={styles.sectionHeader}>
        <Ionicons name="sparkles" size={18} color={BRAND_TEAL} />
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
          Visiting Tips for {placeData?.name || placeName}
        </Text>
      </View>
      <View style={styles.tipsGrid}>
        {info.tips.map((tip, idx) => (
          <View
            key={idx}
            style={[
              styles.tipCard,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            ]}
          >
            <View style={[styles.tipIcon, { backgroundColor: BRAND_TEAL }]}>
              <Ionicons name={tip.icon} size={16} color="#ffffff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.tipTitle, { color: themeColors.text }]}>{tip.title}</Text>
              <Text style={[styles.tipDesc, { color: themeColors.textSecondary }]}>
                {tip.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Expectations */}
      <View style={styles.sectionHeader}>
        <Ionicons name="information-circle" size={18} color={BRAND_TEAL} />
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>What to Expect</Text>
      </View>
      <View
        style={[
          styles.expectCard,
          { backgroundColor: themeColors.surface, borderColor: themeColors.border },
        ]}
      >
        {info.expectations.map((e, idx) => (
          <View key={idx} style={styles.expectRow}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginTop: 1 }} />
            <Text style={[styles.expectText, { color: themeColors.textSecondary }]}>{e}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },

  // Loading
  loadingHero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  loadingBadge: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  loadingTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  loadingSub: { fontSize: fontSize.sm, textAlign: 'center' },
  skelLine: { height: 12, borderRadius: 6, opacity: 0.8 },

  // Trust strip
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  trustIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: { flex: 1, minWidth: 0 },
  trustTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  trustSub: { fontSize: fontSize.xs, marginTop: 2 },

  // Legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  // Card
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImageWrap: { position: 'relative', width: '100%' },
  cardImage: { width: '100%', aspectRatio: 16 / 10 },
  cardImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  sourceBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  sourceBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: fontWeight.semibold },
  popularBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  popularText: { color: '#B45309', fontSize: 10, fontWeight: fontWeight.bold },
  ratingChip: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  ratingText: { color: '#111827', fontSize: 12, fontWeight: fontWeight.bold },
  ratingCount: { color: '#6B7280', fontSize: 11 },

  cardBody: { padding: spacing.md, gap: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: borderRadius.sm },
  tagText: { fontSize: 10, fontWeight: fontWeight.semibold, textTransform: 'uppercase' },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: 20 },
  cardDesc: { fontSize: fontSize.sm, lineHeight: 19 },
  trustLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  trustLineText: { fontSize: 11, fontWeight: fontWeight.medium },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  fromLabel: { fontSize: 10, fontWeight: fontWeight.semibold, marginBottom: 1 },
  priceText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  viaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viaText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
  },
  ctaText: { color: '#ffffff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // Footer note
  footerNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  footerText: { flex: 1, fontSize: fontSize.sm, lineHeight: 19 },

  // Empty state
  emptyHero: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  emptyDesc: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  emptyCityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  emptyCityText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  tipsGrid: { gap: spacing.sm },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  tipIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: 2 },
  tipDesc: { fontSize: fontSize.xs, lineHeight: 17 },

  expectCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  expectRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  expectText: { flex: 1, fontSize: fontSize.sm, lineHeight: 19 },
});

export default TicketsTab;
