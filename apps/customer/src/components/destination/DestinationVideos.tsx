// "Videos" tab for the destination search-results page.
// Fetches hand-picked YouTube travel videos via /youtube/search and opens them
// in YouTube on tap. Topic filters mirror the PWA (Guide / To Do / Vlogs / Food).
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Play } from 'lucide-react-native';
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

  const openVideo = useCallback((id: string) => {
    if (!id) return;
    Linking.openURL(`https://www.youtube.com/watch?v=${id}`).catch(() => {});
  }, []);

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
                onPress={() => openVideo(id)}
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
    </View>
  );
};

const styles = StyleSheet.create({
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
