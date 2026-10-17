// /stays — search, filters and results for hotels, homestays, hostels,
// resorts and villas. Web parity: components/stays/discovery/StaysSearchClient.
//
// The search (where, dates, guests) is edited in a sheet and applied with
// one tap; filters and sort likewise. Results page in as the list scrolls.
// With no destination the screen opens on every live stay and the popular
// places, so a first visit is never an empty form. Accepts `q` (TripBookings
// passes the trip's city) and the same date/party params as the web URL.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput as RNTextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import {
  Button,
  EmptyState,
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import { staysAPI } from '@prayana/shared-services';
import { useGoBack } from '../../lib/goBack';
import {
  datesProblem,
  errorCode,
  errorText,
  fmtDayNoYear,
  partySummary,
  plural,
  propertyPath,
  readStayQuery,
  type Party,
  type StayDates,
  type StaySearchCard,
} from '../../lib/stays';
import { StayCard } from '../../components/stays/StayCard';
import { StaySheet } from '../../components/stays/StaySheet';
import { StayDateFields } from '../../components/stays/StayDateFields';
import { PartyEditor, draftMissingAge, fromDraft, toDraft, type DraftParty } from '../../components/stays/GuestRoomPicker';
import { EMPTY_FILTERS, StayFiltersSheet, countFilters, type StayFilters } from '../../components/stays/StayFiltersSheet';

type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'rating';
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

type City = { city: string; state?: string; count?: number };

type Results = {
  items: StaySearchCard[];
  page: number;
  pages: number;
  total: number;
  nights: number | null;
};
const NO_RESULTS: Results = { items: [], page: 0, pages: 1, total: 0, nights: null };

const dedupe = (list: StaySearchCard[]) => {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s._id) ? false : (seen.add(s._id), true)));
};

