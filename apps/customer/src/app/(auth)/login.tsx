import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput as RNTextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@prayana/shared-hooks';
import { resetGuestUsage } from '@prayana/shared-utils';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '@prayana/shared-services/src/firebase';

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

// Google SVG-style colored "G" button logo
function GoogleG() {
  return (
    <View style={styles.googleGWrap}>
      <Text style={styles.googleG}>G</Text>
    </View>
  );
}

// Apple logo (text-based for React Native)
function AppleA() {
  return (
    <View style={styles.appleWrap}>
      <Text style={styles.appleIcon}></Text>
    </View>
  );
}

export default function LoginScreen() {
  const { setUser, setIsAuthenticated, syncWithBackend } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    redirectUri: makeRedirectUri({ scheme: 'prayana' }),
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      const accessToken = response.authentication?.accessToken;
      if (idToken) handleGoogleToken(idToken, null);
      else if (accessToken) handleGoogleToken(null, accessToken);
      else {
        setIsGoogleLoading(false);
        setError('No token received from Google. Please try again.');
      }
    } else if (response.type === 'error') {
      setIsGoogleLoading(false);
      setError(response.error?.message || 'Google sign-in failed.');
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      setIsGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleToken = async (idToken: string | null, accessToken: string | null) => {
    try {
      const credential = idToken
        ? GoogleAuthProvider.credential(idToken)
        : GoogleAuthProvider.credential(null, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      setUser(userCredential.user);
      setIsAuthenticated(true);
      try { await syncWithBackend(userCredential.user, 'google'); } catch {}
      await resetGuestUsage();
      router.replace('/(tabs)');
    } catch (err: any) {
      let msg = 'Google Sign-In failed. Please try again.';
      if (err.code === 'auth/account-exists-with-different-credential') msg = 'An account already exists with this email using a different sign-in method.';
      else if (err.code === 'auth/invalid-credential') msg = 'Invalid credential. Please try again.';
      setError(msg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    if (!GOOGLE_WEB_CLIENT_ID && !GOOGLE_IOS_CLIENT_ID) {
      Alert.alert('Not Configured', 'Google Sign-In is not set up yet. Use email or phone login.');
      return;
    }
    if (!request) {
      Alert.alert('Not Ready', 'Google Sign-In is loading. Please try again.');
      return;
    }
    setIsGoogleLoading(true);
    await promptAsync();
  };

  const handleEmailLogin = async () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(userCredential.user);
      setIsAuthenticated(true);
      try { await syncWithBackend(userCredential.user, 'email'); } catch {}
      await resetGuestUsage();
      router.replace('/(tabs)');
    } catch (err: any) {
      let msg = 'An unexpected error occurred. Please try again.';
      switch (err.code) {
        case 'auth/invalid-email': msg = 'Please enter a valid email address.'; break;
        case 'auth/user-not-found': msg = 'No account found with this email.'; break;
        case 'auth/wrong-password': msg = 'Incorrect password. Please try again.'; break;
        case 'auth/invalid-credential': msg = 'Invalid email or password.'; break;
        case 'auth/too-many-requests': msg = 'Too many attempts. Try again later.'; break;
        case 'auth/user-disabled': msg = 'This account has been disabled.'; break;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setUser({
      uid: 'guest-user',
      displayName: 'Guest User',
      email: 'guest@prayana.ai',
      photoURL: null,
      phoneNumber: null,
      getIdToken: async () => 'guest-token',
    } as any);
    setIsAuthenticated(true);
    router.replace('/(tabs)');
  };

  const isSubmitting = isLoading || isGoogleLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Modal card ──────────────────────────────────── */}
          <View style={styles.card}>
            {/* Rainbow top accent (matching web) */}
            <LinearGradient
              colors={['#2EC4B6', '#FFE66D', '#FFE66D', '#FF6B6B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topAccent}
            />

            {/* Logo */}
            <View style={styles.logoWrap}>
              <LinearGradient
                colors={['#2EC4B6', '#0FA697']}
                style={styles.logoGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="sparkles" size={28} color="#ffffff" />
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={styles.title}>Welcome to Prayana</Text>
            <Text style={styles.subtitle}>Your AI-powered travel companion</Text>

            {/* ── Buttons ──────────────────────────────────── */}
            <View style={styles.buttonsSection}>
              {/* Apple */}
              <TouchableOpacity
                style={styles.appleBtn}
                onPress={() => Alert.alert('Coming Soon', 'Apple Sign-In coming soon.')}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                <AppleA />
                <Text style={styles.appleBtnText}>Continue with Apple</Text>
              </TouchableOpacity>

              {/* Google */}
              <TouchableOpacity
                style={styles.googleBtn}
                onPress={handleGoogleLogin}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color="#374151" />
                ) : (
                  <GoogleG />
                )}
                <Text style={styles.googleBtnText}>
                  {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
                </Text>
              </TouchableOpacity>

              {/* Phone */}
              <TouchableOpacity
                style={styles.phoneBtn}
                onPress={() => router.push('/(auth)/phone-login')}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                <Ionicons name="phone-portrait-outline" size={20} color="#374151" />
                <Text style={styles.phoneBtnText}>Continue with Phone</Text>
              </TouchableOpacity>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or sign in with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email input */}
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
              <RNTextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isSubmitting}
              />
            </View>

            {/* Password input */}
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
              <RNTextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                editable={!isSubmitting}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Sign In button */}
            <TouchableOpacity
              style={[styles.signInBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={handleEmailLogin}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={['#2EC4B6', '#0FA697']}
                style={styles.signInBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.signInBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Sign Up link */}
            <View style={styles.signUpRow}>
              <Text style={styles.signUpLabel}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')} activeOpacity={0.7}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Divider secure */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>Secure & Private</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Trust indicators (matching web) */}
            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#2EC4B6" />
                <Text style={styles.trustLabel}>Encrypted</Text>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="globe-outline" size={16} color="#d4a017" />
                <Text style={styles.trustLabel}>Global Access</Text>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="sparkles-outline" size={16} color="#FF6B6B" />
                <Text style={styles.trustLabel}>AI Powered</Text>
              </View>
            </View>

            {/* Terms */}
            <Text style={styles.terms}>
              By continuing, you agree to our{' '}
              <Text style={styles.termsLink}>Terms</Text>,{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text> &{' '}
              <Text style={styles.termsLink}>User Agreement</Text>
            </Text>
          </View>

          {/* Guest option (below the card) */}
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={handleGuestLogin}
            activeOpacity={0.7}
          >
            <Text style={styles.guestBtnText}>Continue as Guest</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const CARD_MAX = Math.min(SCREEN_WIDTH - 32, 420);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },

  // Card
  card: {
    width: CARD_MAX,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  topAccent: { height: 4, width: '100%' },

  // Logo
  logoWrap: { alignItems: 'center', marginTop: 36, marginBottom: 16 },
  logoGrad: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Title
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 0,
  },

  // Buttons section
  buttonsSection: { paddingHorizontal: 28, marginTop: 28, gap: 12 },

  // Apple button (black)
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
  },
  appleWrap: { width: 22, alignItems: 'center' },
  appleIcon: { fontSize: 18, color: '#ffffff' },
  appleBtnText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },

  // Google button (outlined)
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  googleGWrap: { width: 22, alignItems: 'center' },
  googleG: { fontSize: 17, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Phone button (outlined)
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  phoneBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    borderRadius: 12,
    marginHorizontal: 28,
    marginTop: 14,
    padding: 12,
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 13, color: '#ef4444', lineHeight: 18 },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginHorizontal: 28,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },

  // Sign In button
  signInBtn: {
    marginHorizontal: 28,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  signInBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  signInBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },

  // Sign Up
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signUpLabel: { fontSize: 14, color: '#6b7280' },
  signUpLink: { fontSize: 14, fontWeight: '600', color: '#2EC4B6' },

  // Trust row
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  trustItem: { alignItems: 'center', gap: 4, flex: 1, paddingVertical: 10, backgroundColor: '#f9fafb', borderRadius: 12, marginHorizontal: 4 },
  trustLabel: { fontSize: 10, fontWeight: '600', color: '#6b7280', textAlign: 'center' },

  // Terms
  terms: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 28,
    paddingBottom: 28,
    marginTop: 12,
    lineHeight: 17,
  },
  termsLink: { color: '#2EC4B6' },

  // Guest
  guestBtn: { marginTop: 20, paddingVertical: 12, alignItems: 'center' },
  guestBtnText: { fontSize: 14, fontWeight: '500', color: '#9ca3af', textDecorationLine: 'underline' },
});
