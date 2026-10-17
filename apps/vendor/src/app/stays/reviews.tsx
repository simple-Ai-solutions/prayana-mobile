// Stay reviews for the partner: what guests wrote after their stay, across
// every property or one (?stayId=), with the rating summary on top. Reply
// inline (future guests read replies too), edit a reply, or report a review
// to our team. Ported from the web stays reviews page.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ScrollView, TextInput as RNTextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { Badge, Button, LoadingSpinner } from '../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme/vendorColors';
import { DEV_BYPASS_AUTH } from '../../config/devFlags';
import { staysAPI } from './_components/api';
import { usePalette, ScreenHeader, SelectField, Sheet, Banner, Palette } from './_components/controls';
import { StaySummary, apiError, hasOperations, longDate, monthLong, plural } from './_components/stayConfig';

const ASPECTS = [
  { id: 'cleanliness', label: 'Cleanliness' },
  { id: 'location', label: 'Location' },
  { id: 'value', label: 'Value for money' },
  { id: 'staff', label: 'Staff' },
  { id: 'comfort', label: 'Comfort' },
];
const TRIP_TYPES: Record<string, string> = {
  family: 'Family trip',
  couple: 'Couple',
  solo: 'Solo trip',
  friends: 'With friends',
  business: 'Business trip',
};
const MAX_REPLY = 1000;
const MIN_REASON = 5;

interface Rating {
  average?: number;
  count?: number;
  distribution?: Record<string, number>;
  aspects?: Record<string, number | null>;
}
interface Review {
  _id: string;
  rating: number;
  aspects?: Record<string, number | null>;
  tripType?: string | null;
  title?: string | null;
  body?: string | null;
  photos?: string[];
  reviewer?: { name?: string };
  roomTypeName?: string | null;
  stayedOn?: string | null;
  nights?: number | null;
  reply?: { body: string; repliedAt?: string | null } | null;
  createdAt?: string;
  stay?: string;
  flaggedByVendor?: { reason?: string | null; flaggedAt?: string | null } | null;
  hidden?: boolean;
}

