// Pieces shared by the topic and tag pages: a paged question list that loads
// the next page as you near the end, the Newest / Top / Unanswered switch, and
// the loading skeletons.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { communityAPI } from '@prayana/shared-services';
import type { Question } from './QuestionCard';

const RED = '#E61417';
const ORANGE = '#f97316';
const LIMIT = 20;

export type SortKey = 'newest' | 'top' | 'unanswered';
export const SORTS: { key: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap; title: string }[] = [
  { key: 'newest', label: 'Newest', icon: 'time-outline', title: 'Latest questions' },
  { key: 'top', label: 'Top', icon: 'flame-outline', title: 'Most upvoted' },
  { key: 'unanswered', label: 'Unanswered', icon: 'help-circle-outline', title: 'Awaiting answers' },
];

export function usePagedQuestions({ category, tag, sort }: { category?: string; tag?: string; sort: SortKey }) {
  const [items, setItems] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  // Only the latest request may land; a sort switch mid-load drops the old one.
  const req = useRef(0);

  const fetchPage = useCallback(async (p: number) => {
    const id = ++req.current;
    try {
      const res: any = await communityAPI.listQuestions({ category, tag, sort, page: p, limit: LIMIT } as any);
      if (id !== req.current) return;
      const data: Question[] = Array.isArray(res?.data) ? res.data : [];
      setItems((prev) => {
        if (p === 1) return data;
        const seen = new Set(prev.map((q) => q._id));
        return [...prev, ...data.filter((q) => !seen.has(q._id))];
      });
      setPage(p);
      setPages(res?.pagination?.pages || (data.length < LIMIT ? p : p + 1));
      setTotal(res?.pagination?.total ?? (p === 1 ? data.length : 0));
      setFailed(false);
    } catch {
      if (id !== req.current) return;
      if (p === 1) { setItems([]); setTotal(0); setFailed(true); }
    }
  }, [category, tag, sort]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    const mine = req.current + 1;
    fetchPage(1).finally(() => { if (req.current === mine) setLoading(false); });
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(1);
    setRefreshing(false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || page >= pages) return;
    setLoadingMore(true);
    await fetchPage(page + 1);
    setLoadingMore(false);
  }, [loading, loadingMore, refreshing, page, pages, fetchPage]);

  return { items, total, loading, loadingMore, refreshing, failed, hasMore: page < pages, refresh, loadMore };
}

export function SortTabs({ sort, onChange }: { sort: SortKey; onChange: (k: SortKey) => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
  return (
    <View style={[s.sorts, { backgroundColor: themeColors.surface, borderColor: line }]}>
      {SORTS.map((t) => {
        const on = sort === t.key;
        const body = (
          <>
            <Ionicons name={t.icon} size={14} color={on ? '#fff' : themeColors.textSecondary} />
            <Text style={[s.sortText, { color: on ? '#fff' : themeColors.textSecondary }]}>{t.label}</Text>
          </>
        );
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={s.sortItem} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            {on ? (
              <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sortPill}>{body}</LinearGradient>
            ) : (
              <View style={s.sortPill}>{body}</View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export function QuestionSkeletons() {
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
  return (
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
  );
}

const s = StyleSheet.create({
  sorts: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 999, borderWidth: 1, padding: 4 },
  sortItem: { flex: 1 },
  sortPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 999, paddingVertical: 9 },
  sortText: { fontSize: 13, fontWeight: '800' },
  skel: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  skelLine: { height: 16, borderRadius: 6, backgroundColor: 'rgba(148,163,184,0.18)' },
});
