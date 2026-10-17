// /stays/[slug] — one property: photos, what it offers, its rules, a card per
// room type priced for the guest's dates and party, and guest reviews.
// Web parity: components/stays/discovery/StayDetailClient.
//
// Dates and party arrive as params (same as the web URL) and are edited
// here; every change refetches the property, whose `availability` block
// prices each room for that party. While a refetch is in flight the old
// availability is hidden, not just dimmed: Reserve must never carry prices
// or a room count from the previous dates to the checkout.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { staysAPI } from '@prayana/shared-services';
import { useGoBack } from '../../lib/goBack';
import { useRequireAuth } from '../../lib/useRequireAuth';
import {
  AMENITY_BY_ID,
  HOUSE_RULES,
  cancellationDetail,
  cancellationPolicy,
  propertyTypeLabel,
  timeLabel,
} from '../../lib/stayLabels';
import {
  asApiError,
  checkoutPath,
  datesProblem,
  inrWhole,
  mapSearchHref,
  plural,
  readStayQuery,
  type AvailabilityRow,
  type StayDates,
  type StayDetail,
  type StayPhoto,
  type StayQueryState,
  type StayRoomType,
} from '../../lib/stays';
import { Chip, RatingBadge, StarRow } from '../../components/stays/StayCard';
import { RoomTypeCard } from '../../components/stays/RoomTypeCard';
import { StayDateFields } from '../../components/stays/StayDateFields';
import { GuestRoomField } from '../../components/stays/GuestRoomPicker';
import { StayReviewsSection } from '../../components/stays/StayReviewsSection';
import { StayProblem } from '../../components/stays/StayNotices';
import { PhotoViewer, type ViewerPhoto } from '../../components/stays/PhotoViewer';

const AMENITIES_FOLDED = 10;

// Bookable rooms first (cheapest first), then ones the party doesn't fit,
// then sold out. Without dates, the property's own order.
function roomRank(a: AvailabilityRow | null): number {
  if (!a) return 0;
  if (a.fits && a.price) return 0;
  if (!a.fits) return 1;
  return 2;
}

type LoadState = { key: string | null; data: StayDetail | null; error: unknown };

// staysAPI is plain JS: its `children = []` default reads to TypeScript as
// never[], so the call is typed here.
type StayQueryArgs = { checkIn?: string; checkOut?: string; adults?: number; children?: number[]; rooms?: number };
const staysClient = staysAPI as unknown as {
  getStay: (slug: string, q: StayQueryArgs) => Promise<{ data?: StayDetail }>;
};

