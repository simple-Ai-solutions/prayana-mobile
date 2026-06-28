// app/community/[id].tsx — Question detail (mobile)
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Linking,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, spacing, borderRadius, useTheme } from "@prayana/shared-ui";
import { communityAPI } from "@prayana/shared-services";
import { resolveImageUrl } from "@prayana/shared-utils";

const URL_PATTERN = /^https?:\/\/[^\s<>")]+$/;

function timeAgo(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function RichText({ text, style }: { text: string; style?: any }) {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s<>")]+)/g);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        URL_PATTERN.test(p) ? (
          <Text
            key={i}
            style={{ color: colors.primary[600], textDecorationLine: "underline" }}
            onPress={() => Linking.openURL(p)}
          >
            {p}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        )
      )}
    </Text>
  );
}

export default function QuestionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();
  const [question, setQuestion] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await communityAPI.getQuestion(id);
      setQuestion(res?.data?.question || null);
      setAnswers(res?.data?.answers || []);
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const upvoteQuestion = async () => {
    try {
      const res = await communityAPI.upvoteQuestion(id!);
      if (res?.data?.upvotes != null) {
        setQuestion((q: any) => ({ ...q, upvotes: res.data.upvotes }));
      }
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Sign in to upvote");
    }
  };

  const upvoteAnswer = async (answerId: string) => {
    try {
      const res = await communityAPI.upvoteAnswer(answerId);
      if (res?.data?.upvotes != null) {
        setAnswers((arr) =>
          arr.map((a) => (a._id === answerId ? { ...a, upvotes: res.data.upvotes } : a))
        );
      }
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Sign in to upvote");
    }
  };

  const postAnswer = async () => {
    if (reply.trim().length < 10) return;
    setPosting(true);
    try {
      const res = await communityAPI.createAnswer(id!, { content: reply.trim() });
      if (res?.data) setAnswers((prev) => [...prev, res.data]);
      setReply("");
    } catch (e: any) {
      Alert.alert("Failed to post", e?.message || "Please try again");
    } finally {
      setPosting(false);
    }
  };

  // ── Nested replies under an answer (PWA parity) ──
  const [replyOpen, setReplyOpen] = useState<string | null>(null); // answerId being replied to
  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);

  const postReply = async (answerId: string) => {
    if (replyText.trim().length < 2) return;
    setReplyPosting(true);
    try {
      const res = await communityAPI.replyToAnswer(answerId, { content: replyText.trim() });
      const newReply = res?.data || { content: replyText.trim(), createdAt: new Date().toISOString() };
      setAnswers((prev) =>
        prev.map((a) =>
          a._id === answerId ? { ...a, replies: [...(a.replies || []), newReply] } : a
        )
      );
      setReplyText("");
      setReplyOpen(null);
    } catch (e: any) {
      Alert.alert("Failed to reply", e?.message || "Please try again");
    } finally {
      setReplyPosting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (!question) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.center}>
          <Text style={{ color: themeColors.textSecondary }}>Question not found.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.primary[600], marginTop: 8 }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ctx = question.tripContext || {};

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={themeColors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
          {question.category}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
        }
      >
        <View style={[styles.questionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Text style={styles.cardCategory}>{question.category.toUpperCase()}</Text>
            {question.isResolved && (
              <View style={[styles.badge, { backgroundColor: "#dcfce7" }]}>
                <Text style={[styles.badgeText, { color: "#15803d" }]}>Resolved</Text>
              </View>
            )}
            {question.isAnonymous && (
              <View style={[styles.badge, { backgroundColor: colors.gray[100] }]}>
                <Text style={[styles.badgeText, { color: colors.gray[600] }]}>Anonymous</Text>
              </View>
            )}
          </View>
          <Text style={[styles.questionTitle, { color: themeColors.text }]}>{question.title}</Text>
          {question.description ? (
            <RichText text={question.description} style={[styles.questionDesc, { color: themeColors.textSecondary }]} />
          ) : null}

          {(question.images?.length ?? 0) > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {question.images.map((img: any, i: number) => (
                <Image key={img.s3Key || i} source={{ uri: resolveImageUrl(img.url) || img.url }} style={styles.questionImage} />
              ))}
            </ScrollView>
          )}

          {/* Tags (PWA parity) */}
          {(question.tags?.length ?? 0) > 0 && (
            <View style={styles.tagRow}>
              {question.tags.map((t: string, i: number) => (
                <View key={i} style={[styles.tagChip, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                  <Text style={[styles.tagChipText, { color: themeColors.textSecondary }]}>#{t}</Text>
                </View>
              ))}
            </View>
          )}

          {/* SmartCTA-mini: deep-link to relevant product when destination known */}
          {ctx.destination && (
            <TouchableOpacity
              style={styles.ctaCard}
              onPress={() =>
                Linking.openURL(
                  `https://prayanaai.com/create-trip?destination=${encodeURIComponent(ctx.destination)}&qsrc=q:${question._id}`
                )
              }
            >
              <Ionicons name="compass-outline" size={18} color={colors.primary[600]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Plan a trip to {ctx.destination}</Text>
                <Text style={styles.ctaSub}>AI builds a day-by-day itinerary →</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={upvoteQuestion} style={[styles.actionPill, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Ionicons name="arrow-up" size={14} color={themeColors.textSecondary} />
              <Text style={[styles.actionPillText, { color: themeColors.textSecondary }]}>{question.upvotes || 0}</Text>
            </TouchableOpacity>
            <View style={[styles.actionPill, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Ionicons name="chatbubble-outline" size={14} color={themeColors.textTertiary} />
              <Text style={[styles.actionPillText, { color: themeColors.textSecondary }]}>{question.answerCount || 0}</Text>
            </View>
            <Text style={[styles.metaRight, { color: themeColors.textTertiary }]}>by {question.userName} · {timeAgo(question.createdAt)}</Text>
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: themeColors.text }]}>
          {answers.length} Answer{answers.length === 1 ? "" : "s"}
        </Text>

        {answers.map((a) => (
          <View
            key={a._id}
            style={[styles.answerCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }, a.isAccepted && styles.answerAccepted]}
          >
            <View style={styles.answerHead}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{(a.displayName || "?")[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.answerAuthor, { color: themeColors.text }]}>{a.displayName}</Text>
                <Text style={[styles.answerMeta, { color: themeColors.textTertiary }]}>{timeAgo(a.createdAt)}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                {a.authorType === "partner" && (
                  <View style={[styles.badge, { backgroundColor: "#fed7aa" }]}>
                    <Text style={[styles.badgeText, { color: "#9a3412" }]}>
                      ✓ {a.partnerBadge?.partnerName || "Partner"}
                    </Text>
                  </View>
                )}
                {a.authorType === "ai" && (
                  <View style={[styles.badge, { backgroundColor: "#dbeafe" }]}>
                    <Text style={[styles.badgeText, { color: "#1e40af" }]}>AI</Text>
                  </View>
                )}
                {a.verifiedAnswerer?.isVerified && (
                  <View style={[styles.badge, { backgroundColor: "#dcfce7" }]}>
                    <Text style={[styles.badgeText, { color: "#15803d" }]}>
                      ✓ Visited {a.verifiedAnswerer.destination}
                    </Text>
                  </View>
                )}
                {a.isAccepted && (
                  <View style={[styles.badge, { backgroundColor: colors.primary[500] }]}>
                    <Text style={[styles.badgeText, { color: "white" }]}>Accepted</Text>
                  </View>
                )}
              </View>
            </View>

            <RichText text={a.content} style={[styles.answerContent, { color: themeColors.textSecondary }]} />

            {(a.images?.length ?? 0) > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {a.images.map((img: any, i: number) => (
                  <Image key={img.s3Key || i} source={{ uri: resolveImageUrl(img.url) || img.url }} style={styles.answerImage} />
                ))}
              </ScrollView>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity onPress={() => upvoteAnswer(a._id)} style={[styles.actionPill, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Ionicons name="arrow-up" size={14} color={themeColors.textSecondary} />
                <Text style={[styles.actionPillText, { color: themeColors.textSecondary }]}>{a.upvotes || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setReplyOpen(replyOpen === a._id ? null : a._id); setReplyText(""); }}
                style={[styles.actionPill, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              >
                <Ionicons name="chatbubble-outline" size={13} color={themeColors.textSecondary} />
                <Text style={[styles.actionPillText, { color: themeColors.textSecondary }]}>
                  Reply{(a.replies?.length ?? 0) > 0 ? ` · ${a.replies.length}` : ""}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Nested replies */}
            {(a.replies?.length ?? 0) > 0 && (
              <View style={[styles.repliesWrap, { borderLeftColor: themeColors.border }]}>
                {a.replies.map((r: any, ri: number) => (
                  <View key={r._id || ri} style={styles.replyItem}>
                    <View style={styles.replyHead}>
                      <Text style={[styles.replyAuthor, { color: themeColors.text }]}>
                        {r.displayName || r.userName || "User"}
                      </Text>
                      <Text style={[styles.replyMeta, { color: themeColors.textTertiary }]}>
                        {r.createdAt ? timeAgo(r.createdAt) : ""}
                      </Text>
                    </View>
                    <RichText text={r.content} style={[styles.replyContent, { color: themeColors.textSecondary }]} />
                  </View>
                ))}
              </View>
            )}

            {/* Reply composer (toggled) */}
            {replyOpen === a._id && (
              <View style={styles.replyComposer}>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Write a reply…"
                  placeholderTextColor={themeColors.textTertiary}
                  multiline
                  style={[styles.replyInput, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                  maxLength={2000}
                />
                <TouchableOpacity
                  onPress={() => postReply(a._id)}
                  disabled={replyPosting || replyText.trim().length < 2}
                  style={[styles.replyBtn, (replyPosting || replyText.trim().length < 2) && { opacity: 0.5 }]}
                >
                  <Text style={styles.replyBtnText}>{replyPosting ? "Posting…" : "Post Reply"}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <View style={[styles.composer, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.composerLabel, { color: themeColors.text }]}>Your Answer</Text>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Share what you know…"
            placeholderTextColor={themeColors.textTertiary}
            multiline
            style={[styles.composerInput, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
            maxLength={10000}
          />
          <TouchableOpacity
            onPress={postAnswer}
            disabled={posting || reply.trim().length < 10}
            style={[
              styles.composerBtn,
              (posting || reply.trim().length < 10) && { opacity: 0.5 },
            ]}
          >
            {posting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: "white", fontWeight: "600" }}>Post Answer</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, backgroundColor: "white",
    borderBottomWidth: 1, borderColor: colors.gray[200], justifyContent: "space-between",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, color: colors.gray[900], textTransform: "capitalize" },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  questionCard: {
    backgroundColor: "white",
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  cardCategory: { fontSize: 10, color: colors.primary[600], fontWeight: fontWeight.bold as any, letterSpacing: 0.5 },
  questionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any, color: colors.gray[900], marginBottom: 8 },
  questionDesc: { fontSize: fontSize.sm, color: colors.gray[700], lineHeight: 20 },
  questionImage: { width: 220, height: 160, borderRadius: borderRadius.md, marginRight: 8 },
  ctaCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.primary[50], borderColor: colors.primary[200], borderWidth: 1,
    padding: spacing.sm, borderRadius: borderRadius.md, marginTop: 12,
  },
  ctaTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any, color: colors.gray[900] },
  ctaSub: { fontSize: 11, color: colors.gray[600], marginTop: 2 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  actionPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: "white",
    borderWidth: 1, borderColor: colors.gray[200],
  },
  actionPillText: { fontSize: 12, color: colors.gray[700] },
  metaRight: { marginLeft: "auto", fontSize: 11, color: colors.gray[400] },
  sectionHeader: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, color: colors.gray[900], marginTop: 8 },
  answerCard: {
    backgroundColor: "white",
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  answerAccepted: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  answerHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  avatarCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary[500], alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "white", fontWeight: fontWeight.semibold as any, fontSize: 13 },
  answerAuthor: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any, color: colors.gray[900] },
  answerMeta: { fontSize: 11, color: colors.gray[400] },
  answerContent: { fontSize: fontSize.sm, color: colors.gray[700], lineHeight: 20 },
  answerImage: { width: 130, height: 100, borderRadius: borderRadius.md, marginRight: 6 },
  // Nested replies
  repliesWrap: { marginTop: 10, marginLeft: 8, paddingLeft: 10, borderLeftWidth: 2 },
  replyItem: { marginBottom: 8 },
  replyHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  replyAuthor: { fontSize: 12, fontWeight: fontWeight.semibold as any },
  replyMeta: { fontSize: 10 },
  replyContent: { fontSize: 13, lineHeight: 18 },
  replyComposer: { marginTop: 10, gap: 8 },
  replyInput: { borderWidth: 1, borderRadius: borderRadius.md, padding: 10, fontSize: 13, minHeight: 56, textAlignVertical: "top" },
  replyBtn: { alignSelf: "flex-start", backgroundColor: "#06B6D4", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  replyBtnText: { color: "white", fontWeight: fontWeight.semibold as any, fontSize: 13 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: fontWeight.semibold as any },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  tagChipText: { fontSize: 11, fontWeight: fontWeight.medium as any },
  composer: {
    backgroundColor: "white",
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  composerLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any, color: colors.gray[900], marginBottom: 6 },
  composerInput: {
    backgroundColor: colors.gray[50],
    borderWidth: 1, borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    minHeight: 90, textAlignVertical: "top",
    fontSize: fontSize.sm, color: colors.gray[900],
  },
  composerBtn: {
    marginTop: 10,
    backgroundColor: colors.primary[500],
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
});
