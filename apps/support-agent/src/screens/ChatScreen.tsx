import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTheme } from "@prayana/shared-ui";
import { useAgentStore } from "../state/agentStore";
import { agentAPI } from "../lib/api";
import type { RootStackParamList } from "../../App";

type Suggestion = { suggestion: string | null; hash?: string; reason?: string };
type Hint = { kind: string; title: string; body: string; ctaLabel: string; ctaUrl: string; priority: number };

export default function ChatScreen() {
  const { themeColors } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "Chat">>();
  const navigation = useNavigation();
  const { sessionId } = route.params;
  const listRef = useRef<FlatList>(null);

  const { activeMessages, send, resolve, handBackToAI, setTyping } = useAgentStore();
  const firebaseToken = useAgentStore((s) => s.firebaseToken);
  const [draft, setDraft] = useState("");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);

  // ── AI Co-pilot state ──────────────────────────────────────────────
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [suggestion, setSuggestion] = useState<Suggestion>({ suggestion: null });
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [hints, setHints] = useState<Hint[]>([]);
  const lastCustomerMsgIdRef = useRef<string | null>(null);

  // Fetch a suggestion. Skipped if no token (e.g. brand-new sign-in).
  const fetchSuggestion = useCallback(async () => {
    if (!firebaseToken || !sessionId) return;
    setSuggestionLoading(true);
    try {
      const res = await agentAPI.suggestReply(firebaseToken, sessionId);
      setSuggestion(res.data || { suggestion: null });
    } catch {
      setSuggestion({ suggestion: null, reason: "error" });
    } finally {
      setSuggestionLoading(false);
    }
  }, [firebaseToken, sessionId]);

  // Auto-fetch when the latest message is from the customer (i.e. our turn).
  const lastMsg = activeMessages[activeMessages.length - 1];
  const lastCustomerMsgId = useMemo(() => {
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      if (activeMessages[i].role === "user") return activeMessages[i].messageId;
    }
    return null;
  }, [activeMessages]);
  const itsMyTurn = lastMsg?.role === "user";

  useEffect(() => {
    if (!itsMyTurn || !lastCustomerMsgId) return;
    if (lastCustomerMsgIdRef.current === lastCustomerMsgId) return; // already fetched
    lastCustomerMsgIdRef.current = lastCustomerMsgId;
    fetchSuggestion();
  }, [itsMyTurn, lastCustomerMsgId, fetchSuggestion]);

  // Upsell hints: load once per session.
  useEffect(() => {
    if (!firebaseToken || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await agentAPI.upsellHints(firebaseToken, sessionId);
        if (!cancelled) setHints(res.data?.hints || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [firebaseToken, sessionId]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [activeMessages.length]);

  // Cancel any outstanding typing-stop timer when leaving the screen and
  // emit one final isTyping=false so the customer's banner clears even if
  // the agent backs out without sending.
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingActiveRef.current) setTyping(sessionId, false);
    };
  }, [sessionId, setTyping]);

  // Debounced typing pings — fire once when the agent starts typing,
  // again only after 2.5s of silence (which sends isTyping=false).
  const handleDraftChange = useCallback(
    (text: string) => {
      setDraft(text);
      const hasText = text.trim().length > 0;
      if (hasText && !typingActiveRef.current) {
        typingActiveRef.current = true;
        setTyping(sessionId, true);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (typingActiveRef.current) {
          typingActiveRef.current = false;
          setTyping(sessionId, false);
        }
      }, 2500);
    },
    [sessionId, setTyping]
  );

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      setTyping(sessionId, false);
    }
    send(sessionId, text);
    setDraft("");
  };

  const onResolve = () => {
    Alert.alert("Resolve conversation?", "The customer will see a closing message.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Resolve",
        style: "destructive",
        onPress: () => {
          resolve(sessionId);
          navigation.goBack();
        },
      },
    ]);
  };

  const onHandBack = () => {
    handBackToAI(sessionId);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: themeColors.background }]} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={activeMessages}
          keyExtractor={(m) => m.messageId}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={({ item }) => {
            const fromMe = item.senderType === "agent";
            const isCustomer = item.role === "user";
            return (
              <View style={[styles.bubble, fromMe ? styles.bubbleMine : isCustomer ? styles.bubbleCustomer : styles.bubbleAI]}>
                <Text style={styles.bubbleLabel}>
                  {fromMe ? "You" : isCustomer ? "Customer" : item.senderType === "agent" ? item.agentName : "AI"}
                </Text>
                <Text style={styles.bubbleText}>{item.content}</Text>
              </View>
            );
          }}
        />

        {/* AI Co-pilot card — only renders when there's something to show. */}
        {copilotOpen && (suggestion.suggestion || suggestionLoading || hints.length > 0) && (
          <View style={[styles.copilotCard, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
            <View style={styles.copilotHeader}>
              <Text style={styles.copilotTitle}>✨ AI Co-pilot</Text>
              <Pressable onPress={() => setCopilotOpen(false)} hitSlop={8}>
                <Text style={[styles.copilotDismiss, { color: themeColors.textSecondary }]}>Hide</Text>
              </Pressable>
            </View>

            {(suggestionLoading || suggestion.suggestion) && (
              <View style={styles.copilotSection}>
                <View style={styles.copilotRow}>
                  <Text style={[styles.copilotLabel, { color: themeColors.textSecondary }]}>Suggested reply</Text>
                  <Pressable onPress={fetchSuggestion} hitSlop={8}>
                    <Text style={styles.copilotRefresh}>{suggestionLoading ? "…" : "↻"}</Text>
                  </Pressable>
                </View>
                {suggestionLoading && !suggestion.suggestion ? (
                  <ActivityIndicator size="small" color="#f97316" style={{ marginVertical: 8 }} />
                ) : suggestion.suggestion ? (
                  <>
                    <Text style={[styles.copilotSuggestion, { backgroundColor: themeColors.surfaceElevated, color: themeColors.text }]}>{suggestion.suggestion}</Text>
                    <Pressable
                      style={styles.copilotUseBtn}
                      onPress={() => suggestion.suggestion && setDraft(suggestion.suggestion)}
                    >
                      <Text style={styles.copilotUseText}>Use suggestion</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            )}

            {hints.length > 0 && (
              <View style={styles.copilotSection}>
                <Text style={[styles.copilotLabel, { color: themeColors.textSecondary }]}>Smart pitches</Text>
                {hints.map((h) => (
                  <Pressable
                    key={h.kind}
                    style={[styles.hintCard, { backgroundColor: themeColors.surfaceElevated }]}
                    onPress={() => setDraft(`${h.title}: ${h.ctaUrl}`)}
                  >
                    <Text style={[styles.hintTitle, { color: themeColors.text }]}>{h.title}</Text>
                    <Text style={[styles.hintBody, { color: themeColors.textSecondary }]}>{h.body}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
        {!copilotOpen && (
          <Pressable style={[styles.copilotShowBtn, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]} onPress={() => setCopilotOpen(true)}>
            <Text style={styles.copilotShowText}>✨ Show AI co-pilot</Text>
          </Pressable>
        )}

        <View style={[styles.actionsBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
          <Pressable onPress={onHandBack} style={[styles.actionBtn, { backgroundColor: themeColors.surfaceElevated }]}>
            <Text style={[styles.actionText, { color: themeColors.text }]}>Return to AI</Text>
          </Pressable>
          <Pressable onPress={onResolve} style={[styles.actionBtn, styles.resolveBtn]}>
            <Text style={[styles.actionText, { color: "white" }]}>Resolve</Text>
          </Pressable>
        </View>

        <View style={[styles.composer, { backgroundColor: themeColors.background, borderTopColor: themeColors.border }]}>
          <TextInput
            style={[styles.composerInput, { backgroundColor: themeColors.inputBackground, color: themeColors.text }]}
            placeholder="Reply to customer…"
            placeholderTextColor={themeColors.textTertiary}
            value={draft}
            onChangeText={handleDraftChange}
            multiline
          />
          <Pressable style={styles.sendBtn} onPress={onSend} disabled={!draft.trim()}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  bubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: "85%",
  },
  bubbleMine: { backgroundColor: "#f97316", alignSelf: "flex-end" },
  bubbleCustomer: { backgroundColor: "#1e293b", alignSelf: "flex-start", borderWidth: 1, borderColor: "#334155" },
  bubbleAI: { backgroundColor: "#0f172a", alignSelf: "flex-start", borderWidth: 1, borderColor: "#334155" },
  bubbleLabel: { fontSize: 11, color: "#cbd5e1", marginBottom: 4, fontWeight: "600", textTransform: "uppercase" },
  bubbleText: { color: "#f1f5f9", fontSize: 14, lineHeight: 20 },
  actionsBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: "#334155",
  },
  resolveBtn: { backgroundColor: "#dc2626" },
  actionText: { color: "#f1f5f9", fontSize: 13, fontWeight: "600" },
  composer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#0f172a",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    backgroundColor: "#1e293b",
    color: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: "#f97316",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 8,
  },
  sendText: { color: "white", fontWeight: "600" },

  // ── AI Co-pilot ─────────────────────────────────────────────────────
  copilotCard: {
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  copilotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  copilotTitle: { color: "#fbbf24", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  copilotDismiss: { color: "#94a3b8", fontSize: 11 },
  copilotSection: { marginTop: 6 },
  copilotRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  copilotLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  copilotRefresh: { color: "#f97316", fontSize: 16, paddingHorizontal: 4 },
  copilotSuggestion: {
    color: "#f1f5f9",
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: "#0f172a",
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  copilotUseBtn: {
    backgroundColor: "#f97316",
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  copilotUseText: { color: "white", fontSize: 12, fontWeight: "600" },
  hintCard: {
    backgroundColor: "#0f172a",
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  hintTitle: { color: "#f1f5f9", fontSize: 12, fontWeight: "600" },
  hintBody: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  copilotShowBtn: {
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingVertical: 8,
    alignItems: "center",
  },
  copilotShowText: { color: "#fbbf24", fontSize: 12, fontWeight: "600" },
});
