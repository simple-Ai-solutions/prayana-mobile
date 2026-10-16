// app/community/tag/[tag].tsx — every question carrying one tag (mobile), after
// the web's /community/tag/[tag]: a "#" tile, "N questions tagged #tag", then
// the newest questions, paged as you scroll.
import React from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { QuestionCard } from '../../../components/community/QuestionCard';
import { QuestionSkeletons, usePagedQuestions } from '../../../components/community/QuestionFeed';
import { useGoBack } from '../../../lib/goBack';

const RED = '#E61417';
const ORANGE = '#f97316';

export default function CommunityTagScreen() {
  const router = useRouter();
  const goBack = useGoBack('/community');
  const { themeColors, isDarkMode } = useTheme();
  const { tag: raw } = useLocalSearchParams<{ tag: string }>();
  // The server stores and matches tags lowercased.
  const tag = String(raw || '').replace(/^#/, '').trim().toLowerCase();
  const feed = usePagedQuestions({ tag, sort: 'newest' });

  const line = isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
  const bg = isDarkMode ? themeColors.background : '#fafafa';

  const header = (
    <View style={s.wash}>
      <LinearGradient
        colors={isDarkMode ? ['rgba(249,115,22,0.22)', 'rgba(230,20,23,0.06)', bg] : ['#ffedd5', '#fff7ed', bg]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.topRow}>
        <Pressable onPress={goBack} hitSlop={10} style={[s.round, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)' }]} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={21} color={themeColors.text} />
        </Pressable>
        <Pressable onPress={() => router.dismissTo('/community' as any)} hitSlop={8} style={[s.allPill, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)' }]} accessibilityRole="link">
          <Ionicons name="chatbubbles-outline" size={14} color={themeColors.text} />
          <Text style={[s.allText, { color: themeColors.text }]}>Community</Text>
        </Pressable>
      </View>

      <View style={s.titleRow}>
        <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
          <Text style={s.hash}>#</Text>
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.eyebrow}>TAG</Text>
          <Text style={[s.h1, { color: themeColors.text }]} numberOfLines={2}>#{tag}</Text>
        </View>
      </View>
      <Text style={[s.lead, { color: themeColors.textSecondary }]}>
        {feed.loading
          ? 'Loading questions…'
          : `${feed.total} ${feed.total === 1 ? 'question' : 'questions'} tagged `}
        {feed.loading ? null : <Text style={{ color: ORANGE, fontWeight: '800' }}>#{tag}</Text>}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: bg }]} edges={['top']}>
      <FlatList
        data={feed.loading ? [] : feed.items}
        keyExtractor={(q) => q._id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <QuestionCard q={item} currentTag={tag} onPress={() => router.push(`/community/${item._id}` as any)} />
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
              <LinearGradient colors={[ORANGE, RED]} style={s.emptyIcon}>
                <Ionicons name="pricetag" size={24} color="#fff" />
              </LinearGradient>
              <Text style={[s.emptyTitle, { color: themeColors.text }]}>
                {feed.failed ? "Couldn't load questions" : 'No questions with this tag yet'}
              </Text>
              <Text style={[s.emptyText, { color: themeColors.textSecondary }]}>
                {feed.failed ? 'Check your connection and pull down to try again.' : 'Ask one and add this tag so the next traveler finds it.'}
              </Text>
              {!feed.failed ? (
                <Pressable onPress={() => router.push('/community/ask' as any)} accessibilityRole="button">
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  wash: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, marginBottom: 4, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  allPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  allText: { fontSize: 12.5, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 },
  tile: {
    width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }],
    shadowColor: RED, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  hash: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: -2 },
  eyebrow: { color: ORANGE, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.6 },
  h1: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8, lineHeight: 33, marginTop: 2 },
  lead: { fontSize: 14.5, lineHeight: 21, marginTop: 12 },

  empty: { marginHorizontal: 16, borderWidth: 1, borderRadius: 24, padding: 26, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  emptyTitle: { fontSize: 21, fontWeight: '900', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
