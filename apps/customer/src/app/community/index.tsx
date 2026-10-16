// app/community/index.tsx — Community Q&A feed (mobile), designed after the
// web's app/community/page.jsx: a hero over a soft blurred travel photo ("Ask
// travelers who've been there."), a pill search with a gradient button, Ask a
// question / Visual feed, live counts from the questions on screen; then the
// Newest / Top / Unanswered switch, topic chips in each category's colour,
// a section heading, and the question cards.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { communityAPI } from '@prayana/shared-services';
import { QuestionCard, Question } from '../../components/community/QuestionCard';
import { COMMUNITY_CATEGORIES } from '../../lib/communityCategories';

const RED = '#E61417';
const ORANGE = '#f97316';
const HERO = require('../../../assets/hero-scenery.jpg');

type SortKey = 'newest' | 'top' | 'unanswered';
const SORTS: { key: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap; title: string; note: string }[] = [
  { key: 'newest', label: 'Newest', icon: 'time-outline', title: 'Latest questions', note: 'newest first' },
  { key: 'top', label: 'Top', icon: 'flame-outline', title: 'Most upvoted', note: 'travelers found most useful' },
  { key: 'unanswered', label: 'Unanswered', icon: 'help-circle-outline', title: 'Awaiting answers', note: 'still looking for a reply — can you help?' },
];

