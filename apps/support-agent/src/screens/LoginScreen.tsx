import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@prayana/shared-services";
import {
  signInWithEmailAndPassword,
  onIdTokenChanged,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { useTheme } from "@prayana/shared-ui";
import { useAgentStore } from "../state/agentStore";
import { agentAPI } from "../lib/api";

// Standard email + password Firebase auth. The Firebase JS SDK persists the
// session via AsyncStorage (set up in @prayana/shared-services/firebase.ts),
// so the user stays signed in across app launches. We listen for ID-token
// refreshes so the agent app always holds a fresh JWT for the Socket.IO
// handshake — Firebase rotates the token roughly every hour.
export default function LoginScreen() {
  const { themeColors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signInWithToken = useAgentStore((s) => s.signInWithToken);
  const setFirebaseToken = useAgentStore((s) => s.setFirebaseToken);

  // Auto-sign-in: if Firebase already has a session, exchange it for an ID
  // token, validate role server-side, and skip the form entirely.
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        // Validate against the role-gated endpoint so we don't admit
        // non-agents who happen to be signed in to a shared Firebase project.
        await agentAPI.pendingHandoffs(idToken);
        signInWithToken(idToken, user.displayName || user.email || "Agent");
      } catch (err: any) {
        // Token didn't pass requireAgentRole. Force sign-out so the form
        // shows again instead of looping.
        try {
          await firebaseSignOut(auth);
        } catch {}
      }
    });
    return unsubscribe;
  }, [signInWithToken]);

  // Background refresh: whenever Firebase rotates the ID token, push the new
  // value into the store so the next socket reconnect uses it.
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) return;
      const idToken = await user.getIdToken();
      setFirebaseToken(idToken);
    });
    return unsubscribe;
  }, [setFirebaseToken]);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      // Server-side gate: requireAgentRole rejects non-agent accounts.
      await agentAPI.pendingHandoffs(idToken);
      signInWithToken(idToken, cred.user.displayName || cred.user.email || "Agent");
    } catch (e: any) {
      const code = e?.code || "";
      const msg =
        code === "auth/invalid-credential" || code === "auth/wrong-password"
          ? "Email or password incorrect."
          : code === "auth/user-not-found"
            ? "No account with that email."
            : code === "auth/too-many-requests"
              ? "Too many attempts. Try again in a minute."
              : e?.message?.includes("Agent role required") ||
                  e?.message?.includes("Forbidden")
                ? "This account isn't a support agent. Ask admin to grant access."
                : "Sign-in failed. Check your connection and try again.";
      Alert.alert("Sign-in failed", msg);
      try {
        await firebaseSignOut(auth);
      } catch {}
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.body}>
          <Text style={[styles.title, { color: themeColors.text }]}>Prayana Support</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Sign in to claim conversations</Text>

          <Text style={[styles.label, { color: themeColors.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.inputBackground, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="agent@prayanaai.com"
            placeholderTextColor={themeColors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <Text style={[styles.label, { color: themeColors.textSecondary }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.inputBackground, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="Your password"
            placeholderTextColor={themeColors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          <Pressable
            style={[styles.btn, busy && styles.btnDisabled]}
            onPress={handleSignIn}
            disabled={busy}
          >
            <Text style={styles.btnText}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  body: { flex: 1, padding: 24, justifyContent: "center" },
  title: { color: "#f1f5f9", fontSize: 28, fontWeight: "700", marginBottom: 4 },
  subtitle: { color: "#94a3b8", fontSize: 14, marginBottom: 32 },
  label: { color: "#cbd5e1", fontSize: 13, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: "#1e293b",
    color: "#f1f5f9",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#334155",
    fontSize: 14,
  },
  btn: {
    marginTop: 28,
    backgroundColor: "#f97316",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "white", fontSize: 16, fontWeight: "600" },
});
