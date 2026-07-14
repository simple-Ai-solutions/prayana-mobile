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
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useAuth } from '@prayana/shared-hooks';
import { useTheme, PrayanaLogo } from '@prayana/shared-ui';
import { colors } from '../../theme/vendorColors';
import { Card } from '../../components/ui';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  sendPasswordResetEmail,
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
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

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

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email.');
      return;
    }
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setForgotSent(true);
    } catch (error: any) {
      let message = 'Failed to send reset link. Please try again.';
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      }
      Alert.alert('Reset failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  // Login is the app's root screen, so there is usually nothing to go back to.
  // The chevron only appears when login was pushed (e.g. from signup).
  const canGoBack = router.canGoBack();

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
          {/* Back chevron — only when there is a screen behind us */}
          {canGoBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={26} color={themeColors.text} />
            </TouchableOpacity>
          )}

          {/* Brand Header */}
          <View style={styles.brandSection}>
            <View style={styles.brandBadge}>
              <PrayanaLogo size={32} />
            </View>
            <Text style={[styles.brandTitle, { color: themeColors.text }]}>Partner Login</Text>
            <Text style={[styles.brandSubtitle, { color: themeColors.textSecondary }]}>
              Prayana AI &mdash; List &amp; manage your travel business
            </Text>
          </View>

          {/* Login Card */}
          <Card style={styles.loginCard}>
            {forgotMode ? (
              /* Forgot Password Form */
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Email Address</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                    placeholder="your@email.com"
                    placeholderTextColor={themeColors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>

                {forgotSent ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>
                      Reset link sent to {email}. Check your inbox (and spam folder).
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
                    onPress={handleForgotPassword}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.signInButtonText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.backToLogin}
                  onPress={() => {
                    setForgotMode(false);
                    setForgotSent(false);
                  }}
                >
                  <Text style={[styles.backToLoginText, { color: themeColors.textSecondary }]}>Back to login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Login Form */
              <View style={styles.formSection}>
                {/* Social Login Buttons */}
                <TouchableOpacity
                  style={[styles.socialButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  onPress={handleGoogleLogin}
                  disabled={isGoogleLoading}
                  activeOpacity={0.7}
                >
                  {isGoogleLoading ? (
                    <ActivityIndicator size="small" color={colors.primary[500]} />
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

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
                  <Text style={[styles.dividerText, { color: themeColors.textTertiary }]}>or</Text>
                  <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Email Address</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                    placeholder="your@email.com"
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
                  <View style={styles.passwordLabelRow}>
                    <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Password</Text>
                    <TouchableOpacity onPress={() => setForgotMode(true)}>
                      <Text style={styles.forgotLink}>Forgot password?</Text>
                    </TouchableOpacity>
                  </View>
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
                    <Text style={styles.signInButtonText}>Login &#8594;</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Card>

          {/* Register Link */}
          <View style={styles.footerSection}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>Don&apos;t have a partner account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.footerLink}>Register your business</Text>
            </TouchableOpacity>
          </View>

          {/* Customer note */}
          <View style={styles.customerNote}>
            <Text style={[styles.customerNoteText, { color: themeColors.textTertiary }]}>
              Looking to book a trip?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
              <Text style={[styles.customerNoteLink, { color: themeColors.textSecondary }]}>Go to Prayana AI</Text>
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

  // Back chevron
  backButton: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginBottom: 16,
  },

  // Brand Section
  brandSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },

  // Login Card
  loginCard: {
    padding: 24,
    marginBottom: 24,
  },

  // Social Buttons
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
    color: colors.primary[500],
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
    marginVertical: 4,
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
  },
  inputGroup: {
    gap: 6,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary[500],
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
    color: colors.primary[500],
  },
  signInButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
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

  // Forgot password
  successBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  successText: {
    fontSize: 14,
    color: '#15803d',
    lineHeight: 20,
  },
  backToLogin: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backToLoginText: {
    fontSize: 14,
    color: '#6b7280',
  },

  // Footer
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[500],
  },

  // Customer note
  customerNote: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  customerNoteText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  customerNoteLink: {
    fontSize: 12,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
});
