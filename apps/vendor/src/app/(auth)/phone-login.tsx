import { useState, useRef, useEffect } from 'react';
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
import { signInWithCustomToken } from 'firebase/auth';
import { useAuth } from '@prayana/shared-hooks';
import { useTheme } from '@prayana/shared-ui';
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  auth,
} from '@prayana/shared-services';

type Step = 'phone' | 'otp';

export default function PhoneLoginScreen() {
  const { setUser, setIsAuthenticated, syncWithBackend } = useAuth();
  const { themeColors } = useTheme();
  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCountdown(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    const cleanPhone = phone.replace(/[\s()-]/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number.');
      return;
    }
    const fullPhone = `${countryCode}${cleanPhone}`;

    setIsLoading(true);
    try {
      const res = await sendPhoneOtp(fullPhone);
      if (!res?.success) {
        Alert.alert(
          'Could not send OTP',
          res?.message || 'Please try again in a moment.',
        );
        return;
      }
      setStep('otp');
      startCountdown();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      // 429 = rate-limited
      const msg =
        error?.status === 429
          ? 'Too many attempts. Please try again in a few minutes.'
          : error?.message || 'Failed to send OTP. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste - distribute digits across inputs
      const digits = value.replace(/\D/g, '').split('').slice(0, 6);
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      // Focus last filled input or next empty
      const focusIndex = Math.min(index + digits.length, 5);
      otpRefs.current[focusIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, '');
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Incomplete OTP', 'Please enter the full 6-digit code.');
      return;
    }
    const cleanPhone = phone.replace(/[\s()-]/g, '');
    const fullPhone = `${countryCode}${cleanPhone}`;

    setIsLoading(true);
    try {
      const res = await verifyPhoneOtp(fullPhone, otpCode);
      if (!res?.success) {
        Alert.alert(
          'Verification failed',
          res?.message || 'The code is incorrect or expired. Please try again.',
        );
        return;
      }

      // Sign in to Firebase using the server-issued custom token. If the server
      // could not issue one (Admin SDK unconfigured), we still proceed with a
      // backend-only session — but auth state will be limited.
      if (res.customToken) {
        const credential = await signInWithCustomToken(auth, res.customToken);
        setUser(credential.user);
        setIsAuthenticated(true);
        try {
          await syncWithBackend(credential.user, 'phone');
        } catch {}
      } else {
        // Fallback: shape a synthetic user object so app state moves forward.
        const u: any = res.user || {};
        setUser({
          uid: `phone_${cleanPhone}`,
          phoneNumber: fullPhone,
          displayName: u.displayName || `User ${cleanPhone.slice(-4)}`,
          email: u.email || null,
          photoURL: u.avatar || null,
          getIdToken: async () => '',
        } as any);
        setIsAuthenticated(true);
      }
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert(
        'Verification failed',
        error?.message || 'Could not verify the OTP. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (countdown > 0) return;
    setOtp(['', '', '', '', '', '']);
    handleSendOTP();
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
          {/* Header */}
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={() => {
                if (step === 'otp') {
                  setStep('phone');
                  setOtp(['', '', '', '', '', '']);
                } else {
                  router.back();
                }
              }}
            >
              <Text style={[styles.backArrow, { color: themeColors.text }]}>&#8592;</Text>
            </TouchableOpacity>
            <Text style={styles.brandLabel}>Prayana Business</Text>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>
              {step === 'phone' ? 'Phone Sign In' : 'Verify OTP'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
              {step === 'phone'
                ? 'Enter your phone number to receive a verification code'
                : `We sent a 6-digit code to ${countryCode} ${phone}`}
            </Text>
          </View>

          {step === 'phone' ? (
            /* Phone Input Step */
            <View style={styles.formSection}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <View style={[styles.countryCodeContainer, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border }]}>
                  <TextInput
                    style={[styles.countryCodeInput, { color: themeColors.text }]}
                    value={countryCode}
                    onChangeText={setCountryCode}
                    keyboardType="phone-pad"
                    editable={!isLoading}
                  />
                </View>
                <TextInput
                  style={[styles.phoneInput, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                  placeholder="98765 43210"
                  placeholderTextColor={themeColors.textTertiary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={handleSendOTP}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* OTP Verification Step */
            <View style={styles.formSection}>
              <View style={styles.otpRow}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      otpRefs.current[index] = ref;
                    }}
                    style={[
                      styles.otpInput,
                      { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text },
                      digit ? styles.otpInputFilled : null,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleOTPChange(value, index)}
                    onKeyPress={({ nativeEvent }) =>
                      handleOTPKeyPress(nativeEvent.key, index)
                    }
                    keyboardType="number-pad"
                    maxLength={1}
                    editable={!isLoading}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={handleVerifyOTP}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify</Text>
                )}
              </TouchableOpacity>

              <View style={styles.resendRow}>
                {countdown > 0 ? (
                  <Text style={[styles.resendCountdown, { color: themeColors.textTertiary }]}>
                    Resend code in {countdown}s
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResendOTP}>
                    <Text style={styles.resendLink}>Resend Code</Text>
                  </TouchableOpacity>
                )}
              </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },

  // Header
  headerSection: {
    marginBottom: 36,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  backArrow: {
    fontSize: 20,
    color: '#1a1a1a',
  },
  brandLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 20,
  },

  // Form
  formSection: {
    gap: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: -12,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryCodeContainer: {
    width: 72,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeInput: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    width: '100%',
    height: '100%',
    paddingHorizontal: 8,
  },
  phoneInput: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },

  // OTP
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  otpInputFilled: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },

  // Buttons
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Resend
  resendRow: {
    alignItems: 'center',
  },
  resendCountdown: {
    fontSize: 14,
    color: '#9ca3af',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
});
