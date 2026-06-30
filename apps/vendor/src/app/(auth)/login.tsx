import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useAuth } from '@prayana/shared-hooks';
import { useTheme } from '@prayana/shared-ui';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '@prayana/shared-services';
import { ENV } from '../../config/env';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { setUser, setIsAuthenticated, syncWithBackend } = useAuth();
  const { themeColors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Only hand Google.useAuthRequest a config when at least one platform client
  // ID is actually set. On Android the hook throws synchronously if androidClientId
  // is undefined, which would crash the whole login screen — so when nothing is
  // configured we pass an empty object (hook returns a null request) and the
  // Google button degrades gracefully to "not configured".
  const googleAuthConfigured = Boolean(
    ENV.googleAuth.webClientId ||
      ENV.googleAuth.iosClientId ||
      ENV.googleAuth.androidClientId,
  );
  const [request, response, promptAsync] = Google.useAuthRequest(
    googleAuthConfigured
      ? {
          clientId: ENV.googleAuth.webClientId || undefined,
          iosClientId: ENV.googleAuth.iosClientId || undefined,
          androidClientId: ENV.googleAuth.androidClientId || undefined,
          redirectUri: makeRedirectUri({ scheme: 'prayanabiz' }),
          scopes: ['openid', 'profile', 'email'],
        }
      : {},
  );

  // Handle the Google OAuth response (idToken or accessToken).
  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      const accessToken = response.authentication?.accessToken;
      if (idToken) {
        completeGoogleSignIn(idToken, null);
      } else if (accessToken) {
        completeGoogleSignIn(null, accessToken);
      } else {
        setIsGoogleLoading(false);
        Alert.alert('Sign-in failed', 'No token received from Google. Please try again.');
      }
    } else if (response.type === 'error') {
      setIsGoogleLoading(false);
      Alert.alert(
        'Sign-in failed',
        response.error?.message || 'Google sign-in failed.',
      );
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      setIsGoogleLoading(false);
    }
  }, [response]);

  const completeGoogleSignIn = async (
    idToken: string | null,
    accessToken: string | null,
  ) => {
    try {
      const credential = idToken
        ? GoogleAuthProvider.credential(idToken)
        : GoogleAuthProvider.credential(null, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      setUser(userCredential.user);
      setIsAuthenticated(true);
      // Best-effort backend sync — don't block login on it.
      try {
        await syncWithBackend(userCredential.user, 'google');
      } catch {}
      router.replace('/(tabs)');
    } catch (error: any) {
      let msg = 'Google sign-in failed. Please try again.';
      if (error.code === 'auth/account-exists-with-different-credential') {
        msg = 'An account exists with this email using a different sign-in method.';
      } else if (error.code === 'auth/invalid-credential') {
        msg = 'Invalid credential. Please try again.';
      }
      Alert.alert('Sign-in failed', msg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!ENV.googleAuth.webClientId && !ENV.googleAuth.iosClientId) {
      Alert.alert(
        'Not configured',
        'Google sign-in is not set up yet. Use email or phone login.',
      );
      return;
    }
    if (!request) {
      Alert.alert('Not ready', 'Google sign-in is loading. Please try again.');
      return;
    }
    setIsGoogleLoading(true);
    await promptAsync();
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      setUser(userCredential.user);
      setIsAuthenticated(true);
      try {
        await syncWithBackend(userCredential.user, 'email');
      } catch {}
      router.replace('/(tabs)');
    } catch (error: any) {
      let message = 'Failed to sign in. Please try again.';
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      } else if (error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      }
      Alert.alert('Sign in failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = () => {
    router.push('/(auth)/phone-login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header */}
          <View style={styles.brandSection}>
            <Text style={styles.brandIcon}>&#128188;</Text>
            <Text style={[styles.brandTitle, { color: themeColors.text }]}>Prayana Business</Text>
            <Text style={[styles.brandSubtitle, { color: themeColors.textSecondary }]}>
              Manage your activities & bookings
            </Text>
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialSection}>
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={handleGoogleLogin}
              disabled={isGoogleLoading}
              activeOpacity={0.7}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#f97316" />
              ) : (
                <>
                  <Text style={styles.socialButtonIcon}>G</Text>
                  <Text style={[styles.socialButtonText, { color: themeColors.text }]}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={handlePhoneLogin}
              activeOpacity={0.7}
            >
              <Text style={styles.socialButtonIcon}>&#128222;</Text>
              <Text style={[styles.socialButtonText, { color: themeColors.text }]}>Continue with Phone</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
            <Text style={[styles.dividerText, { color: themeColors.textTertiary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
          </View>

          {/* Email + Password Form */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                placeholder="you@business.com"
                placeholderTextColor={themeColors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Password</Text>
              <View style={[styles.passwordContainer, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border }]}>
                <TextInput
                  style={[styles.passwordInput, { color: themeColors.text }]}
                  placeholder="Enter your password"
                  placeholderTextColor={themeColors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
              onPress={handleEmailLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Register Link */}
          <View style={styles.footerSection}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>New vendor? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.footerLink}>Register your business</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },

  // Brand Section
  brandSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  brandIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 6,
  },

  // Social Buttons
  socialSection: {
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    gap: 10,
  },
  socialButtonIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },

  // Form Section
  formSection: {
    gap: 16,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1a1a1a',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    height: '100%',
  },
  eyeButton: {
    paddingLeft: 12,
  },
  eyeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  signInButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Footer
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
});
