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
import { router } from 'expo-router';
import { Button, TextInput } from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@prayana/shared-services/src/firebase';
import { makeAPICall } from '@prayana/shared-services';
import { COUNTRY_CODES } from '@prayana/shared-utils';

const RESEND_TIMER_SECONDS = 60;
const OTP_LENGTH = 6;

export default function PhoneLoginScreen() {
  const { setUser, setIsAuthenticated, syncWithBackend } = useAuth();

  // Phone input state
  const [selectedCountryIndex, setSelectedCountryIndex] = useState(0); // India default
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [fullPhone, setFullPhone] = useState('');

  // Loading states
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Resend timer
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // OTP input refs
  const otpInputRefs = useRef<(RNTextInput | null)[]>([]);

  const selectedCountry = COUNTRY_CODES[selectedCountryIndex];

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
  // SEND OTP via backend API (no reCAPTCHA needed!)
  // ============================================================
  const handleSendOTP = async () => {
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    if (!cleanPhone || cleanPhone.length < 7) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }

    const fullPhoneNumber = `${selectedCountry.code}${cleanPhone}`;
    setIsSending(true);

    try {
      const response = await makeAPICall('/auth/phone/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhoneNumber }),
        timeout: 15000,
      });

      if (response?.success) {
        setFullPhone(fullPhoneNumber);
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
      console.error('[PhoneLogin] Send OTP error:', error);
      Alert.alert('OTP Failed', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

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
      const response = await makeAPICall('/auth/phone/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhone, otp: otpCode }),
        timeout: 15000,
      });

      if (!response?.success) {
        Alert.alert('Verification Failed', response?.message || response?.error || 'Invalid OTP.');
        setIsVerifying(false);
        return;
      }

      // If backend returned a Firebase custom token, sign in with it
      if (response.customToken) {
        try {
          const userCredential = await signInWithCustomToken(auth, response.customToken);
          setUser(userCredential.user);
          setIsAuthenticated(true);

          try {
            await syncWithBackend(userCredential.user, 'phone');
          } catch (syncErr: any) {
            console.warn('[PhoneLogin] Backend sync failed (non-fatal):', syncErr.message);
          }

          router.replace('/(tabs)');
          return;
        } catch (firebaseErr: any) {
          console.warn('[PhoneLogin] Firebase custom token sign-in failed:', firebaseErr.message);
          // Fall through to direct user setup below
        }
      }

      // Fallback: set user directly from backend response (no Firebase token)
      if (response.user) {
        setUser({
          uid: response.user.id || `phone_${fullPhone}`,
          displayName: response.user.displayName || `User ${fullPhone.slice(-4)}`,
          email: response.user.email || null,
          phoneNumber: response.user.phone || fullPhone,
          photoURL: response.user.avatar || null,
          getIdToken: async () => 'phone-verified-token',
        });
        setIsAuthenticated(true);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Verification succeeded but failed to create session.');
      }
    } catch (error: any) {
      console.error('[PhoneLogin] Verify OTP error:', error);
      Alert.alert('Verification Failed', error.message || 'Something went wrong.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOTP = () => {
    if (resendTimer > 0) return;
    setOtpSent(false);
    setOtp(Array(OTP_LENGTH).fill(''));
    setTimeout(() => handleSendOTP(), 100);
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
      setFullPhone('');
      if (timerRef.current) clearInterval(timerRef.current);
      setResendTimer(0);
    } else {
      router.back();
    }
  };

  const selectCountry = (index: number) => {
    setSelectedCountryIndex(index);
    setShowCountryPicker(false);
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
            <Text style={styles.backButtonText}>{otpSent ? '← Change Number' : '← Back'}</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>{otpSent ? '✓' : '📱'}</Text>
            </View>
            <Text style={styles.title}>
              {otpSent ? 'Verify OTP' : 'Phone Login'}
            </Text>
            <Text style={styles.subtitle}>
              {otpSent
                ? `Enter the ${OTP_LENGTH}-digit code sent to\n${selectedCountry.code} ${phoneNumber}`
                : 'Enter your phone number to receive a verification code'}
            </Text>
          </View>

          {!otpSent ? (
            /* Phone Number Input */
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity
                  style={styles.countryCodeButton}
                  onPress={() => setShowCountryPicker(!showCountryPicker)}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
                  <Text style={styles.dropdownArrow}>
                    {showCountryPicker ? '\u25B2' : '\u25BC'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.phoneInputWrapper}>
                  <RNTextInput
                    style={styles.phoneInput}
                    placeholder="Phone number"
                    placeholderTextColor="#9ca3af"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                </View>
              </View>

              {/* Country Picker Dropdown */}
              {showCountryPicker && (
                <View style={styles.countryPickerDropdown}>
                  <ScrollView
                    style={styles.countryList}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {COUNTRY_CODES.map((country, index) => (
                      <TouchableOpacity
                        key={`${country.country}-${index}`}
                        style={[
                          styles.countryItem,
                          index === selectedCountryIndex &&
                            styles.countryItemSelected,
                        ]}
                        onPress={() => selectCountry(index)}
                      >
                        <Text style={styles.countryItemFlag}>{country.flag}</Text>
                        <Text style={styles.countryItemName}>{country.name}</Text>
                        <Text style={styles.countryItemCode}>{country.code}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Button
                title="Send OTP"
                onPress={handleSendOTP}
                variant="primary"
                size="lg"
                fullWidth
                loading={isSending}
                style={styles.sendButton}
              />

              <Text style={styles.devNote}>
                OTP will be sent via WhatsApp. Check server logs in dev mode.
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
                    autoComplete={index === 0 ? 'sms-otp' : 'off'}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <Button
                title="Verify OTP"
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
                    Resend OTP in {formatTimer(resendTimer)}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResendOTP}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.devNote}>
                In dev mode, check server console for the OTP code.
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

  // Phone Input Row
  phoneRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 10,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    minWidth: 100,
  },
  countryFlag: {
    fontSize: 18,
    marginRight: 6,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
    marginRight: 4,
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#6b7280',
  },
  phoneInputWrapper: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },

  // Country Picker Dropdown
  countryPickerDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  countryList: {
    maxHeight: 200,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  countryItemSelected: {
    backgroundColor: '#f0fdfc',
  },
  countryItemFlag: {
    fontSize: 18,
    marginRight: 10,
  },
  countryItemName: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
  },
  countryItemCode: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
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
