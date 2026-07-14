// "Videos" tab for the destination search-results page.
// Fetches hand-picked YouTube travel videos via /youtube/search and plays them
// INSIDE the app (YouTube embed in a modal, mirroring the web's VideoToursRail
// player) instead of kicking the user out to the YouTube app. Topic filters
// mirror the PWA (Guide / To Do / Vlogs / Food).
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
// Both from gesture-handler: this tab renders inside the destination page's
// gesture-handler ScrollView, and a plain RN Touchable nested in one never
// receives the tap (the same bug that made the result tabs unresponsive).
import { TouchableOpacity } from 'react-native-gesture-handler';
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// The video the player modal is showing. `vertical` sizes the frame 9:16 for
// Shorts vs 16:9 for regular videos, exactly like the web player does.
type PlayingVideo = { id: string; title?: string; vertical: boolean } | null;

interface Props {
  locationName: string;
}

const TOPICS = [
  { id: 'guide', label: 'Guide', suffix: 'travel guide' },
  { id: 'todo', label: 'To Do', suffix: 'top things to do' },
  { id: 'vlogs', label: 'Vlogs', suffix: 'travel vlog' },
  { id: 'food', label: 'Food', suffix: 'street food' },
];

export const DestinationVideos: React.FC<Props> = ({ locationName }) => {
  const { themeColors } = useTheme();
  const [topic, setTopic] = useState('guide');
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<PlayingVideo>(null);
  const [playerLoading, setPlayerLoading] = useState(true);

  const load = useCallback(
    async (topicId: string) => {
      setLoading(true);
      const t = TOPICS.find((x) => x.id === topicId) || TOPICS[0];
      try {
        const res: any = await videosAPI.search({
          q: `${locationName} ${t.suffix}`,
          max: 10,
        });
        setVideos(res?.results || res?.data || []);
      } catch (e: any) {
        console.warn('[DestinationVideos] failed:', e?.message);
        setVideos([]);
      } finally {
        setLoading(false);
      }
    },
    [locationName]
  );

  useEffect(() => {
    load(topic);
  }, [topic, load]);

  // Play in-app rather than handing the user off to the YouTube app.
  const openVideo = useCallback((video: any) => {
    const id = typeof video === 'string' ? video : video?.id;
    if (!id) return;
    setPlayerLoading(true);
    setPlaying({
      id,
      title: typeof video === 'object' ? video?.title : undefined,
      vertical: !!(typeof video === 'object' && video?.isShort),
    });
  }, []);

  const closeVideo = useCallback(() => setPlaying(null), []);

  return (
    <View>
      {/* Topic filter chips */}
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary[500]} size="large" />
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
                style={[styles.card, shadow.sm, { backgroundColor: themeColors.surface }]}
                activeOpacity={0.85}
                onPress={() => openVideo({ ...v, id })}
              >
                <View>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: colors.gray[200] }]} />
                  )}
                  <View style={styles.playOverlay}>
                    <Play size={20} color="#fff" fill="#fff" />
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
                    <Text style={[styles.channel, { color: themeColors.textTertiary }]} numberOfLines={1}>
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
                source={{
                  uri: `https://www.youtube.com/embed/${playing.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
                }}
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
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.md },
  centerText: { fontSize: fontSize.sm, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: '48%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  thumb: { width: '100%', height: 100, backgroundColor: colors.gray[200] },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  cardBody: { padding: spacing.sm, gap: 4 },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 17 },
  channel: { fontSize: fontSize.xs },
});
