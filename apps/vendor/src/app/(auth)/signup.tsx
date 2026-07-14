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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@prayana/shared-hooks';
import { useTheme } from '@prayana/shared-ui';
import { colors } from '../../theme/vendorColors';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@prayana/shared-services';

export default function SignupScreen() {
  const { setUser, setIsAuthenticated } = useAuth();
  const { themeColors } = useTheme();
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    if (!businessName.trim()) {
      Alert.alert('Missing Field', 'Please enter your business name.');
      return false;
    }
    if (!contactName.trim()) {
      Alert.alert('Missing Field', 'Please enter a contact name.');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('Missing Field', 'Please enter your email address.');
      return false;
    }
    if (!phone.trim()) {
      Alert.alert('Missing Field', 'Please enter your phone number.');
      return false;
    }
    if (!password.trim()) {
      Alert.alert('Missing Field', 'Please enter a password.');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Set display name to contact name
      await updateProfile(userCredential.user, {
        displayName: contactName.trim(),
      });

      setUser(userCredential.user);
      setIsAuthenticated(true);

      // Navigate to main app - business onboarding will be handled there
      router.replace('/(tabs)');
    } catch (error: any) {
      // The email is already registered — a dead-end alert here just makes the
      // user retry the same email forever. Send them to sign-in instead.
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert(
          'Account already exists',
          `${email.trim()} is already registered. Sign in instead, or use "Forgot password?" if you don't remember it.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign in',
              onPress: () =>
                router.canGoBack() ? router.back() : router.replace('/(auth)/login'),
            },
          ],
        );
        return;
      }

      let message = 'Registration failed. Please try again.';
      if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak. Use at least 6 characters.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Check your connection and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Wait a moment and try again.';
      } else if (error.code === 'auth/operation-not-allowed') {
        message = 'Email sign-up is disabled for this project.';
      } else if (error.code) {
        message = `Registration failed (${error.code}).`;
      }
      Alert.alert('Registration Failed', message);
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
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={26} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Register Your Business</Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
              Join Prayana Business and start listing your activities
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Business Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                placeholder="e.g., Hampi Adventure Tours"
                placeholderTextColor={themeColors.textTertiary}
                value={businessName}
                onChangeText={setBusinessName}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Contact Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                placeholder="Your full name"
                placeholderTextColor={themeColors.textTertiary}
                value={contactName}
                onChangeText={setContactName}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                placeholder="business@example.com"
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
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Phone</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                placeholder="+91 98765 43210"
                placeholderTextColor={themeColors.textTertiary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Password</Text>
              <View style={[styles.passwordContainer, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border }]}>
                <TextInput
                  style={[styles.passwordInput, { color: themeColors.text }]}
                  placeholder="At least 6 characters"
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

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Confirm Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
                placeholder="Re-enter your password"
                placeholderTextColor={themeColors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.registerButtonText}>Register Business</Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.noteText, { color: themeColors.textTertiary }]}>
              After registration, you'll complete your business onboarding to
              start listing activities.
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footerSection}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>Already registered? </Text>
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
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginBottom: 20,
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
  registerButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  noteText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
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
    color: colors.primary[500],
  },
});