export default function StayDetailScreen() {
  const router = useRouter();
  const goBack = useGoBack('/stays');
  const requireAuth = useRequireAuth();
  const params = useLocalSearchParams<{
    slug: string;
    checkIn?: string;
    checkOut?: string;
    adults?: string;
    children?: string;
    rooms?: string;
  }>();
  const slug = String(params.slug || '');
  const { themeColors, brand, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const initial = useMemo(() => readStayQuery(params), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [query, setQuery] = useState<StayQueryState>(initial);
  const [dateDraft, setDateDraft] = useState<StayDates>({ checkIn: initial.checkIn, checkOut: initial.checkOut });
  const [retry, setRetry] = useState(0);

  // ---- fetch ----
  const fetchKey = JSON.stringify({ slug, ...query, retry });
  const [state, setState] = useState<LoadState>({ key: null, data: null, error: null });
  useEffect(() => {
    let alive = true;
    staysClient
      .getStay(slug, {
        checkIn: query.checkIn || undefined,
        checkOut: query.checkOut || undefined,
        adults: query.adults,
        children: query.children,
        rooms: query.rooms,
      })
      .then((r) => {
        if (alive) setState({ key: fetchKey, data: r?.data || null, error: null });
      })
      .catch((error: unknown) => {
        // Keep the property on screen if only the re-price failed.
        if (alive) setState((prev) => ({ key: fetchKey, data: prev.data, error }));
      });
    return () => {
      alive = false;
    };
    // fetchKey carries slug + query + retry.
  }, [fetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back (from the checkout, say) re-checks prices: rooms sell while
  // the guest is away, and Reserve must not offer one that's gone.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) setRetry((n) => n + 1);
      focusedOnce.current = true;
    }, []),
  );

  const fresh = state.key === fetchKey;
  const data = state.data;
  const error = fresh ? state.error : null;
  const refreshing = Boolean(data) && !fresh;
  // Only availability from a fetch for exactly these dates and guests — and
  // not while the date fields hold a half-edited pair the prices aren't for.
  const datesSettled = dateDraft.checkIn === query.checkIn && dateDraft.checkOut === query.checkOut;
  const availability = fresh && !error && datesSettled ? data?.availability || null : null;
  const avRows = availability && !availability.error ? availability.rooms || [] : null;

  // ---- scrolling to the dates box / rooms ----
  const scrollRef = useRef<ScrollView>(null);
  const datesY = useRef(0);
  const roomsY = useRef(0);
  const scrollTo = (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });

  // ---- gallery & photo viewer ----
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewer, setViewer] = useState<{ photos: ViewerPhoto[]; index: number; title?: string } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [allAmenities, setAllAmenities] = useState(false);

  // ---- editing dates & party ----
  const changeDates = (d: StayDates) => {
    setDateDraft(d);
    if (!datesProblem(d.checkIn, d.checkOut)) setQuery((q) => ({ ...q, ...d }));
  };
  const clearDates = () => {
    setDateDraft({ checkIn: '', checkOut: '' });
    setQuery((q) => ({ ...q, checkIn: '', checkOut: '' }));
  };

  // ---- before there's a property ----
  const topBar = (title?: string) => (
    <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={26} color={themeColors.text} />
      </TouchableOpacity>
      <Text style={[styles.topBarTitle, { color: themeColors.text }]} numberOfLines={1}>
        {title || 'Stay'}
      </Text>
      <View style={{ width: 26 }} />
    </View>
  );

  if (!data) {
    const status = asApiError(state.error).status;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        {topBar()}
        {!fresh ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : status === 404 || !state.error ? (
          <StayProblem
            icon="bed-outline"
            title="This stay isn't available"
            text="It may have been taken off Prayana, or the link isn't quite right."
            primary={{ label: 'Browse stays', onPress: () => router.replace('/stays' as any) }}
          />
        ) : (
          <StayProblem
            icon="cloud-offline-outline"
            title="Couldn't load this stay"
            text="Check your connection and try again."
            primary={{ label: 'Try again', onPress: () => setRetry((n) => n + 1) }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ---- the property ----
  const loc = data.location || {};
  const pol = data.policies || {};
  const rules = pol.houseRules || {};
  const place = [...new Set([loc.locality, loc.city, loc.state].filter(Boolean))].join(', ');
  const mapHref = mapSearchHref(loc.coordinates);

  // Cover first, then the rest of the property, then the rooms.
  const photos = data.photos || [];
  const ordered: StayPhoto[] = [
    ...photos.filter((p) => p.isCover),
    ...photos.filter((p) => !p.isCover && !p.roomTypeId),
    ...photos.filter((p) => !p.isCover && p.roomTypeId),
  ];
  const gallery: ViewerPhoto[] = ordered.length
    ? ordered.map((p) => ({ url: p.url, caption: p.caption }))
    : data.coverPhoto
      ? [{ url: data.coverPhoto }]
      : [];

  const rowFor = (rt: StayRoomType) => avRows?.find((a) => String(a.roomTypeId) === String(rt._id)) || null;
  const rooms = (data.roomTypes || [])
    .map((rt, i) => ({ rt, i, a: rowFor(rt) }))
    .sort((x, y) => roomRank(x.a) - roomRank(y.a) || (x.a?.price?.total ?? 0) - (y.a?.price?.total ?? 0) || x.i - y.i);

  const nights = availability && !availability.error ? availability.nights ?? null : null;
  const nightlyPrices = (data.roomTypes || []).map((r) => Number(r.price?.perNight)).filter((n) => n > 0);
  const fromNightly = nightlyPrices.length ? Math.min(...nightlyPrices) : null;
  const bookable = (avRows || []).filter((a) => a.fits && a.price);
  const cheapestTotal = bookable.length ? Math.min(...bookable.map((a) => a.price!.total)) : null;
  const serverDateError = availability?.error || null;
  const dateProblem = datesProblem(dateDraft.checkIn, dateDraft.checkOut) || serverDateError;

  const amenities = (data.amenities || []).map((id) => AMENITY_BY_ID[id]).filter(Boolean);
  const answeredRules = HOUSE_RULES.filter((r) => typeof rules[r.id] === 'boolean');
  const cancel = pol.cancellation ? cancellationPolicy(pol.cancellation) : null;
  const gstThreshold = data.gstThreshold || 7500;
  const longAbout = (data.description || '').length > 360;

  const reserve = (rt: StayRoomType, a: AvailabilityRow) => {
    if (!query.checkIn || !query.checkOut) return;
    const path = checkoutPath({
      slug: data.slug || slug,
      roomTypeId: rt._id,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      units: a.units,
      adults: query.adults,
      childrenAges: query.children,
    });
    if (
      !requireAuth({
        reason: 'Sign in to book this stay. Your booking and voucher will be saved to your account.',
        redirectAfter: path,
      })
    ) {
      return;
    }
    router.push(path as any);
  };

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== galleryIndex) setGalleryIndex(i);
  };

  const sectionTitle = [styles.sectionTitle, { color: themeColors.text }];
  const section = [styles.section, { borderTopColor: themeColors.border }];
  const galleryHeight = Math.min(320, Math.round(width * 0.66));

  const headline =
    cheapestTotal != null ? (
      <Text style={[styles.barPrice, { color: themeColors.text }]} numberOfLines={1}>
        <Text style={[styles.barSmall, { color: themeColors.textSecondary }]}>from </Text>
        {inrWhole(cheapestTotal)}
        <Text style={[styles.barSmall, { color: themeColors.textSecondary }]}>
          {' '}incl. taxes{nights ? ` · ${plural(nights, 'night')}` : ''}
        </Text>
      </Text>
    ) : avRows ? (
      <Text style={[styles.barSmall, { color: themeColors.textSecondary }]} numberOfLines={2}>
        No room fits these dates and guests. See the options.
      </Text>
    ) : fromNightly != null ? (
      <Text style={[styles.barPrice, { color: themeColors.text }]} numberOfLines={1}>
        <Text style={[styles.barSmall, { color: themeColors.textSecondary }]}>from </Text>
        {inrWhole(fromNightly)}
        <Text style={[styles.barSmall, { color: themeColors.textSecondary }]}> / night + taxes</Text>
      </Text>
    ) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {topBar(data.name)}

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 96 + insets.bottom }} keyboardShouldPersistTaps="handled">
        {/* Gallery */}
        {gallery.length ? (
          <View style={{ height: galleryHeight, backgroundColor: themeColors.backgroundSecondary }}>
            <FlatList
              data={gallery}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(p, i) => `${p.url}-${i}`}
              onMomentumScrollEnd={onGalleryScroll}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => setViewer({ photos: gallery, index, title: data.name })}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Photo ${index + 1} of ${gallery.length}${item.caption ? `: ${item.caption}` : ''}. Open full screen`}
                >
                  <Image source={{ uri: item.url }} style={{ width, height: galleryHeight }} contentFit="cover" transition={150} />
                </TouchableOpacity>
              )}
            />
            {gallery.length > 1 ? (
              <View style={styles.galleryCount} pointerEvents="none">
                <Ionicons name="images-outline" size={13} color="#fff" />
                <Text style={styles.galleryCountText}>
                  {galleryIndex + 1} / {gallery.length}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.noPhoto, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="bed-outline" size={44} color={themeColors.textTertiary} />
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.typeRow}>
            <Text style={[styles.type, { color: isDarkMode ? brand[300] : brand[700] }]}>{propertyTypeLabel(data.propertyType)}</Text>
            <StarRow stars={data.starRating} size={13} />
          </View>
          <Text style={[styles.name, { color: themeColors.text }]} accessibilityRole="header">
            {data.name}
          </Text>
          <RatingBadge rating={data.rating} google={data.google} size="md" showBoth />
          {place ? (
            <View style={styles.placeRow}>
              <Ionicons name="location-outline" size={15} color={themeColors.textTertiary} style={{ marginTop: 1 }} />
              <Text style={[styles.place, { color: themeColors.textSecondary }]}>
                {loc.exact && loc.address ? loc.address : place}
              </Text>
            </View>
          ) : null}
          {mapHref ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(mapHref).catch(() => {})}
              style={styles.mapLink}
              accessibilityRole="link"
              accessibilityLabel={loc.exact ? 'View on map, opens Google Maps' : 'View area on map, opens Google Maps'}
            >
              <Ionicons name="map-outline" size={15} color={brand[600]} />
              <Text style={[styles.mapLinkText, { color: brand[600] }]}>{loc.exact ? 'View on map' : 'View area on map'}</Text>
              <Ionicons name="open-outline" size={13} color={brand[600]} />
            </TouchableOpacity>
          ) : null}
          {!loc.exact ? (
            <Text style={[styles.small, { color: themeColors.textTertiary }]}>You'll get the exact address once you book.</Text>
          ) : null}

          <View style={styles.chips}>
            {data.rentalMode === 'entire_place' ? <Chip tone="brand" icon="home-outline" label="Entire place" /> : null}
            {data.hostOnSite && data.category === 'home' ? <Chip icon="person-outline" label="Host lives here" /> : null}
            {rules.coupleFriendly === true ? <Chip tone="brand" icon="heart-outline" label="Couple-friendly" /> : null}
            {rules.localIdAccepted === true ? <Chip icon="card-outline" label="Local ID OK" /> : null}
            {rules.petsAllowed === true ? <Chip icon="paw-outline" label="Pet-friendly" /> : null}
            {pol.cancellation && pol.cancellation !== 'non_refundable' ? (
              <Chip tone="green" icon="shield-checkmark-outline" label="Free cancellation" />
            ) : null}
          </View>
        </View>

        {/* Dates & guests */}
        <View
          style={[styles.box, { backgroundColor: isDarkMode ? themeColors.surface : themeColors.backgroundSecondary, borderColor: themeColors.border }]}
          onLayout={(e: LayoutChangeEvent) => {
            datesY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.boxTitle, { color: themeColors.text }]}>Your dates and guests</Text>
          <StayDateFields checkIn={dateDraft.checkIn} checkOut={dateDraft.checkOut} onChange={changeDates} error={dateProblem} />
          {dateDraft.checkIn || dateDraft.checkOut ? (
            <TouchableOpacity onPress={clearDates} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
              <Text style={[styles.link, { color: brand[600] }]}>Clear dates</Text>
            </TouchableOpacity>
          ) : null}
          <GuestRoomField
            value={{ adults: query.adults, children: query.children, rooms: query.rooms }}
            onChange={(p) => setQuery((q) => ({ ...q, ...p }))}
          />
          {refreshing ? (
            <View style={styles.statusRow} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={themeColors.textTertiary} />
              <Text style={[styles.small, { color: themeColors.textSecondary }]}>Checking prices…</Text>
            </View>
          ) : error ? (
            <View style={styles.statusRow}>
              <Text style={[styles.small, { color: colors.error, flex: 1 }]}>Couldn't check prices.</Text>
              <TouchableOpacity onPress={() => setRetry((n) => n + 1)} accessibilityRole="button">
                <Text style={[styles.link, { color: brand[600] }]}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Rooms */}
        <View
          style={[styles.sectionPad]}
          onLayout={(e: LayoutChangeEvent) => {
            roomsY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={sectionTitle}>Rooms</Text>
          <View style={{ gap: spacing.md, opacity: refreshing ? 0.5 : 1 }} pointerEvents={refreshing ? 'none' : 'auto'}>
            {rooms.length === 0 ? (
              <Text style={[styles.body, { color: themeColors.textSecondary }]}>No rooms are open for booking right now.</Text>
            ) : (
              rooms.map(({ rt, a }) => {
                const roomPhotos = photos.filter((p) => p.roomTypeId && String(p.roomTypeId) === String(rt._id));
                return (
                  <RoomTypeCard
                    key={rt._id}
                    room={rt}
                    photos={roomPhotos}
                    avail={a}
                    nights={nights}
                    adults={query.adults}
                    onReserve={(row) => reserve(rt, row)}
                    onBookRooms={(n) => setQuery((q) => ({ ...q, rooms: n }))}
                    onChooseDates={() => scrollTo(datesY.current)}
                    onOpenPhotos={() =>
                      setViewer({ photos: roomPhotos.map((p) => ({ url: p.url, caption: p.caption })), index: 0, title: rt.name })
                    }
                  />
                );
              })
            )}
          </View>
          <View style={styles.gstNote}>
            <Ionicons name="information-circle-outline" size={14} color={themeColors.textTertiary} style={{ marginTop: 1 }} />
            <Text style={[styles.small, { color: themeColors.textSecondary, flex: 1 }]}>
              Nightly prices are before GST: 5% on rooms up to {inrWhole(gstThreshold)} a night, 18% above. Totals include it.
            </Text>
          </View>
        </View>

        {/* About */}
        {data.description ? (
          <View style={section}>
            <Text style={sectionTitle}>About this stay</Text>
            <Text style={[styles.body, { color: themeColors.textSecondary }]} numberOfLines={longAbout && !aboutOpen ? 6 : undefined}>
              {data.description}
            </Text>
            {longAbout ? (
              <TouchableOpacity onPress={() => setAboutOpen((v) => !v)} accessibilityRole="button" style={styles.moreRow}>
                <Text style={[styles.link, { color: brand[600] }]}>{aboutOpen ? 'Show less' : 'Read more'}</Text>
                <Ionicons name={aboutOpen ? 'chevron-up' : 'chevron-down'} size={14} color={brand[600]} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Amenities */}
        {amenities.length ? (
          <View style={section}>
            <Text style={sectionTitle}>Amenities</Text>
            <View style={styles.amenityGrid}>
              {(allAmenities ? amenities : amenities.slice(0, AMENITIES_FOLDED)).map((a) => (
                <View key={a.id} style={styles.amenity}>
                  <Ionicons name={a.icon} size={16} color={isDarkMode ? '#6EE7B7' : '#059669'} />
                  <Text style={[styles.amenityText, { color: themeColors.textSecondary }]}>{a.label}</Text>
                </View>
              ))}
            </View>
            {amenities.length > AMENITIES_FOLDED ? (
              <TouchableOpacity onPress={() => setAllAmenities((v) => !v)} accessibilityRole="button" style={styles.moreRow}>
                <Text style={[styles.link, { color: brand[600] }]}>
                  {allAmenities ? 'Show fewer' : `Show all ${amenities.length} amenities`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Things to do */}
        {data.experiences?.length ? (
          <View style={section}>
            <Text style={sectionTitle}>Things to do here</Text>
            <View style={styles.chips}>
              {data.experiences.map((x) => (
                <Chip key={x} tone="brand" icon="sparkles-outline" label={x} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Rules & policies */}
        <View style={section}>
          <Text style={sectionTitle}>Rules & policies</Text>

          <View style={styles.policyHead}>
            <Ionicons name="time-outline" size={16} color={themeColors.textTertiary} />
            <Text style={[styles.policyTitle, { color: themeColors.text }]}>Check-in & check-out</Text>
          </View>
          {pol.checkInFrom ? (
            <Text style={[styles.body, { color: themeColors.textSecondary }]}>
              Check-in from {timeLabel(pol.checkInFrom)}
              {pol.checkInUntil ? ` until ${timeLabel(pol.checkInUntil)}` : ''}
            </Text>
          ) : null}
          {pol.checkOutBy ? (
            <Text style={[styles.body, { color: themeColors.textSecondary }]}>Check-out by {timeLabel(pol.checkOutBy)}</Text>
          ) : null}
          {pol.flexibleCheckout24h ? <Text style={[styles.body, { color: '#059669', fontWeight: fontWeight.semibold }]}>24-hour check-out</Text> : null}
          {pol.minCheckInAge ? (
            <Text style={[styles.body, { color: themeColors.textSecondary }]}>Main guest must be {pol.minCheckInAge} or older</Text>
          ) : null}

          <View style={styles.policyHead}>
            <Ionicons name="happy-outline" size={16} color={themeColors.textTertiary} />
            <Text style={[styles.policyTitle, { color: themeColors.text }]}>Children</Text>
          </View>
          <Text style={[styles.body, { color: themeColors.textSecondary }]}>
            {pol.childrenAllowed === false
              ? "This property doesn't take children."
              : (pol.childFreeUnderAge || 0) > 0
                ? `Children welcome. Kids under ${pol.childFreeUnderAge} stay free.`
                : 'Children welcome.'}
          </Text>

          <View style={styles.policyHead}>
            <Ionicons name="shield-checkmark-outline" size={16} color={themeColors.textTertiary} />
            <Text style={[styles.policyTitle, { color: themeColors.text }]}>Cancellation</Text>
          </View>
          {cancel ? (
            <>
              <Text style={[styles.body, { color: themeColors.text, fontWeight: fontWeight.medium }]}>{cancel.label}</Text>
              <Text style={[styles.body, { color: themeColors.textSecondary }]}>{cancellationDetail(pol.cancellation)}</Text>
            </>
          ) : (
            <Text style={[styles.body, { color: themeColors.textSecondary }]}>Shown at checkout.</Text>
          )}

          {answeredRules.length ? (
            <>
              <View style={styles.policyHead}>
                <Ionicons name="list-outline" size={16} color={themeColors.textTertiary} />
                <Text style={[styles.policyTitle, { color: themeColors.text }]}>House rules</Text>
              </View>
              {answeredRules.map((r) => {
                const yes = rules[r.id] === true;
                return (
                  <View key={r.id} style={[styles.ruleRow, { borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.body, { color: themeColors.textSecondary, flex: 1 }]}>{r.label}</Text>
                    <View style={styles.ruleAnswer}>
                      <Ionicons name={yes ? 'checkmark' : 'close'} size={16} color={yes ? '#059669' : themeColors.textTertiary} />
                      <Text style={[styles.ruleAnswerText, { color: yes ? '#059669' : themeColors.textTertiary }]}>{yes ? 'Yes' : 'No'}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}

          {pol.notes ? (
            <View style={[styles.notes, { backgroundColor: isDarkMode ? themeColors.surface : themeColors.backgroundSecondary, borderColor: themeColors.border }]}>
              <Text style={[styles.policyTitle, { color: themeColors.text }]}>Notes from the property</Text>
              <Text style={[styles.body, { color: themeColors.textSecondary, marginTop: 4 }]}>{pol.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Reviews */}
        <StayReviewsSection slug={data.slug || slug} summary={data.rating} style={section} titleStyle={sectionTitle} />
      </ScrollView>

      {/* Price + jump to the rooms */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: themeColors.surface, borderTopColor: themeColors.border, paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>{headline}</View>
        <Button
          title={avRows ? 'See rooms' : query.checkIn ? 'See rooms' : 'Add dates'}
          onPress={() => scrollTo(avRows || query.checkIn ? roomsY.current : datesY.current)}
          size="md"
        />
      </View>

      <PhotoViewer
        visible={Boolean(viewer)}
        photos={viewer?.photos || []}
        startIndex={viewer?.index || 0}
        title={viewer?.title}
        onClose={() => setViewer(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  galleryCount: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  galleryCountText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  noPhoto: { height: 160, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: 8 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  type: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
  name: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, lineHeight: 30 },
  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  place: { flex: 1, fontSize: fontSize.sm, lineHeight: 19 },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 2 },
  mapLinkText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  small: { fontSize: fontSize.xs, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  box: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  boxTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  sectionPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  section: { marginHorizontal: spacing.lg, paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  body: { fontSize: fontSize.sm, lineHeight: 21 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, alignSelf: 'flex-start' },
  gstNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.md },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  amenity: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: spacing.sm },
  amenityText: { flex: 1, fontSize: fontSize.sm },
  policyHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, marginBottom: 4 },
  policyTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  ruleAnswer: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ruleAnswerText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  notes: { marginTop: spacing.lg, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barPrice: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  barSmall: { fontSize: fontSize.xs, fontWeight: fontWeight.normal },
});