export default function CommunityFeedScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const [items, setItems] = useState<Question[]>([]);
  const [sort, setSort] = useState<SortKey>('newest');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Searches run on submit (as on the web), not on every keystroke.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = query
        ? await communityAPI.searchQuestions(query, 30)
        : await communityAPI.listQuestions({ sort, category, limit: 30 } as any);
      setItems((res?.data as Question[]) || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [sort, category, query]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sortMeta = SORTS.find((x) => x.key === sort)!;
  const catMeta = COMMUNITY_CATEGORIES.find((c) => c.value === category);
  // Live numbers, from the questions on screen (the web does the same).
  const totalAnswers = items.reduce((n, q) => n + (q.answerCount || 0), 0);
  const resolvedCount = items.filter((q) => q.isResolved).length;
  const line = isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
  const bg = isDarkMode ? themeColors.background : '#fafafa';

  const header = (
    <View>
      {/* ═══ HERO ═══ */}
      <View style={s.hero}>
        <Image source={HERO} style={[StyleSheet.absoluteFill, { opacity: isDarkMode ? 0.35 : 0.85 }]} contentFit="cover" blurRadius={40} />
        <LinearGradient
          colors={isDarkMode ? ['rgba(3,7,18,0.45)', 'rgba(3,7,18,0.75)', bg] : ['rgba(250,250,250,0.15)', 'rgba(250,250,250,0.6)', bg]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={s.topRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any))} hitSlop={10} style={[s.round, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)' }]} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={21} color={themeColors.text} />
          </Pressable>
          <View style={[s.eyebrow, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)' }]}>
            <View style={s.liveDot} />
            <Text style={s.eyebrowText}>PRAYANAAI COMMUNITY</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <Text style={[s.h1, { color: themeColors.text }]}>
          Ask travelers who've{'\n'}<Text style={{ color: RED }}>been there.</Text>
        </Text>
        <Text style={[s.lead, { color: themeColors.textSecondary }]}>
          Real answers from fellow travelers and verified partners on the ground — visas, eSIMs, stays, routes, budgets and hidden spots.
        </Text>

        <View style={[s.search, { backgroundColor: themeColors.surface, borderColor: line }]}>
          <Ionicons name="search" size={18} color={themeColors.textTertiary} style={{ marginLeft: 6 }} />
          <TextInput
            value={search}
            onChangeText={(t) => { setSearch(t); if (!t) setQuery(''); }}
            placeholder="Search visas, eSIMs, stays…"
            placeholderTextColor={themeColors.textTertiary}
            style={[s.searchInput, { color: themeColors.text }]}
            returnKeyType="search"
            onSubmitEditing={() => setQuery(search.trim())}
          />
          <Pressable onPress={() => setQuery(search.trim())} accessibilityRole="button" accessibilityLabel="Search">
            <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.searchBtn}>
              <Ionicons name="search" size={16} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>

        <View style={s.actions}>
          <Pressable onPress={() => router.push('/community/ask' as any)} style={({ pressed }) => [s.askWrap, pressed && { opacity: 0.9 }]} accessibilityRole="button">
            <View style={[s.ask, { backgroundColor: isDarkMode ? '#fff' : '#111827' }]}>
              <Ionicons name="paper-plane" size={15} color={isDarkMode ? '#111827' : '#fff'} />
              <Text style={[s.askText, { color: isDarkMode ? '#111827' : '#fff' }]}>Ask a question</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/community/visual' as any)} style={({ pressed }) => [s.visual, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)', borderColor: line }, pressed && { opacity: 0.9 }]} accessibilityRole="button">
            <Ionicons name="images" size={15} color={ORANGE} />
            <Text style={[s.visualText, { color: themeColors.text }]}>Visual feed</Text>
          </Pressable>
        </View>

        <View style={s.stats}>
          {([
            ['chatbubbles', items.length, 'questions'],
            ['create', totalAnswers, 'answers'],
            ['checkmark-circle', resolvedCount, 'resolved'],
          ] as const).map(([icon, n, label]) => (
            <View key={label} style={[s.stat, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)', borderColor: line }]}>
              <Ionicons name={icon} size={13} color={label === 'resolved' ? '#10b981' : ORANGE} />
              <Text style={[s.statN, { color: themeColors.text }]}>{loading ? '—' : n}</Text>
              <Text style={[s.statL, { color: themeColors.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ═══ Sort + topics ═══ */}
      <View style={[s.sorts, { backgroundColor: themeColors.surface, borderColor: line }]}>
        {SORTS.map((t) => {
          const on = sort === t.key && !query;
          const body = (
            <>
              <Ionicons name={t.icon} size={14} color={on ? '#fff' : themeColors.textSecondary} />
              <Text style={[s.sortText, { color: on ? '#fff' : themeColors.textSecondary }]}>{t.label}</Text>
            </>
          );
          return (
            <Pressable key={t.key} onPress={() => { setSort(t.key); setQuery(''); setSearch(''); }} style={s.sortItem} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              {on ? (
                <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sortOn}>{body}</LinearGradient>
              ) : (
                <View style={s.sortOff}>{body}</View>
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.topics}>
        {[{ value: '', label: 'All', icon: 'grid' as const, color: '#111827' }, ...COMMUNITY_CATEGORIES].map((c) => {
          const on = category === c.value;
          const tint = c.value ? c.color : isDarkMode ? '#fff' : '#111827';
          return (
            <Pressable
              key={c.value || 'all'}
              onPress={() => { setCategory(c.value); setQuery(''); setSearch(''); }}
              style={[s.topic, on ? { backgroundColor: tint, borderColor: tint } : { backgroundColor: themeColors.surface, borderColor: line }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <View style={[s.topicIcon, { backgroundColor: on ? 'rgba(255,255,255,0.22)' : `${c.color}1A` }]}>
                <Ionicons name={c.icon} size={12} color={on ? (c.value ? '#fff' : isDarkMode ? '#111827' : '#fff') : tint} />
              </View>
              <Text style={[s.topicText, { color: on ? (c.value || !isDarkMode ? '#fff' : '#111827') : themeColors.text }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.masthead}>
        <View style={s.mastRow}>
          <Text style={[s.h2, { color: themeColors.text, flex: 1 }]} numberOfLines={1}>
            {query ? `Results for "${query}"` : catMeta ? catMeta.label : sortMeta.title}
          </Text>
          {/* The chip filters in place; this opens the topic's own page. */}
          {catMeta && !query ? (
            <Pressable onPress={() => router.push(`/community/category/${catMeta.value}` as any)} hitSlop={8} style={[s.seeAll, { backgroundColor: `${catMeta.color}1A` }]} accessibilityRole="link" accessibilityLabel={`Open ${catMeta.label} topic`}>
              <Text style={[s.seeAllText, { color: catMeta.color }]}>See all</Text>
              <Ionicons name="chevron-forward" size={13} color={catMeta.color} />
            </Pressable>
          ) : null}
        </View>
        <Text style={[s.mastNote, { color: themeColors.textSecondary }]}>
          {loading ? 'Loading questions…' : `${items.length} ${items.length === 1 ? 'question' : 'questions'}${query ? '' : ` · ${sortMeta.note}`}`}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: bg }]} edges={['top']}>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={(q) => q._id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 110 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <QuestionCard q={item} onPress={() => router.push(`/community/${item._id}` as any)} />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[s.skel, { backgroundColor: themeColors.surface, borderColor: line }]}>
                  <View style={[s.skelLine, { width: 90, height: 18, borderRadius: 9 }]} />
                  <View style={[s.skelLine, { width: '85%' }]} />
                  <View style={[s.skelLine, { width: '100%', height: 12 }]} />
                  <View style={[s.skelLine, { width: '55%', height: 12 }]} />
                </View>
              ))}
            </View>
          ) : (
            <View style={[s.empty, { backgroundColor: themeColors.surface, borderColor: line }]}>
              <LinearGradient colors={[ORANGE, RED]} style={s.emptyIcon}>
                <Ionicons name="mail" size={26} color="#fff" />
              </LinearGradient>
              <Text style={[s.emptyTitle, { color: themeColors.text }]}>
                {query ? 'No matching questions' : <>The desk is quiet <Text style={{ color: RED }}>for now.</Text></>}
              </Text>
              <Text style={[s.emptyText, { color: themeColors.textSecondary }]}>
                Be the first to ask. Answers come from travelers who've been there and verified partners on the ground.
              </Text>
              <Pressable onPress={() => router.push('/community/ask' as any)} accessibilityRole="button">
                <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtn}>
                  <Ionicons name="paper-plane" size={14} color="#fff" />
                  <Text style={s.emptyBtnText}>Ask the first question</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
      />

      {/* Ask, always in reach while reading the feed. */}
      <Pressable onPress={() => router.push('/community/ask' as any)} style={s.fabWrap} accessibilityRole="button" accessibilityLabel="Ask a question">
        <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fab}>
          <Ionicons name="add" size={26} color="#fff" />
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  hero: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 22, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(230,20,23,0.18)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10b981' },
  eyebrowText: { color: RED, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.6 },
  h1: { fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 37, textAlign: 'center', marginTop: 18 },
  lead: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 10, paddingHorizontal: 6 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, padding: 5, marginTop: 20,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  searchBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  askWrap: { flex: 1.2 },
  ask: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 16, paddingVertical: 13,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  askText: { fontSize: 14.5, fontWeight: '800' },
  visual: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 16, borderWidth: 1, paddingVertical: 13 },
  visualText: { fontSize: 14.5, fontWeight: '800' },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  statN: { fontSize: 14.5, fontWeight: '900' },
  statL: { fontSize: 11.5 },

  sorts: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 999, borderWidth: 1, padding: 4 },
  sortItem: { flex: 1 },
  sortOn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 999, paddingVertical: 9 },
  sortOff: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 999, paddingVertical: 9 },
  sortText: { fontSize: 13, fontWeight: '800' },
  topics: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingLeft: 5, paddingRight: 12, paddingVertical: 5 },
  topicIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  topicText: { fontSize: 13, fontWeight: '700' },
  masthead: { paddingHorizontal: 16, paddingBottom: 12 },
  h2: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  mastRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 999, paddingLeft: 11, paddingRight: 8, paddingVertical: 6 },
  seeAllText: { fontSize: 12.5, fontWeight: '800' },
  mastNote: { fontSize: 13, marginTop: 2 },

  skel: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  skelLine: { height: 16, borderRadius: 6, backgroundColor: 'rgba(148,163,184,0.18)' },

  empty: { marginHorizontal: 16, borderWidth: 1, borderRadius: 24, padding: 26, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  emptyTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  fabWrap: { position: 'absolute', right: 18, bottom: 26 },
  fab: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: RED, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
});
