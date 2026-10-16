// DestinationEditionView — the magazine-style country landing page (web
// components/destinations/DestinationEditionView). Used by
// /experiences-in/[slug]; India keeps its bespoke /india-experiences.
//
//   1. Cover — an auto-paging carousel of the country's top cities, shot from
//      LIVE inventory, under the edition's masthead.
//   2. Editor's letter — the edition's own copy and numbered highlights.
//   3. "Where to go" — top cities as editorial tiles; a tap narrows the grid.
//   4. The catalogue — /activities/global?country=, filtered by city and
//      category on the server, 12 at a time.
//
// Accent colours come from the edition; every photo comes from the feed.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@prayana/shared-ui';
import { RAIL_PAD } from '../../lib/railLayout';
import { goBack } from '../../lib/goBack';
import { DestinationEdition, editionImage } from '../../lib/destinationEditions';
import {
  CardPair,
  CategoryChips,
  CityEntry,
  GRID_CARD_W,
  LoadMoreButton,
  PLACE_CATEGORIES,
  ScopeNote,
  SkeletonPairs,
  StateBlock,
  chunkPairs,
  topCitiesOf,
  useGlobalCatalogue,
  usePlaceSample,
} from './PlaceExperiences';

type Icon = keyof typeof Ionicons.glyphMap;

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const SCREEN_W = Dimensions.get('window').width;
const COVER_W = SCREEN_W - RAIL_PAD * 2;
const COVER_H = Math.round(COVER_W * 1.08);
const AUTO_PAGE_MS = 4500;

/* ─── cover ─── */

