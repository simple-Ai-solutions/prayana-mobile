import { useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@prayana/shared-ui';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@prayana/shared-services';

export default function ForgotPasswordScreen() {
  const { themeColors } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Missing Field', 'Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setSent(true);
    } catch (error: any) {
      let message = 'Could not send the reset email. Please try again.';
      if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/user-not-found') {
        // Avoid leaking whether an account exists — treat as success.
        setSent(true);
        setIsLoading(false);
        return;
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      }
      Alert.alert('Reset Failed', message);
    } finally {
      setIsLoading(false);
    }
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
              onPress={() => router.back()}
            >
              <Text style={[styles.backArrow, { color: themeColors.text }]}>&#8592;</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Reset Password</Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
              Enter the email linked to your account and we&apos;ll send you a
              link to reset your password.
            </Text>
          </View>

          {sent ? (
            /* Success State */
            <View style={styles.successSection}>
              <Text style={styles.successIcon}>&#9993;</Text>
              <Text style={[styles.successTitle, { color: themeColors.text }]}>Check your email</Text>
              <Text style={[styles.successSubtitle, { color: themeColors.textSecondary }]}>
                If an account exists for {email.trim()}, we&apos;ve sent a
                password reset link. Follow it to set a new password.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Back to Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => setSent(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.resendText}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Form */
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
                  onSubmitEditing={handleSendReset}
                  returnKeyType="send"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={handleSendReset}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footerSection}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>Remember your password? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}>Sign In</Text>
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
    paddingTop: 16,
    paddingBottom: 32,
  },

  // Header
  headerSection: {
    marginBottom: 28,
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
    marginBottom: 20,
  },
  backArrow: {
    fontSize: 20,
    color: '#1a1a1a',
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
    marginTop: 6,
    lineHeight: 20,
  },

  // Form
  formSection: {
    gap: 16,
    marginBottom: 28,
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
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Success State
  successSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  resendButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
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
    color: '#1e3a8a',
  },
});