const istDate = (iso?: string | null) => (iso ? longDate(new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 10)) : '');

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <View style={styles.stars} accessibilityLabel={`${filled} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= filled ? 'star' : 'star-outline'} size={size} color="#f59e0b" />
      ))}
    </View>
  );
}

function Summary({ name, rating, p }: { name?: string | null; rating: Rating; p: Palette }) {
  const count = rating.count || 0;
  const dist = rating.distribution || {};
  const aspects = ASPECTS.filter((a) => rating.aspects?.[a.id] != null);
  return (
    <View style={[styles.summary, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
      {name ? <Text style={[styles.summaryName, { color: p.c.textSecondary }]}>{name}</Text> : null}
      <View style={styles.summaryTop}>
        <Text style={[styles.avg, { color: p.c.text }]}>{count ? Number(rating.average || 0).toFixed(1) : '—'}</Text>
        <View>
          <Stars value={rating.average || 0} size={16} />
          <Text style={[styles.small, { color: p.c.textSecondary }]}>{plural(count, 'review')}</Text>
        </View>
      </View>
      {count > 0
        ? [5, 4, 3, 2, 1].map((n) => {
            const k = Number(dist[n] || 0);
            const pct = count ? Math.round((k / count) * 100) : 0;
            return (
              <View key={n} style={styles.distRow} accessible accessibilityLabel={`${n} stars: ${k}`}>
                <Text style={[styles.distLabel, { color: p.c.textSecondary }]}>{n}</Text>
                <View style={[styles.distTrack, { backgroundColor: p.soft.gray.bg }]}>
                  <View style={[styles.distFill, { width: `${pct}%` }]} />
                </View>
                <Text style={[styles.distCount, { color: p.c.textTertiary }]}>{k}</Text>
              </View>
            );
          })
        : null}
      {aspects.length ? (
        <View style={styles.aspects}>
          {aspects.map((a) => (
            <View key={a.id} style={[styles.aspect, { backgroundColor: p.soft.gray.bg }]}>
              <Text style={[styles.small, { color: p.c.textSecondary }]}>
                {a.label} <Text style={[styles.bold, { color: p.c.text }]}>{Number(rating.aspects?.[a.id]).toFixed(1)}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ReplyForm({ review, onSaved, onCancel }: { review: Review; onSaved: (r: Review) => void; onCancel: () => void }) {
  const p = usePalette();
  const editing = !!review.reply?.body;
  const [text, setText] = useState(review.reply?.body || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const post = async () => {
    const body = text.trim();
    if (body.length < 2) return setError('Write a reply first');
    setBusy(true);
    setError(null);
    try {
      const res = await staysAPI.replyToReview(review._id, body);
      if (res?.success === false) throw new Error(res.message);
      Toast.show({ type: 'success', text1: editing ? 'Reply updated' : res?.message || 'Reply posted' });
      onSaved({ ...review, ...(res?.data || {}), reply: res?.data?.reply || { body, repliedAt: new Date().toISOString() } });
    } catch (e) {
      setError(apiError(e, "Couldn't post the reply. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.replyForm}>
      <Text style={[styles.fieldLabel, { color: p.c.text }]}>{editing ? 'Edit your reply' : 'Your reply'}</Text>
      <RNTextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (error) setError(null);
        }}
        multiline
        autoFocus
        maxLength={MAX_REPLY}
        textAlignVertical="top"
        placeholder={`Thank ${review.reviewer?.name || 'the guest'} for staying, and answer anything they raised. Future guests read this too.`}
        placeholderTextColor={p.c.textTertiary}
        accessibilityLabel={editing ? 'Edit your reply' : 'Your reply'}
        style={[styles.textarea, { color: p.c.text, borderColor: error ? p.danger : p.c.fieldBorder, backgroundColor: p.c.field }]}
      />
      <Text style={[styles.small, { color: error ? p.danger : p.c.textTertiary }]}>
        {error || `Shown under the review on your property page. ${text.length}/${MAX_REPLY}`}
      </Text>
      <View style={styles.btnRow}>
        <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} disabled={busy} style={styles.flex} />
        <Button title={editing ? 'Save reply' : 'Post reply'} size="sm" onPress={post} loading={busy} style={styles.flex} />
      </View>
    </View>
  );
}

function ReviewCard({ review, stayName, onUpdated, onReport }: { review: Review; stayName?: string | null; onUpdated: (r: Review) => void; onReport: (r: Review) => void }) {
  const p = usePalette();
  const [replying, setReplying] = useState(false);
  const hasReply = !!review.reply?.body;
  const flagged = !!review.flaggedByVendor?.flaggedAt || !!review.flaggedByVendor?.reason;
  const canReport = !flagged && !review.hidden;
  const stayed = review.stayedOn
    ? `Stayed in ${monthLong(review.stayedOn)}${review.nights ? ` · ${plural(review.nights, 'night')}` : ''}`
    : null;
  const aspects = ASPECTS.filter((a) => review.aspects?.[a.id] != null);

  return (
    <View style={[styles.card, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
      <View style={styles.cardTop}>
        <Stars value={review.rating} />
        <View style={styles.badgeRow}>
          {review.hidden ? <Badge label="Hidden by Prayana" variant="default" /> : null}
          {flagged ? <Badge label="Reported" variant="warning" /> : null}
        </View>
      </View>
      {review.title ? <Text style={[styles.title, { color: p.c.text }]}>{review.title}</Text> : null}
      {review.body ? <Text style={[styles.body, { color: p.c.text }]}>{review.body}</Text> : null}
      <Text style={[styles.small, styles.meta, { color: p.c.textTertiary }]}>
        {[
          review.reviewer?.name || 'Guest',
          review.tripType ? TRIP_TYPES[review.tripType] : null,
          review.roomTypeName,
          stayed,
          istDate(review.createdAt),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {stayName ? <Text style={[styles.small, { color: p.c.textSecondary }]}>{stayName}</Text> : null}
      {aspects.length ? (
        <View style={styles.aspects}>
          {aspects.map((a) => (
            <View key={a.id} style={[styles.aspect, { backgroundColor: p.soft.gray.bg }]}>
              <Text style={[styles.small, { color: p.c.textSecondary }]}>
                {a.label} <Text style={[styles.bold, { color: p.c.text }]}>{review.aspects?.[a.id]}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {review.photos?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {review.photos.slice(0, 5).map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.photo} contentFit="cover" accessibilityLabel="Guest photo" />
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.replyArea, { borderTopColor: p.c.border }]}>
        {replying ? (
          <ReplyForm
            review={review}
            onCancel={() => setReplying(false)}
            onSaved={(r) => {
              setReplying(false);
              onUpdated(r);
            }}
          />
        ) : hasReply ? (
          <View style={[styles.reply, { backgroundColor: p.soft.blue.bg }]}>
            <View style={styles.replyHead}>
              <Text style={[styles.small, styles.bold, { color: p.soft.blue.fg }]}>
                Your reply{review.reply?.repliedAt ? ` · ${istDate(review.reply.repliedAt)}` : ''}
              </Text>
              <TouchableOpacity onPress={() => setReplying(true)} accessibilityRole="button" accessibilityLabel="Edit your reply" hitSlop={8} style={styles.editBtn}>
                <Ionicons name="pencil" size={13} color={p.brand} />
                <Text style={[styles.small, styles.bold, { color: p.brand }]}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.replyBody, { color: p.c.text }]}>{review.reply?.body}</Text>
          </View>
        ) : null}
        {!replying && (!hasReply || canReport) ? (
          <View style={[styles.btnRow, hasReply && styles.gapTop]}>
            {!hasReply ? (
              <Button title="Reply" size="sm" onPress={() => setReplying(true)} icon={<Ionicons name="chatbubble-outline" size={15} color="#fff" />} style={styles.flex} />
            ) : null}
            {canReport ? (
              <Button title="Report" size="sm" variant="ghost" onPress={() => onReport(review)} icon={<Ionicons name="flag-outline" size={15} color={colors.primary[500]} />} style={styles.flex} />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ReportSheet({ review, onClose, onDone }: { review: Review | null; onClose: () => void; onDone: (r: Review, message: string) => void }) {
  const p = usePalette();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < MIN_REASON;
  useEffect(() => {
    setReason('');
    setError(null);
    setBusy(false);
  }, [review?._id]);
  const submit = async () => {
    if (!review) return;
    if (tooShort) return setError("Tell us what's wrong with it");
    setBusy(true);
    try {
      const res = await staysAPI.flagReview(review._id, reason.trim());
      if (res?.success === false) throw new Error(res.message);
      onDone({ ...review, ...(res?.data || {}), flaggedByVendor: res?.data?.flaggedByVendor || { reason: reason.trim(), flaggedAt: new Date().toISOString() } }, res?.message || 'Thanks — our team will take a look');
    } catch (e) {
      setError(apiError(e, "Couldn't send the report. Try again."));
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible={!!review}
      title="Report this review"
      subtitle={review ? `${review.reviewer?.name ? `By ${review.reviewer.name}` : "A guest's review"} · ${plural(review.rating, 'star')}` : undefined}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <Button title="Send report" onPress={submit} loading={busy} disabled={tooShort} fullWidth />
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={busy} fullWidth />
        </>
      }
    >
      <Banner tone="gray">
        Our team reads every report. We hide a review only if it breaks our rules: it's fake, abusive, about a different property, or shares someone's personal details. A low rating on its own isn't a reason; a calm reply usually helps more.
      </Banner>
      <Text style={[styles.fieldLabel, { color: p.c.text }]}>What's wrong with it?</Text>
      <RNTextInput
        value={reason}
        onChangeText={(t) => {
          setReason(t);
          if (error) setError(null);
        }}
        multiline
        maxLength={500}
        textAlignVertical="top"
        placeholder="e.g. This guest never stayed with us; the booking was cancelled before arrival."
        placeholderTextColor={p.c.textTertiary}
        accessibilityLabel="What's wrong with the review"
        style={[styles.textarea, { color: p.c.text, borderColor: error ? p.danger : p.c.fieldBorder, backgroundColor: p.c.field }]}
      />
      <Text style={[styles.small, { color: error ? p.danger : p.c.textTertiary }]}>{error || `At least ${MIN_REASON} characters. The guest doesn't see this.`}</Text>
    </Sheet>
  );
}

