// app/community/visual.tsx — Visual-first masonry feed (mobile)
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, spacing, borderRadius } from "@prayana/shared-ui";
import { communityAPI } from "@prayana/shared-services";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COL_GAP = 8;
const COL_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - COL_GAP) / 2;

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "destination", label: "Destinations" },
  { value: "accommodation", label: "Stays" },
  { value: "food", label: "Food" },
  { value: "transport", label: "Transport" },
  { value: "esim", label: "eSIM" },
];

type Q = {
  _id: string;
  title: string;
  category: string;
  answerCount?: number;
  upvotes?: number;
  images: { url: string; verifiedVisit?: boolean }[];
};

export default function VisualFeedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communityAPI.listQuestions({ sort: "top", category, limit: 80 });
      const all = (res?.data as Q[]) || [];
      setItems(all.filter((q) => q.images?.length > 0));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Distribute items into two columns for masonry
  const columns: Q[][] = [[], []];
  let heights = [0, 0];
  for (const q of items) {
    const ratio = 1 + Math.random() * 0.5; // mock height-variation; real heights set by Image
    const target = heights[0] <= heights[1] ? 0 : 1;
    columns[target].push(q);
    heights[target] += ratio;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.title}>Visual Community</Text>
        <TouchableOpacity onPress={() => router.push("/community/ask")}>
          <Ionicons name="add" size={22} color={colors.brand[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        {CATEGORIES.map((c) => {
          const active = category === c.value;
          return (
            <TouchableOpacity
              key={c.value || "all"}
              onPress={() => setCategory(c.value)}
              style={[styles.catChip, active && styles.catChipActive]}
            >
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand[500]} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: colors.gray[600] }}>No photos yet in this category.</Text>
          <TouchableOpacity onPress={() => router.push("/community/ask")} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.brand[600], fontWeight: "600" }}>
              Ask a visual question →
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.masonry}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[500]} />}
        >
          {[0, 1].map((col) => (
            <View key={col} style={[styles.column, { width: COL_WIDTH }]}>
              {columns[col].map((q) => (
                <TouchableOpacity
                  key={q._id}
                  onPress={() => router.push(`/community/${q._id}` as any)}
                  style={styles.tile}
                >
                  <Image
                    source={{ uri: q.images[0].url }}
                    style={styles.tileImage}
                    resizeMode="cover"
                  />
                  {q.images[0].verifiedVisit && (
                    <View style={styles.verifiedBadge}>
                      <Text style={{ color: "white", fontSize: 9, fontWeight: "700" }}>
                        ✓ Verified
                      </Text>
                    </View>
                  )}
                  <View style={styles.tileOverlay}>
                    <Text style={styles.tileCategory}>{q.category.toUpperCase()}</Text>
                    <Text style={styles.tileTitle} numberOfLines={2}>
                      {q.title}
                    </Text>
                    <Text style={styles.tileMeta}>
                      {q.answerCount || 0} answer{q.answerCount === 1 ? "" : "s"} ·{" "}
                      {q.upvotes || 0} upvote{q.upvotes === 1 ? "" : "s"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: "white", borderBottomWidth: 1, borderColor: colors.gray[200],
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any, color: colors.gray[900] },
  catRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "white", borderWidth: 1, borderColor: colors.gray[200], marginRight: 6,
  },
  catChipActive: { backgroundColor: colors.brand[500], borderColor: colors.brand[500] },
  catChipText: { fontSize: 11, color: colors.gray[700] },
  catChipTextActive: { color: "white", fontWeight: fontWeight.semibold as any },
  masonry: {
    flexDirection: "row", paddingHorizontal: spacing.md, gap: COL_GAP,
    paddingBottom: spacing.xl,
  },
  column: { gap: COL_GAP, flexDirection: "column" },
  tile: {
    backgroundColor: "white",
    borderRadius: borderRadius.md,
    overflow: "hidden",
    marginBottom: COL_GAP,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  tileImage: { width: "100%", height: 200 },
  tileOverlay: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  tileCategory: { color: "rgba(255,255,255,0.85)", fontSize: 9, letterSpacing: 0.5, fontWeight: "700" },
  tileTitle: { color: "white", fontSize: 12, fontWeight: "600", marginVertical: 2 },
  tileMeta: { color: "rgba(255,255,255,0.7)", fontSize: 9 },
  verifiedBadge: {
    position: "absolute", top: 6, left: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, backgroundColor: "#16a34a",
  },
});