function Cover({ edition, frames }: { edition: DestinationEdition; frames: CityEntry[] }) {
  const ref = useRef<ScrollView>(null);
  const [frame, setFrame] = useState(0);
  const dragging = useRef(false);
  const count = frames.length;
  const fallback = editionImage(edition, 1200);

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => {
      if (dragging.current) return;
      setFrame((f) => {
        const next = (f + 1) % count;
        ref.current?.scrollTo({ x: next * COVER_W, animated: true });
        return next;
      });
    }, AUTO_PAGE_MS);
    return () => clearInterval(t);
  }, [count]);

  const active = count ? frames[Math.min(frame, count - 1)] : null;
  const vol = edition.masthead.split('·').pop()?.trim() || 'Vol 01';

  return (
    <View style={s.cover}>
      {count > 0 ? (
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => {
            dragging.current = true;
          }}
          onMomentumScrollEnd={(e) => {
            dragging.current = false;
            setFrame(Math.round(e.nativeEvent.contentOffset.x / COVER_W));
          }}
        >
          {frames.map((f, i) => (
            <Image
              key={f.city}
              source={{ uri: f.image! }}
              style={{ width: COVER_W, height: COVER_H }}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
              priority={i === 0 ? 'high' : 'normal'}
            />
          ))}
        </ScrollView>
      ) : fallback ? (
        <Image source={{ uri: fallback }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} cachePolicy="memory-disk" />
      ) : (
        <LinearGradient colors={[edition.accent.from, edition.accent.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <LinearGradient
          pointerEvents="none"
          colors={[`${edition.accent.from}99`, 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.3, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={s.coverTop} pointerEvents="box-none">
          <Pressable onPress={() => goBack('/experiences-in')} hitSlop={10} style={s.glassBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={21} color="#FFFFFF" />
          </Pressable>
          <View style={s.masthead} pointerEvents="none">
            <Text style={s.mastEmoji}>{edition.emoji}</Text>
            <Text style={s.mastText} numberOfLines={1}>
              {edition.masthead}
            </Text>
          </View>
        </View>

        {count > 1 && (
          <View style={s.counter} pointerEvents="none">
            <Text style={s.counterText}>
              {String(frame + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </Text>
          </View>
        )}

        <View style={s.coverBottom} pointerEvents="box-none">
          <Text style={s.coverEyebrow}>{active ? 'On the cover' : vol}</Text>
          <Text style={s.coverCity} numberOfLines={1}>
            {active ? active.city : edition.displayName}
          </Text>
          <Text style={s.coverTagline} numberOfLines={2}>
            {active?.count
              ? `${active.count}+ experience${active.count === 1 ? '' : 's'} · ${edition.tagline}`
              : edition.tagline}
          </Text>
          {count > 1 && (
            <View style={s.dots}>
              {frames.map((f, i) => (
                <Pressable
                  key={f.city}
                  hitSlop={6}
                  onPress={() => {
                    setFrame(i);
                    ref.current?.scrollTo({ x: i * COVER_W, animated: true });
                  }}
                  accessibilityLabel={`Show ${f.city}`}
                  style={[s.dot, i === frame && s.dotOn]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* ─── editor's letter ─── */

function Letter({ edition, onExplore }: { edition: DestinationEdition; onExplore: () => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const accent = edition.accent.solid;
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const vol = edition.masthead.split('·').pop()?.trim() || 'Vol 01';
  return (
    <View style={[s.letter, { backgroundColor: themeColors.surface, borderColor: line }]}>
      <Text style={s.letterEmoji} pointerEvents="none">
        {edition.emoji}
      </Text>
      <View style={s.letterTop}>
        <View style={s.rowCenter}>
          <Ionicons name="compass" size={15} color={accent} />
          <Text style={[s.letterEyebrow, { color: accent }]}>Editor&apos;s letter</Text>
        </View>
        <Text style={[s.letterVol, { color: themeColors.textTertiary }]}>{vol} · Issue 01</Text>
      </View>

      <Text style={[s.quote, { color: `${accent}AA` }]}>“</Text>
      <Text style={[s.letterTitle, { color: themeColors.text }]}>{edition.editorTitle}</Text>

      <LinearGradient
        colors={[line, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.rule}
      />

      <Text style={[s.letterBody, { color: themeColors.textSecondary }]}>
        <Text style={[s.letterLead, { color: accent }]}>{edition.editorLead.toUpperCase()}</Text> {edition.editorBody}
      </Text>

      <View style={s.highlights}>
        {edition.highlights.map((h, i) => (
          <View key={h} style={s.highlight}>
            <Text style={[s.hlNum, { color: accent }]}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={[s.hlText, { color: themeColors.text }]}>{h}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={onExplore} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
        <LinearGradient colors={[edition.accent.from, edition.accent.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
          <Text style={s.ctaText}>Explore {edition.displayName} experiences</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
      <View style={[s.rowCenter, { justifyContent: 'center', marginTop: 12 }]}>
        <Ionicons name="sparkles" size={12} color={accent} />
        <Text style={[s.curated, { color: themeColors.textTertiary }]}>Curated · refreshed weekly</Text>
      </View>
    </View>
  );
}

/* ─── section header ─── */

function SectionHeader({
  edition,
  eyebrow,
  icon,
  lead,
  em,
  subtitle,
  meta,
}: {
  edition: DestinationEdition;
  eyebrow: string;
  icon: Icon;
  lead: string;
  em: string;
  subtitle?: string;
  meta?: string | null;
}) {
  const { themeColors } = useTheme();
  const accent = edition.accent.solid;
  return (
    <View style={s.sectionHead}>
      <View style={[s.eyebrowPill, { backgroundColor: themeColors.surface, borderColor: `${accent}40` }]}>
        <LinearGradient colors={[edition.accent.from, edition.accent.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.eyebrowIcon}>
          <Ionicons name={icon} size={12} color="#FFFFFF" />
        </LinearGradient>
        <Text style={[s.eyebrowText, { color: themeColors.text }]}>{eyebrow}</Text>
      </View>
      <Text style={[s.sectionTitle, { color: themeColors.text }]}>
        {lead} <Text style={{ color: accent }}>{em}</Text>
      </Text>
      {!!subtitle && <Text style={[s.sectionSub, { color: themeColors.textSecondary }]}>{subtitle}</Text>}
      {!!meta && (
        <View style={[s.meta, { backgroundColor: `${accent}14`, borderColor: `${accent}33` }]}>
          <Text style={[s.metaText, { color: accent }]}>{meta}</Text>
        </View>
      )}
    </View>
  );
}

/* ─── city tile ─── */

function CityTile({ entry, edition, onPick }: { entry: CityEntry; edition: DestinationEdition; onPick: () => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  return (
    <Pressable
      onPress={onPick}
      style={({ pressed }) => [s.tile, { backgroundColor: themeColors.surface, borderColor: line }, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.city}, ${entry.count} experiences`}
    >
      <View style={s.tileImg}>
        {entry.image ? (
          <Image source={{ uri: entry.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <LinearGradient colors={[edition.accent.from, edition.accent.to]} style={[StyleSheet.absoluteFill, s.center]}>
            <Ionicons name="location" size={32} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        )}
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.85)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
        <View style={s.tilePill}>
          <View style={[s.tileDot, { backgroundColor: edition.accent.solid }]} />
          <Text style={s.tilePillText}>
            {entry.count} exp{entry.count === 1 ? '' : 's'}
          </Text>
        </View>
        <Text style={s.tileCity} numberOfLines={2}>
          {entry.city}
        </Text>
      </View>
      <View style={s.tileFoot}>
        <Text style={[s.tileFootText, { color: themeColors.textSecondary }]}>See experiences</Text>
        <Ionicons name="arrow-forward" size={14} color={edition.accent.solid} />
      </View>
    </Pressable>
  );
}

/* ─── page ─── */

type Row =
  | { key: string; kind: 'cover' }
  | { key: string; kind: 'letter' }
  | { key: string; kind: 'where' }
  | { key: string; kind: 'catHead' }
  | { key: string; kind: 'bar' }
  | { key: string; kind: 'pair'; pair: any[] }
  | { key: string; kind: 'skeleton' }
  | { key: string; kind: 'state' }
  | { key: string; kind: 'footer' };

export function DestinationEditionView({ edition }: { edition: DestinationEdition }) {
  const { themeColors, isDarkMode } = useTheme();
  const { country, displayName } = edition;
  const accent = edition.accent.solid;

  const sample = usePlaceSample(country, 48);
  const topCities = useMemo(() => topCitiesOf(sample, 8), [sample]);
  const frames = useMemo(() => topCities.filter((c) => c.image).slice(0, 6), [topCities]);

  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const cat = useGlobalCatalogue({ country, city, category, pageSize: 12 });
  const categoryLabel = PLACE_CATEGORIES.find((c) => c.value === category)?.label;
  const listRef = useRef<FlatList<Row>>(null);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [
      { key: 'cover', kind: 'cover' },
      { key: 'letter', kind: 'letter' },
    ];
    if (topCities.length) out.push({ key: 'where', kind: 'where' });
    out.push({ key: 'catHead', kind: 'catHead' }, { key: 'bar', kind: 'bar' });
    if (cat.loading) out.push({ key: 'skeleton', kind: 'skeleton' });
    else if (cat.error || !cat.items.length) out.push({ key: 'state', kind: 'state' });
    else {
      chunkPairs(cat.items).forEach((pair, i) => out.push({ key: `p${i}`, kind: 'pair', pair }));
      out.push({ key: 'footer', kind: 'footer' });
    }
    return out;
  }, [topCities.length, cat.loading, cat.error, cat.items]);
  const headIndex = rows.findIndex((r) => r.kind === 'catHead');
  const barIndex = rows.findIndex((r) => r.kind === 'bar');

  const toCatalogue = useCallback(() => {
    listRef.current?.scrollToIndex({ index: headIndex, animated: true });
  }, [headIndex]);

  const pickCity = useCallback(
    (next: string) => {
      setCity(next);
      toCatalogue();
    },
    [toCatalogue],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cat.reload();
    setRefreshing(false);
  }, [cat]);

  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const where = city || displayName;
  const meta = cat.loading
    ? null
    : cat.total > 0
      ? `${cat.total.toLocaleString('en-IN')} in ${where}`
      : null;

  const renderRow = ({ item }: { item: Row }) => {
    switch (item.kind) {
      case 'cover':
        return (
          <View style={s.pad}>
            <Cover edition={edition} frames={frames} />
          </View>
        );
      case 'letter':
        return (
          <View style={s.pad}>
            <Letter edition={edition} onExplore={toCatalogue} />
          </View>
        );
      case 'where':
        return (
          <View style={s.block}>
            <SectionHeader
              edition={edition}
              eyebrow="WHERE TO GO"
              icon="location"
              lead="Explore"
              em={`${displayName} city by city`}
              subtitle={`The most-booked corners of ${displayName} — tap a city to see what's on there.`}
            />
            <View style={s.tiles}>
              {topCities.map((c) => (
                <CityTile key={c.city} entry={c} edition={edition} onPick={() => pickCity(c.city)} />
              ))}
            </View>
          </View>
        );
      case 'catHead':
        return (
          <View style={s.block}>
            <View style={s.divider}>
              <View style={[s.divLine, { backgroundColor: line }]} />
              <LinearGradient colors={[edition.accent.from, edition.accent.to]} style={s.divDot} />
              <View style={[s.divLine, { backgroundColor: line }]} />
            </View>
            <SectionHeader
              edition={edition}
              eyebrow={city ? 'DESTINATION' : 'THE CATALOGUE'}
              icon={city ? 'location' : 'compass'}
              lead={city ? 'Experiences in' : 'Every experience in'}
              em={where}
              subtitle={
                city
                  ? `Hand-picked ${city} experiences, paired with local guides who know the area.`
                  : `Skip-the-line tickets, guided tours and bucket-list moments across ${displayName}.`
              }
              meta={meta}
            />
            {!!city && (
              <View style={s.cityBar}>
                <LinearGradient colors={[edition.accent.from, edition.accent.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cityChip}>
                  <Ionicons name="location" size={14} color="#FFFFFF" />
                  <Text style={s.cityChipText}>{city}</Text>
                  <Pressable onPress={() => setCity('')} hitSlop={10} accessibilityLabel={`Clear ${city}`}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.9)" />
                  </Pressable>
                </LinearGradient>
                <Pressable onPress={() => setCity('')} hitSlop={8} style={s.rowCenter}>
                  <Ionicons name="arrow-back" size={14} color={themeColors.textSecondary} />
                  <Text style={[s.allLink, { color: themeColors.textSecondary }]}>All of {displayName}</Text>
                </Pressable>
              </View>
            )}
            <View style={{ marginHorizontal: -RAIL_PAD }}>
              <ScopeNote
                scope={cat.scope}
                requested={cat.requested}
                city={city}
                country={country}
                categoryLabel={category ? categoryLabel : undefined}
              />
            </View>
          </View>
        );
      case 'bar':
        return (
          <View style={[s.bar, { backgroundColor: themeColors.background, borderBottomColor: line }]}>
            <CategoryChips value={category} onChange={setCategory} accent={accent} />
          </View>
        );
      case 'skeleton':
        return (
          <View style={{ paddingTop: 14 }}>
            <SkeletonPairs />
          </View>
        );
      case 'state':
        if (cat.error) {
          return (
            <StateBlock
              icon="cloud-offline-outline"
              title={`Couldn't load ${displayName} experiences`}
              body="Check your connection and try again."
              action="Try again"
              onAction={cat.reload}
              accent={accent}
            />
          );
        }
        return (
          <StateBlock
            icon="globe-outline"
            accent={accent}
            title={
              city
                ? `No experiences in ${city} yet`
                : category
                  ? `No ${categoryLabel} experiences in ${displayName} yet`
                  : `Indexing ${displayName} experiences`
            }
            body={
              city
                ? `We don't have live experiences for ${city} right now — explore the rest of ${displayName}.`
                : category
                  ? 'Try another category, or browse the top cities above.'
                  : `We're pulling fresh ${displayName} inventory right now. Check back soon.`
            }
            action={city || category ? `Show all ${displayName} experiences` : undefined}
            onAction={() => {
              setCity('');
              setCategory('');
            }}
          />
        );
      case 'pair':
        return <CardPair pair={item.pair} />;
      case 'footer':
        return (
          <View style={s.footer}>
            {cat.hasMore ? (
              <LoadMoreButton onPress={cat.loadMore} busy={cat.loadingMore} accent={accent} />
            ) : (
              <Text style={[s.endText, { color: themeColors.textTertiary }]}>That&apos;s everything in {where} for now</Text>
            )}
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        stickyHeaderIndices={barIndex >= 0 ? [barIndex] : undefined}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        initialNumToRender={6}
        windowSize={9}
        onScrollToIndexFailed={({ averageItemLength, index }) => {
          listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true });
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      />
    </SafeAreaView>
  );
}

export default DestinationEditionView;

const s = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingBottom: 40 },
  pad: { paddingHorizontal: RAIL_PAD, paddingTop: 8 },
  block: { paddingHorizontal: RAIL_PAD, marginTop: 28 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  center: { alignItems: 'center', justifyContent: 'center' },

  cover: { width: COVER_W, height: COVER_H, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1F2937' },
  coverTop: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingRight: 72 },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  mastEmoji: { fontSize: 14 },
  mastText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', flexShrink: 1 },
  counter: {
    position: 'absolute',
    top: 17,
    right: 12,
    paddingHorizontal: 9,
    height: 30,
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  counterText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  coverBottom: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  coverEyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 2.4, textTransform: 'uppercase' },
  coverCity: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  coverTagline: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontStyle: 'italic', marginTop: 4, lineHeight: 20 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { width: 20, backgroundColor: '#FFFFFF' },

  letter: { marginTop: 16, borderRadius: 24, borderWidth: 1, padding: 20, overflow: 'hidden' },
  letterEmoji: { position: 'absolute', top: -6, right: 6, fontSize: 96, opacity: 0.1 },
  letterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  letterEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  letterVol: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  quote: { fontFamily: SERIF, fontSize: 48, lineHeight: 52, marginTop: 10, marginBottom: -18 },
  letterTitle: { fontFamily: SERIF, fontStyle: 'italic', fontSize: 25, lineHeight: 31, letterSpacing: -0.3 },
  rule: { height: 1, marginVertical: 16 },
  letterLead: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  letterBody: { fontSize: 14.5, lineHeight: 22 },
  highlights: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 10 },
  highlight: { width: '50%', flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingRight: 10 },
  hlNum: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hlText: { flex: 1, fontFamily: SERIF, fontStyle: 'italic', fontSize: 14, lineHeight: 19 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 25,
    marginTop: 22,
  },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  curated: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },

  sectionHead: { marginBottom: 16 },
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    marginBottom: 12,
  },
  eyebrowIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  eyebrowText: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  sectionTitle: { fontSize: 27, fontWeight: '800', letterSpacing: -0.9, lineHeight: 31 },
  sectionSub: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  meta: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  metaText: { fontSize: 12.5, fontWeight: '800' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: { width: GRID_CARD_W, borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  tileImg: { aspectRatio: 4 / 5, backgroundColor: '#E5E7EB' },
  tilePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  tileDot: { width: 6, height: 6, borderRadius: 3 },
  tilePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#1F2937', textTransform: 'uppercase' },
  tileCity: { position: 'absolute', left: 12, right: 12, bottom: 12, color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.5, lineHeight: 23 },
  tileFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  tileFootText: { fontSize: 12, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, paddingHorizontal: 24 },
  divLine: { flex: 1, height: 1 },
  divDot: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 10 },

  cityBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 8, height: 34, borderRadius: 17 },
  cityChipText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  allLink: { fontSize: 13, fontWeight: '700' },

  bar: { paddingVertical: 10, marginBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },

  footer: { paddingHorizontal: RAIL_PAD, paddingTop: 8, alignItems: 'center' },
  endText: { fontSize: 12, fontWeight: '600', paddingVertical: 12 },
});
