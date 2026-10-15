// Two home rails that sit between "More ways to explore" and "Discover by
// Interest", ported from the web home page:
//   TrekkingRail   — components/activities/TrekkingHomeRail + TrekOverlayCard
//   ValueDealsRail — components/packages/ValueDealsRail
//
// Both cards are the same shell: a 3:4 photo, a bottom scrim covering the
// lower 62%, and white text over it. Only the overlay contents differ, so the
// shell lives in one component here rather than being written twice.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, AccessibilityInfo, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView, setVideoCacheSizeAsync } from 'expo-video';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTheme, spacing, fontWeight } from '@prayana/shared-ui';
import { activityMarketplaceAPI, holidayPackagesAPI } from '@prayana/shared-services';
import { normalizeImageUrl } from '../../lib/imageUrl';
import { trekArtFor } from '../../lib/trekArt';
import { TrekPosterCard, POSTER_CARD_W } from './TrekPosterCard';
import { TWO_UP_W, RAIL_GAP, usePairSnap } from '../../lib/railLayout';
import { assignDealClips } from '../../lib/dealClips';

const TREK_ACCENT = '#16A34A';   // green icon tile on the trekking rail
const DEALS_ACCENT = '#10B981';  // emerald icon tile on the deals rail
// Two whole cards across the phone (see lib/railLayout).
const CARD_W = TWO_UP_W;
const CARD_H = Math.round((CARD_W * 4) / 3); // aspect 3:4

const inr = (n?: number) => Number(n || 0).toLocaleString('en-IN');

const primaryImage = (images?: any[]): string | undefined => {
  const list = Array.isArray(images) ? images : [];
  const pick = list.find((i) => i?.isPrimary && i?.url) || list.find((i) => i?.url);
  return pick?.url ? normalizeImageUrl(pick.url) : undefined;
};

// Clips are cached on the phone so each one downloads once. All of the home
// clips together are about 31 MB, so 64 MB holds them with room to spare
// (the player's own default is 1 GB). This must run before any player exists,
// which is why it sits at module load; the size persists across launches.
setVideoCacheSizeAsync(64 * 1024 * 1024).catch(() => {});

/**
 * Muted looping clip over a card's photo. Only mounted while the card leads
 * its rail on screen and the phone is on Wi-Fi, so a rail of twelve treks
 * decodes one video at a time and mobile data is never spent on it. A
 * TextureView stays transparent until its first frame, so the poster
 * underneath shows while the clip loads (no fade wrapper: on Android an
 * opacity layer around it kept the video from ever drawing).
 */
export function CardVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        // The default SurfaceView draws behind the window, under the card's
        // photo; a TextureView composites in order and honours the clip.
        surfaceType="textureView"
      />
    </View>
  );
}

/** Shared photo card: image, scrim, and whatever overlay the rail supplies. */
function OverlayCard({
  image, video, onPress, children, topLeft, topRight,
}: {
  image?: string;
  video?: string | null;
  onPress: () => void;
  children: React.ReactNode;
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]} onPress={onPress}>
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFillObject} contentFit="cover"
          transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cardPh]} />
      )}
      {!!video && <CardVideo uri={video} />}
      {/* Scrim over the bottom 62%, matching the web gradient stops. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)']}
        style={styles.scrim}
      />
      {topLeft}
      {topRight}
      <View style={styles.cardBody}>{children}</View>
    </Pressable>
  );
}

function RailHeader({
  icon, tint, title, subtitle, onSeeAll,
}: { icon: any; tint: string; title: string; subtitle: string; onSeeAll: () => void }) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={[styles.headerIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>{title}</Text>
        <Text style={[styles.headerSub, { color: themeColors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Pressable
        onPress={onSeeAll}
        style={[styles.seeAll, { borderColor: themeColors.border }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="See all"
      >
        <Ionicons name="arrow-forward" size={16} color={themeColors.textSecondary} />
      </Pressable>
    </View>
  );
}

/**
 * Which cards of a horizontal rail are on screen, so only those play a clip:
 * the rail itself has to be within the window (the home page scrolls it in
 * and out), and the card within the rail's sideways scroll. Reduce-motion
 * users get no motion at all and keep the stills. Nothing moves off Wi-Fi:
 * on mobile data a video rail stays as posters and a photo-reel rail shows
 * each card's one main photo, so the home screen never spends someone's data
 * pack on clips or extra photos. A `video` rail plays only its lead card. The rail must
 * use `spacing.lg` side padding and the given card width and gap.
 */
export function useRailPlayback(cardW = CARD_W, gap = RAIL_GAP, { video = false } = {}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [scrollX, setScrollX] = useState(0);
  const [inView, setInView] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Rests on a whole pair of cards after every swipe.
  const snap = usePairSnap(2 * (cardW + gap));
  const ref = snap.ref;
  // Unknown counts as mobile data until NetInfo says otherwise.
  const net = useNetInfo();
  const onWifi =
    (net.type === 'wifi' || net.type === 'ethernet') &&
    !(net.details as { isConnectionExpensive?: boolean } | null)?.isConnectionExpensive;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduceMotion(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  // The page's own scroll is not ours to listen to, so check where the rail
  // sits a few times a second; a state update only happens when it changes.
  useEffect(() => {
    const check = () => {
      (ref.current as any)?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        setInView(h > 0 && y < screenH && y + h > 0);
      });
    };
    check();
    const id = setInterval(check, 700);
    return () => clearInterval(id);
  }, [screenH]);

  const leftOf = (i: number) => spacing.lg + i * (cardW + gap) - scrollX;
  // A video rail plays only its lead card — the first one at least half on
  // screen — since several decoders at once are too much for a slower phone.
  const lead = Math.max(0, Math.ceil((scrollX - spacing.lg - cardW / 2) / (cardW + gap)));
  const canPlay = (i: number) => {
    if (reduceMotion || !inView || !onWifi) return false;
    // Video rails show posters only: decoding clips while the page scrolls
    // made the home screen stutter. The clips play on the detail pages.
    if (video) return HOME_VIDEOS && i === lead;
    const left = leftOf(i);
    return left < screenW && left + cardW > 0;
  };
  const scrollProps = {
    ref,
    onScroll: (e: any) => setScrollX(e.nativeEvent.contentOffset.x),
    scrollEventThrottle: 100,
    ...snap.props,
  };
  return { canPlay, scrollProps, inView };
}

