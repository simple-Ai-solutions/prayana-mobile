import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { resetGuestUsage } from '@prayana/shared-utils';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@prayana/shared-services/src/firebase';
import { sendEmailOtp, verifyEmailOtp } from '@prayana/shared-services';
import { isPlaceholderName } from '../../lib/userName';

const RESEND_TIMER_SECONDS = 60;
const OTP_LENGTH = 6;

// Same check the web LoginModal runs before sending the code.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Passwordless email login — the email twin of phone-login. Mirrors the web
// LoginModal "email" → "email-otp" steps: POST /auth/email/send-otp mails a
// 6-digit code, POST /auth/email/verify-otp checks it and returns a Firebase
// custom token (creating an email-only account if the address is new).
export default function EmailLoginScreen() {
  const { setUser, setIsAuthenticated, syncWithBackend } = useAuth();

  // The login screen can hand over an address the user already typed in the
  // email/password form. Both params are optional.
  const params = useLocalSearchParams<{ email?: string; autoSend?: string }>();
  const initialEmail = typeof params.email === 'string' ? params.email : '';

  // Email input state
  const [email, setEmail] = useState(initialEmail);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [sentTo, setSentTo] = useState('');

  // Loading states
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Resend timer
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // OTP input refs
  const otpInputRefs = useRef<(RNTextInput | null)[]>([]);

  // Fires the prefilled send-OTP at most once per mount.
  const autoSentRef = useRef(false);

  const emailIsValid = EMAIL_RE.test(email.trim());

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resendTimer]);

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================================
  // SEND OTP via backend API
  // ============================================================
  // Takes the address explicitly so the prefilled auto-send can pass it straight
  // from the route params; with no arg it reads state — the normal manual path.
  const handleSendOTP = async (emailArg?: string) => {
    const cleanEmail = (emailArg ?? email).trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setIsSending(true);
    try {
      const response: any = await sendEmailOtp(cleanEmail);

      if (response?.success) {
        setSentTo(cleanEmail);
        setOtpSent(true);
        setResendTimer(RESEND_TIMER_SECONDS);
        setOtp(Array(OTP_LENGTH).fill(''));

        // Focus the first OTP input after a brief delay
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 300);
      } else {
        Alert.alert('OTP Failed', response?.message || 'Failed to send OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('[EmailLogin] Send OTP error:', error);
      Alert.alert('OTP Failed', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Arrived from the login screen with an address already typed: send the code
  // straight away. Opened with no params this does nothing.
  useEffect(() => {
    if (autoSentRef.current) return;
    if (params.autoSend !== '1') return;
    if (!EMAIL_RE.test(initialEmail.trim())) return;

    autoSentRef.current = true;
    void handleSendOTP(initialEmail);
    // Mount-only: the params are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // VERIFY OTP via backend API → get Firebase custom token
  // ============================================================
  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      Alert.alert('Error', `Please enter the ${OTP_LENGTH}-digit OTP.`);
      return;
    }

    setIsVerifying(true);
    try {
      const response: any = await verifyEmailOtp(sentTo, otpCode);

      if (!response?.success) {
        Alert.alert('Verification Failed', response?.message || response?.error || 'Invalid OTP.');
        return;
      }

      // Unlike phone, there's no session to fall back to without the token —
      // the server only skips it if Firebase Admin failed.
      if (!response.customToken) {
        Alert.alert('Error', 'Verification succeeded but failed to create session.');
        return;
      }

      const userCredential = await signInWithCustomToken(auth, response.customToken);
      setUser(userCredential.user);
      setIsAuthenticated(true);

      // useAuth's syncWithBackend type only allows 'email' | 'google' | 'phone',
      // so this is tracked as 'email' (the web tracks it as 'email-otp').
      let syncedUser: { name?: string } | null = null;
      try {
        const synced: any = await syncWithBackend(userCredential.user, 'email');
        syncedUser = synced?.user ?? null;
      } catch (syncErr: any) {
        console.warn('[EmailLogin] Backend sync failed (non-fatal):', syncErr.message);
      }
      await resetGuestUsage();

      // Placeholder name → ask for it now, same as phone-login. If the sync
      // failed, the verify response still tells us the account's name.
      const name = syncedUser ? syncedUser.name : response.user?.name;
      router.replace(
        isPlaceholderName(name) ? ('/complete-profile' as never) : '/(tabs)',
      );
    } catch (error: any) {
      console.error('[EmailLogin] Verify OTP error:', error);
      Alert.alert('Verification Failed', error.message || 'Something went wrong.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOTP = () => {
    if (resendTimer > 0) return;
    setOtpSent(false);
    setOtp(Array(OTP_LENGTH).fill(''));
    setTimeout(() => handleSendOTP(sentTo || email), 100);
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste: distribute digits across fields
      const digits = value.replace(/[^\d]/g, '').split('').slice(0, OTP_LENGTH);
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next field
    if (value && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleBack = () => {
    if (otpSent) {
      setOtpSent(false);
      setOtp(Array(OTP_LENGTH).fill(''));
      setSentTo('');
      if (timerRef.current) clearInterval(timerRef.current);
      setResendTimer(0);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>{otpSent ? '← Change Email' : '← Back'}</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>{otpSent ? '✓' : '✉️'}</Text>
            </View>
            <Text style={styles.title}>
              {otpSent ? 'Verify your email' : 'Email Login'}
            </Text>
            <Text style={styles.subtitle}>
              {otpSent
                ? `Enter the ${OTP_LENGTH}-digit code sent to\n${sentTo}`
                : "Enter your email and we'll send you a sign-in code"}
            </Text>
          </View>

          {!otpSent ? (
            /* Email Input */
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.emailInputWrapper}>
                <RNTextInput
                  style={styles.emailInput}
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!isSending}
                  onSubmitEditing={emailIsValid ? () => { void handleSendOTP(); } : undefined}
                  returnKeyType="go"
                />
              </View>

              <Button
                title="Send Code"
                onPress={() => { void handleSendOTP(); }}
                variant="primary"
                size="lg"
                fullWidth
                loading={isSending}
                disabled={!emailIsValid}
                style={styles.sendButton}
              />

              <Text style={styles.devNote}>
                No password needed — new emails get an account automatically.
              </Text>
            </View>
          ) : (
            /* OTP Verification */
            <View style={styles.formSection}>
              <View style={styles.otpContainer}>
                {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                  <RNTextInput
                    key={index}
                    ref={(ref) => {
                      otpInputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.otpInput,
                      otp[index] ? styles.otpInputFilled : null,
                    ]}
                    value={otp[index]}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={({ nativeEvent }) =>
                      handleOtpKeyPress(nativeEvent.key, index)
                    }
                    keyboardType="number-pad"
                    maxLength={index === 0 ? OTP_LENGTH : 1}
                    textContentType="oneTimeCode"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <Button
                title="Verify Code"
                onPress={handleVerifyOTP}
                variant="primary"
                size="lg"
                fullWidth
                loading={isVerifying}
                disabled={otp.join('').length !== OTP_LENGTH}
                style={styles.verifyButton}
              />

              {/* Resend Timer */}
              <View style={styles.resendContainer}>
                {resendTimer > 0 ? (
                  <Text style={styles.resendTimerText}>
                    Resend code in {formatTimer(resendTimer)}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResendOTP}>
                    <Text style={styles.resendLink}>Resend code</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.devNote}>
                Can't find it? Check your spam folder.
              </Text>
            </View>
          )}
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // Back Button
  backButton: {
    marginTop: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#06B6D4',
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdfc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#99f6ef',
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  // Form
  formSection: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 6,
  },

  // Email Input
  emailInputWrapper: {
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginBottom: 24,
  },
  emailInput: {
    fontSize: 15,
    color: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },

  // Send Button
  sendButton: {
    marginTop: 4,
  },

  // OTP Container
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  otpInputFilled: {
    borderColor: '#06B6D4',
    backgroundColor: '#f0fdfc',
  },

  // Verify Button
  verifyButton: {
    marginTop: 4,
  },

  // Resend
  resendContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendTimerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#06B6D4',
  },

  // Dev note
  devNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
