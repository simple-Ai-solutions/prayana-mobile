// app/community/index.tsx — Community Q&A feed (mobile)
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, spacing, borderRadius, useTheme } from "@prayana/shared-ui";
import { communityAPI } from "@prayana/shared-services";
import { resolveImageUrl } from "@prayana/shared-utils";

type SortKey = "newest" | "top" | "unanswered";
type Question = {
  _id: string;
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  answerCount?: number;
  upvotes?: number;
  viewCount?: number;
  isResolved?: boolean;
  isAnonymous?: boolean;
  userName?: string;
  createdAt: string;
  images?: { url: string }[];
};

const SORT_TABS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "top", label: "Top" },
  { key: "unanswered", label: "Unanswered" },
];

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "destination", label: "Destinations" },
  { value: "accommodation", label: "Stays" },
  { value: "food", label: "Food" },
  { value: "transport", label: "Transport" },
  { value: "esim", label: "eSIM" },
  { value: "visa", label: "Visa" },
  { value: "safety", label: "Safety" },
  { value: "budget", label: "Budget" },
  { value: "gear", label: "Gear" },
];

function timeAgo(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export default function CommunityFeedScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const [items, setItems] = useState<Question[]>([]);
  const [sort, setSort] = useState<SortKey>("newest");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = search
        ? await communityAPI.searchQuestions(search, 30)
        : await communityAPI.listQuestions({ sort, category, limit: 30 } as any);
      setItems((res?.data as Question[]) || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [sort, category, search]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Community</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => router.push("/community/visual")}
          >
            <Ionicons name="images-outline" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.primary[500] }]}
            onPress={() => router.push("/community/ask")}
          >
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border }]}>
        <Ionicons name="search" size={16} color={themeColors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: themeColors.text }]}
          placeholder="Search questions…"
          placeholderTextColor={themeColors.textTertiary}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
          returnKeyType="search"
        />
      </View>

      <View style={styles.tabsRow}>
        {SORT_TABS.map((t) => {
          const active = sort === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setSort(t.key)}
              style={[styles.tab, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, { color: themeColors.textSecondary }, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(c) => c.value || "all"}
        contentContainerStyle={styles.catRow}
        renderItem={({ item: c }) => {
          const active = category === c.value;
          return (
            <TouchableOpacity
              onPress={() => setCategory(c.value)}
              style={[styles.catChip, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, active && styles.catChipActive]}
            >
              <Text style={[styles.catChipText, { color: themeColors.textSecondary }, active && styles.catChipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No questions yet.</Text>
          <TouchableOpacity onPress={() => router.push("/community/ask")}>
            <Text style={styles.emptyCta}>Be the first to ask →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(q) => q._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
          }
          renderItem={({ item: q }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={() => router.push(`/community/${q._id}` as any)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardCategory}>{q.category.toUpperCase()}</Text>
                {q.isResolved && (
                  <View style={[styles.badge, { backgroundColor: "#dcfce7" }]}>
                    <Text style={[styles.badgeText, { color: "#15803d" }]}>Resolved</Text>
                  </View>
                )}
                {q.isAnonymous && (
                  <View style={[styles.badge, { backgroundColor: colors.gray[100] }]}>
                    <Text style={[styles.badgeText, { color: colors.gray[600] }]}>Anonymous</Text>
                  </View>
                )}
                {(q.images?.length ?? 0) > 0 && (
                  <View style={styles.imageHint}>
                    <Ionicons name="image-outline" size={11} color={colors.gray[500]} />
                    <Text style={styles.imageHintText}> {q.images!.length}</Text>
                  </View>
                )}
              </View>

              {/* Body: text on the left, first image thumbnail on the right
                  (mirrors the PWA QuestionCard layout). */}
              <View style={styles.cardBodyRow}>
                <View style={styles.cardBodyText}>
                  <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
                    {q.title}
                  </Text>
                  {q.description ? (
                    <Text style={[styles.cardDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                      {q.description}
                    </Text>
                  ) : null}
                </View>
                {(q.images?.length ?? 0) > 0 && q.images?.[0]?.url ? (
                  <Image
                    source={{ uri: resolveImageUrl(q.images[0].url) || q.images[0].url }}
                    style={styles.cardThumb}
                    resizeMode="cover"
                  />
                ) : null}
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.statRow}>
                  <Ionicons name="arrow-up" size={12} color={themeColors.textTertiary} />
                  <Text style={[styles.statText, { color: themeColors.textTertiary }]}>{q.upvotes || 0}</Text>
                </View>
                <View style={styles.statRow}>
                  <Ionicons name="chatbubble-outline" size={12} color={themeColors.textTertiary} />
                  <Text style={[styles.statText, { color: themeColors.textTertiary }]}>{q.answerCount || 0}</Text>
                </View>
                <View style={styles.statRow}>
                  <Ionicons name="eye-outline" size={12} color={themeColors.textTertiary} />
                  <Text style={[styles.statText, { color: themeColors.textTertiary }]}>{q.viewCount || 0}</Text>
                </View>
                <Text style={[styles.metaText, { color: themeColors.textTertiary }]}>
                  {q.userName} · {timeAgo(q.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.gray[900] },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "white", borderWidth: 1, borderColor: colors.gray[200],
  },
  searchBar: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: "white",
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.gray[900], paddingVertical: 4 },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: 6,
  },
  tab: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: 999, backgroundColor: "white",
    borderWidth: 1, borderColor: colors.gray[200],
  },
  tabActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  tabText: { fontSize: fontSize.xs, color: colors.gray[700], fontWeight: fontWeight.medium },
  tabTextActive: { color: "white" },
  catRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "white", borderWidth: 1, borderColor: colors.gray[200],
    marginRight: 6,
  },
  catChipActive: { backgroundColor: colors.primary[100], borderColor: colors.primary[300] },
  catChipText: { fontSize: 11, color: colors.gray[700] },
  catChipTextActive: { color: colors.primary[700], fontWeight: fontWeight.semibold as any },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 8 },
  emptyText: { color: colors.gray[600] },
  emptyCta: { color: colors.primary[600], fontWeight: fontWeight.semibold as any },
  card: {
    backgroundColor: "white",
    marginHorizontal: spacing.md,
    marginVertical: 6,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  cardCategory: { fontSize: 10, color: colors.primary[600], fontWeight: fontWeight.bold as any, letterSpacing: 0.5 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: fontWeight.semibold as any },
  imageHint: { flexDirection: "row", alignItems: "center" },
  imageHintText: { fontSize: 10, color: colors.gray[500] },
  cardBodyRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardBodyText: { flex: 1 },
  cardThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.gray[100] },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, color: colors.gray[900], marginBottom: 4 },
  cardDesc: { fontSize: fontSize.sm, color: colors.gray[600], marginBottom: 8 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  statRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 11, color: colors.gray[500] },
  metaText: { marginLeft: "auto", fontSize: 10, color: colors.gray[400] },
});
