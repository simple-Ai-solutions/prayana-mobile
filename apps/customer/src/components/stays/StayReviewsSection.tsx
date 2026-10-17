// StayReviewsSection — guest reviews on the property screen: the summary
// (average, star distribution, aspect scores), the first few reviews, and
// "See all" which shows the rest of the page and loads more pages in place.
//
// Every review is from a guest whose stay was completed (the server checks
// the booking), so it's labelled as a verified stay.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Button, StarRating, useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { staysAPI } from '@prayana/shared-services';
import { REVIEW_ASPECTS, TRIP_TYPES } from '../../lib/stayLabels';
import { errorText, fmtShortDay, plural, type StayRatingSummary, type StayReview } from '../../lib/stays';
import { PhotoViewer, type ViewerPhoto } from './PhotoViewer';

type Sort = 'recent' | 'highest' | 'lowest';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: 'Most recent' },
  { value: 'highest', label: 'Highest' },
  { value: 'lowest', label: 'Lowest' },
];
const FIRST_LOOK = 3;
const AMBER = '#F59E0B';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-14" → "Nov 2026" */
const monthYear = (iso?: string | null) => {
  const m = /^(\d{4})-(\d{2})/.exec(iso || '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};

function ReviewItem({ review, onOpenPhoto }: { review: StayReview; onOpenPhoto: (photos: string[], i: number) => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const trip = TRIP_TYPES.find((t) => t.id === review.tripType);
  const long = (review.body || '').length > 280;
  const photos = review.photos || [];
  const meta = [
    review.stayedOn ? `Stayed ${monthYear(review.stayedOn)}` : null,
    trip?.label,
    review.roomTypeName,
  ].filter(Boolean);

  return (
    <View style={[styles.review, { borderTopColor: themeColors.border }]}>
      <View style={styles.reviewHead}>
        <View style={[styles.avatar, { backgroundColor: isDarkMode ? themeColors.surfaceElevated : themeColors.backgroundSecondary }]}>
          <Text style={[styles.avatarText, { color: themeColors.textSecondary }]}>
            {(review.reviewer?.name || 'G').trim().charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reviewer, { color: themeColors.text }]} numberOfLines={1}>
            {review.reviewer?.name || 'Guest'}
          </Text>
          {meta.length ? (
            <Text style={[styles.meta, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {meta.join(' · ')}
            </Text>
          ) : null}
        </View>
        <View accessible accessibilityLabel={`${review.rating} out of 5 stars`}>
          <StarRating rating={review.rating} size={13} color={AMBER} />
        </View>
      </View>
      {review.title ? <Text style={[styles.reviewTitle, { color: themeColors.text }]}>{review.title}</Text> : null}
      {review.body ? (
        <>
          <Text style={[styles.body, { color: themeColors.textSecondary }]} numberOfLines={expanded || !long ? undefined : 5}>
            {review.body}
          </Text>
          {long ? (
            <TouchableOpacity onPress={() => setExpanded((v) => !v)} accessibilityRole="button">
              <Text style={styles.more}>{expanded ? 'Show less' : 'Read more'}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
      {photos.length ? (
        <View style={styles.photos}>
          {photos.slice(0, 5).map((url, i) => (
            <TouchableOpacity
              key={`${url}-${i}`}
              onPress={() => onOpenPhoto(photos, i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Guest photo ${i + 1} of ${photos.length}`}
            >
              <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {review.reply?.body ? (
        <View style={[styles.reply, { backgroundColor: isDarkMode ? themeColors.surfaceElevated : themeColors.backgroundSecondary }]}>
          <Text style={[styles.replyHead, { color: themeColors.text }]}>
            Reply from the property{review.reply.repliedAt ? ` · ${fmtShortDay(review.reply.repliedAt)}` : ''}
          </Text>
          <Text style={[styles.replyBody, { color: themeColors.textSecondary }]}>{review.reply.body}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function StayReviewsSection({
  slug,
  summary: initialSummary,
  style,
  titleStyle,
}: {
  slug: string;
  summary?: StayRatingSummary;
  /** The section wrapper and heading, so it matches the screen's other sections. */
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}) {
  const { themeColors } = useTheme();
  const [sort, setSort] = useState<Sort>('recent');
  const [items, setItems] = useState<StayReview[]>([]);
  const [summary, setSummary] = useState<StayRatingSummary>(initialSummary || null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [viewer, setViewer] = useState<{ photos: ViewerPhoto[]; index: number } | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (p: number, s: Sort) => {
      const my = ++seq.current;
      if (p === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const r = await staysAPI.reviews(slug, { page: p, sort: s });
        if (my !== seq.current) return;
        const list = (r?.data as StayReview[]) || [];
        setItems((prev) => (p === 1 ? list : [...prev, ...list.filter((x) => !prev.some((y) => y._id === x._id))]));
        if (r?.summary) setSummary(r.summary as StayRatingSummary);
        setPage(p);
        setPages(Number(r?.pages) || 1);
        setTotal(Number(r?.total) || 0);
        setError(null);
      } catch (e) {
        if (my !== seq.current) return;
        setError(errorText(e, "Couldn't load reviews."));
      } finally {
        if (my === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [slug],
  );

  useEffect(() => {
    load(1, sort);
  }, [load, sort]);

  const hasSummary = Boolean(summary && summary.count > 0);
  // No reviews (or none we could load and none we know of): the section
  // stays out of the way.
  if (!loading && !items.length && !hasSummary) return null;
  if (loading && !items.length) {
    return hasSummary ? (
      <View style={style}>
        <Text style={titleStyle}>Guest reviews</Text>
        <View style={styles.loading}>
          <ActivityIndicator color={themeColors.textTertiary} />
        </View>
      </View>
    ) : null;
  }

  const shown = showAll ? items : items.slice(0, FIRST_LOOK);
  const count = summary?.count || total;
  const dist = summary?.distribution || {};
  const aspects = REVIEW_ASPECTS.map((a) => ({ ...a, value: summary?.aspects?.[a.id] ?? null })).filter(
    (a): a is typeof a & { value: number } => typeof a.value === 'number' && a.value > 0,
  );

  return (
    <View style={style}>
      <Text style={titleStyle} accessibilityRole="header">
        Guest reviews
      </Text>
      {summary && summary.count > 0 ? (
        <View style={[styles.summary, { borderColor: themeColors.border }]}>
          <View style={styles.summaryLeft}>
            <Text style={[styles.average, { color: themeColors.text }]}>{summary.average.toFixed(1)}</Text>
            <StarRating rating={Math.round(summary.average)} size={14} color={AMBER} />
            <Text style={[styles.count, { color: themeColors.textSecondary }]}>{plural(count, 'review')}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const n = Number(dist[String(star)] || 0);
              const pct = count ? Math.round((n / count) * 100) : 0;
              return (
                <View key={star} style={styles.distRow} accessible accessibilityLabel={`${star} stars: ${n}`}>
                  <Text style={[styles.distLabel, { color: themeColors.textSecondary }]}>{star}</Text>
                  <View style={[styles.bar, { backgroundColor: themeColors.border }]}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={[styles.distCount, { color: themeColors.textTertiary }]}>{n}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {aspects.length ? (
        <View style={styles.aspects}>
          {aspects.map((a) => (
            <View key={a.id} style={styles.aspectRow}>
              <Text style={[styles.aspectLabel, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {a.label}
              </Text>
              <View style={[styles.bar, { backgroundColor: themeColors.border }]}>
                <View style={[styles.barFill, { width: `${(a.value / 5) * 100}%` }]} />
              </View>
              <Text style={[styles.aspectValue, { color: themeColors.text }]}>{a.value.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {showAll ? (
        <View style={styles.sorts}>
          {SORTS.map((s) => {
            const on = s.value === sort;
            return (
              <TouchableOpacity
                key={s.value}
                onPress={() => setSort(s.value)}
                style={[styles.sortChip, { borderColor: on ? AMBER : themeColors.border }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.sortText, { color: themeColors.text }, on && { fontWeight: fontWeight.bold }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {shown.map((r) => (
        <ReviewItem
          key={r._id}
          review={r}
          onOpenPhoto={(photos, i) => setViewer({ photos: photos.map((url) => ({ url })), index: i })}
        />
      ))}

      {error ? (
        <View style={styles.errorRow}>
          <Text style={[styles.meta, { color: themeColors.textSecondary, flex: 1 }]}>{error}</Text>
          <Button title="Try again" variant="outline" size="sm" onPress={() => load(page ? page + 1 : 1, sort)} />
        </View>
      ) : null}

      {!showAll && (items.length > FIRST_LOOK || pages > 1) ? (
        <Button
          title={`See all ${plural(count, 'review')}`}
          variant="outline"
          size="md"
          fullWidth
          onPress={() => setShowAll(true)}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
      {showAll && page < pages ? (
        <Button
          title="Show more reviews"
          variant="outline"
          size="md"
          fullWidth
          loading={loadingMore}
          onPress={() => load(page + 1, sort)}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      <PhotoViewer
        visible={Boolean(viewer)}
        photos={viewer?.photos || []}
        startIndex={viewer?.index || 0}
        title="Guest photos"
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing.lg, alignItems: 'center' },
  summary: { flexDirection: 'row', gap: spacing.lg, borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md, alignItems: 'center' },
  summaryLeft: { alignItems: 'center', gap: 4, minWidth: 84 },
  average: { fontSize: 34, fontWeight: fontWeight.bold, lineHeight: 38 },
  count: { fontSize: fontSize.xs },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distLabel: { width: 10, fontSize: fontSize.xs, textAlign: 'right' },
  distCount: { width: 26, fontSize: fontSize.xs, textAlign: 'right' },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: AMBER },
  aspects: { marginTop: spacing.md, gap: 8 },
  aspectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aspectLabel: { width: 112, fontSize: fontSize.xs },
  aspectValue: { width: 28, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textAlign: 'right' },
  sorts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  sortChip: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  sortText: { fontSize: fontSize.xs },
  review: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.md, marginTop: spacing.md, gap: 6 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  reviewer: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.xs },
  reviewTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  body: { fontSize: fontSize.sm, lineHeight: 20 },
  more: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#EA580C' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  photo: { width: 64, height: 64, borderRadius: borderRadius.md },
  reply: { borderRadius: borderRadius.lg, padding: spacing.md, marginTop: 4 },
  replyHead: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  replyBody: { fontSize: fontSize.sm, marginTop: 2, lineHeight: 19 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
});