export default function StayReviewsScreen() {
  const params = useLocalSearchParams<{ stayId?: string }>();
  const router = useRouter();
  const p = usePalette();
  const [stayId, setStayId] = useState(params.stayId ? String(params.stayId) : '');
  const [filter, setFilter] = useState<'all' | 'unreplied'>('all');
  const [list, setList] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [unreplied, setUnreplied] = useState<number | null>(null);
  const [rated, setRated] = useState<{ _id: string; name?: string; rating?: Rating }[]>([]);
  const [myStays, setMyStays] = useState<StaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<Review | null>(null);
  const reqRef = useRef(0);

  // Properties for the filter (and names on the cards): only a stay that's been live can have reviews.
  useEffect(() => {
    staysAPI
      .listMine()
      .then((res) => setMyStays((res?.data || []).filter(hasOperations)))
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (nextPage = 1) => {
      const req = ++reqRef.current;
      if (nextPage > 1) setLoadingMore(true);
      try {
        const res = await staysAPI.vendorReviews({ stayId: stayId || undefined, filter, page: nextPage });
        if (req !== reqRef.current) return;
        if (res?.success === false) throw new Error(res.message);
        const data: Review[] = (Array.isArray(res?.data) ? res.data : []).map((r: Review) => ({ ...r, stay: r.stay ? String(r.stay) : undefined }));
        setList((prev) => (nextPage > 1 ? [...prev, ...data] : data));
        setPage(res?.page || nextPage);
        setPages(res?.pages || 1);
        setUnreplied(typeof res?.unreplied === 'number' ? res.unreplied : null);
        setRated((res?.stays || []).map((s: { _id: string; name?: string; rating?: Rating }) => ({ ...s, _id: String(s._id) })));
        setError(null);
      } catch (e) {
        if (req !== reqRef.current) return;
        if (!DEV_BYPASS_AUTH) setError(apiError(e, "Couldn't load reviews"));
      } finally {
        if (req === reqRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [stayId, filter],
  );

  useEffect(() => {
    setLoading(true);
    setList([]);
    load(1);
  }, [load]);

  const nameOf = (id?: string) => myStays.find((s) => s._id === id)?.name || rated.find((s) => s._id === id)?.name || null;
  const update = (r: Review) => {
    const before = list.find((x) => x._id === r._id);
    if (r.reply?.body && before && !before.reply?.body) setUnreplied((n) => (n ? n - 1 : n));
    setList((prev) => prev.map((x) => (x._id === r._id ? { ...x, ...r, stay: x.stay } : x)));
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/stays'));
  const selected = rated.find((s) => s._id === stayId);
  const filterOptions = [
    { value: '', label: 'All properties' },
    ...myStays.map((s) => ({ value: s._id, label: s.name || 'Unnamed property' })),
    ...(stayId && !myStays.some((s) => s._id === stayId) ? [{ value: stayId, label: nameOf(stayId) || 'This property' }] : []),
  ];

  const header = (
    <View>
      {stayId ? (
        selected?.rating?.count ? <Summary rating={selected.rating} p={p} /> : null
      ) : rated.length ? (
        rated.length === 1 ? (
          <Summary name={rated[0].name} rating={rated[0].rating || {}} p={p} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratedRow}>
            {rated.map((s) => (
              <TouchableOpacity
                key={s._id}
                onPress={() => setStayId(s._id)}
                accessibilityRole="button"
                accessibilityLabel={`${s.name}: ${Number(s.rating?.average || 0).toFixed(1)} from ${plural(s.rating?.count || 0, 'review')}. Show only these reviews`}
                style={[styles.ratedCard, { backgroundColor: p.c.card, borderColor: p.c.border }]}
              >
                <Text style={[styles.small, styles.bold, { color: p.c.text }]} numberOfLines={1}>
                  {s.name || 'Property'}
                </Text>
                <View style={styles.ratedLine}>
                  <Text style={[styles.ratedAvg, { color: p.c.text }]}>{Number(s.rating?.average || 0).toFixed(1)}</Text>
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text style={[styles.small, { color: p.c.textTertiary }]}>({s.rating?.count || 0})</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      ) : null}

      <View style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            { id: 'all', label: 'All reviews' },
            { id: 'unreplied', label: 'Needs a reply' },
          ] as const
        ).map((t) => {
          const on = filter === t.id;
          const n = t.id === 'unreplied' ? unreplied : null;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setFilter(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, { borderColor: on ? colors.primary[500] : p.c.border, backgroundColor: on ? colors.primary[500] : p.c.surface }]}
            >
              <Text style={[styles.tabText, { color: on ? '#fff' : p.c.text }]}>{t.label}</Text>
              {n ? (
                <View style={[styles.tabCount, { backgroundColor: on ? 'rgba(255,255,255,0.22)' : p.soft.amber.bg }]}>
                  <Text style={[styles.tabCountText, { color: on ? '#fff' : p.soft.amber.fg }]}>{n}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {myStays.length > 1 || stayId ? (
        <View style={styles.filter}>
          <SelectField compact sheetTitle="Property" value={stayId} options={filterOptions} onChange={setStayId} />
        </View>
      ) : null}

      {error ? (
        <Banner tone="red" style={styles.gapBottom}>
          <Text style={{ color: p.soft.red.fg, fontSize: fontSize.sm }}>
            {error}{' '}
            <Text style={styles.bold} onPress={() => { setLoading(true); load(1); }} accessibilityRole="button">
              Try again
            </Text>
          </Text>
        </Banner>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.c.backgroundSecondary }]} edges={['top']}>
      <ScreenHeader title="Stay reviews" subtitle={stayId ? nameOf(stayId) : null} onBack={back} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <FlatList
          data={loading ? [] : list}
          keyExtractor={(r) => r._id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          renderItem={({ item }) => <ReviewCard review={item} stayName={stayId ? null : nameOf(item.stay)} onUpdated={update} onReport={setReportTarget} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            loading ? (
              <LoadingSpinner />
            ) : !error ? (
              <View style={[styles.empty, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
                <Ionicons name={filter === 'unreplied' ? 'checkmark-done-outline' : 'star-outline'} size={30} color={p.c.textTertiary} />
                <Text style={[styles.emptyTitle, { color: p.c.text }]}>{filter === 'unreplied' ? "You've replied to every review" : 'No reviews yet'}</Text>
                <Text style={[styles.emptyText, { color: p.c.textSecondary }]}>
                  {filter === 'unreplied'
                    ? 'New reviews that need a reply show up here.'
                    : 'Guests are asked to review their stay after they check out. Reviews show up here.'}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={!loading && page < pages ? <Button title="Load more" variant="outline" onPress={() => load(page + 1)} loading={loadingMore} style={styles.more} /> : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor={colors.primary[500]} />}
        />
      </KeyboardAvoidingView>
      <ReportSheet
        review={reportTarget}
        onClose={() => setReportTarget(null)}
        onDone={(r, message) => {
          setReportTarget(null);
          update(r);
          Toast.show({ type: 'success', text1: message });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: fontWeight.semibold },
  small: { fontSize: fontSize.xs, lineHeight: 16 },
  gapTop: { marginTop: spacing.sm },
  gapBottom: { marginBottom: spacing.md },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  stars: { flexDirection: 'row', gap: 1 },

  summary: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, gap: 4 },
  summaryName: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  avg: { fontSize: 34, fontWeight: fontWeight.bold },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  distLabel: { width: 10, fontSize: fontSize.xs },
  distTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  distFill: { height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  distCount: { width: 24, textAlign: 'right', fontSize: fontSize.xs },
  ratedRow: { gap: spacing.sm, paddingBottom: spacing.md },
  ratedCard: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, width: 160 },
  ratedLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratedAvg: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 36 },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  tabCount: { borderRadius: 999, paddingHorizontal: 6, minWidth: 20, alignItems: 'center' },
  tabCountText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  filter: { marginBottom: spacing.md },

  card: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg, gap: spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  badgeRow: { flexDirection: 'row', gap: 6 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginTop: spacing.xs },
  body: { fontSize: fontSize.sm, lineHeight: 20 },
  meta: { marginTop: 2 },
  aspects: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs },
  aspect: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  photos: { gap: spacing.sm, paddingVertical: spacing.xs },
  photo: { width: 84, height: 64, borderRadius: borderRadius.md },
  replyArea: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.sm, paddingTop: spacing.md },
  reply: { borderRadius: borderRadius.lg, padding: spacing.md },
  replyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
  replyBody: { fontSize: fontSize.sm, lineHeight: 19, marginTop: 4 },
  replyForm: { gap: spacing.xs },
  btnRow: { flexDirection: 'row', gap: spacing.sm },

  empty: { alignItems: 'center', borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing['2xl'], gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  emptyText: { fontSize: fontSize.sm, lineHeight: 19, textAlign: 'center' },
  more: { marginTop: spacing.lg },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginTop: spacing.md, marginBottom: spacing.xs },
  textarea: { borderWidth: 1.5, borderRadius: borderRadius.lg, padding: spacing.md, minHeight: 96, fontSize: fontSize.md },
});