const PHOTO_STEP_MS = 3200; // the web's touch-screen pace for photo reels
/** Clips on home rails. Off: posters only, for a smooth home scroll. */
export const HOME_VIDEOS = false;

/**
 * One clock for a whole rail of photo reels: a counter that ticks every
 * PHOTO_STEP_MS. Each card on screen moves to its next photo on a tick.
 */
export function useRailClock(active = true) {
  const [tick, setTick] = useState(0);
  // Stopped while the rail is off screen: a tick re-renders the whole rail,
  // and a dozen rails ticking out of sight made the home page scroll unevenly.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), PHOTO_STEP_MS);
    return () => clearInterval(id);
  }, [active]);
  return tick;
}

/**
 * The photo a card shows from `frames`: it steps on each `tick` while the
 * card is `playing`, counted from when it came on screen so it always opens
 * on its main photo. It only steps once the photo on show AND the next one
 * have both downloaded — switching sooner cancels the download in flight,
 * and on a slow connection a large photo would then never appear. Pass the
 * returned `onLoad` to the Image.
 */
export function usePhotoStep(frames: string[], playing: boolean, tick: number) {
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const lastTick = useRef(tick);
  const markLoaded = useCallback((url?: string) => {
    if (!url) return;
    setLoaded((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  }, []);

  const photo = frames.length ? frames[step % frames.length] : undefined;
  const next = frames.length > 1 ? frames[(step + 1) % frames.length] : undefined;

  useEffect(() => {
    if (!playing || frames.length < 2) {
      lastTick.current = tick;
      return;
    }
    if (tick === lastTick.current) return;
    lastTick.current = tick;
    if (photo && next && loaded.has(photo) && loaded.has(next)) setStep((n) => n + 1);
  }, [tick, playing, frames.length, photo, next, loaded]);

  // Fetch the next photo only once the one on show is in, so the two never
  // compete for a slow connection.
  useEffect(() => {
    if (!playing || !photo || !next || !loaded.has(photo) || loaded.has(next)) return;
    let alive = true;
    Image.prefetch(next).then((ok) => alive && ok && markLoaded(next));
    return () => { alive = false; };
  }, [playing, photo, next, loaded, markLoaded]);

  return { photo, onLoad: () => markLoaded(photo) };
}

// ── Trek with strangers, or bring your crew ──────────────────────────────
export function TrekkingRail() {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let alive = true;
    activityMarketplaceAPI
      .searchActivities({ category: 'Trekking', limit: 12, page: 1, sort: 'rating' })
      .then((res: any) => {
        if (!alive) return;
        const raw = Array.isArray(res?.data) ? res.data : res?.data?.activities || [];
        setItems(raw.filter((a: any) => !a.source || a.source === 'internal'));
      })
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, []);

  const { canPlay, scrollProps } = useRailPlayback(POSTER_CARD_W, RAIL_GAP, { video: true });

  // The web hides this below two results rather than showing a lone card.
  if (!items || items.length < 2) return null;

  return (
    <View style={styles.section}>
      <RailHeader
        icon="footsteps"
        tint={TREK_ACCENT}
        title="Trek with strangers, or bring your crew"
        subtitle="Weekend trails and Himalayan expeditions — join a solo-traveller group or book the whole departure for your people."
        onSeeAll={() => router.push('/experiences/trekking-hikes' as any)}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        {...scrollProps}
      >
        {items.map((a, i) => {
          // Only the commissioned clips play, as on the web: no stock filler.
          const clip = trekArtFor(a)?.video;
          return (
            <TrekPosterCard
              key={a._id}
              activity={a}
              video={clip && canPlay(i) ? <CardVideo uri={clip} /> : null}
              onPress={() => router.push(`/activity/${a._id}` as any)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Sea, sand, savings (last-minute deals) ──────────────────────────────
export function ValueDealsRail() {
  const [deals, setDeals] = useState<any[] | null>(null);

  useEffect(() => {
    let alive = true;
    holidayPackagesAPI
      .getValueDeals({ maxPrice: 25000, limit: 12, only: 'Thailand,Indonesia,Andaman & Nicobar Islands' })
      .then((res: any) => alive && setDeals(res?.data || []))
      .catch(() => alive && setDeals([]));
    return () => { alive = false; };
  }, []);

  // The web home shelf's own footage, one distinct clip per card.
  const clips = useMemo(() => assignDealClips(deals || []), [deals]);
  const { canPlay, scrollProps } = useRailPlayback(CARD_W, RAIL_GAP, { video: true });

  if (!deals || deals.length === 0) return null;

  return (
    <View style={styles.section}>
      <RailHeader
        icon="pricetag"
        tint={DEALS_ACCENT}
        title="Sea, sand, savings"
        subtitle="Island escapes to Andaman, Bali and Thailand, all under ₹25,000 — our lowest prices, ready to book."
        onSeeAll={() => router.push('/packages?maxBudget=25000' as any)}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        {...scrollProps}
      >
        {deals.map((p, i) => {
          const listPrice = p.pricing?.startingFrom || 0;
          const sell = p.platformSellingPrice || listPrice;
          const mrp = p.platformMRP || 0;
          const pct = p.platformDiscountPercent || 0;
          // Only strike through when there is a genuine markup to discount from.
          const hasDiscount = pct > 0 && mrp > sell;
          const notice = p.availability?.advanceBookingDays || 0;

          return (
            <OverlayCard
              key={p._id}
              // The clip's own first frame is the poster, so on mobile data
              // the card still shows the sea-and-sand shot, and on Wi-Fi the
              // clip takes over from it without a visible change.
              image={clips[p._id] ? clips[p._id].replace(/\.mp4$/, '.jpg') : primaryImage(p.images)}
              video={canPlay(i) ? clips[p._id] || null : null}
              // Deals route by slug; the trek cards route by _id.
              onPress={() => router.push(`/packages/${encodeURIComponent(p._id)}` as any)}
              topLeft={notice > 0 ? (
                <View style={styles.badge}>
                  <Ionicons name="time-outline" size={8} color="#fff" />
                  <Text style={styles.badgeText}>Book {notice}d ahead</Text>
                </View>
              ) : null}
              topRight={hasDiscount ? (
                <View style={styles.discountPill}>
                  <Text style={styles.discountText}>{pct}% OFF</Text>
                </View>
              ) : null}
            >
              {!!p.dealDestination && (
                <Text style={styles.place} numberOfLines={1}>{p.dealDestination}</Text>
              )}
              <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
              {p.duration?.nights ? (
                <Text style={styles.meta}>{p.duration.nights}N / {p.duration.days}D</Text>
              ) : null}
              <View style={styles.priceRow}>
                <View>
                  {hasDiscount && <Text style={styles.strike}>₹{inr(mrp)}</Text>}
                  <Text style={[styles.price, hasDiscount && { color: '#86EFAC' }]}>
                    ₹{inr(sell)}<Text style={styles.per}>/person</Text>
                  </Text>
                </View>
              </View>
            </OverlayCard>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  seeAll: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rail: { gap: RAIL_GAP, paddingHorizontal: spacing.lg },

  card: { width: CARD_W, height: CARD_H, borderRadius: 16, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  cardPh: { backgroundColor: '#e5e7eb' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  cardBody: { position: 'absolute', left: 10, right: 10, bottom: 10 },

  badge: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: fontWeight.semibold, letterSpacing: 0.5 },
  discountPill: {
    position: 'absolute', top: 10, right: 10, backgroundColor: '#22C55E',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
  },
  discountText: { color: '#fff', fontSize: 9, fontWeight: fontWeight.bold },

  place: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginBottom: 1 },
  title: { color: '#fff', fontSize: 12.5, fontWeight: fontWeight.bold, lineHeight: 16, marginBottom: 3 },
  meta: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
  priceRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  strike: { color: 'rgba(255,255,255,0.6)', fontSize: 9, textDecorationLine: 'line-through', marginBottom: 1 },
  price: { color: '#fff', fontSize: 14, fontWeight: fontWeight.bold },
  per: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: fontWeight.normal },
});
