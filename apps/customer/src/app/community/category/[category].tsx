// app/community/category/[category].tsx — one community topic (mobile), after
// the web's /community/category/[category]: a header washed in the topic's
// colour (icon tile, "Community topic", name, a line about it), Ask a question
// with the topic picked, Newest / Top / Unanswered, chips to hop to the other
// topics, then the questions — the next page loads as you scroll.
import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { QuestionCard } from '../../../components/community/QuestionCard';
import { QuestionSkeletons, SortKey, SORTS, SortTabs, usePagedQuestions } from '../../../components/community/QuestionFeed';
import { CATEGORY_BLURBS, COMMUNITY_CATEGORIES, categoryMeta } from '../../../lib/communityCategories';
import { useGoBack } from '../../../lib/goBack';

const RED = '#E61417';
const ORANGE = '#f97316';

export default function CommunityTopicScreen() {
  const router = useRouter();
  const goBack = useGoBack('/community');
  const { themeColors, isDarkMode } = useTheme();
  const { category: raw } = useLocalSearchParams<{ category: string }>();
  const category = String(raw || 'other').toLowerCase();
  const cat = categoryMeta(category);
  const [sort, setSort] = useState<SortKey>('newest');
  const feed = usePagedQuestions({ category, sort });

  const sortMeta = SORTS.find((x) => x.key === sort)!;
  const line = isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
  const bg = isDarkMode ? themeColors.background : '#fafafa';
  const blurb = CATEGORY_BLURBS[category] || `Questions and answers about ${cat.label.toLowerCase()} from fellow travelers.`;
  const ask = () => router.push(`/community/ask?category=${encodeURIComponent(category)}` as any);

  const header = (
    <View>
      <View style={s.wash}>
        <LinearGradient
          colors={[`${cat.color}${isDarkMode ? '40' : '2E'}`, `${cat.color}${isDarkMode ? '14' : '0D'}`, bg]}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.topRow}>
          <Pressable onPress={goBack} hitSlop={10} style={[s.round, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)' }]} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={21} color={themeColors.text} />
          </Pressable>
          <Pressable onPress={() => router.dismissTo('/community' as any)} hitSlop={8} style={[s.allPill, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)' }]} accessibilityRole="link">
            <Ionicons name="chatbubbles-outline" size={14} color={themeColors.text} />
            <Text style={[s.allText, { color: themeColors.text }]}>All topics</Text>
          </Pressable>
        </View>

        <View style={s.titleRow}>
          <LinearGradient colors={[cat.color, `${cat.color}CC`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.tile, { shadowColor: cat.color }]}>
            <Ionicons name={cat.icon} size={28} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.eyebrow, { color: cat.color }]}>COMMUNITY TOPIC</Text>
            <Text style={[s.h1, { color: themeColors.text }]} numberOfLines={2}>{cat.label}</Text>
          </View>
        </View>
        <Text style={[s.lead, { color: themeColors.textSecondary }]}>{blurb}</Text>

        <Pressable onPress={ask} style={({ pressed }) => [s.askWrap, pressed && { opacity: 0.9 }]} accessibilityRole="button">
          <View style={[s.ask, { backgroundColor: isDarkMode ? '#fff' : '#111827' }]}>
            <Ionicons name="paper-plane" size={15} color={isDarkMode ? '#111827' : '#fff'} />
            <Text style={[s.askText, { color: isDarkMode ? '#111827' : '#fff' }]}>Ask about {cat.label}</Text>
          </View>
        </Pressable>
      </View>

      <SortTabs sort={sort} onChange={setSort} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.topics}>
        {COMMUNITY_CATEGORIES.filter((c) => c.value !== category).map((c) => (
          <Pressable
            key={c.value}
            onPress={() => router.replace(`/community/category/${c.value}` as any)}
            style={({ pressed }) => [s.topic, { backgroundColor: themeColors.surface, borderColor: line }, pressed && { opacity: 0.8 }]}
            accessibilityRole="link"
          >
            <View style={[s.topicIcon, { backgroundColor: `${c.color}1A` }]}>
              <Ionicons name={c.icon} size={12} color={c.color} />
            </View>
            <Text style={[s.topicText, { color: themeColors.text }]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={s.masthead}>
        <Text style={[s.h2, { color: themeColors.text }]}>{sortMeta.title}</Text>
        <Text style={[s.mastNote, { color: themeColors.textSecondary }]}>
          {feed.loading ? 'Loading questions…' : `${feed.total} ${feed.total === 1 ? 'question' : 'questions'}`}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: bg }]} edges={['top']}>
      <FlatList
        data={feed.loading ? [] : feed.items}
        keyExtractor={(q) => q._id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 110 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <QuestionCard q={item} currentCategory={category} onPress={() => router.push(`/community/${item._id}` as any)} />
          </View>
        )}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.6}
        initialNumToRender={6}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={RED} style={{ marginTop: 18 }} /> : null}
        ListEmptyComponent={
          feed.loading ? (
            <QuestionSkeletons />
          ) : (
            <View style={[s.empty, { backgroundColor: themeColors.surface, borderColor: line }]}>
              <View style={[s.emptyIcon, { backgroundColor: cat.color }]}>
                <Ionicons name={cat.icon} size={26} color="#fff" />
              </View>
              <Text style={[s.emptyTitle, { color: themeColors.text }]}>
                {feed.failed ? "Couldn't load questions" : sort === 'unanswered' ? 'Every question has an answer' : 'Be the first to ask'}
              </Text>
              <Text style={[s.emptyText, { color: themeColors.textSecondary }]}>
                {feed.failed
                  ? 'Check your connection and pull down to try again.'
                  : `Nobody has asked about ${cat.label.toLowerCase()} here yet. Travelers who've been there and verified partners will answer.`}
              </Text>
              {!feed.failed ? (
                <Pressable onPress={ask} accessibilityRole="button">
                  <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtn}>
                    <Ionicons name="paper-plane" size={14} color="#fff" />
                    <Text style={s.emptyBtnText}>Ask a question</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor={RED} />}
      />

      <Pressable onPress={ask} style={s.fabWrap} accessibilityRole="button" accessibilityLabel="Ask a question">
        <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fab}>
          <Ionicons name="add" size={26} color="#fff" />
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  wash: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  allPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  allText: { fontSize: 12.5, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 },
  tile: {
    width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  eyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.6 },
  h1: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8, lineHeight: 33, marginTop: 2 },
  lead: { fontSize: 14.5, lineHeight: 21, marginTop: 12 },
  askWrap: { marginTop: 16 },
  ask: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 16, paddingVertical: 13,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  askText: { fontSize: 14.5, fontWeight: '800' },

  topics: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingLeft: 5, paddingRight: 12, paddingVertical: 5 },
  topicIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  topicText: { fontSize: 13, fontWeight: '700' },
  masthead: { paddingHorizontal: 16, paddingBottom: 12 },
  h2: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  mastNote: { fontSize: 13, marginTop: 2 },

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
