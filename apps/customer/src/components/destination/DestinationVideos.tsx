// "Videos" tab for the destination search-results page.
// Mirrors the web's VideoToursRail.mobile: a dedicated Shorts rail (9:16 cards,
// horizontal swipe) above an even 2-column grid of regular (4:3) video cards.
// Videos play INSIDE the app (YouTube embed in a modal) instead of kicking the
// user out to the YouTube app. Topic filters mirror the PWA
// (Guide / To Do / Vlogs / Food) and drive BOTH fetches.
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
// Both from gesture-handler: this tab renders inside the destination page's
// gesture-handler ScrollView, and a plain RN Touchable / ScrollView nested in
// one never receives the tap (the same bug that made the result tabs
// unresponsive).
import { TouchableOpacity, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { Play, X } from 'lucide-react-native';
import { YouTubeIcon } from './YouTubeIcon';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { videosAPI } from '@prayana/shared-services';

// The video the player modal is showing. `vertical` sizes the frame 9:16 for
// Shorts vs 16:9 for regular videos, exactly like the web player does.
type PlayingVideo = { id: string; title?: string; vertical: boolean } | null;

// The YouTube iframe, wrapped in a minimal page. We hand the WebView this HTML
// (with baseUrl = our https origin) instead of pointing it at
// youtube.com/embed/<id> directly: a raw WebView navigation carries no origin,
// and YouTube then refuses to embed the video ("Error 153"). The body is black
// and edge-to-edge so the frame has no letterbox seams.
function youtubeEmbedHtml(videoId: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
      iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe
      src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    ></iframe>
  </body>
</html>`;
}

interface Props {
  locationName: string;
}

const TOPICS = [
  { id: 'guide', label: 'Guide', suffix: 'travel guide' },
  { id: 'todo', label: 'To Do', suffix: 'top things to do' },
  { id: 'vlogs', label: 'Vlogs', suffix: 'travel vlog' },
  { id: 'food', label: 'Food', suffix: 'street food' },
];

// Shorts rail card geometry — 150px wide 9:16, matching the web's ShortsRail.
const SHORT_W = 150;
const SHORT_H = Math.round((SHORT_W * 16) / 9);

// Brand red/rose used for the Shorts chip gradient (mirrors the web's
// from-red-500 to-rose-600) — this is the Prayana secondary accent, not orange.
const SHORTS_GRADIENT = ['#ef4444', '#e11d48'] as const;

export const DestinationVideos: React.FC<Props> = ({ locationName }) => {
  const { themeColors } = useTheme();
  // Read live, not at module scope: a module-scope Dimensions.get() is captured
  // once at import time and is wrong after rotation (and on some devices at
  // first mount), which left the player frame mis-sized / off-centre.
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState('guide');
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shorts, setShorts] = useState<any[]>([]);
  const [shortsLoading, setShortsLoading] = useState(true);
  const [playing, setPlaying] = useState<PlayingVideo>(null);
  const [playerLoading, setPlayerLoading] = useState(true);

  const topicMeta = TOPICS.find((x) => x.id === topic) || TOPICS[0];
  const suffix = topicMeta.suffix;

  // Regular videos. The endpoint returns a mix, so Shorts are filtered out here
  // and shown in their own rail instead of jamming 9:16 clips into a 4:3 grid.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res: any = await videosAPI.search({
          q: `${locationName} ${suffix}`,
          max: 10,
        });
        if (cancelled) return;
        const list: any[] = res?.results || res?.data || [];
        setVideos(list.filter((v) => !v?.isShort));
      } catch (e: any) {
        if (cancelled) return;
        console.warn('[DestinationVideos] videos failed:', e?.message);
        setVideos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [locationName, suffix]);

  // Shorts are fetched SEPARATELY with shorts=1, exactly like the web does.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setShortsLoading(true);
      try {
        const res: any = await videosAPI.search({
          q: `${locationName} ${suffix}`,
          max: 14,
          shorts: 1,
        });
        if (cancelled) return;
        const list: any[] = res?.results || res?.data || [];
        setShorts(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (cancelled) return;
        console.warn('[DestinationVideos] shorts failed:', e?.message);
        setShorts([]);
      } finally {
        if (!cancelled) setShortsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [locationName, suffix]);

  // Play in-app rather than handing the user off to the YouTube app.
  const openVideo = useCallback((video: any, vertical: boolean) => {
    const id = typeof video === 'string' ? video : video?.id || video?.videoId;
    if (!id) return;
    setPlayerLoading(true);
    setPlaying({
      id,
      title: typeof video === 'object' ? video?.title : undefined,
      vertical,
    });
  }, []);

  const closeVideo = useCallback(() => setPlaying(null), []);

  // Nothing to show for Shorts once we know there are none — same as the web,
  // which returns null rather than leaving an empty header behind.
  const showShorts = shortsLoading || shorts.length > 0;

  // Player frame geometry, derived from the LIVE window size: 16:9 for regular
  // videos, 9:16 for Shorts (capped so a tall frame still fits the screen).
  const frameMaxW = screenW - spacing.lg * 2;
  const horizontalFrame = { width: frameMaxW, height: (frameMaxW * 9) / 16 };
  const verticalH = Math.min(screenH * 0.78, 720, (frameMaxW * 16) / 9);
  const verticalFrame = { height: verticalH, width: (verticalH * 9) / 16 };

  return (
    <View>
      {/* Topic filter chips — drive both the video and the shorts fetch */}
      <View style={styles.topicRow}>
        {TOPICS.map((t) => {
          const active = topic === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTopic(t.id)}
              style={[
                styles.topicChip,
                {
                  backgroundColor: active ? colors.primary[500] : themeColors.surface,
                  borderColor: active ? colors.primary[500] : themeColors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.topicText,
                  { color: active ? '#fff' : themeColors.textSecondary },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Shorts rail ────────────────────────────────────────────────────
          9:16 cards on a horizontal swipe, above the regular grid — the web's
          ShortsRail. Keeping Shorts out of the 4:3 grid is what stops the grid
          from going ragged. */}
      {showShorts && (
        <View style={styles.shortsSection}>
          <View style={styles.shortsHeader}>
            <LinearGradient
              colors={SHORTS_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.shortsChip}
            >
              <Play size={14} color="#fff" fill="#fff" strokeWidth={0} />
            </LinearGradient>
            <View style={styles.shortsHeaderText}>
              <Text style={[styles.shortsTitle, { color: themeColors.text }]}>Shorts</Text>
              <Text
                style={[styles.shortsSubtitle, { color: themeColors.textTertiary }]}
                numberOfLines={1}
              >
                Quick clips from fellow travellers
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shortsRail}
          >
            {shortsLoading
              ? [0, 1, 2, 3, 4].map((i) => (
                  <View
                    key={`sk-${i}`}
                    style={[styles.shortSkeleton, { backgroundColor: themeColors.border }]}
                  />
                ))
              : shorts.map((s: any, idx: number) => {
                  const id = s.id || s.videoId;
                  const thumb = s.thumbnail || s.thumb || null;
                  return (
                    <TouchableOpacity
                      key={id || `s-${idx}`}
                      style={styles.shortCard}
                      activeOpacity={0.85}
                      onPress={() => openVideo({ ...s, id }, true)}
                    >
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.shortThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.shortThumb, { backgroundColor: colors.gray[800] }]} />
                      )}

                      {/* Bottom scrim so the overlaid title stays legible */}
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.88)']}
                        style={styles.shortScrim}
                      />

                      <View style={styles.shortPlayBadge}>
                        <Play size={13} color={colors.gray[900]} fill={colors.gray[900]} strokeWidth={0} />
                      </View>

                      {s.length ? (
                        <View style={styles.shortDuration}>
                          <Text style={styles.durationText}>{s.length}</Text>
                        </View>
                      ) : null}

                      <View style={styles.shortBody}>
                        <Text style={styles.shortCardTitle} numberOfLines={2}>
                          {s.title}
                        </Text>
                        {s.channel ? (
                          <Text style={styles.shortCardChannel} numberOfLines={1}>
                            {s.channel}
                            {s.views ? ` · ${s.views}` : ''}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
          </ScrollView>
        </View>
      )}

      {/* ── Regular videos ─────────────────────────────────────────────────
          Even 2-column grid. Every thumbnail is locked to 4:3 (the web's
          pb-[75%]) so rows line up no matter what size YouTube hands back. */}
      {loading ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={`vsk-${i}`}
              style={[
                styles.card,
                shadow.sm,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              ]}
            >
              <View style={[styles.thumb, { backgroundColor: themeColors.border }]} />
              <View style={styles.cardBody}>
                <View style={[styles.skelLine, { backgroundColor: themeColors.border }]} />
                <View
                  style={[styles.skelLine, styles.skelLineShort, { backgroundColor: themeColors.border }]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.center}>
          <YouTubeIcon size={40} />
          <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
            No videos found for {locationName}.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {videos.map((v: any, idx: number) => {
            const id = v.id || v.videoId;
            const thumb = v.thumbnail || v.thumb || null;
            return (
              <TouchableOpacity
                key={id || idx}
                style={[
                  styles.card,
                  shadow.sm,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                ]}
                activeOpacity={0.85}
                onPress={() => openVideo({ ...v, id }, false)}
              >
                <View style={styles.thumbWrap}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: colors.gray[200] }]} />
                  )}
                  <View style={styles.playOverlay}>
                    <View style={styles.playCircle}>
                      <Play size={18} color="#fff" fill="#fff" strokeWidth={0} />
                    </View>
                  </View>
                  {v.length ? (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>{v.length}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
                    {v.title}
                  </Text>
                  {v.channel ? (
                    <Text
                      style={[styles.channel, { color: themeColors.textTertiary }]}
                      numberOfLines={1}
                    >
                      {v.channel}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── In-app player ──────────────────────────────────────────────────
          Mirrors the web's VideoToursRail modal: the official YouTube embed
          (autoplay + playsinline + rel=0) on a near-black backdrop, sized 9:16
          for Shorts and 16:9 for regular videos. Tapping the backdrop or the
          X closes it, so it never traps the user. */}
      <Modal
        visible={!!playing}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={closeVideo}
        supportedOrientations={['portrait', 'landscape']}
      >
        <StatusBar barStyle="light-content" />
        <TouchableOpacity
          style={styles.playerBackdrop}
          activeOpacity={1}
          onPress={closeVideo}
        >
          {/* Stop taps inside the frame from closing the modal. */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={[
              styles.playerFrame,
              playing?.vertical ? styles.playerVertical : styles.playerHorizontal,
            ]}
          >
            {playing && (
              <WebView
                // Serve the iframe as HTML with a real baseUrl rather than
                // navigating straight to youtube.com/embed/<id>. A bare WebView
                // navigation sends no origin, and YouTube refuses to embed
                // without one — the player came back "Error 153". Giving it our
                // own https origin (which is what the web player does from
                // prayanaai.com) makes the embed play.
                source={{
                  html: youtubeEmbedHtml(playing.id),
                  baseUrl: 'https://prayanaai.com',
                }}
                originWhitelist={['*']}
                style={styles.webview}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                onLoadEnd={() => setPlayerLoading(false)}
              />
            )}
            {playerLoading && (
              <View style={styles.playerLoading}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playerClose}
            onPress={closeVideo}
            hitSlop={12}
            activeOpacity={0.8}
          >
            <X size={22} color="#fff" />
          </TouchableOpacity>

          {!!playing?.title && (
            <Text style={styles.playerTitle} numberOfLines={2}>
              {playing.title}
            </Text>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// 9:16 for Shorts, 16:9 for regular — matching the web player's two sizes.
const H_WIDTH = SCREEN_W - spacing.lg * 2;
const V_HEIGHT = Math.min(SCREEN_H * 0.78, 720);

const styles = StyleSheet.create({
  playerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  playerFrame: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  playerHorizontal: {
    width: H_WIDTH,
    height: (H_WIDTH * 9) / 16,
  },
  playerVertical: {
    height: V_HEIGHT,
    width: (V_HEIGHT * 9) / 16,
    maxWidth: SCREEN_W - spacing.lg * 2,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  playerClose: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  playerTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  // Topic chips
  topicRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  topicChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  topicText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  // Shorts rail
  shortsSection: { marginBottom: spacing.xl },
  shortsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  shortsChip: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortsHeaderText: { flex: 1, minWidth: 0 },
  shortsTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  shortsSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  shortsRail: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  shortCard: {
    width: SHORT_W,
    height: SHORT_H,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  shortSkeleton: {
    width: SHORT_W,
    height: SHORT_H,
    borderRadius: borderRadius.xl,
    opacity: 0.7,
  },
  shortThumb: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  shortScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  shortPlayBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  shortDuration: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  shortBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    gap: 2,
  },
  shortCardTitle: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeight.semibold,
  },
  shortCardChannel: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },

  // Regular grid
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  centerText: { fontSize: fontSize.sm, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '48%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  // 4:3 thumbnail — the web's pb-[75%]. Locking the ratio here is what makes
  // every card the same height so the rows stop going ragged.
  thumbWrap: { width: '100%', aspectRatio: 4 / 3, position: 'relative' },
  thumb: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.gray[200] },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  durationText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  // Fixed body height keeps two-line and one-line titles from misaligning rows.
  cardBody: { padding: spacing.sm, gap: 4, height: 62 },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 17 },
  channel: { fontSize: fontSize.xs },
  skelLine: { height: 10, borderRadius: 4, opacity: 0.8 },
  skelLineShort: { width: '60%' },
});
