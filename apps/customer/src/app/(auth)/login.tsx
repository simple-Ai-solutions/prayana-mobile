import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@prayana/shared-hooks';
import { resetGuestUsage } from '@prayana/shared-utils';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithCustomToken,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@prayana/shared-services';
import { readRedirect } from '../../lib/authRedirect';
import {
  CountryCodeButton,
  CountryCodeList,
  DEFAULT_COUNTRY_INDEX,
  getCountryAt,
  isPlausiblePhone,
} from '../../components/common/CountryCodePicker';
import {
  canUseTruecaller,
  openTruecaller,
  startTruecallerLogin,
  checkTruecallerLogin,
  isTruecallerPending,
  TRUECALLER_POLL_MS,
  TRUECALLER_UNACKED_WINDOW_MS,
  TRUECALLER_ACKED_WINDOW_MS,
  type TruecallerSession,
} from '../../lib/truecaller';
import { isPlaceholderName } from '../../lib/userName';
import { cleanPhone } from '../../lib/phoneInput';

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

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
  // Where sign-in was asked for (e.g. a stay's Reserve). AuthGuard in
  // app/_layout.tsx routes there once the user is set, so with a redirect the
  // handlers below don't navigate themselves — doing both opened it twice.
  const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();
  const redirect = readRedirect(redirectTo);

  // Phone is the primary path — it leads the screen, entered inline here and
  // handed to the OTP step already filled in.
  const [countryIndex, setCountryIndex] = useState(DEFAULT_COUNTRY_INDEX);
  const [phone, setPhone] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Email/password is the demoted fallback, collapsed behind a text link.
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  // Sign in with Apple only exists on iOS (13+); elsewhere the button is hidden.
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState('');

  const phoneIsValid = useMemo(() => isPlausiblePhone(phone), [phone]);

  // Truecaller one-tap (Android, Truecaller installed). Mirrors the web
  // LoginModal: the sheet opens on the first tap into the number field; if the
  // user continues they're signed in with their verified number and name, and
  // otherwise ("use another number", dismissed, not installed) they just carry
  // on typing for SMS OTP underneath.
  const truecallerSessionRef = useRef<TruecallerSession | null>(null);
  const truecallerTriedRef = useRef(false);
  const [truecallerWaiting, setTruecallerWaiting] = useState(false);

  // Leaving the screen abandons any in-flight poll.
  useEffect(() => () => { truecallerSessionRef.current = null; }, []);

  // Google sign-in used expo-auth-session, which drives OAuth through a browser.
  // Google now blocks that from native apps as non-compliant with their OAuth 2.0
  // policy — it came back "Access blocked ... Error 400: invalid_request".
  //
  // Use the official native Google SDK instead (@react-native-google-signin — it
  // was already a dependency with its pod linked, just never wired up). Google
  // supports this path, and it is the mobile equivalent of what the web does
  // (Firebase's own GoogleAuthProvider popup). The idToken is still exchanged for
  // a Firebase credential exactly as before; only how the token is obtained
  // changed.
  //
  // webClientId is the client Firebase verifies the credential against;
  // iosClientId is the native client the request actually goes out under.
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      scopes: ['openid', 'profile', 'email'],
      offlineAccess: false,
    });
  }, []);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  const pollTruecaller = async (session: TruecallerSession) => {
    let deadline = Date.now() + TRUECALLER_UNACKED_WINDOW_MS;
    let acked = false;
    const isCurrent = () => truecallerSessionRef.current === session;

    while (isCurrent() && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, TRUECALLER_POLL_MS));
      if (!isCurrent()) return;

      const result = await checkTruecallerLogin(session);
      if (!isCurrent()) return;

      if (result.status === 'verified') {
        truecallerSessionRef.current = null;
        setTruecallerWaiting(false);
        if (!result.customToken) {
          setError('Truecaller sign-in failed. Please continue with your phone number.');
          return;
        }
        try {
          const userCredential = await signInWithCustomToken(auth, result.customToken);
          setUser(userCredential.user);
          setIsAuthenticated(true);
          try { await syncWithBackend(userCredential.user, 'phone'); } catch {}
          await resetGuestUsage();
          // Truecaller normally supplies the name; if it didn't (or it failed
          // validation) the user is asked for it, same as after OTP.
          router.replace(
            isPlaceholderName(result.user?.name) ? ('/complete-profile' as never) : '/(tabs)',
          );
        } catch {
          setError('Truecaller sign-in failed. Please continue with your phone number.');
        }
        return;
      }
      if (!isTruecallerPending(result.status)) break;
      if (result.status === 'flow_invoked' && !acked) {
        acked = true;
        deadline = Date.now() + TRUECALLER_ACKED_WINDOW_MS;
        setTruecallerWaiting(true);
      }
    }

    if (isCurrent()) {
      truecallerSessionRef.current = null;
      setTruecallerWaiting(false);
    }
  };

  const tryTruecaller = async () => {
    if (!canUseTruecaller()) return;
    const session = await openTruecaller();
    if (!session) return; // not installed — the user just types their number
    Keyboard.dismiss();
    truecallerSessionRef.current = session;
    await startTruecallerLogin(session);
    void pollTruecaller(session);
  };

  // Only the first tap into the field offers Truecaller; after "use another
  // number" the user is left to type in peace.
  const handlePhoneFieldFocus = () => {
    if (truecallerTriedRef.current) return;
    truecallerTriedRef.current = true;
    void tryTruecaller();
  };

  // ── Phone (primary) ─────────────────────────────────────────────
  // Hand the number straight to the OTP step so it never has to be retyped.
  // phone-login reads these params, prefills, and fires send-OTP itself.
  const handlePhoneContinue = () => {
    setError('');
    if (!phoneIsValid) {
      setError('Please enter a valid phone number (at least 10 digits).');
      return;
    }
    setShowCountryPicker(false);
    router.push({
      pathname: '/(auth)/phone-login',
      params: {
        phone: phone.replace(/[^\d]/g, ''),
        countryIndex: String(countryIndex),
        autoSend: '1',
        ...(redirect ? { redirectTo: redirect } : {}),
      },
    });
  };

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
      if (!redirect) router.replace('/(tabs)');
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

    setIsGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Sign out first so the account chooser always appears instead of silently
      // reusing the last account (matches the web, which sets prompt=select_account).
      try { await GoogleSignin.signOut(); } catch {}

      const result: any = await GoogleSignin.signIn();
      // v13+ returns { type, data: { idToken, ... } }; older returns { idToken }.
      const idToken: string | null =
        result?.data?.idToken ?? result?.idToken ?? null;

      if (!idToken) {
        setIsGoogleLoading(false);
        // The user backed out of the account chooser — not an error worth shouting about.
        if (result?.type === 'cancelled') return;
        setError('No token received from Google. Please try again.');
        return;
      }

      await handleGoogleToken(idToken, null);
    } catch (e: any) {
      setIsGoogleLoading(false);
      const code = e?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED) return; // user dismissed — stay quiet
      if (code === statusCodes.IN_PROGRESS) return;
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services is unavailable on this device.');
        return;
      }
      setError(e?.message || 'Google Sign-In failed. Please try again.');
    }
  };

  // ── Apple ───────────────────────────────────────────────────────
  // The web signs in with Firebase's OAuthProvider('apple.com') popup. Natively
  // the Apple sheet hands us an identity token instead, which is exchanged for
  // the same Firebase credential. Firebase requires a nonce: Apple gets its
  // SHA-256, Firebase gets the raw value and checks they match.
  const handleAppleLogin = async () => {
    setError('');
    setIsAppleLoading(true);
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!appleCredential.identityToken) {
        setError('No token received from Apple. Please try again.');
        return;
      }

      const credential = new OAuthProvider('apple.com').credential({
        idToken: appleCredential.identityToken,
        rawNonce,
      });
      const userCredential = await signInWithCredential(auth, credential);

      // Apple shares the name only on the very first sign-in, and Firebase
      // doesn't copy it onto the user — save it so the backend sync gets it.
      const fullName = [appleCredential.fullName?.givenName, appleCredential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      if (fullName && !userCredential.user.displayName) {
        try { await updateProfile(userCredential.user, { displayName: fullName }); } catch {}
      }

      setUser(userCredential.user);
      setIsAuthenticated(true);
      // syncWithBackend's type has no 'apple' method yet, so it's tracked as
      // 'email' (the web sends 'apple').
      try { await syncWithBackend(userCredential.user, 'email'); } catch {}
      await resetGuestUsage();
      router.replace('/(tabs)');
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return; // user dismissed — stay quiet
      let msg = 'Apple Sign-In failed. Please try again.';
      if (err?.code === 'auth/account-exists-with-different-credential') msg = 'An account already exists with this email using a different sign-in method.';
      else if (err?.code === 'auth/invalid-credential') msg = 'Invalid credential. Please try again.';
      setError(msg);
    } finally {
      setIsAppleLoading(false);
    }
  };

  // ── Email code (passwordless) ───────────────────────────────────
  // Carries over whatever was typed in the email/password form, and sends the
  // code straight away if it's already a valid address.
  const handleEmailCode = () => {
    setError('');
    const typed = email.trim();
    router.push({
      pathname: '/(auth)/email-login',
      params: typed ? { email: typed, autoSend: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed) ? '1' : '0' } : {},
    });
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
      if (!redirect) router.replace('/(tabs)');
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

  const isSubmitting = isLoading || isGoogleLoading || isAppleLoading;
  const selectedCountry = getCountryAt(countryIndex);

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

            {/* ── PRIMARY: phone entry, inline ─────────────────
                Phone is how we want people to sign in, so it leads: the number
                is typed here and carried into the OTP step. */}
            <View style={styles.phoneSection}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <CountryCodeButton
                  selectedIndex={countryIndex}
                  open={showCountryPicker}
                  onPress={() => setShowCountryPicker((v) => !v)}
                  disabled={isSubmitting}
                />
                <View style={styles.phoneInputWrap}>
                  <RNTextInput
                    style={styles.phoneInput}
                    placeholder="Phone number"
                    placeholderTextColor="#9ca3af"
                    value={phone}
                    onChangeText={(t) => { setPhone(cleanPhone(t)); setError(''); }}
                    onFocus={handlePhoneFieldFocus}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    maxLength={15}
                    editable={!isSubmitting}
                    onSubmitEditing={phoneIsValid ? handlePhoneContinue : undefined}
                    returnKeyType="go"
                  />
                </View>
              </View>

              {showCountryPicker && (
                <CountryCodeList
                  selectedIndex={countryIndex}
                  onSelect={(index) => {
                    setCountryIndex(index);
                    setShowCountryPicker(false);
                  }}
                  style={styles.countryList}
                />
              )}

              {/* Main CTA — the brand gradient button, same weight the email
                  "Sign In" button used to carry. */}
              <TouchableOpacity
                style={[styles.primaryBtn, (!phoneIsValid || isSubmitting) && styles.primaryBtnDisabled]}
                onPress={handlePhoneContinue}
                activeOpacity={0.85}
                disabled={!phoneIsValid || isSubmitting}
              >
                <LinearGradient
                  colors={['#2EC4B6', '#0FA697']}
                  style={styles.primaryBtnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>

              {truecallerWaiting ? (
                <View style={styles.truecallerWaiting}>
                  <ActivityIndicator size="small" color="#0FA697" />
                  <Text style={[styles.phoneHint, styles.truecallerWaitingText]}>Waiting for Truecaller…</Text>
                </View>
              ) : (
                <Text style={styles.phoneHint}>
                  We'll text a 6-digit code to {selectedCountry.code} {phone || 'your number'}
                </Text>
              )}
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
              <Text style={styles.dividerLabel}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── SECONDARY: social ───────────────────────────── */}
            <View style={styles.socialSection}>
              {/* Google */}
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={handleGoogleLogin}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color="#374151" />
                ) : (
                  <GoogleG />
                )}
                <Text style={styles.socialBtnText}>
                  {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
                </Text>
              </TouchableOpacity>

              {/* Apple — iOS only */}
              {appleAvailable && (
                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={handleAppleLogin}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  {isAppleLoading ? (
                    <ActivityIndicator size="small" color="#374151" />
                  ) : (
                    <AppleA />
                  )}
                  <Text style={styles.socialBtnText}>
                    {isAppleLoading ? 'Connecting...' : 'Continue with Apple'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── DEMOTED: email, collapsed behind links ──────────
                A one-time code (email-login) or the old password form. */}
            {!showEmailForm ? (
              <View>
                <TouchableOpacity
                  style={styles.emailToggle}
                  onPress={handleEmailCode}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={isSubmitting}
                >
                  <Ionicons name="mail-outline" size={15} color="#6b7280" />
                  <Text style={styles.emailToggleText}>Email me a sign-in code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.emailToggle, styles.emailToggleSecond]}
                  onPress={() => { setShowEmailForm(true); setError(''); }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="key-outline" size={15} color="#6b7280" />
                  <Text style={styles.emailToggleText}>Sign in with password</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emailSection}>
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

                {/* Sign In button — secondary/outline now that phone owns the
                    primary CTA, but the same handler as before. */}
                <TouchableOpacity
                  style={[styles.emailSignInBtn, isSubmitting && { opacity: 0.6 }]}
                  onPress={handleEmailLogin}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#0FA697" />
                  ) : (
                    <>
                      <Text style={styles.emailSignInBtnText}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={18} color="#0FA697" />
                    </>
                  )}
                </TouchableOpacity>

                {/* Forgot the password? A code works for the same address. */}
                <TouchableOpacity
                  style={styles.emailToggle}
                  onPress={handleEmailCode}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={isSubmitting}
                >
                  <Ionicons name="mail-outline" size={15} color="#6b7280" />
                  <Text style={styles.emailToggleText}>Email me a code instead</Text>
                </TouchableOpacity>
              </View>
            )}

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

  // ── Phone (primary) ──────────────────────────────────────────
  phoneSection: { paddingHorizontal: 28, marginTop: 28 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  phoneInputWrap: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  countryList: { marginTop: 10 },

  // Primary CTA (brand gradient)
  primaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 16,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  phoneHint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 10,
  },
  truecallerWaiting: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  truecallerWaitingText: { marginTop: 0 },

  // ── Social (secondary) ───────────────────────────────────────
  socialSection: { paddingHorizontal: 28, gap: 12 },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    minHeight: 48,
  },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  googleGWrap: { width: 22, alignItems: 'center' },
  googleG: { fontSize: 17, fontWeight: '700', color: '#4285F4' },
  appleWrap: { width: 22, alignItems: 'center' },
  appleIcon: { fontSize: 18, color: '#111827' },

  // ── Email (demoted) ──────────────────────────────────────────
  emailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 8,
    minHeight: 44,
  },
  emailToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  emailToggleSecond: { marginTop: 0 },
  emailSection: { marginTop: 4 },
  emailSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 28,
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#2EC4B6',
    backgroundColor: '#ffffff',
    minHeight: 48,
  },
  emailSignInBtnText: { fontSize: 15, fontWeight: '700', color: '#0FA697' },

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

  // Input (email/password)
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
