import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Switch,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@prayana/shared-ui";
import { useAgentStore } from "../state/agentStore";
import { agentAPI } from "../lib/api";
import type { RootStackParamList } from "../../App";

export default function InboxScreen() {
  const { themeColors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isOnline, goOnline, goOffline, pendingHandoffs, agentName, signOut, firebaseToken, loadActive, claim } =
    useAgentStore();

  const handoffs = useMemo(
    () => Object.values(pendingHandoffs).sort((a, b) => (a.queuedAt > b.queuedAt ? 1 : -1)),
    [pendingHandoffs]
  );

  const handleClaim = async (sessionId: string) => {
    if (!firebaseToken) return;
    try {
      const res = await agentAPI.conversationHistory(firebaseToken, sessionId);
      const msgs = (res.data.messages || []).map((m: any) => ({
        messageId: m.messageId,
        sessionId,
        role: m.role,
        senderType: m.senderType || (m.role === "assistant" ? "ai" : null),
        content: m.content,
        timestamp: m.timestamp,
      }));
      loadActive(sessionId, msgs);
      claim(sessionId);
      navigation.navigate("Chat", { sessionId });
    } catch (e) {
      // Stay on inbox; the card stays visible.
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: themeColors.background }]} edges={["bottom", "left", "right"]}>
      <View style={[styles.toolbar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <View>
          <Text style={[styles.greeting, { color: themeColors.text }]}>Hi {agentName}</Text>
          <Text style={[styles.subline, { color: themeColors.textSecondary }]}>{isOnline ? "Receiving handoffs" : "You're offline"}</Text>
        </View>
        <View style={styles.toolbarRight}>
          <Switch value={isOnline} onValueChange={(v) => (v ? goOnline() : goOffline())} />
          <Pressable onPress={signOut} style={styles.signOutBtn}>
            <Text style={[styles.signOutText, { color: themeColors.textSecondary }]}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      {!isOnline ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>You're offline</Text>
          <Text style={[styles.emptyBody, { color: themeColors.textSecondary }]}>Flip the toggle above to start receiving handoff requests.</Text>
        </View>
      ) : handoffs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No pending handoffs</Text>
          <Text style={[styles.emptyBody, { color: themeColors.textSecondary }]}>You're online. New escalations will show up here in real time.</Text>
        </View>
      ) : (
        <FlatList
          data={handoffs}
          keyExtractor={(h) => h.sessionId}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardName, { color: themeColors.text }]}>{item.customer.name}</Text>
                {item.escalationReason ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{item.escalationReason}</Text>
                  </View>
                ) : null}
              </View>
              {item.destination ? (
                <Text style={[styles.cardMeta, { color: themeColors.textSecondary }]}>Destination: {item.destination}</Text>
              ) : null}
              {item.recentMessages.slice(-3).map((m) => (
                <Text key={m.messageId} style={[styles.cardLine, { color: themeColors.text }]} numberOfLines={2}>
                  <Text style={{ color: m.role === "user" ? "#f97316" : themeColors.textSecondary }}>
                    {m.role === "user" ? "Customer: " : m.senderType === "agent" ? "Agent: " : "AI: "}
                  </Text>
                  {m.content}
                </Text>
              ))}
              <Pressable style={styles.claimBtn} onPress={() => handleClaim(item.sessionId)}>
                <Text style={styles.claimBtnText}>Claim conversation</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  toolbarRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  greeting: { color: "#f1f5f9", fontSize: 16, fontWeight: "600" },
  subline: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  signOutBtn: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  signOutText: { color: "#94a3b8", fontSize: 13 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { color: "#f1f5f9", fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptyBody: { color: "#94a3b8", textAlign: "center", lineHeight: 20 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardName: { color: "#f1f5f9", fontSize: 16, fontWeight: "600" },
  chip: { backgroundColor: "#7c2d12", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  chipText: { color: "#fed7aa", fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  cardMeta: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  cardLine: { color: "#cbd5e1", fontSize: 13, marginBottom: 4, lineHeight: 18 },
  claimBtn: {
    marginTop: 12,
    backgroundColor: "#f97316",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  claimBtnText: { color: "white", fontWeight: "600" },
});