export default function StaysSearchScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)');
  const params = useLocalSearchParams<{
    q?: string;
    city?: string;
    checkIn?: string;
    checkOut?: string;
    adults?: string;
    children?: string;
    rooms?: string;
  }>();
  const { themeColors, brand, isDarkMode } = useTheme();

  // ---- what's searched (applied) ----
  const initial = useMemo(() => readStayQuery(params), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState(() => String(params.q || params.city || '').trim().slice(0, 80));
  const [dates, setDates] = useState<StayDates>({ checkIn: initial.checkIn, checkOut: initial.checkOut });
  const [party, setParty] = useState<Party>({ adults: initial.adults, children: initial.children, rooms: initial.rooms });
  const [filters, setFilters] = useState<StayFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('recommended');

  // A new `q` param (TripBookings linking in again) replaces the destination.
  const paramQ = String(params.q || params.city || '').trim().slice(0, 80);
  const lastParamQ = useRef(paramQ);
  useEffect(() => {
    if (paramQ !== lastParamQ.current) {
      lastParamQ.current = paramQ;
      setQ(paramQ);
    }
  }, [paramQ]);

  // ---- results ----
  const [res, setRes] = useState<Results>(NO_RESULTS);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<{ badDates: boolean; message: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const searchParams = useMemo(
    () => ({
      q: q || undefined,
      checkIn: dates.checkIn || undefined,
      checkOut: dates.checkOut || undefined,
      adults: party.adults,
      children: party.children,
      rooms: party.rooms,
      types: filters.types,
      minPrice: filters.minPrice || undefined,
      maxPrice: filters.maxPrice || undefined,
      amenities: filters.amenities,
      coupleFriendly: filters.coupleFriendly,
      localId: filters.localId,
      pets: filters.pets,
      freeCancellation: filters.freeCancellation,
      stars: filters.stars || undefined,
      sort: sort === 'recommended' ? undefined : sort,
    }),
    [q, dates, party, filters, sort],
  );

  const runSearch = useCallback(
    async (mode: 'fresh' | 'refresh') => {
      const my = ++seq.current;
      if (mode === 'fresh') {
        setStatus('loading');
        setRes(NO_RESULTS);
      }
      setMoreFailed(false);
      setLoadingMore(false);
      try {
        const r = await staysAPI.search({ ...searchParams, page: 1 });
        if (my !== seq.current) return;
        const items = dedupe((r?.data as StaySearchCard[]) || []);
        setRes({
          items,
          page: 1,
          pages: Number(r?.pages) || 1,
          total: Number(r?.total ?? items.length) || 0,
          nights: r?.search?.nights ?? null,
        });
        setError(null);
        setStatus('ready');
      } catch (e) {
        if (my !== seq.current) return;
        setError({ badDates: errorCode(e) === 'BAD_DATES', message: errorText(e, 'Check your connection and try again.') });
        setStatus('error');
      } finally {
        if (my === seq.current) setRefreshing(false);
      }
    },
    [searchParams],
  );

  useEffect(() => {
    runSearch('fresh');
  }, [runSearch]);

  // `retry` (the footer's Try again) skips the failed-page guard; scrolling
  // to the end doesn't, so a failing page isn't hammered.
  const loadMore = useCallback(async (retry?: unknown) => {
    if (status !== 'ready' || loadingMore || (moreFailed && retry !== true) || res.page >= res.pages) return;
    const my = seq.current;
    const next = res.page + 1;
    setMoreFailed(false);
    setLoadingMore(true);
    try {
      const r = await staysAPI.search({ ...searchParams, page: next });
      if (my !== seq.current) return;
      setRes((prev) => ({
        ...prev,
        items: dedupe([...prev.items, ...((r?.data as StaySearchCard[]) || [])]),
        page: next,
        pages: Number(r?.pages) || prev.pages,
        total: Number(r?.total ?? prev.total) || prev.total,
      }));
    } catch {
      if (my === seq.current) setMoreFailed(true);
    } finally {
      if (my === seq.current) setLoadingMore(false);
    }
  }, [status, loadingMore, moreFailed, res.page, res.pages, searchParams]);

  // ---- places for suggestions and chips ----
  const [cities, setCities] = useState<City[]>([]);
  useEffect(() => {
    let alive = true;
    staysAPI
      .cities()
      .then((r: { data?: City[] }) => alive && setCities(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // ---- sheets ----
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // The search sheet edits a draft; Search applies it.
  const [draftQ, setDraftQ] = useState('');
  const [draftDates, setDraftDates] = useState<StayDates>(dates);
  const [draftParty, setDraftParty] = useState<DraftParty>(toDraft(party));
  const [partyOpen, setPartyOpen] = useState(false);
  const [partyWarn, setPartyWarn] = useState(false);
  const [destFocused, setDestFocused] = useState(false);

  const openSearch = () => {
    setDraftQ(q);
    setDraftDates(dates);
    setDraftParty(toDraft(party));
    setPartyOpen(false);
    setPartyWarn(false);
    setSearchOpen(true);
  };

  const draftProblem = datesProblem(draftDates.checkIn, draftDates.checkOut);
  const applySearch = () => {
    if (draftProblem) return;
    if (draftMissingAge(draftParty)) {
      setPartyOpen(true);
      setPartyWarn(true);
      return;
    }
    Keyboard.dismiss();
    setQ(draftQ.trim().slice(0, 80));
    setDates(draftDates);
    setParty(fromDraft(draftParty));
    setSearchOpen(false);
  };

  const pickPlace = (city: string) => setQ(city);
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const clearDates = () => setDates({ checkIn: '', checkOut: '' });

  const text = draftQ.trim().toLowerCase();
  const matches = (
    text ? cities.filter((c) => c.city?.toLowerCase().includes(text) || c.state?.toLowerCase().includes(text)) : cities
  ).slice(0, 6);
  const exact = matches.length === 1 && matches[0].city?.toLowerCase() === text;
  const showSuggestions = destFocused && matches.length > 0 && !exact;

  // ---- derived ----
  const hasDates = Boolean(dates.checkIn && dates.checkOut);
  const filterCount = countFilters(filters);
  const summary = hasDates
    ? `${fmtDayNoYear(dates.checkIn)} – ${fmtDayNoYear(dates.checkOut)}${res.nights ? ` · ${plural(res.nights, 'night')}` : ''} · ${partySummary(party)}`
    : `Add dates · ${partySummary(party)}`;
  const heading =
    status === 'loading'
      ? 'Finding stays…'
      : status === 'error'
        ? q
          ? `Stays in ${q}`
          : 'All stays'
        : `${res.total.toLocaleString('en-IN')} ${res.total === 1 ? 'stay' : 'stays'}${q ? ` in ${q}` : ''}`;
  const sortLabel = SORTS.find((s) => s.value === sort)?.label || 'Sort';

  const placeChips = (centered = false) =>
    cities.length ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.placeRow, centered && { paddingTop: 0 }]}
        keyboardShouldPersistTaps="handled"
      >
        {cities.slice(0, 10).map((c) => (
          <TouchableOpacity
            key={`${c.city}-${c.state}`}
            onPress={() => pickPlace(c.city)}
            style={[styles.placeChip, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            accessibilityRole="button"
            accessibilityLabel={`Stays in ${c.city}${c.count ? `, ${plural(c.count, 'stay')}` : ''}`}
          >
            <Ionicons name="location" size={13} color={brand[500]} />
            <Text style={[styles.placeChipText, { color: themeColors.text }]}>{c.city}</Text>
            {c.count ? <Text style={[styles.placeChipCount, { color: themeColors.textTertiary }]}>{c.count}</Text> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    ) : null;

  const listHeader = !q ? (
    <View style={styles.hero}>
      <Text style={[styles.heroTitle, { color: themeColors.text }]}>Hotels, homestays and hostels across India</Text>
      <Text style={[styles.heroSub, { color: themeColors.textSecondary }]}>
        Pick your dates to see the full price for your group, taxes included, before you book.
      </Text>
      {cities.length ? <Text style={[styles.heroLabel, { color: themeColors.text }]}>Popular places</Text> : null}
      {placeChips()}
    </View>
  ) : null;

  const emptyView = () => {
    if (status === 'loading') {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      );
    }
    if (status === 'error' && error) {
      return error.badDates ? (
        <EmptyState
          icon={<Ionicons name="calendar-outline" size={52} color={themeColors.textTertiary} />}
          title="Those dates don't work"
          description={error.message || 'Check your check-in and check-out dates.'}
          actionLabel="Search without dates"
          onAction={clearDates}
        />
      ) : (
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={52} color={themeColors.textTertiary} />}
          title="Couldn't load stays"
          description={error.message}
          actionLabel="Try again"
          onAction={() => runSearch('fresh')}
        />
      );
    }
    if (filterCount > 0) {
      return (
        <EmptyState
          icon={<Ionicons name="funnel-outline" size={52} color={themeColors.textTertiary} />}
          title="No stays match these filters"
          description="Try removing a filter or two."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      );
    }
    return (
      <View>
        <EmptyState
          icon={<Ionicons name={q ? 'location-outline' : 'bed-outline'} size={52} color={themeColors.textTertiary} />}
          title={q ? `No stays in ${q} yet` : 'No stays listed yet'}
          description={q ? (cities.length ? 'Try a nearby place, or one of these:' : 'Try a nearby city or a different spelling.') : 'Check back soon.'}
        />
        {q ? placeChips(true) : null}
      </View>
    );
  };

  const footer =
    status !== 'ready' || res.items.length === 0 ? null : loadingMore ? (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary[500]} />
      </View>
    ) : moreFailed ? (
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.error }]}>Couldn't load more stays.</Text>
        <Button title="Try again" variant="outline" size="sm" onPress={() => loadMore(true)} />
      </View>
    ) : (
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: themeColors.textTertiary }]}>
          Showing {res.items.length} of {res.total.toLocaleString('en-IN')}
        </Text>
      </View>
    );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Stays</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Search summary — opens the search sheet */}
      <View style={[styles.searchWrap, { backgroundColor: themeColors.surface }]}>
        <TouchableOpacity
          onPress={openSearch}
          style={[styles.searchPill, { backgroundColor: isDarkMode ? themeColors.surfaceElevated : themeColors.backgroundSecondary, borderColor: themeColors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Search: ${q || 'anywhere'}. ${summary}. Change search`}
        >
          <Ionicons name="search" size={18} color={brand[500]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.searchWhere, { color: themeColors.text }]} numberOfLines={1}>
              {q || 'Where to?'}
            </Text>
            <Text style={[styles.searchWhen, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {summary}
            </Text>
          </View>
          <View style={[styles.editBadge, { backgroundColor: brand[500] }]}>
            <Text style={styles.editBadgeText}>Edit</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Count, filters, sort */}
      <View style={[styles.toolbar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.heading, { color: themeColors.text }]} numberOfLines={1} accessibilityLiveRegion="polite">
            {heading}
          </Text>
          {!hasDates ? (
            <Text style={[styles.subheading, { color: themeColors.textSecondary }]} numberOfLines={1}>
              Add dates to see prices for your stay
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => setFiltersOpen(true)}
          style={[
            styles.toolBtn,
            { borderColor: filterCount ? brand[500] : themeColors.border },
            filterCount ? { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.16)' : brand[50] } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Filters${filterCount ? `, ${filterCount} on` : ''}`}
        >
          <Ionicons name="options-outline" size={16} color={filterCount ? brand[600] : themeColors.text} />
          <Text style={[styles.toolBtnText, { color: filterCount ? brand[600] : themeColors.text }]}>
            {filterCount ? `Filters (${filterCount})` : 'Filters'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortOpen(true)}
          style={[styles.toolBtn, { borderColor: themeColors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Sort: ${sortLabel}`}
        >
          <Ionicons name="swap-vertical" size={16} color={themeColors.text} />
          <Text style={[styles.toolBtnText, { color: themeColors.text }]}>Sort</Text>
        </TouchableOpacity>
      </View>

      <FlashList
        data={status === 'ready' ? res.items : []}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <StayCard
            stay={item}
            dates={hasDates ? dates : null}
            onPress={() => router.push(propertyPath(item.slug, { ...dates, ...party }) as any)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyView()}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing['3xl'] }}
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              runSearch('refresh');
            }}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      />

      {/* Search sheet */}
      <StaySheet
        visible={searchOpen}
        title="Search stays"
        onClose={() => setSearchOpen(false)}
        maxHeight={0.92}
        footer={
          <Button
            title="Search"
            onPress={applySearch}
            size="lg"
            fullWidth
            disabled={Boolean(draftProblem)}
            icon={<Ionicons name="search" size={18} color="#fff" />}
          />
        }
      >
        <View style={{ gap: spacing.lg }}>
          <View>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Where</Text>
            <View style={[styles.destBox, { backgroundColor: themeColors.field, borderColor: destFocused ? brand[500] : themeColors.fieldBorder }]}>
              <Ionicons name="search" size={17} color={themeColors.textTertiary} />
              <RNTextInput
                value={draftQ}
                onChangeText={(t) => setDraftQ(t.slice(0, 80))}
                placeholder="City, area or property"
                placeholderTextColor={themeColors.textTertiary}
                style={[styles.destInput, { color: themeColors.text }]}
                onFocus={() => setDestFocused(true)}
                onBlur={() => setDestFocused(false)}
                returnKeyType="search"
                onSubmitEditing={applySearch}
                autoCorrect={false}
                accessibilityLabel="Destination"
              />
              {draftQ ? (
                <TouchableOpacity onPress={() => setDraftQ('')} accessibilityRole="button" accessibilityLabel="Clear destination" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {showSuggestions ? (
              <View style={[styles.suggestions, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                {!text ? <Text style={[styles.suggestHead, { color: themeColors.textTertiary }]}>POPULAR PLACES</Text> : null}
                {matches.map((c) => (
                  <TouchableOpacity
                    key={`${c.city}-${c.state}`}
                    onPress={() => {
                      setDraftQ(c.city);
                      Keyboard.dismiss();
                    }}
                    style={styles.suggestRow}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.city}${c.state ? `, ${c.state}` : ''}`}
                  >
                    <Ionicons name="location-outline" size={16} color={brand[500]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestCity, { color: themeColors.text }]} numberOfLines={1}>{c.city}</Text>
                      {c.state ? <Text style={[styles.suggestState, { color: themeColors.textSecondary }]} numberOfLines={1}>{c.state}</Text> : null}
                    </View>
                    {c.count ? (
                      <Text style={[styles.suggestCount, { color: themeColors.textTertiary }]}>{plural(c.count, 'stay')}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          <StayDateFields
            checkIn={draftDates.checkIn}
            checkOut={draftDates.checkOut}
            onChange={setDraftDates}
            error={draftProblem}
          />
          {draftDates.checkIn || draftDates.checkOut ? (
            <TouchableOpacity onPress={() => setDraftDates({ checkIn: '', checkOut: '' })} accessibilityRole="button" style={{ marginTop: -spacing.sm }}>
              <Text style={[styles.link, { color: brand[600] }]}>Clear dates</Text>
            </TouchableOpacity>
          ) : null}

          <View>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Guests</Text>
            <TouchableOpacity
              onPress={() => setPartyOpen((v) => !v)}
              style={[styles.destBox, { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder, paddingVertical: spacing.md + 2 }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: partyOpen }}
              accessibilityLabel={`Guests: ${partySummary(draftParty)}`}
            >
              <Ionicons name="people-outline" size={17} color={themeColors.textSecondary} />
              <Text style={[styles.destInput, { color: themeColors.text, paddingVertical: 0 }]} numberOfLines={1}>
                {partySummary(draftParty)}
              </Text>
              <Ionicons name={partyOpen ? 'chevron-up' : 'chevron-down'} size={16} color={themeColors.textTertiary} />
            </TouchableOpacity>
            {partyOpen ? (
              <View style={{ marginTop: spacing.sm }}>
                <PartyEditor
                  value={draftParty}
                  onChange={(d) => {
                    setPartyWarn(false);
                    setDraftParty(d);
                  }}
                  warn={partyWarn}
                />
              </View>
            ) : null}
          </View>
        </View>
      </StaySheet>

      <StayFiltersSheet
        visible={filtersOpen}
        value={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setFiltersOpen(false);
        }}
      />

      <StaySheet visible={sortOpen} title="Sort by" onClose={() => setSortOpen(false)}>
        {SORTS.map((s) => {
          const on = sort === s.value;
          return (
            <TouchableOpacity
              key={s.value}
              onPress={() => {
                setSort(s.value);
                setSortOpen(false);
              }}
              style={[styles.sortRow, { borderBottomColor: themeColors.border }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.sortText, { color: on ? brand[600] : themeColors.text }, on && { fontWeight: fontWeight.bold }]}>
                {s.label}
              </Text>
              {on ? <Ionicons name="checkmark" size={20} color={brand[600]} /> : null}
            </TouchableOpacity>
          );
        })}
      </StaySheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { paddingVertical: spacing['4xl'], alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  searchWhere: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  searchWhen: { fontSize: fontSize.xs, marginTop: 1 },
  editBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full },
  editBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heading: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  subheading: { fontSize: fontSize.xs, marginTop: 1 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  toolBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  heroTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, lineHeight: 26 },
  heroSub: { fontSize: fontSize.sm, marginTop: 6, lineHeight: 19 },
  heroLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: spacing.lg },
  placeRow: { gap: spacing.sm, paddingTop: spacing.sm, paddingRight: spacing.lg },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  placeChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  placeChipCount: { fontSize: fontSize.xs },
  footer: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  footerText: { fontSize: fontSize.xs },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  destBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
  },
  destInput: { flex: 1, fontSize: fontSize.md, paddingVertical: spacing.md },
  suggestions: { marginTop: spacing.sm, borderWidth: 1, borderRadius: borderRadius.lg, paddingVertical: 4 },
  suggestHead: { fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.6, paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 2 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  suggestCity: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  suggestState: { fontSize: fontSize.xs },
  suggestCount: { fontSize: fontSize.xs },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortText: { fontSize: fontSize.md },
});
